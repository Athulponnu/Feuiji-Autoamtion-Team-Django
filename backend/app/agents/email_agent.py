"""
Email Agent — fetches unread Gmail emails with contract attachments,
downloads the attachment, and returns it ready for the LexAgent pipeline.
"""
import os
import base64
import json
from typing import List, Dict, Optional
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",  # read + mark as read
    "https://www.googleapis.com/auth/gmail.send",    # reply
]

CREDENTIALS_FILE = os.getenv("GMAIL_CREDENTIALS_FILE", "gmail_credentials.json")
TOKEN_FILE = os.getenv("GMAIL_TOKEN_FILE", "gmail_token.json")

CONTRACT_EXTENSIONS = {".pdf", ".docx", ".txt"}
CONTRACT_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None

    if Path(TOKEN_FILE).exists():
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def extract_attachment(service, message_id: str, part: dict) -> Optional[Dict]:
    """Download a single attachment from a Gmail message part."""
    filename = part.get("filename", "")
    mime_type = part.get("mimeType", "")
    ext = Path(filename).suffix.lower()

    if ext not in CONTRACT_EXTENSIONS and mime_type not in CONTRACT_MIME_TYPES:
        return None

    body = part.get("body", {})
    attachment_id = body.get("attachmentId")

    if attachment_id:
        att = service.users().messages().attachments().get(
            userId="me", messageId=message_id, id=attachment_id
        ).execute()
        data = base64.urlsafe_b64decode(att["data"])
    elif body.get("data"):
        data = base64.urlsafe_b64decode(body["data"])
    else:
        return None

    # Normalise MIME type from extension if needed
    if mime_type not in CONTRACT_MIME_TYPES:
        mime_map = {
            ".pdf":  "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt":  "text/plain",
        }
        mime_type = mime_map.get(ext, "text/plain")

    return {
        "filename": filename,
        "content_type": mime_type,
        "data": data,
    }


def get_email_body(payload: dict) -> str:
    """Recursively extract plain-text body from email payload."""
    mime = payload.get("mimeType", "")
    body = payload.get("body", {})

    if mime == "text/plain" and body.get("data"):
        return base64.urlsafe_b64decode(body["data"]).decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        result = get_email_body(part)
        if result:
            return result
    return ""


def collect_parts(payload: dict) -> List[dict]:
    """Flatten all MIME parts recursively."""
    parts = []
    if payload.get("mimeType", "").startswith("multipart"):
        for part in payload.get("parts", []):
            parts.extend(collect_parts(part))
    else:
        parts.append(payload)
    return parts


def fetch_contract_emails(max_results: int = 10) -> List[Dict]:
    """
    Fetch unread Gmail messages that have contract attachments.
    Returns list of dicts with email metadata + attachment bytes.
    """
    service = get_gmail_service()

    results = service.users().messages().list(
        userId="me",
        q="is:unread has:attachment",
        maxResults=max_results,
    ).execute()

    messages = results.get("messages", [])
    contracts = []

    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me", id=msg_ref["id"], format="full"
        ).execute()

        payload = msg["payload"]
        headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}

        subject  = headers.get("subject", "(no subject)")
        sender   = headers.get("from", "unknown")
        msg_id   = headers.get("message-id", "")
        date     = headers.get("date", "")
        body     = get_email_body(payload)

        # Find contract attachments
        all_parts = collect_parts(payload)
        attachments = []
        for part in all_parts:
            att = extract_attachment(service, msg_ref["id"], part)
            if att:
                attachments.append(att)

        if not attachments:
            continue  # skip emails without contract attachments

        contracts.append({
            "gmail_message_id": msg_ref["id"],
            "message_id": msg_id,
            "subject": subject,
            "sender": sender,
            "date": date,
            "body": body,
            "attachments": attachments,
        })

    return contracts


def mark_as_read(gmail_message_id: str):
    """Remove UNREAD label from a Gmail message."""
    service = get_gmail_service()
    service.users().messages().modify(
        userId="me",
        id=gmail_message_id,
        body={"removeLabelIds": ["UNREAD"]},
    ).execute()


def send_reply(gmail_message_id: str, sender: str, subject: str, body_html: str):
    """Send an HTML reply to the original email sender."""
    service = get_gmail_service()

    # Get thread ID
    msg = service.users().messages().get(
        userId="me", id=gmail_message_id, format="metadata"
    ).execute()
    thread_id = msg.get("threadId", "")

    raw_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"

    message_body = (
        f"From: me\r\n"
        f"To: {sender}\r\n"
        f"Subject: {raw_subject}\r\n"
        f"Content-Type: text/html; charset=utf-8\r\n\r\n"
        f"{body_html}"
    )
    encoded = base64.urlsafe_b64encode(message_body.encode()).decode()

    service.users().messages().send(
        userId="me",
        body={"raw": encoded, "threadId": thread_id},
    ).execute()
