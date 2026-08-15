import { canvasDefaults } from "../defaults.js";
import type { CanvasConnectionDropTarget, CanvasConnectionInteraction, CanvasConnectionResolver, CanvasNode, ConnectionHandle, Position } from "../types.js";
import { isGroupNode } from "./nodes.js";
import { CANVAS_SPATIAL_INDEX_THRESHOLD, getCanvasNodeSpatialIndex } from "./spatial-index.js";

/** Returns the candidate-side anchor used by the current source or target handle. */
export function getConnectionTargetAnchor<T>(node: CanvasNode<T>, current: ConnectionHandle) {
    return { x: current.handleType === "source" ? node.position.x : node.position.x + node.width, y: node.position.y + node.height / 2 };
}

/** Builds the default cubic Bézier path between two nodes or an active pointer. */
export function getConnectionPath<T>(source: CanvasNode<T>, target?: CanvasNode<T>, interaction?: CanvasConnectionInteraction) {
    const start = interaction?.handle.handleType === "target" ? (target ? { x: target.position.x + target.width, y: target.position.y + target.height / 2 } : interaction.pointer) : { x: source.position.x + source.width, y: source.position.y + source.height / 2 };
    const end = interaction?.handle.handleType === "target" ? { x: source.position.x, y: source.position.y + source.height / 2 } : target ? { x: target.position.x, y: target.position.y + target.height / 2 } : interaction?.pointer || start;
    const curvature = interaction ? Math.abs(end.x - start.x) * 0.5 : Math.max(Math.abs(end.x - start.x) * 0.5, 50);
    return `M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`;
}

/** Finds the highest-priority valid connection target near a world coordinate. */
export function findConnectionDropTarget<T>(nodes: readonly CanvasNode<T>[], current: ConnectionHandle, position: Position, scale = 1, resolver?: CanvasConnectionResolver<T>, handleRadius = canvasDefaults.connectionHandleRadius, nodePadding = canvasDefaults.connectionNodePadding): CanvasConnectionDropTarget {
    const radius = handleRadius / Math.max(scale, 0.05);
    const padding = nodePadding / Math.max(scale, 0.05);
    let isNearNode = false;
    let nodeId: string | null = null;
    let priority = Infinity;
    const index = nodes.length >= CANVAS_SPATIAL_INDEX_THRESHOLD ? getCanvasNodeSpatialIndex(nodes) : null;
    const first = index?.get(current.nodeId) || nodes.find((node) => node.id === current.nodeId);
    if (!first) return { nodeId, isNearNode };
    const extent = Math.max(radius, padding) + 1;
    const candidates = index?.query({ x: position.x - extent, y: position.y - extent, width: extent * 2, height: extent * 2 }) || nodes;
    for (let index = candidates.length - 1; index >= 0; index--) {
        const node = candidates[index]!;
        const anchor = getConnectionTargetAnchor(node, current);
        const dx = position.x - anchor.x;
        const dy = position.y - anchor.y;
        const hitsHandle = dx * dx + dy * dy <= radius * radius;
        const hitsInside = position.x >= node.position.x && position.x <= node.position.x + node.width && position.y >= node.position.y && position.y <= node.position.y + node.height;
        const hitsExpanded = position.x >= node.position.x - padding && position.x <= node.position.x + node.width + padding && position.y >= node.position.y - padding && position.y <= node.position.y + node.height + padding;
        if (!hitsHandle && !hitsInside && !hitsExpanded) continue;
        isNearNode = true;
        if (node.id === current.nodeId || !normalizeConnectionNodes(first, node, current, resolver)) continue;
        const nextPriority = hitsInside ? 0 : hitsHandle ? 1 : 2;
        if (nextPriority < priority) {
            nodeId = node.id;
            priority = nextPriority;
        }
    }
    return { nodeId, isNearNode };
}

/** Validates two node IDs and normalizes their persistent connection direction. */
export function normalizeConnection<T>(firstNodeId: string, secondNodeId: string, nodes: readonly CanvasNode<T>[], firstHandleType: "source" | "target", resolver?: CanvasConnectionResolver<T>, firstHandleId?: string, secondHandleId?: string) {
    const index = nodes.length >= CANVAS_SPATIAL_INDEX_THRESHOLD ? getCanvasNodeSpatialIndex(nodes) : null;
    const first = index?.get(firstNodeId) || nodes.find((node) => node.id === firstNodeId);
    const second = index?.get(secondNodeId) || nodes.find((node) => node.id === secondNodeId);
    return first && second ? normalizeConnectionNodes(first, second, { nodeId: firstNodeId, handleType: firstHandleType, handleId: firstHandleId }, resolver, secondHandleId) : null;
}

/** Applies host policy and verifies that a resolver only connects the two supplied nodes. */
function normalizeConnectionNodes<T>(first: CanvasNode<T>, second: CanvasNode<T>, firstHandle: ConnectionHandle, resolver?: CanvasConnectionResolver<T>, secondHandleId?: string) {
    if (first.id === second.id || isGroupNode(first) || isGroupNode(second)) return null;
    let connection = resolver
        ? resolver(first, second, firstHandle.handleType, firstHandle.handleId)
        : firstHandle.handleType === "source"
          ? { fromNodeId: first.id, toNodeId: second.id, ...(firstHandle.handleId === undefined ? {} : { fromHandleId: firstHandle.handleId }), ...(secondHandleId === undefined ? {} : { toHandleId: secondHandleId }) }
          : { fromNodeId: second.id, toNodeId: first.id, ...(secondHandleId === undefined ? {} : { fromHandleId: secondHandleId }), ...(firstHandle.handleId === undefined ? {} : { toHandleId: firstHandle.handleId }) };
    if (connection && firstHandle.handleId !== undefined) {
        if (connection.fromNodeId === first.id && connection.fromHandleId === undefined) connection = { ...connection, fromHandleId: firstHandle.handleId };
        if (connection.toNodeId === first.id && connection.toHandleId === undefined) connection = { ...connection, toHandleId: firstHandle.handleId };
    }
    return connection && connection.fromNodeId !== connection.toNodeId && [first.id, second.id].includes(connection.fromNodeId) && [first.id, second.id].includes(connection.toNodeId) ? connection : null;
}
