"""
Email Worker — polls Gmail every N minutes, runs LexAgent pipeline,
sends reply, Slack notification, saves report, flags high-risk.
"""
import os
import asyncio
import logging
from datetime import datetime
from typing import Dict, List

from app.agents.email_agent import fetch_contract_emails, mark_as_read, send_reply
from app.agents.notify_agent import notify_all, build_reply_html
from app.orchestrator import run_pipeline

logger = logging.getLogger("email_worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

POLL_INTERVAL = int(os.getenv("EMAIL_POLL_INTERVAL", "300"))

# Worker state
_state = {
    "running": False,
    "last_poll": None,
    "emails_processed": 0,
    "high_risk_count": 0,
    "errors": [],
    "history": [],   # list of processed email summaries
}


async def process_email(email: Dict):
    subject  = email["subject"]
    sender   = email["sender"]
    gmail_id = email["gmail_message_id"]

    logger.info(f"Processing: '{subject}' from {sender}")

    for attachment in email["attachments"]:
        entry = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "subject": subject,
            "sender": sender,
            "filename": attachment["filename"],
            "score": None,
            "risk_label": None,
            "reply_sent": False,
            "report_file": None,
            "error": None,
        }
        try:
            report = await run_pipeline(
                attachment["data"],
                attachment["content_type"],
                attachment["filename"],
            )

            score = report.get("risk_score", 0)
            entry["score"] = score
            entry["risk_label"] = (
                "High Risk" if score < 40 else
                "Medium Risk" if score < 70 else
                "Low Risk"
            )

            if score < 40:
                _state["high_risk_count"] += 1

            logger.info(f"  Score: {score}/100 — {attachment['filename']}")

            # Reply to sender
            reply_html = build_reply_html(report)
            send_reply(gmail_id, sender, subject, reply_html)
            entry["reply_sent"] = True
            logger.info(f"  ✓ Reply sent to {sender}")

            # Slack + save
            notify_results = await notify_all(report, sender, subject)
            entry["report_file"] = notify_results.get("saved_to")
            logger.info(f"  ✓ Notifications: {notify_results}")

        except Exception as e:
            entry["error"] = str(e)[:120]
            logger.error(f"  ✗ Failed: {e}")
            _state["errors"].append({
                "time": datetime.now().isoformat(),
                "subject": subject,
                "error": str(e),
            })

        _state["history"].insert(0, entry)  # newest first
        if len(_state["history"]) > 50:     # keep last 50
            _state["history"].pop()

    mark_as_read(gmail_id)
    _state["emails_processed"] += 1


async def poll_once():
    _state["last_poll"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info("Polling Gmail for new contract emails...")
    try:
        all_emails = fetch_contract_emails(max_results=1)

        emails = [
            e for e in all_emails
            if not any(skip in e["sender"].lower() for skip in [
                "noreply", "no-reply", "no_reply", "offers.",
                "newsletter", "promo", "marketing", "notification",
            ])
        ]

        logger.info(f"Found {len(all_emails)} email(s), {len(emails)} from real senders")

        for email in emails:
            await process_email(email)
    except Exception as e:
        logger.error(f"Poll failed: {e}")
        _state["errors"].append({"time": datetime.now().isoformat(), "error": str(e)})


async def run_worker():
    _state["running"] = True
    logger.info(f"Email worker started — polling every {POLL_INTERVAL}s")
    while _state["running"]:
        await poll_once()
        await asyncio.sleep(POLL_INTERVAL)
    logger.info("Email worker stopped")


def stop_worker():
    _state["running"] = False


def get_state() -> Dict:
    return dict(_state)
