import React from "react";

export default function DiffView({ diff, redlineReason }) {
  if (!diff || diff.length === 0) return null;

  return (
    <div>
      {redlineReason && (
        <div style={{
          fontSize: 12,
          color: "var(--color-accent)",
          background: "rgba(200,169,110,0.08)",
          border: "1px solid rgba(200,169,110,0.2)",
          borderRadius: 6,
          padding: "8px 12px",
          marginBottom: 12,
          fontStyle: "italic",
        }}>
          ✍ {redlineReason}
        </div>
      )}

      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        lineHeight: 1.75,
        padding: "14px 16px",
        background: "var(--color-surface-2)",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {diff.map((segment, i) => {
          if (segment.op === "delete") {
            return (
              <span key={i} className="diff-delete">
                {segment.text}
              </span>
            );
          }
          if (segment.op === "insert") {
            return (
              <span key={i} className="diff-insert">
                {segment.text}
              </span>
            );
          }
          return (
            <span key={i} style={{ color: "var(--color-muted)" }}>
              {segment.text}
            </span>
          );
        })}
      </div>

      <div style={{
        display: "flex",
        gap: 16,
        marginTop: 10,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
      }}>
        <span style={{ color: "#ff9a9a" }}>■ Removed</span>
        <span style={{ color: "#6effc0" }}>■ Added</span>
        <span style={{ color: "var(--color-muted)" }}>■ Unchanged</span>
      </div>
    </div>
  );
}
