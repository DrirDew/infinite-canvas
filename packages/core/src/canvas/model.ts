/** A point in canvas world coordinates. */
export type Position = { readonly x: number; readonly y: number };
/** A width and height measured in canvas world units. */
export type CanvasSize = { readonly width: number; readonly height: number };
/** The translation and zoom applied to the canvas world. */
export type ViewportTransform = Position & { readonly k: number };
/** The canvas container origin in client coordinates. */
export type CanvasViewportOrigin = { readonly left: number; readonly top: number };
/** An axis-aligned rectangle in canvas world coordinates. */
export type CanvasRect = Position & CanvasSize;
/** The built-in pointer tools supported by the canvas surface. */
export type CanvasTool = "select" | "pan";
/** A corner used by the node resize interaction. */
export type CanvasResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
/** An application-defined node type identifier. */
export type CanvasNodeTypeId = string;
/** A structural role understood by the core engine. */
export type CanvasNodeRole = "group";
/**
 * An immutable node snapshot stored in a canvas document.
 * Metadata is owned by the host and is therefore not cloned or frozen by Core.
 */
export type CanvasNode<TMetadata = unknown> = {
    readonly id: string;
    readonly type: CanvasNodeTypeId;
    readonly role?: CanvasNodeRole;
    readonly groupId?: string;
    readonly title: string;
    readonly position: Position;
    readonly width: number;
    readonly height: number;
    readonly metadata?: TMetadata;
};
/** An immutable directed connection between two nodes. */
export type CanvasConnection = { readonly id: string; readonly fromNodeId: string; readonly toNodeId: string };
/**
 * The authoritative immutable canvas snapshot.
 * Every edit must create a new document through a Core command or mutation helper.
 */
export type CanvasDocument<TMetadata = unknown> = { readonly nodes: readonly CanvasNode<TMetadata>[]; readonly connections: readonly CanvasConnection[] };
/** A detached document fragment used by copy and paste commands. */
export type CanvasClipboard<TMetadata = unknown> = CanvasDocument<TMetadata>;
/** The current immutable node or connection selection. */
export type CanvasSelection = { readonly nodeIds: ReadonlySet<string>; readonly connectionId: string | null };
/** Resolves connection direction and host-specific connection rules. */
export type CanvasConnectionResolver<TMetadata = unknown> = (first: CanvasNode<TMetadata>, second: CanvasNode<TMetadata>, firstHandleType: "source" | "target") => Omit<CanvasConnection, "id"> | null;
/** Determines whether a node may belong to a group. */
export type CanvasGroupResolver<TMetadata = unknown> = (node: CanvasNode<TMetadata>, group: CanvasNode<TMetadata>) => boolean;
/** A source or target connection handle on a node. */
export type ConnectionHandle = { readonly nodeId: string; readonly handleType: "source" | "target" };
/** Transient state while the pointer is creating a connection. */
export type CanvasConnectionInteraction = { readonly handle: ConnectionHandle; readonly pointer: Position; readonly targetNodeId: string | null };
/** The nearest valid node discovered during connection targeting. */
export type CanvasConnectionDropTarget = { readonly nodeId: string | null; readonly isNearNode: boolean };
/** The host-facing result produced when a connection interaction ends. */
export type CanvasConnectionDropResult = CanvasConnectionDropTarget & { readonly handle: ConnectionHandle; readonly position: Position; readonly connection: Omit<CanvasConnection, "id"> | null };
/** Transient interaction state excluded from document history. */
export type CanvasInteractionState = { readonly isNodeDragging: boolean; readonly isNodeResizing: boolean; readonly dropTargetGroupId: string | null; readonly connectionInteraction: CanvasConnectionInteraction | null };
/** Describes whether a node gesture moved or resolved as a click. */
export type CanvasNodeDragResult = { readonly moved: boolean; readonly clickedNodeId: string | null };
/** A normalized keyboard action understood by a canvas host. */
export type CanvasShortcut = "undo" | "redo" | "select-all" | "copy" | "paste" | "delete" | "escape";
/** The platform-neutral keyboard fields used to resolve shortcuts. */
export type CanvasShortcutEvent = { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean };
