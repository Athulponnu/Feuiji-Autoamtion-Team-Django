"""
Email Worker — polls Gmail every N minutes, runs LexAgent pipeline,
sends reply, Slack notification, saves report, flags high-risk.
"""
import os
import asyncio
import logging
from datetime import datetime
from typing import Dict

from app.agents.email_agent import (
    fetch_contract_emails,
    mark_as_read,
    send_reply,
)
from app.agents.notify_agent import notify_all, build_reply_html
from app.orchestrator import run_pipeline

logger = logging.getLogger("email_worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

POLL_INTERVAL = int(os.getenv("EMAIL_POLL_INTERVAL", "300"))  # seconds (default 5 min)

# Worker state — checked by /email/status endpoint
_state = {
    "running": False,
    "last_poll": None,
    "emails_processed": 0,
    "errors": [],
}


async def process_email(email: Dict):
    """Run full pipeline on one email's contract attachment."""
    subject  = email["subject"]
    sender   = email["sender"]
    gmail_id = email["gmail_message_id"]

    logger.info(f"Processing: '{subject}' from {sender}")

    for attachment in email["attachments"]:
        try:
            # Run 5-agent pipeline
            report = await run_pipeline(
                attachment["data"],
                attachment["content_type"],
                attachment["filename"],
            )

            score = report.get("risk_score", 0)
            logger.info(f"  Score: {score}/100 — {attachment['filename']}")

            # 1. Reply to sender
            reply_html = build_reply_html(report)
            send_reply(gmail_id, sender, subject, reply_html)
            logger.info(f"  ✓ Reply sent to {sender}")

            # 2. Slack + save report + alert email
            notify_results = await notify_all(report, sender, subject)
            logger.info(f"  ✓ Notifications: {notify_results}")

        except Exception as e:
            logger.error(f"  ✗ Failed on {attachment['filename']}: {e}")
            _state["errors"].append({
                "time": datetime.now().isoformat(),
                "subject": subject,
                "error": str(e),
            })

    # Mark email as read regardless of attachment processing result
    mark_as_read(gmail_id)


async def poll_once():
    """Single poll cycle — fetch emails and process each one."""
    _state["last_poll"] = datetime.now().isoformat()
    logger.info("Polling Gmail for new contract emails...")

    try:
        emails = fetch_contract_emails(max_results=3)
        logger.info(f"Found {len(emails)} unread email(s) with attachments")

        for email in emails:
            await process_email(email)
            _state["emails_processed"] += 1

    except Exception as e:
        logger.error(f"Poll failed: {e}")
        _state["errors"].append({
            "time": datetime.now().isoformat(),
            "error": str(e),
        })


async def run_worker():
    """Continuous polling loop."""
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
