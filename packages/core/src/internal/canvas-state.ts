import type { CanvasBehaviorOptions, CanvasDocument, CanvasInteractionState, CanvasSelection, Position, ViewportTransform } from "../types.js";

export type CanvasBehavior = Required<CanvasBehaviorOptions>;
export type CanvasHistory<TMetadata> = { past: CanvasDocument<TMetadata>[]; future: CanvasDocument<TMetadata>[] };
export type CanvasDrag<TMetadata> = { start: Position; document: CanvasDocument<TMetadata>; positions: Map<string, Position>; moved: boolean };

export const DEFAULT_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 };
export const DEFAULT_INTERACTION: CanvasInteractionState = { isNodeDragging: false, isNodeResizing: false, dropTargetGroupId: null, connectionInteraction: null };
export const createCanvasSelection = (): CanvasSelection => ({ nodeIds: new Set(), connectionId: null });
export const createCanvasHistory = <TMetadata,>(): CanvasHistory<TMetadata> => ({ past: [], future: [] });
