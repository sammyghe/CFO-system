"""Money-weighted learning: Thompson sampling over message variants, per segment.

Reward comes from the policy's reward table (cash 100 ... any reply 1).
1 in 5 sends explores. A lesson needs min_sends_per_arm before ADOPT or REJECT.
"""

import random
from dataclasses import dataclass, field


@dataclass
class Arm:
    arm_id: str
    segment: str            # e.g. "T1|US|DIRECT_PUBLIC"
    sends: int = 0
    reward_sum: float = 0.0
    failures: int = 0       # sends that ended NO_REPLY/BOUNCE/COMPLAINT after the full series
    status: str = "TESTING"

    @property
    def mean(self):
        return self.reward_sum / self.sends if self.sends else 0.0


@dataclass
class Learner:
    policy: dict
    arms: dict = field(default_factory=dict)
    rng: random.Random = field(default_factory=random.Random)

    def _max_reward(self):
        return max(self.policy["learning"]["rewards"].values())

    def add_arm(self, arm_id, segment):
        self.arms[(segment, arm_id)] = Arm(arm_id, segment)

    def choose(self, segment) -> str:
        live = [a for (seg, _), a in self.arms.items() if seg == segment and a.status != "RETIRED"]
        if not live:
            raise LookupError(f"no live arms for {segment}")
        if self.rng.random() < self.policy["learning"]["explore_share"]:
            return self.rng.choice(live).arm_id
        # Thompson sampling: rewards scaled to 0..1, Beta posterior on "success mass"
        top = self._max_reward()
        best, best_draw = None, -1.0
        for a in live:
            succ = max(0.0, a.reward_sum) / top
            draw = self.rng.betavariate(1 + succ, 1 + max(0.0, a.sends - succ))
            if draw > best_draw:
                best, best_draw = a, draw
        return best.arm_id

    def record(self, segment, arm_id, outcome: str):
        rewards = self.policy["learning"]["rewards"]
        a = self.arms[(segment, arm_id)]
        a.sends += 1
        a.reward_sum += rewards[outcome]
        if rewards[outcome] <= 0:
            a.failures += 1
        else:
            a.failures = 0
        self._review(segment)

    def _review(self, segment):
        cfg = self.policy["learning"]
        arms = [a for (seg, _), a in self.arms.items() if seg == segment]
        for a in arms:
            if a.status == "TESTING" and a.failures >= cfg["retire_after_failures"] and a.reward_sum <= 0:
                a.status = "RETIRED"
        mature = [a for a in arms if a.sends >= cfg["min_sends_per_arm"] and a.status != "RETIRED"]
        if len(mature) >= 2:
            best = max(mature, key=lambda a: a.mean)
            for a in mature:
                a.status = "ADOPT" if a is best else "REJECT"

    def lesson_status(self, segment) -> str:
        arms = [a for (seg, _), a in self.arms.items() if seg == segment]
        if any(a.status == "ADOPT" for a in arms):
            return "ADOPT"
        if sum(a.sends for a in arms) == 0:
            return "HYPOTHESIS"
        if all(a.sends < self.policy["learning"]["min_sends_per_arm"] for a in arms):
            return "INSUFFICIENT_DATA" if any(a.status == "RETIRED" for a in arms) else "TESTING"
        return "TESTING"
