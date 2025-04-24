import { loadAllSamplingAnalysisData, loadVocabulary, mockSamplingAnalysisData } from "./data";
import { initSamplingWithControls } from "./logitSamplingHeatmap";

/**
 * Entry-point for constrained-sampling viz with controls/sidebar.
 */
export function initConstrainedSamplingViz(containerSelector: string): void {
  loadVocabulary("data/").then((vocab) => {
    const sampleNames = Array.from(
      { length: 32 },
      (_, i) => `grammar_greedy-phrase${i}`,
    );
    loadAllSamplingAnalysisData(sampleNames, "data/").then((data) => {
      initSamplingWithControls(containerSelector, data, vocab);
    });
  });
}
