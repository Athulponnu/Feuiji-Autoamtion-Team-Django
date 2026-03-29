import React from "react";

const RISK_COLORS = {
  High: "#f04a4a",
  Medium: "#e8953a",
  Low: "#3dd68c",
};

export default function MissingClauses({ missingClauses }) {
  if (!missingClauses || missingClauses.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--color-muted)",
        fontSize: 14,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        No required clauses appear to be missing.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {missingClauses.map((clause) => {
        const color = RISK_COLORS[clause.risk_level] || "#6b7fa3";
        return (
          <div
            key={clause.id}
            style={{
              padding: "16px 20px",
              borderRadius: 10,
              border: `1px dashed ${color}55`,
              background: `${color}08`,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color,
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span>⚠</span>
                {clause.heading}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.6 }}>
                {clause.reason}
              </div>
              {clause.regulatory_citation && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>⚖</span>
                  {clause.regulatory_citation}
                </div>
              )}
            </div>

            <span style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color,
              background: `${color}18`,
              border: `1px solid ${color}44`,
              borderRadius: 5,
              padding: "3px 9px",
              whiteSpace: "nowrap",
            }}>
              {clause.risk_level}
            </span>
          </div>
        );
      })}
    </div>
  );
}
