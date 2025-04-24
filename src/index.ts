import * as d3 from "d3"; // Keep if needed for global setup or other elements
import * as d3ScaleChromatic from "d3-scale-chromatic"; // Keep if needed globally

// Import initialization functions from component files
import { initGreedySamplingViz } from "./greedySamplingViz";
import { initSoftmaxSamplingViz } from "./softmaxSamplingViz";
import { initConstrainedSamplingViz } from "./constrainedSamplingViz";
import { initConstrainedSamplingDistributionalViz } from "./constrainedSamplingDistributionalViz"; // Import the new function

console.log("d3-scale-chromatic is loaded:", !!d3ScaleChromatic);

// Initialize each visualization by passing the selector for its container

document.addEventListener("DOMContentLoaded", () => {
  initGreedySamplingViz("#greedy-sampling-viz .viz-content");
  initSoftmaxSamplingViz('#softmax-sampling-viz .viz-content');
  initConstrainedSamplingViz('#constrained-sampling-viz .viz-content');
  initConstrainedSamplingDistributionalViz('#constrained-sampling-distributional-viz .viz-content'); // Initialize the new section
});
