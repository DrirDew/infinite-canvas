import type { CanvasBehaviorOptions, CanvasViewportOptions } from "./types.js";

export type CanvasDefaults = Required<CanvasBehaviorOptions & CanvasViewportOptions> & {
    gridSize: number;
    resizeMinWidth: number;
    resizeMinHeight: number;
    resizeHandleSize: number;
    connectionPortHitSize: number;
    connectionPortOffset: number;
    connectionPortIndicatorSize: number;
    connectionStrokeHitWidth: number;
    minimapWidth: number;
    minimapHeight: number;
    minimapWorldPadding: number;
    minimapNodeSize: number;
    minimapViewportSize: number;
};

export const canvasDefaults: CanvasDefaults = {
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
    resizeMinWidth: 24,
    resizeMinHeight: 24,
    resizeHandleSize: 28,
    connectionPortHitSize: 48,
    connectionPortOffset: 24,
    connectionPortIndicatorSize: 12,
    connectionStrokeHitWidth: 16,
    minimapWidth: 240,
    minimapHeight: 160,
    minimapWorldPadding: 500,
    minimapNodeSize: 2,
    minimapViewportSize: 4,
};
