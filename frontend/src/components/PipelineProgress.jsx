import React from "react";

const STAGES = [
  { key: "parse",   label: "Parse",   icon: "📄", staticDesc: "Extracting & segmenting clauses" },
  { key: "flag",    label: "Flag",    icon: "⚑",  staticDesc: "Risk-scoring each clause" },
  { key: "compare", label: "Compare", icon: "⚖",  staticDesc: "Checking playbook & GDPR rules" },
  { key: "redline", label: "Redline", icon: "✍",  staticDesc: "Generating replacement text" },
  { key: "report",  label: "Report",  icon: "📊", staticDesc: "Assembling final report" },
];

export default function PipelineProgress({ stage, stageLabel, progress }) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      {/* Progress bar */}
      <div style={{
        height: 3, background: "var(--color-border)",
        borderRadius: 2, marginBottom: 36, overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--color-accent-dim), var(--color-accent))",
          borderRadius: 2,
          transition: "width 0.5s ease",
          boxShadow: "0 0 8px var(--color-accent)",
        }} />
      </div>

      {/* Stages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {STAGES.map((s, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const upcoming = i > currentIdx;

          // Show real SSE label only on the active stage
          const desc = active && stageLabel ? stageLabel : s.staticDesc;

          return (
            <div key={s.key} style={{
              display: "flex", alignItems: "center", gap: 14,
              opacity: upcoming ? 0.3 : 1,
              transition: "opacity 0.4s ease",
            }}>
              {/* Circle */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                border: `1.5px solid ${active ? "var(--color-accent)" : done ? "var(--color-low)" : "var(--color-border)"}`,
                background: done ? "rgba(61,214,140,0.1)" : active ? "rgba(200,169,110,0.1)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
                animation: active ? "pulse-ring 1.5s infinite" : "none",
              }}>
                {done ? "✓" : s.icon}
              </div>

              <div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
                  color: active ? "var(--color-accent)" : done ? "var(--color-low)" : "var(--color-muted)",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                }}>
                  {s.label}
                </div>
                {/* ← This now shows the real live label from the backend */}
                <div style={{
                  fontSize: 13,
                  color: active ? "var(--color-text)" : "var(--color-muted)",
                  marginTop: 1,
                  transition: "color 0.3s",
                }}>
                  {desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
