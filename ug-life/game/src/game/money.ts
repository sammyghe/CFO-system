// Money the server confirms first: top-ups, event rewards, billboard rentals.
// Each is posted once (ledger keys are unique) and checked again by validate.ts.

import { post } from "./ledger";
import type { Result } from "./actions";
import type { PlayerState } from "./state";

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export function claimTopUp(state: PlayerState, ref: string, credit: number, now: number): Result | null {
  const r = post(state.ledger, `topup:${ref}`, credit, "Mobile money top-up", now);
  return r.ok ? ok(`Top-up received: UGX ${credit.toLocaleString()} game shillings. Webale!`) : null;
}

export function claimEvent(state: PlayerState, eventId: string, reward: number, title: string, now: number): Result | null {
  if (reward <= 0) return null;
  const r = post(state.ledger, `event:${eventId}`, reward, `Event: ${title}`, now);
  return r.ok ? ok(`You came to ${title}! +UGX ${reward.toLocaleString()}`) : null;
}

export function payBillboard(state: PlayerState, slot: string, day: string, price: number, now: number): Result {
  const r = post(state.ledger, `billboard:${slot}:${day}`, -price, "Billboard rental", now);
  if (!r.ok) return fail(r.error === "insufficient" ? `That costs UGX ${price.toLocaleString()}.` : "Already paid.");
  return ok("Your billboard is up. Everyone on the street can see it!");
}
