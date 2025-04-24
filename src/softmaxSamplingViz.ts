import { loadAllSamplingAnalysisData, loadVocabulary, mockSamplingAnalysisData } from "./data";
import { initSamplingWithControls } from "./logitSamplingHeatmap";

/**
 * Entry-point for greedy-sampling viz with controls/sidebar.
 */
export function initSoftmaxSamplingViz(containerSelector: string): void {
  // const sampleGreedyData = mockSamplingAnalysisData();
  loadVocabulary("data/").then((vocab) => {
    const sampleNames = Array.from(
      { length: 32 },
      (_, i) => `distribution-phrase${i}`,
    );
    loadAllSamplingAnalysisData(sampleNames, "data/").then((data) => {
      initSamplingWithControls(containerSelector, data, vocab);
    });
    // const mockData = mockSamplingAnalysisData();
    // console.log(mockData);
    // initSamplingWithControls(containerSelector, mockData, vocab);
  });
}
