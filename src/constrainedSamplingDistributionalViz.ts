import { loadAllSamplingAnalysisData, loadVocabulary, mockSamplingAnalysisData } from "./data";
import { initSamplingWithControls } from "./logitSamplingHeatmap";

/**
 * Entry-point for constrained-sampling (distributional) viz with controls/sidebar.
 */
export function initConstrainedSamplingDistributionalViz(containerSelector: string): void {
  loadVocabulary("data/").then((vocab) => {
    // Assuming data files are named like 'grammar_distributional-phraseX'
    const sampleNames = Array.from(
      { length: 3 },
      (_, i) => `grammar_distribution-phrase${i}`, // Updated sample name prefix
    );
    loadAllSamplingAnalysisData(sampleNames, "data/").then((data) => {
      initSamplingWithControls(containerSelector, data, vocab);
    });
    // const mockData = mockSamplingAnalysisData();
    // console.log(mockData);
    // initSamplingWithControls(containerSelector, mockData, vocab);
  });
}
