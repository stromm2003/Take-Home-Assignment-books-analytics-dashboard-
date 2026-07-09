/*
  charts.js — A thin wrapper around Chart.js.

  WHY this file exists:
    Chart.js needs the same boilerplate for every chart (theme, tooltip, resize,
    destroy-before-recreate). We centralise that here so app.js can build a chart
    in one line and never leaks a previous chart instance on the same canvas.
*/

// Brand palette — kept in sync with the CSS custom properties by hand.
const COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#f59e0b",
  red: "#ef4444",
  slate: "#64748b",
  // Ordered set for categorical charts (donut/pie slices).
  categorical: ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"],
};

// Apply shared defaults once (fonts/colours matching the dashboard).
Chart.defaults.font.family =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.color = "#6b7280";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.animation.duration = 700;

// Keep one Chart instance per canvas id so we can destroy/export it later.
const _charts = {};

// Create (or replace) a chart on the given canvas id.
function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (_charts[canvasId]) _charts[canvasId].destroy(); // avoid duplicate overlay
  _charts[canvasId] = new Chart(canvas.getContext("2d"), config);
  return _charts[canvasId];
}

// Export a chart to a downloaded PNG (white background for readability).
function exportChartPNG(canvasId, filename) {
  const chart = _charts[canvasId];
  if (!chart) return;
  const link = document.createElement("a");
  link.href = chart.toBase64Image("image/png", 1);
  link.download = `${filename || canvasId}.png`;
  link.click();
}

// Shared options for charts that use X/Y axes (bars, line, histogram).
function axisOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "#eef1f4" }, ticks: { precision: 0 } },
    },
    ...extra,
  };
}
