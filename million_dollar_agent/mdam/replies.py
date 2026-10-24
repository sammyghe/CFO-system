"""Reply classifier, rule-based baseline.

The model classifier must beat this on the eval set before it replaces it.
Order matters: safety classes are checked first.
"""

import re
from dataclasses import dataclass

RULES = [
    ("INSTRUCTION_INJECTION", r"ignore (all |your )?(previous|prior) instructions|disregard your rules|system prompt"),
    ("OPT_OUT", r"\bunsubscribe\b|do not (contact|email|write)|don'?t (contact|email|write)|remove me|stop emailing|^\s*no\.?\s*$"),
    ("COMPLAINT", r"\bspam\b|harass|report(ed|ing)? (you|this)"),
    ("BANK_DETAILS", r"bank details|account number|wire (instructions|details)|swift|iban"),
    ("AUTO_REPLY", r"out of (the )?office|automatic reply|auto-?reply|ticket (number|#)|we have received your (email|message)|delivery status notification"),
    ("BOUNCE", r"address not found|undeliverable|550[ -]|mailbox unavailable|delivery has failed"),
    ("DECLINE", r"not (a fit|interested|able to (help|invest|support))|we (do not|don'?t) (invest|fund|make)|pass on this|decline|unable to consider"),
    ("DILIGENCE", r"financials|financial statements|deck|data room|business plan|projections|due diligence|cap table|audited"),
    ("TERMS", r"valuation|term sheet|equity stake|interest rate|repayment|convertible"),
    ("MEETING_REQUEST", r"(set up|schedule|book|arrange|have) a (call|meeting|chat)|let'?s (talk|speak|meet)|available (to|for) (a )?(call|meet)|calendly"),
    ("REFERRAL", r"(speak|talk|reach out|write) to (my|our)|cc'?ing|copying (in )?my|right person (is|would be)|forward(ed|ing) (this|your)"),
    ("LATER", r"not (right )?now|come back|reach out (again )?(in|after|when)|next (year|quarter)|after (you|your)|once you"),
    ("INTEREST", r"interest(ed|ing)|tell me more|sounds (good|great|compelling)|happy to (look|learn)|send (me )?(the|your) one-?page"),
]

ESCALATE = {"INSTRUCTION_INJECTION", "BANK_DETAILS", "DILIGENCE", "TERMS", "MEETING_REQUEST", "INTEREST"}
SUPPRESS = {"OPT_OUT", "COMPLAINT", "DECLINE"}


@dataclass
class Classified:
    label: str
    escalate: bool
    suppress: bool
    human: bool


def classify(text: str) -> Classified:
    t = text.lower()
    label = "HUMAN_OTHER"
    for name, pattern in RULES:
        if re.search(pattern, t, re.MULTILINE):
            label = name
            break
    return Classified(
        label=label,
        escalate=label in ESCALATE,
        suppress=label in SUPPRESS,
        human=label not in {"AUTO_REPLY", "BOUNCE"},
    )
