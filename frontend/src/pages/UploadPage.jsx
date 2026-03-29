import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useStore } from "../store";
import { reviewFileStream, reviewTextStream } from "../api/client";
import PipelineProgress from "../components/PipelineProgress";

export default function UploadPage() {
  const {
    status, stage, progress, error,
    setStatus, setStage, setProgress, setError, setReport,
  } = useStore();

  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const runReview = useCallback(async (fileOrText) => {
    setStatus("processing");
    setProgress(5);
    setStage("parse");

    const handlers = {
      // Called for every real agent stage event from the backend
      onStage: ({ stage, label, progress }) => {
        setStage(stage);
        setProgress(progress);
      },
      // Called once with the final report — drives navigation to ResultsPage
      onDone: (report) => {
        setReport(report);
      },
      // Called on any error — shows the error banner
      onError: (msg) => {
        setError(msg || "An unexpected error occurred.");
      },
    };

    if (typeof fileOrText === "string") {
      await reviewTextStream(fileOrText, handlers);
    } else {
      await reviewFileStream(fileOrText, handlers);
    }
  }, [setStatus, setProgress, setStage, setReport, setError]);

  const onDrop = useCallback(
    (accepted) => { if (accepted.length > 0) runReview(accepted[0]); },
    [runReview]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    multiple: false,
    disabled: status === "processing",
  });

  const isProcessing = status === "processing";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      background: "var(--color-bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(30,45,69,0.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,45,69,0.4) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        pointerEvents: "none",
      }} />

      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 400,
        background: "radial-gradient(ellipse, rgba(200,169,110,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.5s ease both" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "var(--color-accent)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}>
            ⚖ Contract Intelligence
          </div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 56,
            fontWeight: 400,
            color: "var(--color-text)",
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}>
            LexAgent
          </h1>
          <p style={{
            marginTop: 14,
            fontSize: 15,
            color: "var(--color-muted)",
            maxWidth: 400,
            margin: "14px auto 0",
            lineHeight: 1.7,
          }}>
            Upload any contract. Get a risk score, redlines,<br />
            and action plan in under 60 seconds.
          </p>
        </div>

        {/* Main card */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 16,
          padding: 36,
          animation: "fadeUp 0.5s 0.1s ease both",
          backdropFilter: "blur(4px)",
        }}>
          {isProcessing ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 32,
              padding: "12px 0",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.15em",
                color: "var(--color-accent)",
                textTransform: "uppercase",
              }}>
                Reviewing Contract…
              </div>
              <PipelineProgress stage={stage} progress={progress} />
            </div>
          ) : (
            <>
              {/* Upload / Paste toggle */}
              <div style={{
                display: "flex",
                marginBottom: 24,
                background: "var(--color-bg)",
                borderRadius: 8,
                padding: 3,
                border: "1px solid var(--color-border)",
              }}>
                {[
                  { mode: false, label: "Upload File" },
                  { mode: true,  label: "Paste Text"  },
                ].map(({ mode, label }) => (
                  <button
                    key={label}
                    onClick={() => setPasteMode(mode)}
                    style={{
                      flex: 1,
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      transition: "all 0.2s",
                      background: pasteMode === mode ? "var(--color-surface-2)" : "transparent",
                      color: pasteMode === mode ? "var(--color-text)" : "var(--color-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {pasteMode ? (
                <div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your contract text here…"
                    style={{
                      width: "100%",
                      minHeight: 200,
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      color: "var(--color-text)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => pasteText.trim() && runReview(pasteText)}
                    disabled={!pasteText.trim()}
                    style={{
                      marginTop: 14,
                      width: "100%",
                      padding: "13px 24px",
                      background: pasteText.trim()
                        ? "linear-gradient(135deg, #8a6e3e, var(--color-accent))"
                        : "var(--color-surface-2)",
                      border: "none",
                      borderRadius: 10,
                      color: pasteText.trim() ? "#0f1623" : "var(--color-muted)",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "var(--font-sans)",
                      cursor: pasteText.trim() ? "pointer" : "not-allowed",
                      letterSpacing: "0.03em",
                      transition: "all 0.2s",
                    }}
                  >
                    Analyse Contract →
                  </button>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  style={{
                    border: `2px dashed ${isDragActive ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderRadius: 12,
                    padding: "48px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragActive ? "rgba(200,169,110,0.05)" : "var(--color-bg)",
                    transition: "all 0.2s",
                  }}
                >
                  <input {...getInputProps()} />
                  <div style={{ fontSize: 40, marginBottom: 16 }}>
                    {isDragActive ? "📂" : "📄"}
                  </div>
                  <div style={{ fontSize: 15, color: "var(--color-text)", fontWeight: 500 }}>
                    {isDragActive ? "Drop to analyse" : "Drop your contract here"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-muted)" }}>
                    or{" "}
                    <span style={{ color: "var(--color-accent)", textDecoration: "underline" }}>
                      click to browse
                    </span>
                  </div>
                  <div style={{
                    marginTop: 14,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    letterSpacing: "0.08em",
                  }}>
                    PDF · DOCX · TXT
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "rgba(240,74,74,0.1)",
                  border: "1px solid rgba(240,74,74,0.3)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#ff9a9a",
                }}>
                  ⚠ {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer stats */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 40,
          marginTop: 36,
          animation: "fadeUp 0.5s 0.2s ease both",
        }}>
          {[
            { value: "< 60s", label: "Review time" },
            { value: "5",     label: "AI agents"   },
            { value: "GDPR",  label: "Compliant checks" },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--color-accent)" }}>
                {value}
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--color-muted)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 2,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
