import { canvasDefaults } from "../defaults.js";
import type { CanvasConnectionDropTarget, CanvasConnectionInteraction, CanvasConnectionResolver, CanvasNode, ConnectionHandle, Position } from "../types.js";
import { isGroupNode } from "./nodes.js";

export function getConnectionTargetAnchor<T>(node: CanvasNode<T>, current: ConnectionHandle) {
    return { x: current.handleType === "source" ? node.position.x : node.position.x + node.width, y: node.position.y + node.height / 2 };
}

export function getConnectionPath<T>(source: CanvasNode<T>, target?: CanvasNode<T>, interaction?: CanvasConnectionInteraction) {
    const start = interaction?.handle.handleType === "target" ? (target ? { x: target.position.x + target.width, y: target.position.y + target.height / 2 } : interaction.pointer) : { x: source.position.x + source.width, y: source.position.y + source.height / 2 };
    const end = interaction?.handle.handleType === "target" ? { x: source.position.x, y: source.position.y + source.height / 2 } : target ? { x: target.position.x, y: target.position.y + target.height / 2 } : interaction?.pointer || start;
    const curvature = interaction ? Math.abs(end.x - start.x) * 0.5 : Math.max(Math.abs(end.x - start.x) * 0.5, 50);
    return `M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`;
}

export function findConnectionDropTarget<T>(nodes: CanvasNode<T>[], current: ConnectionHandle, position: Position, scale = 1, resolver?: CanvasConnectionResolver<T>, handleRadius = canvasDefaults.connectionHandleRadius, nodePadding = canvasDefaults.connectionNodePadding): CanvasConnectionDropTarget {
    const radius = handleRadius / Math.max(scale, 0.05);
    const padding = nodePadding / Math.max(scale, 0.05);
    let isNearNode = false;
    let nodeId: string | null = null;
    let priority = Infinity;
    [...nodes].reverse().forEach((node) => {
        const anchor = getConnectionTargetAnchor(node, current);
        const dx = position.x - anchor.x;
        const dy = position.y - anchor.y;
        const hitsHandle = dx * dx + dy * dy <= radius * radius;
        const hitsInside = position.x >= node.position.x && position.x <= node.position.x + node.width && position.y >= node.position.y && position.y <= node.position.y + node.height;
        const hitsExpanded = position.x >= node.position.x - padding && position.x <= node.position.x + node.width + padding && position.y >= node.position.y - padding && position.y <= node.position.y + node.height + padding;
        if (!hitsHandle && !hitsInside && !hitsExpanded) return;
        isNearNode = true;
        if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodes, current.handleType, resolver)) return;
        const nextPriority = hitsInside ? 0 : hitsHandle ? 1 : 2;
        if (nextPriority < priority) {
            nodeId = node.id;
            priority = nextPriority;
        }
    });
    return { nodeId, isNearNode };
}

export function normalizeConnection<T>(firstNodeId: string, secondNodeId: string, nodes: CanvasNode<T>[], firstHandleType: "source" | "target", resolver?: CanvasConnectionResolver<T>) {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id || isGroupNode(first) || isGroupNode(second)) return null;
    const connection = resolver ? resolver(first, second, firstHandleType) : firstHandleType === "source" ? { fromNodeId: first.id, toNodeId: second.id } : { fromNodeId: second.id, toNodeId: first.id };
    return connection && connection.fromNodeId !== connection.toNodeId && [first.id, second.id].includes(connection.fromNodeId) && [first.id, second.id].includes(connection.toNodeId) ? connection : null;
}
