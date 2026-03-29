import React, { useState } from "react";
import DiffView from "./DiffView";

const BADGE_CLASS = {
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
  OK: "badge-ok",
};

export default function ClauseTable({ clauses }) {
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {clauses.map((clause) => {
        const isOpen = expanded === clause.id;
        const risk = clause.risk_level;
        const hasDiff = clause.diff && clause.diff.length > 0;
        const badgeCls = BADGE_CLASS[risk] || "badge-ok";

        return (
          <div
            key={clause.id}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "hidden",
              background: isOpen ? "var(--color-surface)" : "transparent",
              transition: "background 0.2s",
            }}
          >
            {/* Row header */}
            <button
              onClick={() => toggle(clause.id)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "13px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--color-text)",
              }}
            >
              <div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: clause.is_missing ? "var(--color-muted)" : "var(--color-text)",
                  fontStyle: clause.is_missing ? "italic" : "normal",
                }}>
                  {clause.heading}
                </div>
                {clause.reason && (
                  <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                    {clause.reason}
                  </div>
                )}
              </div>

              {clause.regulatory_citation && (
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent)",
                  background: "rgba(200,169,110,0.1)",
                  border: "1px solid rgba(200,169,110,0.25)",
                  borderRadius: 4,
                  padding: "2px 7px",
                  whiteSpace: "nowrap",
                }}>
                  {clause.regulatory_citation}
                </span>
              )}

              <span className={badgeCls} style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderRadius: 5,
                padding: "3px 9px",
                whiteSpace: "nowrap",
              }}>
                {risk}
              </span>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{
                padding: "0 18px 18px",
                borderTop: "1px solid var(--color-border)",
                paddingTop: 16,
              }}>
                {clause.is_missing ? (
                  <div style={{
                    fontSize: 13,
                    color: "var(--color-muted)",
                    fontStyle: "italic",
                    padding: "12px 16px",
                    background: "rgba(240,74,74,0.05)",
                    borderRadius: 8,
                    border: "1px dashed rgba(240,74,74,0.3)",
                  }}>
                    ⚠ This clause is absent from the contract. {clause.reason}
                  </div>
                ) : hasDiff ? (
                  <DiffView
                    diff={clause.diff}
                    redlineReason={clause.redline_reason}
                  />
                ) : (
                  <div style={{
                    fontSize: 13,
                    color: "var(--color-muted)",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}>
                    {clause.original_text}
                  </div>
                )}

                {clause.escalate_to_human && (
                  <div style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--color-accent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span>⚠</span>
                    <span>Low-confidence assessment — recommend human legal review.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
