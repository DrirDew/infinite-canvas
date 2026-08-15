import type { CanvasBehaviorOptions } from "../canvas/options.js";
import type { CanvasDocument, CanvasInteractionState, CanvasSelection, Position, ViewportTransform } from "../canvas/model.js";

export type CanvasBehavior = Required<CanvasBehaviorOptions>;
export type CanvasHistory<TMetadata> = { past: CanvasDocument<TMetadata>[]; future: CanvasDocument<TMetadata>[] };
export type CanvasDrag<TMetadata> = { start: Position; document: CanvasDocument<TMetadata>; positions: Map<string, Position>; moved: boolean };

export const DEFAULT_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 };
export const DEFAULT_INTERACTION: CanvasInteractionState = { kind: "idle", isNodeDragging: false, isNodeResizing: false, dropTargetGroupId: null, connectionInteraction: null };
export const createNodeDragInteraction = (dropTargetGroupId: string | null = null): CanvasInteractionState => ({ kind: "node-drag", isNodeDragging: true, isNodeResizing: false, dropTargetGroupId, connectionInteraction: null });
export const NODE_RESIZE_INTERACTION: CanvasInteractionState = { kind: "node-resize", isNodeDragging: false, isNodeResizing: true, dropTargetGroupId: null, connectionInteraction: null };
export const createConnectionInteraction = (connectionInteraction: NonNullable<CanvasInteractionState["connectionInteraction"]>): CanvasInteractionState => ({ kind: "connection", isNodeDragging: false, isNodeResizing: false, dropTargetGroupId: null, connectionInteraction });
export const createCanvasSelection = (): CanvasSelection => ({ nodeIds: new Set(), connectionId: null });
export const createCanvasHistory = <TMetadata,>(): CanvasHistory<TMetadata> => ({ past: [], future: [] });
