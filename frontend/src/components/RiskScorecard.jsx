import React from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

function scoreColor(score) {
  if (score >= 70) return "#3dd68c";
  if (score >= 40) return "#e8953a";
  return "#f04a4a";
}

function scoreLabel(score) {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

export default function RiskScorecard({ report }) {
  const { risk_score, risk_counts, total_clauses } = report;
  const color = scoreColor(risk_score);
  const data = [{ value: risk_score, fill: color }];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 32,
      alignItems: "center",
    }}>
      {/* Gauge */}
      <div style={{ position: "relative", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="65%"
            innerRadius="75%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={data}
            barSize={18}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              background={{ fill: "var(--color-border)" }}
              dataKey="value"
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Score overlay */}
        <div style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: 48,
            lineHeight: 1,
            color,
          }}>
            {risk_score}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: 4,
          }}>
            / 100
          </div>
          <div style={{
            fontSize: 12,
            color,
            fontWeight: 600,
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            {scoreLabel(risk_score)}
          </div>
        </div>
      </div>

      {/* Counts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { key: "High",   label: "High Risk",   color: "#f04a4a", cls: "badge-high" },
          { key: "Medium", label: "Medium Risk",  color: "#e8953a", cls: "badge-medium" },
          { key: "Low",    label: "Low Risk",     color: "#3dd68c", cls: "badge-low" },
          { key: "OK",     label: "Acceptable",   color: "#4a7fa5", cls: "badge-ok" },
        ].map(({ key, label, color: c, cls }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `${c}18`,
              border: `1px solid ${c}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              color: c,
              flexShrink: 0,
            }}>
              {risk_counts[key] ?? 0}
            </div>
            <span style={{ fontSize: 13, color: "var(--color-muted)" }}>{label} clauses</span>
          </div>
        ))}

        <div style={{
          marginTop: 4,
          paddingTop: 12,
          borderTop: "1px solid var(--color-border)",
          fontSize: 12,
          color: "var(--color-muted)",
          fontFamily: "var(--font-mono)",
        }}>
          {total_clauses} total clauses analysed
        </div>
      </div>
    </div>
  );
}
