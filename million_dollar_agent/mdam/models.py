from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class RouteClass(str, Enum):
    DIRECT_PUBLIC = "DIRECT_PUBLIC"
    OFFICE_PUBLIC = "OFFICE_PUBLIC"
    INTRODUCTION = "INTRODUCTION"
    FORM = "FORM"
    UNVERIFIED = "UNVERIFIED"
    BOUNCED = "BOUNCED"
    SUPPRESSED = "SUPPRESSED"


class Queue(str, Enum):
    ASK = "ASK"
    RESEARCH_MORE = "RESEARCH_MORE"
    HOLD = "HOLD"


@dataclass
class Evidence:
    claim: str
    url: str
    accessed_on: date
    confidence: str = "MEDIUM"
    is_inference: bool = False


@dataclass
class ContactRoute:
    address: str
    route_class: RouteClass
    source_url: str | None = None
    addressed_to: str | None = None


@dataclass
class Target:
    target_id: str
    full_name: str
    tier: str
    region_lane: str
    organisation: str | None = None
    narrative: str = "B"                      # B = Builder, I = Impact
    preferred_language: str = "en"
    lane: str = "USD1M"
    # 0..1 ratings per scoring dimension, filled by the dossier agent and checked by code
    ratings: dict = field(default_factory=dict)
    personal_hook: Evidence | None = None
    route: ContactRoute | None = None
    evidence: list = field(default_factory=list)


@dataclass
class Draft:
    target_id: str
    template_id: str
    subject: str
    body: str
    claim_ids: list
    arm_id: str | None = None

    @property
    def idempotency_key(self):
        return f"{self.target_id}:{self.template_id}:{self.subject}"
