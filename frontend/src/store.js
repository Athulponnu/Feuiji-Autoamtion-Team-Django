import { create } from "zustand";

export const useStore = create((set) => ({
  status: "idle",
  stage: null,
  stageLabel: null,   // ← ADD THIS
  progress: 0,
  error: null,
  report: null,
  activeTab: "overview",

  setStatus: (status) => set({ status }),
  setStage: (stage, label) => set({ stage, stageLabel: label ?? null }),  // ← accepts label
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error, status: "error" }),
  setReport: (report) => set({ report, status: "done", progress: 100 }),
  setActiveTab: (activeTab) => set({ activeTab }),

  reset: () => set({
    status: "idle", stage: null, stageLabel: null,
    progress: 0, error: null, report: null, activeTab: "overview",
  }),
}));
