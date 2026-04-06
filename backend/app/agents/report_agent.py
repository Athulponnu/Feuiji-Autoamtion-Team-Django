"""
Agent 5 — Report Agent
Assembles all agent outputs into the final structured report.
Calculates risk score, generates executive summary, action checklist.
"""
from typing import List, Dict

RISK_WEIGHTS = {"High": 30, "Medium": 10, "Low": 2, "OK": 0}

ACTION_TEMPLATES = {
    "liability": "Redline liability cap to 12-month fees or $50,000 minimum before signing.",
    "ip": "Carve out pre-existing IP and general know-how from the IP assignment clause.",
    "data": "Add a GDPR-compliant Data Processing Agreement (DPA) annex or standalone agreement.",
    "auto_renewal": "Negotiate auto-renewal notice window down to 30 days.",
    "governing_law": "Add a dispute resolution clause with mediation step.",
    "payment": "Review payment terms and late fee structure against your cash flow requirements.",
    "termination": "Review termination triggers and cure periods.",
    "confidentiality": "Verify mutual obligations and duration are acceptable.",
    "sla": "Add SLA with 99.9% uptime commitment and service credits.",
    "audit": "Add right-to-audit clause for security controls.",
    "other": "Review with legal counsel before signing.",
}

RISK_LABEL = {
    "High": {"label": "High Risk", "color": "#ef4444"},
    "Medium": {"label": "Medium Risk", "color": "#f59e0b"},
    "Low": {"label": "Low Risk", "color": "#22c55e"},
    "OK": {"label": "OK", "color": "#6b7280"},
}


def calculate_risk_score(clauses: List[Dict]) -> int:
    """
    Risk score /100: starts at 100 (perfect), deducted by risky clauses.
    100 = no risk, 0 = extreme risk.
    """
    deductions = 0
    for c in clauses:
        level = c.get("flag", {}).get("risk_level", "OK")
        deductions += RISK_WEIGHTS.get(level, 0)
    score = max(0, 100 - deductions)
    return score


def build_action_checklist(clauses: List[Dict]) -> List[Dict]:
    """Build a prioritised action checklist from High → Medium risk clauses."""
    actions = []
    seen_categories = set()
    priority_order = ["High", "Medium"]

    for priority in priority_order:
        for clause in clauses:
            flag = clause.get("flag", {})
            if flag.get("risk_level") != priority:
                continue
            category = flag.get("category", "other")
            if category in seen_categories:
                continue
            seen_categories.add(category)
            action_text = ACTION_TEMPLATES.get(category, ACTION_TEMPLATES["other"])
            redline_reason = clause.get("redline_reason")
            actions.append({
                "priority": priority,
                "category": category,
                "clause_id": clause.get("id"),
                "clause_heading": clause.get("heading", ""),
                "action": action_text,
                "redline_available": clause.get("redline") is not None,
                "redline_reason": redline_reason,
                "is_missing": clause.get("is_missing", False),
            })
    return actions


def build_report(
    original_clauses: List[Dict],
    redlined_clauses: List[Dict],
    filename: str,
) -> dict:
    """Assemble the final report dict."""
    present = [c for c in redlined_clauses if not c.get("is_missing")]
    missing = [c for c in redlined_clauses if c.get("is_missing")]

    risk_counts = {"High": 0, "Medium": 0, "Low": 0, "OK": 0}
    for c in present:
        level = c.get("flag", {}).get("risk_level", "OK")
        risk_counts[level] = risk_counts.get(level, 0) + 1

    risk_score = calculate_risk_score(present)
    action_checklist = build_action_checklist(redlined_clauses)

    # Build clause table
    clause_table = []
    for c in redlined_clauses:
        flag = c.get("flag", {})
        risk_level = flag.get("risk_level", "OK")
        clause_table.append({
            "id": c.get("id"),
            "heading": c.get("heading", ""),
            "type": c.get("type", "other"),
            "risk_level": risk_level,
            "risk_meta": RISK_LABEL.get(risk_level, RISK_LABEL["OK"]),
            "reason": flag.get("reason", ""),
            "confidence": flag.get("confidence", 1.0),
            "escalate_to_human": flag.get("escalate_to_human", False),
            "original_text": c.get("text", ""),
            "redline": c.get("redline"),
            "diff": c.get("diff"),
            "redline_reason": c.get("redline_reason"),
            "regulatory_citation": c.get("regulatory_citation"),
            "regulatory_note": c.get("regulatory_note"),
            "playbook_check": c.get("playbook_check"),
            "is_missing": c.get("is_missing", False),
        })

    # Executive summary
    high_count = risk_counts["High"]
    med_count = risk_counts["Medium"]
    if high_count > 0:
        exec_summary = (
            f"This contract contains {high_count} high-risk clause(s) and "
            f"{med_count} medium-risk clause(s) that require attention before signing. "
            f"Key issues include: "
            + ", ".join(
                c.get("flag", {}).get("reason", "")[:60]
                for c in redlined_clauses
                if c.get("flag", {}).get("risk_level") == "High"
            )[:300]
            + "."
        )
    elif med_count > 0:
        exec_summary = (
            f"This contract is mostly acceptable with {med_count} medium-risk clause(s) to negotiate."
        )
    else:
        exec_summary = (
            "This contract appears low-risk. Review flagged clauses and consult legal counsel if needed."
        )

    return {
        "filename": filename,
        "total_clauses": len(original_clauses),
        "risk_score": risk_score,
        "risk_counts": risk_counts,
        "executive_summary": exec_summary,
        "missing_clauses": [
            {
                "id": m.get("id"),
                "type": m.get("type"),
                "heading": m.get("heading", "").replace("MISSING: ", ""),
                "risk_level": m.get("flag", {}).get("risk_level", "High"),
                "reason": m.get("flag", {}).get("reason", ""),
                "regulatory_citation": m.get("regulatory_citation"),
            }
            for m in missing
        ],
        "clause_table": clause_table,
        "action_checklist": action_checklist,
        "escalated_clauses": [
            c["id"] for c in redlined_clauses if c.get("flag", {}).get("escalate_to_human")
        ],
    }
