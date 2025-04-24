import {
  loadAllSamplingAnalysisData,
  loadSamplingAnalysisData,
  loadVocabulary,
  mockSamplingAnalysisData,
} from "./data"; // Assume this function exists for loading data
import { initSamplingWithControls } from "./logitSamplingHeatmap";

export function initGreedySamplingViz(containerSelector: string): void {
  loadVocabulary("data/").then((vocab) => {
    const sampleNames = Array.from(
      { length: 32 },
      (_, i) => `greedy-phrase${i}`,
    );
    loadAllSamplingAnalysisData(sampleNames, "data/").then((data) => {
      initSamplingWithControls(containerSelector, data, vocab);
    });
  });
}
