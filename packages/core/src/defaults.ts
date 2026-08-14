import type { CanvasBehaviorOptions, CanvasViewportOptions } from "./types.js";

export const canvasDefaults = {
    historyLimit: 50,
    dragThreshold: 3,
    groupPadding: 24,
    connectionHandleRadius: 40,
    connectionNodePadding: 32,
    minZoom: 0.05,
    maxZoom: 5,
    focusCoverage: 0.6,
    focusMaxZoom: 1,
    focusDuration: 450,
    gridSize: 48,
} satisfies Required<CanvasBehaviorOptions & CanvasViewportOptions> & { gridSize: number };
