import type { CanvasCommands } from "./commands.js";
import type { CanvasConnectionInteraction, CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasInteractionState, CanvasSelection, ViewportTransform } from "./model.js";

/** Tunable editing behavior owned by one canvas instance. */
export type CanvasBehaviorOptions = {
    historyLimit?: number;
    dragThreshold?: number;
    groupPadding?: number;
    connectionHandleRadius?: number;
    connectionNodePadding?: number;
};
/** Tunable viewport bounds and focus animation behavior. */
export type CanvasViewportOptions = {
    minZoom?: number;
    maxZoom?: number;
    focusCoverage?: number;
    focusMaxZoom?: number;
    focusDuration?: number;
};
/** Initialization, policy, and subscription options for {@link useCanvas}. */
export type UseCanvasOptions<TMetadata = unknown> = CanvasBehaviorOptions & {
    /** Authoritative controlled document. Omit to let the canvas instance own document state. */
    document?: CanvasDocument<TMetadata>;
    /** Authoritative controlled viewport. Omit to let the canvas instance own viewport state. */
    viewport?: ViewportTransform;
    initialDocument?: CanvasDocument<TMetadata>;
    initialViewport?: ViewportTransform;
    onDocumentChange?: (document: CanvasDocument<TMetadata>) => void;
    onViewportChange?: (viewport: ViewportTransform) => void;
    onSelectionChange?: (selection: CanvasSelection) => void;
    onInteractionChange?: (interaction: CanvasInteractionState) => void;
    resolveConnection?: CanvasConnectionResolver<TMetadata>;
    canGroupNode?: CanvasGroupResolver<TMetadata>;
};
/** Reactive canvas state plus the stable imperative command object. */
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
