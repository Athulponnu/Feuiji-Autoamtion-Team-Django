const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// ── Contract review (SSE streaming) ─────────────────────────────────────────

export async function reviewFileStream(file, { onStage, onDone, onError }) {
  const formData = new FormData();
  formData.append("file", file);
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/review/stream`, { method: "POST", body: formData });
  } catch (err) {
    onError("Cannot reach the backend. Is it running on port 8000?"); return;
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    onError(err.detail || "Upload failed"); return;
  }
  await consumeSSE(response, { onStage, onDone, onError });
}

export async function reviewTextStream(text, { onStage, onDone, onError }) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/review/text/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    onError("Cannot reach the backend. Is it running on port 8000?"); return;
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    onError(err.detail || "Review failed"); return;
  }
  await consumeSSE(response, { onStage, onDone, onError });
}

async function consumeSSE(response, { onStage, onDone, onError }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop();
      for (const msg of messages) {
        if (!msg.trim()) continue;
        const eventMatch = msg.match(/^event:\s*(.+)$/m);
        const dataMatch  = msg.match(/^data:\s*(.+)$/ms);
        if (!eventMatch || !dataMatch) continue;
        const eventType = eventMatch[1].trim();
        let data;
        try { data = JSON.parse(dataMatch[1].trim()); } catch { continue; }
        if (eventType === "stage")      onStage(data);
        else if (eventType === "done")  onDone(data.report);
        else if (eventType === "error") onError(data.message);
      }
    }
  } catch (err) {
    onError("Stream interrupted: " + err.message);
  }
}

// ── Email agent API ──────────────────────────────────────────────────────────

export async function getEmailStatus() {
  const res = await fetch(`${BASE_URL}/api/email/status`);
  return res.json();
}

export async function startEmailWorker() {
  const res = await fetch(`${BASE_URL}/api/email/start`, { method: "POST" });
  return res.json();
}

export async function stopEmailWorker() {
  const res = await fetch(`${BASE_URL}/api/email/stop`, { method: "POST" });
  return res.json();
}

export async function pollEmailNow() {
  const res = await fetch(`${BASE_URL}/api/email/poll`, { method: "POST" });
  return res.json();
}

// ── Non-streaming fallbacks ──────────────────────────────────────────────────

export async function reviewFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/review`, { method: "POST", body: formData });
  if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(err.detail || "Review failed"); }
  return res.json();
}

export async function reviewText(text) {
  const res = await fetch(`${BASE_URL}/api/review/text`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(err.detail || "Review failed"); }
  return res.json();
}
