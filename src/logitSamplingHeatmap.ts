// @ts-nocheck

import * as d3 from "d3";
import {
  getLuminance,
  getTextColorForBackground,
  transformDataForSortedView,
} from "./utils";
import {
  SamplingAnalysisData,
  Completion,
  LogitsSequence,
  Vocabulary,
  RenderData,
} from "./data";

export const CONFIG = {
  margin: { top: 150, right: 20, bottom: 50, left: 20 },
  cellHeight: 20, // Note: cellHeight is dynamically calculated based on available space now
  cellWidth: 50,
  sampledCharFontSize: "14px",
  cellTokenFontSize: "10px",
  heatmapPadding: 1,
  highlightBackgroundColor: "#FFFF00",
  highlightStrokeColor: "#FFFF00",
  highlightStrokeWidth: 4.5,
  axisTextColor: "#333",
  pillBgColor: "#eee",
  pillPaddingX: 4,
  pillPaddingY: 2,
  pillBorderRadius: 3,
  hoverHighlightColor: "#f0f0f0",
  infoTextColor: "#555",
  infoTextFontSize: "12px",
  colorInterpolator: d3.interpolateBrBG,
  probColorInterpolator: d3.interpolateBrBG,
  tooltipBgColor: "rgba(0, 0, 0, 0.8)",
  tooltipTextColor: "white",
  tooltipPadding: "5px",
  tooltipBorderRadius: "4px",
  tooltipFontSize: "11px",
  dynamicTextColorThreshold: 0.4,
  lightTextColor: "#f0f0f0",
  darkTextColor: "#1a1a1a",
  probPlotHeight: 80,
  probPlotTopN: 5,
  probPlotAxisColor: "#aaa",
  probPlotLabelFontSize: "9px",
};

const setupSVG = (
  container: any,
  width: number,
  height: number,
  config: any,
): any => {
  container.selectAll("svg").remove();
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("display", "block");

  svg
    .append("g")
    .attr("class", "hover-highlights")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);
  svg
    .append("g")
    .attr("class", "prob-plots-group")
    .attr(
      "transform",
      `translate(${config.margin.left},${config.margin.top - config.probPlotHeight - 10})`,
    );
  svg
    .append("g")
    .attr("class", "sampled-chars-group")
    .attr(
      "transform",
      `translate(${config.margin.left},${config.margin.top - config.probPlotHeight - 40})`,
    );
  const mainGroup = svg
    .append("g")
    .attr("class", "heatmap-group")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);
  return { svg, mainGroup };
};

const setupTooltip = (config: any): any => {
  let tooltip = d3.select("body > .heatmap-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("background", config.tooltipBgColor)
      .style("color", config.tooltipTextColor)
      .style("padding", config.tooltipPadding)
      .style("border-radius", config.tooltipBorderRadius)
      .style("font-size", config.tooltipFontSize)
      .style("z-index", 10);
  }
  return tooltip;
};

const calculateScales = (
  numSteps: number,
  numTokens: number,
  originalLogits: number[][],
  sortedData: any[],
  vizWidth: number,
  vizHeight: number,
  config: any,
): any => {
  const xScale = d3
    .scaleBand<number>()
    .domain(d3.range(numSteps))
    .range([0, vizWidth])
    .paddingInner(0);

  const numLogits = originalLogits[0].length;

  const yScale = d3
    .scaleBand<number>()
    .domain(d3.range(numLogits))
    .range([0, vizHeight])
    .paddingInner(0.1);


  let minLogit = d3.min(originalLogits, (step) => d3.min(step));
  let maxLogit = d3.max(originalLogits, (step) => d3.max(step));
  if (
    minLogit === undefined ||
    maxLogit === undefined ||
    minLogit === maxLogit
  ) {
    minLogit = (minLogit ?? 0) - 1;
    maxLogit = (maxLogit ?? 0) + 1;
  }
  const logitColorScale = d3
    .scaleSequential(config.colorInterpolator)
    .domain([minLogit, maxLogit]);

  let maxProb = 0;
  sortedData.forEach((step) => {
    step.slice(0, config.probPlotTopN).forEach((d) => {
      if (d.probability > maxProb) maxProb = d.probability;
    });
  });

  const probYScale = d3
    .scaleLinear()
    .domain([0, 1.0])
    .range([config.probPlotHeight, 0]);

  const probColorScale = d3
    .scaleSequential(config.probColorInterpolator)
    .domain([0, 1.0]);

  return { xScale, yScale, logitColorScale, probYScale, probColorScale };
};

const renderSampledCharacters = (
  svg: any,
  sampledCharacters: string[],
  xScale: any,
  config: any,
): void => {
  const charGroupContainer = svg.select(".sampled-chars-group");
  charGroupContainer.selectAll("*").remove();

  const charGroup = charGroupContainer
    .selectAll(".sampled-char-group")
    .data(sampledCharacters)
    .enter()
    .append("g")
    .attr("class", "sampled-char-group")
    .attr(
      "transform",
      (_, i) => `translate(${xScale(i) + xScale.bandwidth() / 2}, 0)`,
    );

  charGroup
    .append("rect")
    .attr("class", "sampled-char-pill")
    .attr("rx", config.pillBorderRadius)
    .attr("ry", config.pillBorderRadius)
    .attr("fill", config.pillBgColor);

  charGroup
    .append("text")
    .attr("class", "sampled-char-text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-size", config.sampledCharFontSize)
    .style("font-weight", "bold")
    .text((d) => (d === " " ? "' '" : d === "\n" ? "\\n" : d));

  charGroup.each(function () {
    const textNode = d3.select(this).select("text").node();
    if (textNode) {
      const bbox = (textNode as SVGGraphicsElement).getBBox();
      if (
        isFinite(bbox.x) &&
        isFinite(bbox.y) &&
        isFinite(bbox.width) &&
        isFinite(bbox.height)
      ) {
        d3.select(this)
          .select("rect")
          .attr("x", bbox.x - config.pillPaddingX)
          .attr("y", bbox.y - config.pillPaddingY)
          .attr("width", Math.max(0, bbox.width + 2 * config.pillPaddingX))
          .attr("height", Math.max(0, bbox.height + 2 * config.pillPaddingY));
      } else {
        console.warn(
          "Invalid BBox calculated for sampled character:",
          d3.select(this).datum(),
        );
      }
    }
  });
};

const renderProbabilityPlots = (
  svg: any,
  sortedData: any[],
  xScale: any,
  probYScale: any,
  probColorScale: any,
  config: any,
): void => {
  const probGroupContainer = svg.select(".prob-plots-group");
  probGroupContainer.selectAll("*").remove();

  const stepProbGroups = probGroupContainer
    .selectAll(".prob-plot-step")
    .data(sortedData)
    .enter()
    .append("g")
    .attr("class", "prob-plot-step")
    .attr("transform", (_, i) => `translate(${xScale(i)}, 0)`);

  stepProbGroups
    .append("rect")
    .attr("width", xScale.bandwidth())
    .attr("height", config.probPlotHeight)
    .attr("fill", "none")
    .attr("stroke", config.probPlotAxisColor)
    .attr("stroke-width", 0.5);

  stepProbGroups.each(function (stepData) {
    const topNData = stepData.slice(0, config.probPlotTopN);
    const group = d3.select(this);

    const probXScale = d3
      .scaleBand()
      .domain(d3.range(Math.min(config.probPlotTopN, topNData.length)))
      .range([0, xScale.bandwidth()])
      .padding(0.2);

    group
      .selectAll(".prob-bar")
      .data(topNData)
      .enter()
      .append("rect")
      .attr("class", "prob-bar")
      .attr("x", (_, i) => probXScale(i))
      .attr("y", (d) => probYScale(Math.max(0, d.probability)))
      .attr("width", probXScale.bandwidth())
      .attr("height", (d) =>
        Math.max(
          0,
          config.probPlotHeight - probYScale(Math.max(0, d.probability)),
        ),
      )
      .attr("fill", (d) => probColorScale(d.probability));

    group
      .selectAll(".prob-label")
      .data(topNData)
      .enter()
      .append("text")
      .attr("class", "prob-label")
      .attr("x", (_, i) => probXScale(i) + probXScale.bandwidth() / 2)
      .attr("y", config.probPlotHeight + 8)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .style("font-size", config.probPlotLabelFontSize)
      .style("fill", config.axisTextColor)
      .text((d) =>
        d.token === " " ? "' '" : d.token === "\n" ? "\\n" : d.token,
      );

    group
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", config.probPlotHeight)
      .attr("stroke", config.probPlotAxisColor)
      .attr("stroke-width", 1);

    const maxProbTickVal = probYScale.domain()[1];
    if (maxProbTickVal > 0 && isFinite(probYScale(maxProbTickVal))) {
      group
        .append("text")
        .attr("x", -2)
        .attr("y", probYScale(maxProbTickVal))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "8px")
        .style("fill", config.axisTextColor)
        .text(maxProbTickVal.toFixed(2));
    }
    group
      .append("text")
      .attr("x", -2)
      .attr("y", probYScale(0))
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "8px")
      .style("fill", config.axisTextColor)
      .text("0");
  });
};

const renderHeatmapCells = (
  mainGroup: any,
  sortedData: any[],
  sampledCharacters: string[],
  xScale: any,
  yScale: any,
  colorScale: any,
  tooltip: any,
  config: any,
): void => {
  mainGroup.selectAll(".step-group").remove();

  const stepsGroup = mainGroup
    .selectAll(".step-group")
    .data(sortedData)
    .enter()
    .append("g")
    .attr("class", "step-group")
    .attr("transform", (_, i) => `translate(${xScale(i)}, 0)`);

  stepsGroup.each(function (stepData, stepIndex) {
    const currentGroup = d3.select(this);
    const sampledToken = sampledCharacters[stepIndex];
    const sampledTokenRank = stepData.findIndex(
      (d) => d.token === sampledToken,
    );


    const cellGroup = currentGroup
      .selectAll(".cell-group")
      .data(stepData, (d) => d.token)
      .enter()
      .append("g")
      .attr("class", "cell-group")
      .attr("transform", (_, i) => `translate(0, ${yScale(i) ?? 0})`)
      .on("mouseover", (event, d) => {
        const rank = stepData.findIndex((item) => item.token === d.token);
        if (
          d &&
          typeof d.logit === "number" &&
          typeof d.probability === "number" &&
          rank !== -1 &&
          yScale(rank) !== undefined
        ) {
          const tokenDisplay =
            d.token === " " ? "' '" : d.token === "\n" ? "\\n" : d.token;
          const tooltipHtml = `
                        <strong>Token:</strong> ${tokenDisplay}<br>
                        <strong>Logit:</strong> ${d.logit.toFixed(3)}<br>
                        <strong>Softmax-Prob:</strong> ${d.probability.toFixed(4)}<br>
                        <strong>Rank:</strong> ${rank + 1}
                    `;
          tooltip.transition().duration(100).style("opacity", 1);
          tooltip
            .html(tooltipHtml)
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 28 + "px");
        } else {
          console.warn(
            "Invalid data or rank for tooltip:",
            d,
            "Rank:",
            rank,
            "yScale(rank):",
            yScale(rank),
          );
          tooltip.transition().duration(100).style("opacity", 0);
        }
      })
      .on("mouseout", (event) => {
        tooltip.transition().duration(200).style("opacity", 0);
      });

    cellGroup
      .append("rect")
      .attr("class", "logit-cell")
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d, i) => {
        return d3.color(colorScale(d.probability)) || "#ccc";
      })
      .attr("stroke", (d, i) =>
        i === sampledTokenRank ? config.highlightStrokeColor : "none",
      )
      .attr("stroke-width", (d, i) =>
        i === sampledTokenRank ? config.highlightStrokeWidth : 5,
      );

    // Adds text inside of cells
    cellGroup
      .append("text")
      .attr("class", "cell-token-text")
      .attr("x", xScale.bandwidth() / 2)
      .attr("y", yScale.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("font-size", config.cellTokenFontSize)
      .style("fill", (d, i) => {
        const bgColor =
          i === sampledTokenRank
            ? config.highlightBackgroundColor
            : colorScale(d.logit);
        return getTextColorForBackground(bgColor);
      })
      .style("pointer-events", "none")
      .text((d) =>
        d.token === " " ? "' '" : d.token === "\n" ? "\\n" : d.token,
      );
  });
};

export const render = (
  containerSelector: string,
  data: SamplingAnalysisData,
  vocab: Vocabulary,
  userConfig: any = {},
) => {
  const config = {
    ...CONFIG,
    ...userConfig,
    margin: { ...CONFIG.margin, ...userConfig.margin },
  };

  const {
    originalLogitsValues,
    originalLogitTokenIndex,
    completionTokens,
    sampledCharacters,
  } = data;

  if (
    !originalLogitsValues ||
    !originalLogitTokenIndex ||
    !completionTokens ||
    !sampledCharacters ||
    !Array.isArray(originalLogitsValues) ||
    !Array.isArray(originalLogitTokenIndex) ||
    !Array.isArray(completionTokens) ||
    !Array.isArray(sampledCharacters)
  ) {
    console.error("Invalid data structure provided to render function.");
    return;
  }
  if (
    originalLogitsValues.length === 0 ||
    originalLogitsValues.length !== sampledCharacters.length
  ) {
    console.error(
      "Data length mismatch: originalLogits and sampledCharacters must have the same length > 0.",
    );
    return;
  }

  const sortedData = transformDataForSortedView(
    originalLogitsValues,
    originalLogitTokenIndex,
    vocab,
  );
  const numSteps = originalLogitsValues.length;
  const numTokens = completionTokens.length;

  const container = d3.select(containerSelector);
  const rawWidth = (container.node() as HTMLElement).getBoundingClientRect()
    .width;
  const minWidthThreshold = 100;
  const defaultWidth = 500;
  let availableWidth = rawWidth >= minWidthThreshold ? rawWidth : defaultWidth;

  if (!availableWidth || availableWidth < minWidthThreshold) {
    console.warn(
      `Container "${containerSelector}" has invalid width (${availableWidth}px). Falling back to default width (${defaultWidth}px). Ensure the container or its parent has a defined width.`,
    );
    availableWidth = defaultWidth;
  }


  const vizWidth = availableWidth - config.margin.left - config.margin.right;
  config.cellWidth = Math.max(
    10,
    Math.min(config.cellWidth, vizWidth / numSteps),
  );

  const estimatedCellHeight = config.cellHeight;
  const vizHeight =
    numTokens * (estimatedCellHeight + estimatedCellHeight * 0.1);
  const totalHeight = vizHeight + config.margin.top + config.margin.bottom;

  const { svg, mainGroup } = setupSVG(
    container,
    availableWidth,
    totalHeight,
    config,
  );
  const tooltip = setupTooltip(config);

  const { xScale, yScale, logitColorScale, probYScale, probColorScale } =
    calculateScales(
      numSteps,
      numTokens,
      originalLogitsValues,
      sortedData,
      vizWidth,
      vizHeight,
      config,
    );

  renderSampledCharacters(svg, sampledCharacters, xScale, config);
  renderProbabilityPlots(
    svg,
    sortedData,
    xScale,
    probYScale,
    probColorScale,
    config,
  );
  renderHeatmapCells(
    mainGroup,
    sortedData,
    sampledCharacters,
    xScale,
    yScale,
    probColorScale,
    tooltip,
    config,
  );
};

/**
 * Initializes full visualization: controls dropdown, info pane, and heatmap.
 */
export function initSamplingWithControls(
  containerSelector: string,
  sampleDataSets: SamplingAnalysisData[],
  vocab: Vocabulary,
): void {
  const mainContainer = d3.select<HTMLDivElement, unknown>(containerSelector);
  if (mainContainer.empty()) {
    console.error(`Main container element not found: ${containerSelector}`);
    return;
  }

  mainContainer
    .html("") // clear old content
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "stretch")
    .style("width", "100%");

  const controlsContainer = mainContainer
    .append("div")
    .attr("class", "viz-controls")
    .style("margin-bottom", "15px")
    .style("padding-left", `${CONFIG.margin.left}px`);

  const contentWrapper = mainContainer
    .append("div")
    .attr("class", "viz-content")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "16px")
    .style("padding", "0");

  contentWrapper
    .append("div")
    .attr("class", "info-pane")
    .attr("contenteditable", "true")
    .html(
      "<p><strong>Explanation:</strong> Describe how input maps to completion.</p>",
    )
    .style("flex", "0 0 30%")
    .style("min-width", "200px")
    .style("max-width", "400px")
    .style("padding", "8px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-size", "14px")
    .style("line-height", "1.4");

  const vizContainer = contentWrapper
    .append("div")
    .attr("class", "viz-area")
    .style("flex", "1 1 60%")
    .style("min-width", "0")
    .style("overflow-x", "auto");

  const vizContainerId = `viz-area-${Date.now()}`;
  vizContainer.attr("id", vizContainerId);

  if (!sampleDataSets.length) {
    mainContainer.html("<p>Error: No sample data available.</p>");
    return;
  }

  controlsContainer
    .append("label")
    .attr("for", "sample-select")
    .text("Select Sample Phrase: ")
    .style("margin-right", "5px");

  const select = controlsContainer.append("select").attr("id", "sample-select");

  select
    .selectAll<HTMLOptionElement, SamplingAnalysisData>("option")
    .data(sampleDataSets)
    .enter()
    .append("option")
    .attr("value", (_, i) => i.toString())
    .text((d) => d.id);

  const loadSelectedData = () => {
    const idx = parseInt(select.property("value"), 10);
    const item = sampleDataSets[idx];
    if (!item) {
      console.error("Selected data not found for index:", idx);
      vizContainer.html("<p>Error loading selected sample.</p>");
      return;
    }

    vizContainer.html("");
    vizContainer
      .append("div")
      .attr("class", "input-header")
      .style("font-size", "12px")
      .style("color", "#666")
      .style("margin-bottom", "4px")
      .text("Input Text:");

    vizContainer
      .append("div")
      .attr("class", "input-pill")
      .style("display", "inline-block")
      .style("background", "#eee")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("margin-bottom", "8px")
      .text(item.inputText);

    vizContainer
      .append("hr")
      .style("border", "none")
      .style("border-top", "1px solid #ccc")
      .style("margin", "12px 0");

    // Create the header div for "Completion:"
    const completionHeader = vizContainer
      .append("div")
      .attr("class", "input-header") // Re-use class if styles align, or use a new one
      .style("font-size", "12px")
      .style("color", "#666")
      .style("margin-bottom", "4px");

    // Add the "Completion: " label text
    completionHeader.append("span").text("Completion: ");

    console.log(item);
    // Add the full completion text next to it, styled differently
    completionHeader
      .append("span")
      .style("font-size", "12px") // Smaller font size
      .style("color", "#333") // Optional: different color
      .style("margin-left", "5px") // Add some space
      .style("background", "#eee")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .text(item.sampledCharacters.join("")); // Join the tokens into a single string

    render(`#${vizContainerId}`, sampleDataSets[idx], vocab);
  };

  select.on("change", loadSelectedData);
  loadSelectedData();
}
