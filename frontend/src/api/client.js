const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Stream a file upload through the pipeline via SSE.
 * Calls onStage({ stage, label, progress }) for each agent update.
 * Calls onDone(report) with the final report object.
 * Calls onError(message) on any failure.
 */
export async function reviewFileStream(file, { onStage, onDone, onError }) {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/review/stream`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    onError("Cannot reach the backend. Is it running on port 8000?");
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    onError(err.detail || "Upload failed");
    return;
  }

  await consumeSSE(response, { onStage, onDone, onError });
}

/**
 * Stream pasted contract text through the pipeline via SSE.
 */
export async function reviewTextStream(text, { onStage, onDone, onError }) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/review/text/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    onError("Cannot reach the backend. Is it running on port 8000?");
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    onError(err.detail || "Review failed");
    return;
  }

  await consumeSSE(response, { onStage, onDone, onError });
}

/**
 * Read an SSE stream from a fetch Response and dispatch typed events.
 */
async function consumeSSE(response, { onStage, onDone, onError }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newline
      const messages = buffer.split("\n\n");
      buffer = messages.pop(); // keep any incomplete trailing chunk

      for (const msg of messages) {
        if (!msg.trim()) continue;

        const eventMatch = msg.match(/^event:\s*(.+)$/m);
        const dataMatch  = msg.match(/^data:\s*(.+)$/ms);
        if (!eventMatch || !dataMatch) continue;

        const eventType = eventMatch[1].trim();
        let data;
        try {
          data = JSON.parse(dataMatch[1].trim());
        } catch {
          continue;
        }

        if (eventType === "stage")      onStage(data);
        else if (eventType === "done")  onDone(data.report);
        else if (eventType === "error") onError(data.message);
      }
    }
  } catch (err) {
    onError("Stream interrupted: " + err.message);
  }
}

// ── Non-streaming fallbacks (kept for curl / tests) ──────────────────────────

export async function reviewFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/review`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Review failed");
  }
  return res.json();
}

export async function reviewText(text) {
  const res = await fetch(`${BASE_URL}/api/review/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Review failed");
  }
  return res.json();
}
