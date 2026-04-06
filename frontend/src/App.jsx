import React, { useState } from "react";
import { useStore } from "./store";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";
import ContractCreatorPage from "./pages/ContractCreatorPage";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const { status, setStatus, setStage, setProgress, setReport, setError } = useStore();
  const [page, setPage] = useState("home"); // home | dashboard | creator

  // Called from ContractCreatorPage when user clicks "Review This Contract"
  const handleReviewContract = async (contractText, filename) => {
    setPage("home");
    setStatus("processing");
    setProgress(5);
    setStage("parse");

    const blob = new Blob([contractText], { type: "text/plain" });
    const file = new File([blob], filename, { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BASE_URL}/api/review/stream`, {
        method: "POST", body: formData,
      });

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
          if (eventType === "stage") { setStage(data.stage); setProgress(data.progress); }
          else if (eventType === "done")  setReport(data.report);
          else if (eventType === "error") setError(data.message);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (page === "dashboard") return <DashboardPage onBack={() => setPage("home")} />;
  if (page === "creator")   return <ContractCreatorPage onBack={() => setPage("home")} onReview={handleReviewContract} />;
  if (status === "done")    return <ResultsPage />;
  return <UploadPage onDashboard={() => setPage("dashboard")} onCreator={() => setPage("creator")} />;
}
