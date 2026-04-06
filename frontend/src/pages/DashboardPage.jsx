import React, { useEffect, useState, useCallback } from "react";
import {
  getEmailStatus, startEmailWorker, stopEmailWorker, pollEmailNow,
} from "../api/client";

const RISK_COLOR = {
  "High Risk":   "#f04a4a",
  "Medium Risk": "#e8953a",
  "Low Risk":    "#3dd68c",
};

const POLL_INTERVAL = 5000; // refresh status every 5s

function StatCard({ value, label, color }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      padding: "20px 24px",
      minWidth: 140,
    }}>
      <div style={{
        fontFamily: "var(--font-serif)",
        fontSize: 40,
        lineHeight: 1,
        color: color || "var(--color-accent)",
      }}>{value}</div>
      <div style={{
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--color-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginTop: 6,
      }}>{label}</div>
    </div>
  );
}

function RiskBadge({ label }) {
  const color = RISK_COLOR[label] || "#6b7fa3";
  return (
    <span style={{
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      borderRadius: 5,
      padding: "2px 8px",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export default function DashboardPage({ onBack }) {
  const [state, setState]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [polling, setPolling]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getEmailStatus();
      setState(s);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {}
  }, []);

  // Auto-refresh every 5s
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (state?.running) await stopEmailWorker();
      else await startEmailWorker();
      await refresh();
    } finally { setLoading(false); }
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      await pollEmailNow();
      await refresh();
    } finally { setPolling(false); }
  };

  const history = state?.history || [];
  const errors  = state?.errors  || [];

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
            Email Dashboard
          </span>
        </div>
        <button
          onClick={onBack}
          style={{
            fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-muted)",
            background: "none", border: "1px solid var(--color-border)",
            borderRadius: 6, padding: "5px 14px", cursor: "pointer",
          }}
        >
          ← Upload Contract
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 0" }}>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap",
          animation: "fadeUp 0.4s ease both",
        }}>
          <StatCard value={state?.emails_processed ?? "—"} label="Emails Processed" />
          <StatCard value={state?.high_risk_count ?? "—"} label="High Risk Found" color="#f04a4a" />
          <StatCard value={history.length} label="In History" color="#4a7fa5" />
          <StatCard
            value={state?.running ? "ON" : "OFF"}
            label="Worker Status"
            color={state?.running ? "#3dd68c" : "#6b7fa3"}
          />
        </div>

        {/* Controls */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 14, padding: "20px 24px",
          marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
          animation: "fadeUp 0.4s 0.05s ease both",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
              Gmail Polling Worker
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 3 }}>
              {state?.running
                ? `Running · last poll ${state.last_poll || "—"}`
                : `Stopped · last poll ${state?.last_poll || "never"}`}
              {lastRefresh && (
                <span style={{ marginLeft: 12, opacity: 0.6 }}>· refreshed {lastRefresh}</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handlePoll}
              disabled={polling}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: "var(--color-surface-2)", color: "var(--color-text)",
                fontSize: 13, cursor: polling ? "not-allowed" : "pointer",
                fontFamily: "var(--font-sans)", opacity: polling ? 0.6 : 1,
              }}
            >
              {polling ? "Polling…" : "⟳ Poll Now"}
            </button>

            <button
              onClick={handleToggle}
              disabled={loading}
              style={{
                padding: "8px 22px", borderRadius: 8, border: "none",
                background: state?.running
                  ? "rgba(240,74,74,0.15)"
                  : "linear-gradient(135deg, #8a6e3e, var(--color-accent))",
                color: state?.running ? "#f04a4a" : "#0f1623",
                fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "var(--font-sans)", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "…" : state?.running ? "⏹ Stop Worker" : "▶ Start Worker"}
            </button>
          </div>
        </div>

        {/* Processed emails history */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 14, padding: "20px 24px",
          marginBottom: 20,
          animation: "fadeUp 0.4s 0.1s ease both",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 16,
          }}>
            Processed Emails — {history.length} total
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-muted)", fontSize: 13 }}>
              No emails processed yet. Start the worker or click Poll Now.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((item, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: 12, alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  background: item.error ? "rgba(240,74,74,0.04)" : "transparent",
                }}>
                  {/* Sender + subject */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>
                      {item.subject}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                      {item.sender} · {item.time}
                      {item.filename && (
                        <span style={{ marginLeft: 8, color: "var(--color-accent)" }}>
                          📎 {item.filename}
                        </span>
                      )}
                    </div>
                    {item.error && (
                      <div style={{ fontSize: 11, color: "#f04a4a", marginTop: 3 }}>
                        ✗ {item.error}
                      </div>
                    )}
                  </div>

                  {/* Risk badge */}
                  {item.risk_label ? (
                    <RiskBadge label={item.risk_label} />
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--color-muted)" }}>—</span>
                  )}

                  {/* Score */}
                  {item.score !== null ? (
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                      color: item.score < 40 ? "#f04a4a" : item.score < 70 ? "#e8953a" : "#3dd68c",
                    }}>
                      {item.score}/100
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--color-muted)" }}>—</span>
                  )}

                  {/* Reply status */}
                  <span style={{
                    fontSize: 11, fontFamily: "var(--font-mono)",
                    color: item.reply_sent ? "#3dd68c" : "#f04a4a",
                  }}>
                    {item.reply_sent ? "✓ Replied" : item.error ? "✗ Failed" : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{
            background: "rgba(240,74,74,0.06)",
            border: "1px solid rgba(240,74,74,0.2)",
            borderRadius: 14, padding: "20px 24px",
            animation: "fadeUp 0.4s 0.15s ease both",
          }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "#f04a4a", marginBottom: 12,
            }}>
              Errors — {errors.length}
            </div>
            {errors.slice(0, 5).map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "#ff9a9a", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                [{e.time?.slice(11, 19)}] {e.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
