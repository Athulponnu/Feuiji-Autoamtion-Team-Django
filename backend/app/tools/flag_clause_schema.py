"""
Claude tool-use schema for the flag_clause tool (Agent 2).
"""

FLAG_CLAUSE_TOOL = {
    "name": "flag_clause",
    "description": "Assess a contract clause for risk and return a structured risk assessment.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clause_id": {
                "type": "string",
                "description": "The ID of the clause being assessed.",
            },
            "risk_level": {
                "type": "string",
                "enum": ["High", "Medium", "Low", "OK"],
                "description": "Overall risk level: High = must fix before signing, Medium = negotiate, Low = minor, OK = acceptable.",
            },
            "category": {
                "type": "string",
                "enum": [
                    "liability",
                    "ip",
                    "payment",
                    "termination",
                    "confidentiality",
                    "data",
                    "governing_law",
                    "auto_renewal",
                    "sla",
                    "audit",
                    "other",
                ],
                "description": "Clause category.",
            },
            "reason": {
                "type": "string",
                "maxLength": 200,
                "description": "Plain-English explanation of the risk. Be specific and concise.",
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence score (0-1). Below 0.7 triggers human escalation.",
            },
            "escalate_to_human": {
                "type": "boolean",
                "description": "Set true if confidence < 0.7 or the clause is unusually complex.",
            },
        },
        "required": ["clause_id", "risk_level", "category", "reason", "confidence"],
    },
}
