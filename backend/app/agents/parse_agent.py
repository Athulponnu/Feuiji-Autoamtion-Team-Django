"""
Agent 1 — Parse Agent
Accepts PDF, DOCX, or plain text. Splits into numbered, typed clauses.
"""
import io
import re
from typing import List, Dict

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

try:
    from docx import Document
except ImportError:
    Document = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None


CLAUSE_TYPE_KEYWORDS = {
    "liability": ["liability", "liable", "indemnif", "limitation of liability", "damages"],
    "ip": ["intellectual property", "ip", "ownership", "proprietary", "work for hire", "invention", "patent", "copyright"],
    "payment": ["payment", "invoice", "fee", "price", "billing", "net-30", "net 30", "subscription"],
    "termination": ["terminat", "cancel", "expir", "end of term"],
    "confidentiality": ["confidential", "non-disclosure", "nda", "proprietary information"],
    "data": ["data processing", "personal data", "gdpr", "dpa", "data protection", "privacy"],
    "governing_law": ["governing law", "jurisdiction", "dispute", "arbitration", "mediation"],
    "auto_renewal": ["auto-renew", "automatic renewal", "renews automatically", "renew automatically", "renewal notice", "automatically renew", "auto renewal", "successive"],
    "sla": ["uptime", "availability", "service level", "sla", "credit", "downtime"],
    "audit": ["audit", "inspection", "right to audit"],
}


def detect_clause_type(text: str) -> str:
    text_lower = text.lower()
    for clause_type, keywords in CLAUSE_TYPE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return clause_type
    return "other"


def extract_text_from_pdf(content: bytes) -> str:
    if PyPDF2 is None:
        raise RuntimeError("PyPDF2 not installed")
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n".join(pages)


def extract_text_from_docx(content: bytes) -> str:
    if Document is None:
        raise RuntimeError("python-docx not installed")
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text(content: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        text = extract_text_from_pdf(content)
        if len(text.strip()) < 50 and pytesseract:
            # Fallback OCR path (scanned PDF) — simplified
            return text
        return text
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_text_from_docx(content)
    else:
        return content.decode("utf-8", errors="replace")


def split_into_clauses(text: str) -> List[Dict]:
    """
    Split contract text into clauses using heading detection (regex) and
    paragraph-level fallback. Each clause gets an id, raw text, and type label.
    """
    # Pattern: numbered headings like "1.", "1.1", "Section 1", "CLAUSE 1"
    heading_pattern = re.compile(
        r"(?:^|\n)(\d+(?:\.\d+)*[\.\)]\s+[A-Z][^\n]{2,}|(?:Section|Clause|Article)\s+\d+[^\n]*)",
        re.MULTILINE | re.IGNORECASE,
    )

    matches = list(heading_pattern.finditer(text))
    clauses = []

    if len(matches) >= 3:
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            clause_text = text[start:end].strip()
            if len(clause_text) < 20:
                continue
            heading = match.group(0).strip()
            clause_id = f"clause_{i + 1}"
            clauses.append(
                {
                    "id": clause_id,
                    "heading": heading,
                    "text": clause_text,
                    "type": detect_clause_type(clause_text),
                    "index": i + 1,
                }
            )
    else:
        # Fallback: split by double newlines (paragraphs)
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if len(p.strip()) > 40]
        for i, para in enumerate(paragraphs):
            clauses.append(
                {
                    "id": f"clause_{i + 1}",
                    "heading": f"Paragraph {i + 1}",
                    "text": para,
                    "type": detect_clause_type(para),
                    "index": i + 1,
                }
            )

    return clauses


def parse_contract(content: bytes, content_type: str) -> List[Dict]:
    """Entry point for Agent 1."""
    raw_text = extract_text(content, content_type)
    clauses = split_into_clauses(raw_text)
    return clauses
