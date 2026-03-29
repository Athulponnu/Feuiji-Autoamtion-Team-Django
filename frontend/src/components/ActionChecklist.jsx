import React from "react";

const PRIORITY_META = {
  High:   { color: "#f04a4a", label: "Must Fix",   icon: "🔴" },
  Medium: { color: "#e8953a", label: "Negotiate",  icon: "🟡" },
  Low:    { color: "#3dd68c", label: "Optional",   icon: "🟢" },
};

export default function ActionChecklist({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--color-muted)",
        fontSize: 14,
      }}>
        No action items — contract looks clean.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {actions.map((action, i) => {
        const meta = PRIORITY_META[action.priority] || PRIORITY_META["Low"];
        return (
          <div
            key={`${action.clause_id}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 14,
              padding: "14px 18px",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              alignItems: "start",
            }}
          >
            {/* Number badge */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: meta.color,
              flexShrink: 0,
              marginTop: 2,
            }}>
              {i + 1}
            </div>

            <div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
                flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: meta.color,
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}44`,
                  borderRadius: 4,
                  padding: "2px 7px",
                }}>
                  {meta.label}
                </span>
                <span style={{
                  fontSize: 11,
                  color: "var(--color-muted)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {action.category.replace("_", " ")}
                </span>
                {action.is_missing && (
                  <span style={{
                    fontSize: 10,
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-mono)",
                    background: "rgba(200,169,110,0.1)",
                    border: "1px solid rgba(200,169,110,0.25)",
                    borderRadius: 4,
                    padding: "2px 7px",
                  }}>
                    MISSING CLAUSE
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.6 }}>
                {action.action}
              </div>

              {action.redline_reason && action.redline_available && (
                <div style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--color-muted)",
                  fontStyle: "italic",
                }}>
                  → {action.redline_reason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
