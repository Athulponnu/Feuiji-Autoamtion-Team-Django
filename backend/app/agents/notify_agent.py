"""
Notify Agent — sends Slack notifications, alert emails, and saves reports to disk.
"""
import os
import json
import smtplib
import datetime
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict

import httpx

SLACK_WEBHOOK_URL  = os.getenv("SLACK_WEBHOOK_URL", "")
ALERT_EMAIL        = os.getenv("ALERT_EMAIL", "")        # high-risk forward-to address
SMTP_HOST          = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT          = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER          = os.getenv("SMTP_USER", "")          # your Gmail address
SMTP_PASSWORD      = os.getenv("SMTP_PASSWORD", "")      # Gmail app password
REPORTS_DIR        = Path(os.getenv("REPORTS_DIR", "reports"))
HIGH_RISK_THRESHOLD = int(os.getenv("HIGH_RISK_THRESHOLD", "40"))

REPORTS_DIR.mkdir(exist_ok=True)


# ── Risk helpers ─────────────────────────────────────────────────────────────

def risk_emoji(score: int) -> str:
    if score >= 70: return "✅"
    if score >= 40: return "⚠️"
    return "🚨"

def risk_label(score: int) -> str:
    if score >= 70: return "Low Risk"
    if score >= 40: return "Medium Risk"
    return "HIGH RISK"


# ── 1. Save report to disk ────────────────────────────────────────────────────

def save_report(report: Dict, sender: str, subject: str) -> Path:
    """Save JSON report to the reports/ directory. Returns the file path."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_subject = "".join(c if c.isalnum() else "_" for c in subject)[:40]
    filename = REPORTS_DIR / f"{timestamp}_{safe_subject}.json"

    payload = {
        "saved_at": datetime.datetime.now().isoformat(),
        "sender": sender,
        "subject": subject,
        "report": report,
    }
    filename.write_text(json.dumps(payload, indent=2))
    return filename


# ── 2. Slack notification ─────────────────────────────────────────────────────

async def send_slack_notification(report: Dict, sender: str, subject: str):
    """Post a contract review summary to Slack via webhook."""
    if not SLACK_WEBHOOK_URL:
        return

    score = report.get("risk_score", 0)
    high  = report.get("risk_counts", {}).get("High", 0)
    med   = report.get("risk_counts", {}).get("Medium", 0)
    missing = len(report.get("missing_clauses", []))
    summary = report.get("executive_summary", "")

    # Build action list (top 3)
    actions = report.get("action_checklist", [])[:3]
    action_lines = "\n".join(
        f"  {i+1}. [{a['priority']}] {a['action']}"
        for i, a in enumerate(actions)
    )

    text = (
        f"{risk_emoji(score)} *Contract Review Complete* — {risk_label(score)}\n"
        f"*From:* {sender}\n"
        f"*Subject:* {subject}\n"
        f"*Risk Score:* {score}/100  |  🔴 {high} high  ⚠️ {med} medium  📋 {missing} missing\n\n"
        f"*Summary:* {summary}\n\n"
        f"*Top Actions:*\n{action_lines or '  None required.'}"
    )

    async with httpx.AsyncClient() as client:
        await client.post(SLACK_WEBHOOK_URL, json={"text": text}, timeout=10)


# ── 3. Reply email HTML ───────────────────────────────────────────────────────

def build_reply_html(report: Dict) -> str:
    """Build an HTML email body summarising the contract review."""
    score   = report.get("risk_score", 0)
    high    = report.get("risk_counts", {}).get("High", 0)
    med     = report.get("risk_counts", {}).get("Medium", 0)
    low     = report.get("risk_counts", {}).get("Low", 0)
    summary = report.get("executive_summary", "")
    missing = report.get("missing_clauses", [])
    actions = report.get("action_checklist", [])

    score_color = "#22c55e" if score >= 70 else "#f59e0b" if score >= 40 else "#ef4444"

    rows = ""
    for c in report.get("clause_table", []):
        if c.get("is_missing") or c.get("risk_level") in ("High", "Medium"):
            color = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#22c55e", "OK": "#6b7280"}.get(c["risk_level"], "#6b7280")
            rows += (
                f"<tr>"
                f"<td style='padding:8px;border-bottom:1px solid #eee'>{c['heading']}</td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee;color:{color};font-weight:600'>{c['risk_level']}</td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee;color:#555'>{c['reason']}</td>"
                f"</tr>"
            )

    missing_rows = "".join(
        f"<li style='margin:4px 0;color:#ef4444'><strong>{m['heading']}</strong> — {m['reason']}</li>"
        for m in missing
    )

    action_rows = "".join(
        f"<li style='margin:6px 0'><span style='color:{'#ef4444' if a['priority']=='High' else '#f59e0b'};font-weight:600'>[{a['priority']}]</span> {a['action']}</li>"
        for a in actions
    )

    return f"""
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px">
  <h2 style="color:#0f172a">⚖ LexAgent Contract Review</h2>

  <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:16px 0;display:flex;align-items:center;gap:24px">
    <div style="text-align:center">
      <div style="font-size:48px;font-weight:700;color:{score_color}">{score}</div>
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Risk Score / 100</div>
    </div>
    <div>
      <div style="color:#ef4444">🔴 {high} High Risk</div>
      <div style="color:#f59e0b">⚠️ {med} Medium Risk</div>
      <div style="color:#22c55e">✅ {low} Low / OK</div>
    </div>
  </div>

  <p style="color:#334155">{summary}</p>

  {"<h3>⚠ Missing Clauses</h3><ul>" + missing_rows + "</ul>" if missing else ""}

  <h3>Clause Breakdown</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f1f5f9">
      <th style="padding:8px;text-align:left">Clause</th>
      <th style="padding:8px;text-align:left">Risk</th>
      <th style="padding:8px;text-align:left">Issue</th>
    </tr>
    {rows or "<tr><td colspan='3' style='padding:8px;color:#94a3b8'>No high/medium risk clauses found.</td></tr>"}
  </table>

  {"<h3>Action Plan</h3><ol>" + action_rows + "</ol>" if actions else ""}

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="color:#94a3b8;font-size:12px">Reviewed by LexAgent · AI-powered contract analysis · This is not legal advice.</p>
</div>
"""


# ── 4. Flag high-risk via email ───────────────────────────────────────────────

def send_alert_email(report: Dict, original_sender: str, subject: str, report_path: Path):
    """Forward high-risk contract alert to the configured alert email address."""
    if not ALERT_EMAIL or not SMTP_USER or not SMTP_PASSWORD:
        return

    score = report.get("risk_score", 0)
    if score >= HIGH_RISK_THRESHOLD:
        return  # not high risk enough

    msg = MIMEMultipart("mixed")
    msg["From"]    = SMTP_USER
    msg["To"]      = ALERT_EMAIL
    msg["Subject"] = f"🚨 HIGH RISK Contract Alert: {subject}"

    html = f"""
    <div style="font-family:Arial,sans-serif;padding:24px">
      <h2 style="color:#ef4444">🚨 High-Risk Contract Detected</h2>
      <p><strong>From:</strong> {original_sender}</p>
      <p><strong>Subject:</strong> {subject}</p>
      <p><strong>Risk Score:</strong> <span style="color:#ef4444;font-weight:700">{score}/100</span></p>
      <p>This contract has been flagged as high-risk by LexAgent. Full report attached.</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    # Attach the JSON report
    with open(report_path, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={report_path.name}")
        msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


# ── Main notify function ──────────────────────────────────────────────────────

async def notify_all(report: Dict, sender: str, subject: str) -> Dict:
    """Run all notification actions and return a summary."""
    results = {}

    # 1. Save report
    try:
        path = save_report(report, sender, subject)
        results["saved_to"] = str(path)
    except Exception as e:
        results["save_error"] = str(e)

    # 2. Slack
    try:
        await send_slack_notification(report, sender, subject)
        results["slack"] = "sent" if SLACK_WEBHOOK_URL else "skipped (no webhook)"
    except Exception as e:
        results["slack_error"] = str(e)

    # 3. Alert email for high-risk
    try:
        score = report.get("risk_score", 100)
        if score < HIGH_RISK_THRESHOLD and ALERT_EMAIL:
            report_path = Path(results.get("saved_to", "report.json"))
            send_alert_email(report, sender, subject, report_path)
            results["alert_email"] = f"sent to {ALERT_EMAIL}"
        else:
            results["alert_email"] = "skipped (not high risk or no alert email configured)"
    except Exception as e:
        results["alert_email_error"] = str(e)

    return results
