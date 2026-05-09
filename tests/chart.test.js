import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

describe("chart.js", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="chart"></div>`;

    HTMLCanvasElement.prototype.getContext = () => ({
      lineWidth: 0,
      strokeStyle: "",
      beginPath() {},
      arc() {},
      stroke() {},
      clearRect() {},
    });

    const chartPath = join(process.cwd(), "chart.js");
    const chartCode = readFileSync(chartPath, "utf8");
    window.eval(`${chartCode}\n//# sourceURL=${pathToFileURL(chartPath).href}`);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("updates the chart without throwing for normal income and expense values", () => {
    expect(() => {
      window.updateChart(1000, 200);
    }).not.toThrow();
  });

  it("updates the chart without throwing when income is greater than expense", () => {
    expect(() => {
      window.updateChart(500, 100);
    }).not.toThrow();
  });

  it("updates the chart without throwing when expense is greater than income", () => {
    expect(() => {
      window.updateChart(100, 500);
    }).not.toThrow();
  });

  it("updates the chart without throwing for zero values", () => {
    expect(() => {
      window.updateChart(0, 0);
    }).not.toThrow();
  });
});
