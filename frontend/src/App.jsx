import React from "react";
import { useStore } from "./store";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  const status = useStore((s) => s.status);
  return status === "done" ? <ResultsPage /> : <UploadPage />;
}
