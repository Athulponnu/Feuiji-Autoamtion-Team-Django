"""
Agent 3 — Compare Agent
Cross-checks flagged clauses against the company playbook and jurisdiction rules (GDPR).
Adds regulatory citations and playbook violations.
"""
import json
import os
from typing import List, Dict

RULES_DIR = os.path.join(os.path.dirname(__file__), "..", "rules")


def load_json(filename: str) -> dict:
    path = os.path.join(RULES_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


def compare_clauses(flagged_clauses: List[Dict]) -> List[Dict]:
    """
    Enrich each flagged clause with:
    - playbook_violation: bool + note
    - regulatory_citation: string or None
    """
    try:
        playbook = load_json("playbook.json")
    except FileNotFoundError:
        playbook = {}

    try:
        gdpr_rules = load_json("gdpr.json")
    except FileNotFoundError:
        gdpr_rules = {}

    # Check which GDPR-required clause types are present
    present_types = {c["type"] for c in flagged_clauses}
    gdpr_required = gdpr_rules.get("required_clause_types", [])
    missing_types = [r for r in gdpr_required if r["type"] not in present_types]

    compared = []
    for clause in flagged_clauses:
        enriched = dict(clause)
        flag = clause.get("flag", {})
        category = flag.get("category", clause.get("type", "other"))

        # Check playbook
        playbook_entry = playbook.get(category)
        violation = None
        if playbook_entry:
            # Simple heuristic: if risk is High or Medium and playbook has a standard, flag it
            if flag.get("risk_level") in ("High", "Medium"):
                violation = {
                    "violated": True,
                    "standard": playbook_entry.get("standard", ""),
                    "acceptable_range": playbook_entry.get("acceptable_range", ""),
                }
            else:
                violation = {"violated": False, "standard": playbook_entry.get("standard", "")}
        else:
            violation = {"violated": False, "standard": ""}

        enriched["playbook_check"] = violation

        # Check GDPR
        gdpr_entry = gdpr_rules.get("clause_rules", {}).get(category)
        if gdpr_entry and flag.get("risk_level") in ("High", "Medium"):
            enriched["regulatory_citation"] = gdpr_entry.get("citation", "")
            enriched["regulatory_note"] = gdpr_entry.get("note", "")
        else:
            enriched["regulatory_citation"] = None
            enriched["regulatory_note"] = None

        compared.append(enriched)

    # Attach missing clause information as metadata on first clause (or separate list)
    # We'll return it as a special sentinel item
    for mt in missing_types:
        compared.append({
            "id": f"missing_{mt['type']}",
            "heading": f"MISSING: {mt['label']}",
            "text": "",
            "type": mt["type"],
            "index": -1,
            "flag": {
                "clause_id": f"missing_{mt['type']}",
                "risk_level": mt["risk_level"],
                "category": mt["type"],
                "reason": mt["reason"],
                "confidence": 1.0,
                "escalate_to_human": False,
            },
            "playbook_check": {"violated": True, "standard": mt.get("standard", ""), "acceptable_range": ""},
            "regulatory_citation": mt.get("citation", None),
            "regulatory_note": mt.get("note", None),
            "is_missing": True,
        })

    return compared
