import React from "react";
import { useStore } from "../store";
import RiskScorecard from "../components/RiskScorecard";
import ClauseTable from "../components/ClauseTable";
import MissingClauses from "../components/MissingClauses";
import ActionChecklist from "../components/ActionChecklist";

const TABS = [
  { key: "overview",  label: "Overview" },
  { key: "clauses",   label: "Clauses" },
  { key: "missing",   label: "Missing" },
  { key: "actions",   label: "Actions" },
];

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 14,
      padding: 28,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--color-muted)",
      marginBottom: 18,
    }}>
      {children}
    </div>
  );
}

export default function ResultsPage() {
  const { report, activeTab, setActiveTab, reset } = useStore();
  if (!report) return null;

  const highRisk = report.clause_table.filter((c) => c.risk_level === "High");
  const medRisk  = report.clause_table.filter((c) => c.risk_level === "Medium");
  const lowRisk  = report.clause_table.filter((c) => c.risk_level === "Low" || c.risk_level === "OK");

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg)",
      padding: "0 0 60px",
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(8,12,20,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}>
          <span style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            color: "var(--color-accent)",
          }}>
            LexAgent
          </span>
          <span style={{
            fontSize: 13,
            color: "var(--color-muted)",
            borderLeft: "1px solid var(--color-border)",
            paddingLeft: 20,
          }}>
            {report.filename}
          </span>
        </div>

        <button
          onClick={reset}
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted)",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "5px 14px",
            cursor: "pointer",
            letterSpacing: "0.06em",
            transition: "color 0.2s, border-color 0.2s",
          }}
        >
          ← New Review
        </button>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "36px 24px 0" }}>
        {/* Scorecard row */}
        <div style={{
          animation: "fadeUp 0.4s ease both",
          marginBottom: 24,
        }}>
          <Card>
            <SectionTitle>Risk Assessment</SectionTitle>
            <RiskScorecard report={report} />
          </Card>
        </div>

        {/* Executive summary */}
        <div style={{
          animation: "fadeUp 0.4s 0.05s ease both",
          marginBottom: 24,
        }}>
          <Card>
            <SectionTitle>Executive Summary</SectionTitle>
            <p style={{
              fontSize: 14,
              color: "var(--color-muted)",
              lineHeight: 1.8,
            }}>
              {report.executive_summary}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div style={{
          animation: "fadeUp 0.4s 0.1s ease both",
        }}>
          <div style={{
            display: "flex",
            gap: 0,
            marginBottom: 20,
            background: "var(--color-surface)",
            borderRadius: 10,
            padding: 4,
            border: "1px solid var(--color-border)",
          }}>
            {TABS.map(({ key, label }) => {
              const isActive = activeTab === key;

              // Badge counts
              let badge = null;
              if (key === "missing") badge = report.missing_clauses?.length;
              if (key === "actions") badge = report.action_checklist?.filter(a => a.priority === "High").length;
              if (key === "clauses") badge = highRisk.length + medRisk.length;

              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1,
                    padding: "9px 16px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? "var(--color-surface-2)" : "transparent",
                    color: isActive ? "var(--color-text)" : "var(--color-muted)",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  {label}
                  {badge > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      background: key === "missing" || (key === "clauses" && highRisk.length > 0)
                        ? "rgba(240,74,74,0.2)"
                        : "rgba(200,169,110,0.2)",
                      color: key === "missing" || (key === "clauses" && highRisk.length > 0)
                        ? "#f04a4a"
                        : "var(--color-accent)",
                      borderRadius: 10,
                      padding: "1px 7px",
                      minWidth: 20,
                      textAlign: "center",
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          <Card style={{ animation: "fadeUp 0.3s ease both" }}>
            {activeTab === "overview" && (
              <>
                <SectionTitle>High Risk Clauses</SectionTitle>
                {highRisk.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--color-muted)" }}>No high-risk clauses found.</p>
                ) : (
                  <ClauseTable clauses={highRisk} />
                )}

                {medRisk.length > 0 && (
                  <>
                    <SectionTitle style={{ marginTop: 28 }}>Medium Risk Clauses</SectionTitle>
                    <ClauseTable clauses={medRisk} />
                  </>
                )}

                {report.missing_clauses?.length > 0 && (
                  <>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--color-muted)",
                      marginBottom: 18,
                      marginTop: 28,
                    }}>Missing Clauses</div>
                    <MissingClauses missingClauses={report.missing_clauses} />
                  </>
                )}
              </>
            )}

            {activeTab === "clauses" && (
              <>
                <SectionTitle>All Clauses — {report.clause_table.length} total</SectionTitle>
                <ClauseTable clauses={report.clause_table.filter(c => !c.is_missing)} />
              </>
            )}

            {activeTab === "missing" && (
              <>
                <SectionTitle>Missing Required Clauses</SectionTitle>
                <MissingClauses missingClauses={report.missing_clauses} />
              </>
            )}

            {activeTab === "actions" && (
              <>
                <SectionTitle>Prioritised Action Plan</SectionTitle>
                <ActionChecklist actions={report.action_checklist} />
              </>
            )}
          </Card>
        </div>

        {/* Escalation notice */}
        {report.escalated_clauses?.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: "14px 18px",
            background: "rgba(200,169,110,0.06)",
            border: "1px solid rgba(200,169,110,0.2)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span>
              {report.escalated_clauses.length} clause(s) had low-confidence AI assessments and are
              flagged for human legal review: {report.escalated_clauses.join(", ")}.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
