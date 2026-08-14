import type { CanvasCommands } from "./commands.js";
import type { CanvasConnectionInteraction, CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasInteractionState, CanvasSelection, ViewportTransform } from "./model.js";

export type CanvasBehaviorOptions = {
    historyLimit?: number;
    dragThreshold?: number;
    groupPadding?: number;
    connectionHandleRadius?: number;
    connectionNodePadding?: number;
};
export type CanvasViewportOptions = {
    minZoom?: number;
    maxZoom?: number;
    focusCoverage?: number;
    focusMaxZoom?: number;
    focusDuration?: number;
};
export type UseCanvasOptions<TMetadata = unknown> = CanvasBehaviorOptions & {
    document?: CanvasDocument<TMetadata>;
    viewport?: ViewportTransform;
    onDocumentChange?: (document: CanvasDocument<TMetadata>) => void;
    onViewportChange?: (viewport: ViewportTransform) => void;
    onSelectionChange?: (selection: CanvasSelection) => void;
    onInteractionChange?: (interaction: CanvasInteractionState) => void;
    resolveConnection?: CanvasConnectionResolver<TMetadata>;
    canGroupNode?: CanvasGroupResolver<TMetadata>;
};
export type UseCanvasResult<TMetadata = unknown> = {
    document: CanvasDocument<TMetadata>;
    viewport: ViewportTransform;
    selectedNodeIds: ReadonlySet<string>;
    selectedConnectionId: string | null;
    canUndo: boolean;
    canRedo: boolean;
    isNodeDragging: boolean;
    isNodeResizing: boolean;
    dropTargetGroupId: string | null;
    connectionInteraction: CanvasConnectionInteraction | null;
    commands: CanvasCommands<TMetadata>;
};
