import type { CanvasClipboard, CanvasConnection, CanvasConnectionDropResult, CanvasConnectionDropTarget, CanvasDocument, CanvasInteractionState, CanvasNode, CanvasNodeDragResult, CanvasRect, CanvasSelection, ConnectionHandle, Position, ViewportTransform } from "./model.js";

/** A viewport value or immutable updater evaluated against the latest viewport. */
export type ViewportUpdater = ViewportTransform | ((viewport: ViewportTransform) => ViewportTransform);
/** A shallow node patch or immutable updater evaluated against the current node. */
export type CanvasNodePatch<TMetadata = unknown> = Partial<CanvasNode<TMetadata>> | ((node: CanvasNode<TMetadata>) => CanvasNode<TMetadata>);
/** An immutable document transaction applied atomically to history. */
export type CanvasDocumentUpdater<TMetadata = unknown> = (document: CanvasDocument<TMetadata>) => CanvasDocument<TMetadata>;
/** Host callbacks used to create unique IDs and map nodes during paste. */
export type CanvasPasteOptions<TMetadata = unknown> = {
    position: Position;
    createNodeId: (node: CanvasNode<TMetadata>, index: number) => string;
    createConnectionId: (connection: CanvasConnection, index: number) => string;
    mapNode?: (node: CanvasNode<TMetadata>, index: number) => CanvasNode<TMetadata>;
};
/**
 * Stable imperative commands owned by one canvas instance.
 * Document commands preserve immutable snapshots and record history unless documented as previews.
 */
export type CanvasCommands<TMetadata = unknown> = {
    /** Replaces the complete document, validates it, and clears selection and history. */
    setDocument: (document: CanvasDocument<TMetadata>) => void;
    /** Adds one valid node and records one history entry. */
    addNode: (node: CanvasNode<TMetadata>) => CanvasDocument<TMetadata>;
    /** Adds multiple valid nodes in one history entry. */
    addNodes: (nodes: readonly CanvasNode<TMetadata>[]) => CanvasDocument<TMetadata>;
    /** Updates one node and repairs affected groups and connections. */
    updateNode: (id: string, patch: CanvasNodePatch<TMetadata>) => CanvasDocument<TMetadata>;
    /** Removes nodes, their connections, and child group membership. */
    removeNodes: (ids: Iterable<string>) => CanvasDocument<TMetadata>;
    /** Adds one valid connection and records one history entry. */
    addConnection: (connection: CanvasConnection) => CanvasDocument<TMetadata>;
    /** Adds multiple valid connections in one history entry. */
    addConnections: (connections: readonly CanvasConnection[]) => CanvasDocument<TMetadata>;
    /** Removes connections by ID. */
    removeConnections: (ids: Iterable<string>) => CanvasDocument<TMetadata>;
    /** Replaces the node selection after discarding missing IDs. */
    selectNodes: (ids: Iterable<string>) => void;
    /** Selects nodes intersecting a world rectangle and optional initial selection. */
    selectNodesInRect: (rect: CanvasRect, initialIds?: Iterable<string>) => ReadonlySet<string>;
    /** Selects one existing connection or clears connection selection. */
    selectConnection: (id: string | null) => void;
    /** Clears both node and connection selection. */
    clearSelection: () => void;
    /** Starts a screen-coordinate node drag without changing history. */
    startNodeDrag: (ids: Iterable<string>, pointer: Position) => void;
    /** Updates the transient node drag preview from a screen coordinate. */
    moveNodeDrag: (pointer: Position) => string | null;
    /** Commits or cancels the active drag and returns its click/move result. */
    endNodeDrag: (pointer?: Position) => CanvasNodeDragResult;
    /** Starts a node resize preview. */
    startNodeResize: (id: string) => void;
    /** Updates the active resize preview in world units. */
    resizeNode: (id: string, width: number, height: number, position?: Position) => CanvasDocument<TMetadata>;
    /** Commits the active resize as one history entry. */
    endNodeResize: () => void;
    /** Restores the document from before the active resize. */
    cancelNodeResize: () => void;
    /** Starts a connection interaction at a world coordinate. */
    startConnection: (handle: ConnectionHandle, position: Position) => void;
    /** Updates connection targeting at a world coordinate. */
    moveConnection: (position: Position) => CanvasConnectionDropTarget | null;
    /** Ends connection targeting without generating a persistent connection ID. */
    endConnection: (position: Position) => CanvasConnectionDropResult | null;
    /** Clears the transient connection interaction. */
    cancelConnection: () => void;
    /** Copies selected nodes and their internal connections into instance memory. */
    copySelection: () => CanvasClipboard<TMetadata> | null;
    /** Pastes the instance clipboard as one validated history entry. */
    pasteClipboard: (options: CanvasPasteOptions<TMetadata>) => CanvasClipboard<TMetadata> | null;
    /** Returns the current instance-local clipboard snapshot. */
    getClipboard: () => CanvasClipboard<TMetadata> | null;
    /** Returns the latest immutable document snapshot without subscribing to React state. */
    getDocument: () => CanvasDocument<TMetadata>;
    /** Returns the latest viewport without subscribing to React state. */
    getViewport: () => ViewportTransform;
    /** Returns the latest immutable selection snapshot. */
    getSelection: () => CanvasSelection;
    /** Returns the latest transient interaction state. */
    getInteraction: () => CanvasInteractionState;
    /** Returns the document snapshots currently retained by undo and redo history. */
    getHistoryDocuments: () => CanvasDocument<TMetadata>[];
    /** Applies one atomic immutable document update and records one history entry. */
    transaction: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    /** Updates the viewport outside document history. */
    setViewport: (updater: ViewportUpdater) => ViewportTransform;
    /** Restores the previous document snapshot. */
    undo: () => void;
    /** Restores the next document snapshot. */
    redo: () => void;
    /** Publishes a transient document without notifying persistent document listeners. */
    preview: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    /** Commits the active preview as one history entry. */
    commitPreview: () => void;
    /** Restores the document from before the active preview. */
    cancelPreview: () => void;
};
