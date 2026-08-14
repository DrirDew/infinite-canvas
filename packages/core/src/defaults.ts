import type { CanvasBehaviorOptions } from "./types";

export const canvasDefaults = {
    historyLimit: 50,
    dragThreshold: 3,
    groupPadding: 24,
    connectionHandleRadius: 40,
    connectionNodePadding: 32,
} satisfies Required<CanvasBehaviorOptions>;
