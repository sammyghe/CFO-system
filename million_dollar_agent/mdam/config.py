from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def load_policy(path=None):
    with open(path or CONFIG_DIR / "campaign_policy.yaml") as f:
        return yaml.safe_load(f)


def load_claims(path=None):
    with open(path or CONFIG_DIR / "claims.yaml") as f:
        return yaml.safe_load(f)
