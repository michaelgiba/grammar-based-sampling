import { loadAllSamplingAnalysisData, loadVocabulary } from "./data";
import { initSamplingWithControls } from "./logitSamplingHeatmap";
import "./style.css";

const ROOT = "./data";
const SAMPLE_COUNT = 22;

// --- Helper functions for spinners ---
function showSpinner(spinnerElement: Element | null): void {
  if (spinnerElement) {
    (spinnerElement as HTMLElement).style.display = "block";
  }
}

function hideSpinner(spinnerElement: Element | null): void {
  if (spinnerElement) {
    (spinnerElement as HTMLElement).style.display = "none";
  }
}
// --- End Helper functions ---

// Modified initializeViz to accept vocab and manage its own spinner
function initializeViz(
  containerSelector: string,
  sampleNamePrefix: string,
  vocab: any,
): void {
  // Consider using a more specific type for vocab if available
  const container = document.querySelector(containerSelector);
  // Assume a spinner element with class 'spinner' exists inside the container
  const spinner = container?.querySelector(".spinner");

  if (!container) {
    console.error(`Container not found for selector: ${containerSelector}`);
    return;
  }

  if (spinner) {
    showSpinner(spinner); // Show spinner for this specific visualization
  }

  const sampleNames = Array.from(
    { length: SAMPLE_COUNT },
    (_, i) => `${sampleNamePrefix}${i}`,
  );

  loadAllSamplingAnalysisData(sampleNames, ROOT)
    .then((data) => {
      // Data loaded, initialize the visualization
      initSamplingWithControls(containerSelector, data, vocab);
    })
    .catch((error) => {
      console.error(
        `Failed to load sampling data for ${sampleNamePrefix}:`,
        error,
      );
      // Optionally display an error message within the container
      if (container) {
        container.innerHTML = `<p style="color: red;">Error loading data for ${sampleNamePrefix}.</p>`;
      }
    })
    .finally(() => {
      // Hide spinner regardless of success or failure after data loading attempt
      hideSpinner(spinner!);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  // Assume a global spinner element exists for the initial vocabulary load
  const globalSpinner = document.getElementById("global-spinner");

  showSpinner(globalSpinner); // Show global spinner before loading vocabulary

  loadVocabulary(ROOT)
    .then((vocab) => {
      // Vocabulary loaded successfully
      // Initialize all visualizations with the single loaded vocabulary
      // Each initializeViz call will manage its own data loading spinner
      initializeViz(
        "#greedy-sampling-viz .viz-content",
        "greedy-phrase",
        vocab,
      );
      initializeViz(
        "#softmax-sampling-viz .viz-content",
        "distribution-phrase",
        vocab,
      );
      initializeViz(
        "#constrained-sampling-viz .viz-content",
        "grammar_greedy-phrase",
        vocab,
      );
      initializeViz(
        "#constrained-sampling-distributional-viz .viz-content",
        "grammar_distribution-phrase",
        vocab,
      );
    })
    .catch((error) => {
      console.error("Failed to load vocabulary:", error);
      // Handle the vocabulary loading error appropriately
      // Display a global error message as vocabulary is essential
      const body = document.querySelector("body");
      if (body) {
        body.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">Critical Error: Failed to load vocabulary. Cannot initialize visualizations.</p>`;
      }
    })
    .finally(() => {
      // Hide the global spinner once vocabulary loading attempt is complete (success or fail)
      hideSpinner(globalSpinner);
    });
});
