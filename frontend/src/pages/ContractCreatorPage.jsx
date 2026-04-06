import React, { useState, useRef } from "react";

const CONTRACT_TYPES = [
  { key: "saas",       label: "SaaS Agreement",           icon: "☁" },
  { key: "nda",        label: "NDA / Confidentiality",     icon: "🔒" },
  { key: "freelance",  label: "Freelance Service",         icon: "✍" },
  { key: "vendor",     label: "Vendor Agreement",          icon: "🤝" },
  { key: "employment", label: "Employment Contract",       icon: "👔" },
];

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function streamContractCreation(contractType, description, { onStage, onDone, onError }) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/contract/create/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_type: contractType, description }),
    });
  } catch (err) {
    onError("Cannot reach backend."); return;
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    onError(err.detail || "Failed"); return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
      else if (eventType === "done")  onDone(data);
      else if (eventType === "error") onError(data.message);
    }
  }
}

async function sendToEmailReview(contractText, filename) {
  const blob = new Blob([contractText], { type: "text/plain" });
  const file = new File([blob], filename, { type: "text/plain" });
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/review/stream`, { method: "POST", body: formData });
  return res;
}

export default function ContractCreatorPage({ onBack, onReview }) {
  const [selectedType, setSelectedType] = useState("saas");
  const [description, setDescription]   = useState("");
  const [status, setStatus]             = useState("idle"); // idle | generating | done | error
  const [stageLabel, setStageLabel]     = useState("");
  const [progress, setProgress]         = useState(0);
  const [contract, setContract]         = useState(null);
  const [contractLabel, setContractLabel] = useState("");
  const [error, setError]               = useState(null);
  const [copied, setCopied]             = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail]         = useState("");
  const [sendWhatsApp, setSendWhatsApp]   = useState("");
  const [sendNote, setSendNote]           = useState("");
  const [sending, setSending]             = useState(false);
  const [sendResult, setSendResult]       = useState(null);
  const textareaRef = useRef(null);

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 20) return;
    setStatus("generating");
    setError(null);
    setContract(null);
    setProgress(5);

    await streamContractCreation(selectedType, description, {
      onStage: ({ label, progress }) => {
        setStageLabel(label);
        setProgress(progress);
      },
      onDone: ({ contract, label }) => {
        setContract(contract);
        setContractLabel(label);
        setStatus("done");
        setProgress(100);
      },
      onError: (msg) => {
        setError(msg);
        setStatus("error");
      },
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(contract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([contract], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${selectedType}_contract.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if (!sendEmail && !sendWhatsApp) return;
    setSending(true); setSendResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/contract/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_text: contract, contract_label: contractLabel,
          filename: `${selectedType}_contract.txt`,
          to_email: sendEmail, to_whatsapp: sendWhatsApp, sender_note: sendNote,
        }),
      });
      setSendResult(await res.json());
    } catch (err) { setSendResult({ status: "error", message: err.message }); }
    finally { setSending(false); }
  };

  const handleSendForReview = async () => {
    if (!contract) return;
    setSendingReview(true);
    // Pass contract text to the review pipeline via onReview callback
    onReview(contract, `${selectedType}_contract.txt`);
  };

  const isGenerating = status === "generating";
  const isDone       = status === "done";

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 60 }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,12,20,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--color-accent)" }}>
            LexAgent
          </span>
          <span style={{
            fontSize: 13, color: "var(--color-muted)",
            borderLeft: "1px solid var(--color-border)", paddingLeft: 20,
          }}>
            Contract Creator
          </span>
        </div>
        <button onClick={onBack} style={{
          fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-muted)",
          background: "none", border: "1px solid var(--color-border)",
          borderRadius: 6, padding: "5px 14px", cursor: "pointer",
        }}>
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 0" }}>

        {/* Contract type selector */}
        <div style={{
          display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap",
          animation: "fadeUp 0.4s ease both",
        }}>
          {CONTRACT_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedType(t.key)}
              style={{
                padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                border: `1px solid ${selectedType === t.key ? "var(--color-accent)" : "var(--color-border)"}`,
                background: selectedType === t.key ? "rgba(200,169,110,0.1)" : "var(--color-surface)",
                color: selectedType === t.key ? "var(--color-accent)" : "var(--color-muted)",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Description input */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 14, padding: "24px",
          marginBottom: 20,
          animation: "fadeUp 0.4s 0.05s ease both",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 14,
          }}>
            Describe Your Contract
          </div>

          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isGenerating}
            placeholder={`Describe what you need in plain English. For example:\n\n"A SaaS agreement between Acme Corp (vendor) and Beta Ltd (client) for a project management tool. Monthly subscription of $2,000, 12-month term with auto-renewal, 30-day cancellation notice. Liability capped at 12 months fees. Governed by UK law."`}
            style={{
              width: "100%", minHeight: 160,
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 10, padding: "14px 16px",
              color: "var(--color-text)",
              fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.7,
              resize: "vertical", outline: "none",
              opacity: isGenerating ? 0.6 : 1,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
              {description.length} chars {description.length < 20 && description.length > 0 && (
                <span style={{ color: "#f04a4a" }}>— add more detail</span>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || description.trim().length < 20}
              style={{
                padding: "11px 28px", borderRadius: 10, border: "none",
                background: isGenerating || description.trim().length < 20
                  ? "var(--color-surface-2)"
                  : "linear-gradient(135deg, #8a6e3e, var(--color-accent))",
                color: isGenerating || description.trim().length < 20 ? "var(--color-muted)" : "#0f1623",
                fontSize: 14, fontWeight: 700, fontFamily: "var(--font-sans)",
                cursor: isGenerating || description.trim().length < 20 ? "not-allowed" : "pointer",
                letterSpacing: "0.03em", transition: "all 0.2s",
              }}
            >
              {isGenerating ? "Generating…" : "✍ Generate Contract"}
            </button>
          </div>

          {/* Progress bar */}
          {isGenerating && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                height: 3, background: "var(--color-border)", borderRadius: 2, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--color-accent-dim), var(--color-accent))",
                  borderRadius: 2, transition: "width 0.6s ease",
                  boxShadow: "0 0 8px var(--color-accent)",
                }} />
              </div>
              <div style={{
                marginTop: 8, fontSize: 12, fontFamily: "var(--font-mono)",
                color: "var(--color-accent)", letterSpacing: "0.08em",
              }}>
                {stageLabel}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 14, padding: "12px 16px",
              background: "rgba(240,74,74,0.1)", border: "1px solid rgba(240,74,74,0.3)",
              borderRadius: 8, fontSize: 13, color: "#ff9a9a",
            }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Generated contract */}
        {isDone && contract && (
          <div style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 14, padding: "24px",
            animation: "fadeUp 0.4s ease both",
          }}>
            {/* Header + actions */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <div style={{
                  fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--color-text)",
                }}>
                  {contractLabel}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 3 }}>
                  {contract.split("\n").length} lines · {contract.length} characters · AI generated
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-2)",
                    color: copied ? "#3dd68c" : "var(--color-text)",
                    fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)",
                    transition: "all 0.2s",
                  }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>

                <button
                  onClick={handleDownload}
                  style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-2)",
                    color: "var(--color-text)",
                    fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)",
                  }}
                >
                  ↓ Download
                </button>

                <button
                  onClick={handleSendForReview}
                  disabled={sendingReview}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "none",
                    background: "linear-gradient(135deg, #8a6e3e, var(--color-accent))",
                    color: "#0f1623", fontSize: 13, fontWeight: 700,
                    cursor: sendingReview ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-sans)", opacity: sendingReview ? 0.7 : 1,
                  }}
                >
                  ⚖ Review This Contract
                </button>
                <button
                  onClick={() => { setShowSendModal(true); setSendResult(null); }}
                  style={{
                    padding: "8px 20px", borderRadius: 8,
                    border: "1px solid var(--color-accent)",
                    background: "transparent", color: "var(--color-accent)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  ✉ Send Contract
                </button>
              </div>
            </div>

            {/* Contract text */}
            <div style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 10, padding: "20px 24px",
              maxHeight: 600, overflowY: "auto",
            }}>
              <pre style={{
                fontFamily: "var(--font-mono)", fontSize: 12.5,
                lineHeight: 1.8, color: "var(--color-text)",
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
              }}>
                {contract}
              </pre>
            </div>
          </div>
        )}
      </div>

      {showSendModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 16, padding: 32, width: "100%", maxWidth: 480,
          }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--color-text)", marginBottom: 6 }}>
              Send Contract
            </div>
            <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 24 }}>
              Sending: <strong style={{ color: "var(--color-accent)" }}>{contractLabel}</strong>
            </div>

            {[
              { label: "Email Recipient", val: sendEmail, set: setSendEmail, ph: "recipient@example.com", type: "email", hint: "" },
              { label: "WhatsApp Number", val: sendWhatsApp, set: setSendWhatsApp, ph: "+1234567890", type: "text", hint: "Include country code. Requires Twilio sandbox." },
              { label: "Note (optional)", val: sendNote, set: setSendNote, ph: "Please review and sign by Friday.", type: "text", hint: "" },
            ].map(({ label, val, set, ph, type, hint }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <label style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--color-muted)", display: "block", marginBottom: 6,
                }}>{label}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
                  style={{
                    width: "100%", padding: "10px 14px", boxSizing: "border-box",
                    background: "var(--color-bg)", border: "1px solid var(--color-border)",
                    borderRadius: 8, color: "var(--color-text)", fontFamily: "var(--font-sans)",
                    fontSize: 13, outline: "none",
                  }}
                />
                {hint && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>{hint}</div>}
              </div>
            ))}

            {sendResult && (
              <div style={{
                marginBottom: 16, padding: "12px 16px", borderRadius: 8,
                background: sendResult.status === "sent" ? "rgba(61,214,140,0.1)" : "rgba(240,74,74,0.1)",
                border: "1px solid " + (sendResult.status === "sent" ? "rgba(61,214,140,0.3)" : "rgba(240,74,74,0.3)"),
                fontSize: 13, color: sendResult.status === "sent" ? "#3dd68c" : "#ff9a9a",
              }}>
                {sendResult.status === "sent" ? (
                  <div>
                    <div>✓ Sent successfully</div>
                    {sendResult.results?.email?.success && <div>✓ Email → {sendResult.results.email.to}</div>}
                    {sendResult.results?.whatsapp?.success && <div>✓ WhatsApp → {sendResult.results.whatsapp.to}</div>}
                    {sendResult.results?.email?.error && <div>✗ Email: {sendResult.results.email.error}</div>}
                    {sendResult.results?.whatsapp?.error && <div>✗ WhatsApp: {sendResult.results.whatsapp.error}</div>}
                  </div>
                ) : <div>✗ {sendResult.message || "Failed"}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowSendModal(false)} style={{
                padding: "10px 20px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: "none", color: "var(--color-muted)", fontSize: 13, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleSend} disabled={sending || (!sendEmail && !sendWhatsApp)} style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: sending || (!sendEmail && !sendWhatsApp)
                  ? "var(--color-surface-2)"
                  : "linear-gradient(135deg, #8a6e3e, var(--color-accent))",
                color: sending || (!sendEmail && !sendWhatsApp) ? "var(--color-muted)" : "#0f1623",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>{sending ? "Sending…" : "✉ Send"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}