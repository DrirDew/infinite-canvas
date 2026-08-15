import { canvasDefaults } from "../defaults.js";
import type { CanvasGroupResolver, CanvasNode, CanvasRect, CanvasResizeCorner, Position } from "../canvas/model.js";
import { CANVAS_SPATIAL_INDEX_THRESHOLD, getCanvasNodeSpatialIndex, nodeIntersectsRect } from "./spatial-index.js";

/** Normalizes two world points into a positive axis-aligned rectangle. */
export function normalizeRect(start: Position, end: Position): CanvasRect {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

/** Computes resized node bounds for one corner with optional aspect-ratio locking. */
export function resizeNodeBounds(node: Pick<CanvasNode, "position" | "width" | "height">, corner: CanvasResizeCorner, delta: Position, keepRatio = false, ratio = node.width / node.height, minWidth = canvasDefaults.resizeMinWidth, minHeight = canvasDefaults.resizeMinHeight) {
    const fromLeft = corner.includes("left");
    const fromTop = corner.includes("top");
    const right = node.position.x + node.width;
    const bottom = node.position.y + node.height;
    let width = Math.max(minWidth, node.width + (fromLeft ? -delta.x : delta.x));
    let height = Math.max(minHeight, node.height + (fromTop ? -delta.y : delta.y));
    if (keepRatio) {
        if (Math.abs(delta.x) >= Math.abs(delta.y)) height = width / ratio;
        else width = height * ratio;
        if (height < minHeight) [width, height] = [minHeight * ratio, minHeight];
        if (width < minWidth) [width, height] = [minWidth, minWidth / ratio];
    }
    return { width, height, position: { x: fromLeft ? right - width : node.position.x, y: fromTop ? bottom - height : node.position.y } };
}

/** Returns nodes intersecting a world rectangle while preserving document order. */
export function nodesInRect<T>(nodes: readonly CanvasNode<T>[], rect: CanvasRect) {
    return nodes.length < CANVAS_SPATIAL_INDEX_THRESHOLD ? nodes.filter((node) => nodeIntersectsRect(node, rect)) : getCanvasNodeSpatialIndex(nodes).query(rect);
}

/** Returns the world-space bounds enclosing all supplied nodes. */
export function nodeBounds<T>(nodes: readonly CanvasNode<T>[]) {
    return nodes.reduce(
        (acc, node) => ({ left: Math.min(acc.left, node.position.x), top: Math.min(acc.top, node.position.y), right: Math.max(acc.right, node.position.x + node.width), bottom: Math.max(acc.bottom, node.position.y + node.height) }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

/** Returns whether a node participates in Core group behavior. */
export const isGroupNode = <T,>(node: CanvasNode<T>) => node.role === "group";

/** Finds the topmost group accepting at least one moved node center. */
export function findGroupDropTarget<T>(movedIds: ReadonlySet<string>, nodes: readonly CanvasNode<T>[], canGroupNode?: CanvasGroupResolver<T>) {
    if (nodes.some((node) => movedIds.has(node.id) && isGroupNode(node))) return null;
    const moving = nodes.filter((node) => movedIds.has(node.id) && !isGroupNode(node));
    if (!moving.length) return null;
    for (let index = nodes.length - 1; index >= 0; index--) {
        const group = nodes[index]!;
        if (isGroupNode(group) && !movedIds.has(group.id) && moving.some((node) => (!canGroupNode || canGroupNode(node, group)) && node.position.x + node.width / 2 >= group.position.x && node.position.x + node.width / 2 <= group.position.x + group.width && node.position.y + node.height / 2 >= group.position.y && node.position.y + node.height / 2 <= group.position.y + group.height)) return group;
    }
    return null;
}

/** Moves selected nodes inside a group and assigns their group ID. */
export function snapNodesIntoGroup<T>(movedIds: ReadonlySet<string>, nodes: readonly CanvasNode<T>[], group: CanvasNode<T>, padding = canvasDefaults.groupPadding) {
    const moving = nodes.filter((node) => movedIds.has(node.id) && !isGroupNode(node));
    if (!moving.length) return [...nodes];
    const bounds = nodeBounds(moving);
    const [left, top, right, bottom] = [group.position.x + padding, group.position.y + padding, group.position.x + group.width - padding, group.position.y + group.height - padding];
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => (!movedIds.has(node.id) || isGroupNode(node) ? node : { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, groupId: group.id }));
}

/** Finds the topmost group containing a node center. */
export function findContainingGroupId<T>(node: CanvasNode<T>, nodes: readonly CanvasNode<T>[], canGroupNode?: CanvasGroupResolver<T>) {
    const x = node.position.x + node.width / 2;
    const y = node.position.y + node.height / 2;
    for (let index = nodes.length - 1; index >= 0; index--) {
        const group = nodes[index]!;
        if (isGroupNode(group) && group.id !== node.id && (!canGroupNode || canGroupNode(node, group)) && x >= group.position.x && x <= group.position.x + group.width && y >= group.position.y && y <= group.position.y + group.height) return group.id;
    }
}

/** Fits a media size within maximum bounds without changing its aspect ratio. */
export function fitNodeSize(width: number, height: number, maxWidth = 640, maxHeight = 640) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    return { width: w * scale, height: h * scale };
}

/** Parses an `x` or `:` ratio string into a size bounded by the supplied base box. */
export function nodeSizeFromRatio(size: string, baseWidth: number, baseHeight: number) {
    const match = size?.match(/^(\d+)(?:x|:)(\d+)/);
    if (!match) return null;
    const ratio = Number(match[1]) / Math.max(1, Number(match[2]));
    if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight };
    return ratio >= baseWidth / baseHeight ? { width: baseWidth, height: baseWidth / ratio } : { width: baseHeight * ratio, height: baseHeight };
}
