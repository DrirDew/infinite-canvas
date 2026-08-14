export type Position = { x: number; y: number };
export type ViewportTransform = Position & { k: number };
export type CanvasRect = Position & { width: number; height: number };
export type CanvasTool = "select" | "pan";
export type ViewportUpdater = ViewportTransform | ((viewport: ViewportTransform) => ViewportTransform);
export type CanvasResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type CanvasNodeDragResult = { moved: boolean; clickedNodeId: string | null };

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Group = "group",
}

export type CanvasNodeTypeId = CanvasNodeType | (string & {});
export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type BaseCanvasNodeMetadata = { groupId?: string };
export type CanvasNode<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: TMetadata;
};
export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};
export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};
export type CanvasConnectionInteraction = { handle: ConnectionHandle; pointer: Position; targetNodeId: string | null };
export type CanvasConnectionDropTarget = { nodeId: string | null; isNearNode: boolean };
export type CanvasConnectionDropResult = CanvasConnectionDropTarget & { handle: ConnectionHandle; position: Position; connection: Omit<CanvasConnection, "id"> | null };
export type CanvasInteractionState = { isNodeDragging: boolean; isNodeResizing: boolean; dropTargetGroupId: string | null; connectionInteraction: CanvasConnectionInteraction | null };
export type CanvasDocument<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    nodes: CanvasNode<TMetadata>[];
    connections: CanvasConnection[];
};
export type CanvasSelection = {
    nodeIds: Set<string>;
    connectionId: string | null;
};
export type CanvasNodePatch<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = Partial<CanvasNode<TMetadata>> | ((node: CanvasNode<TMetadata>) => CanvasNode<TMetadata>);
export type CanvasDocumentUpdater<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = (document: CanvasDocument<TMetadata>) => CanvasDocument<TMetadata>;
export type CanvasCommands<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    setDocument: (document: CanvasDocument<TMetadata>) => void;
    addNode: (node: CanvasNode<TMetadata>) => CanvasDocument<TMetadata>;
    addNodes: (nodes: CanvasNode<TMetadata>[]) => CanvasDocument<TMetadata>;
    updateNode: (id: string, patch: CanvasNodePatch<TMetadata>) => CanvasDocument<TMetadata>;
    removeNodes: (ids: Iterable<string>) => CanvasDocument<TMetadata>;
    addConnection: (connection: CanvasConnection) => CanvasDocument<TMetadata>;
    addConnections: (connections: CanvasConnection[]) => CanvasDocument<TMetadata>;
    removeConnections: (ids: Iterable<string>) => CanvasDocument<TMetadata>;
    selectNodes: (ids: Iterable<string>) => void;
    selectNodesInRect: (rect: CanvasRect, initialIds?: Iterable<string>) => Set<string>;
    selectConnection: (id: string | null) => void;
    clearSelection: () => void;
    startNodeDrag: (ids: Iterable<string>, pointer: Position) => void;
    moveNodeDrag: (pointer: Position) => string | null;
    endNodeDrag: (pointer?: Position) => CanvasNodeDragResult;
    startNodeResize: (id: string) => void;
    resizeNode: (id: string, width: number, height: number, position?: Position) => CanvasDocument<TMetadata>;
    endNodeResize: () => void;
    startConnection: (handle: ConnectionHandle, position: Position) => void;
    moveConnection: (position: Position) => CanvasConnectionDropTarget | null;
    endConnection: (position: Position) => CanvasConnectionDropResult | null;
    cancelConnection: () => void;
    getDocument: () => CanvasDocument<TMetadata>;
    getViewport: () => ViewportTransform;
    getSelection: () => CanvasSelection;
    getInteraction: () => CanvasInteractionState;
    getHistoryDocuments: () => CanvasDocument<TMetadata>[];
    transaction: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    setViewport: (updater: ViewportUpdater) => ViewportTransform;
    undo: () => void;
    redo: () => void;
    preview: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    commitPreview: () => void;
};
export type UseCanvasOptions<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    document?: CanvasDocument<TMetadata>;
    viewport?: ViewportTransform;
    onDocumentChange?: (document: CanvasDocument<TMetadata>) => void;
    onViewportChange?: (viewport: ViewportTransform) => void;
};
export type UseCanvasResult<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    document: CanvasDocument<TMetadata>;
    viewport: ViewportTransform;
    selectedNodeIds: Set<string>;
    selectedConnectionId: string | null;
    canUndo: boolean;
    canRedo: boolean;
    isNodeDragging: boolean;
    isNodeResizing: boolean;
    dropTargetGroupId: string | null;
    connectionInteraction: CanvasConnectionInteraction | null;
    commands: CanvasCommands<TMetadata>;
};
