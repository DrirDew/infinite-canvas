import type { BaseCanvasNodeMetadata, CanvasConnection, CanvasNode } from "./types";

export function countCanvasGroupChildren<TMetadata extends BaseCanvasNodeMetadata>(nodes: CanvasNode<TMetadata>[]) {
    const counts = new Map<string, number>();
    nodes.forEach((node) => {
        const groupId = node.metadata?.groupId;
        if (groupId) counts.set(groupId, (counts.get(groupId) || 0) + 1);
    });
    return counts;
}

export function getCanvasRelations(activeNodeId: string | null, connections: CanvasConnection[]) {
    const nodeIds = new Set<string>();
    const connectionIds = new Set<string>();
    if (!activeNodeId) return { nodeIds, connectionIds };
    nodeIds.add(activeNodeId);
    connections.forEach((connection) => {
        if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
        connectionIds.add(connection.id);
        nodeIds.add(connection.fromNodeId);
        nodeIds.add(connection.toNodeId);
    });
    return { nodeIds, connectionIds };
}
