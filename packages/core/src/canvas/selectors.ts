import type { CanvasConnection, CanvasNode } from "../types.js";

export function countCanvasGroupChildren<TMetadata>(nodes: readonly CanvasNode<TMetadata>[]) {
    const counts = new Map<string, number>();
    nodes.forEach((node) => {
        const groupId = node.groupId;
        if (groupId) counts.set(groupId, (counts.get(groupId) || 0) + 1);
    });
    return counts;
}

export function getCanvasRelations(activeNodeId: string | null, connections: readonly CanvasConnection[]) {
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

export function getCanvasUpstreamNodes<TMetadata>(nodeId: string, nodes: readonly CanvasNode<TMetadata>[], connections: readonly CanvasConnection[]) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return connections.flatMap((connection) => (connection.toNodeId === nodeId && byId.has(connection.fromNodeId) ? [byId.get(connection.fromNodeId)!] : []));
}

export function getCanvasDownstreamNodes<TMetadata>(nodeId: string, nodes: readonly CanvasNode<TMetadata>[], connections: readonly CanvasConnection[]) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return connections.flatMap((connection) => (connection.fromNodeId === nodeId && byId.has(connection.toNodeId) ? [byId.get(connection.toNodeId)!] : []));
}

export function findCanvasUpstreamNode<TMetadata>(nodeId: string, nodes: readonly CanvasNode<TMetadata>[], connections: readonly CanvasConnection[], predicate: (node: CanvasNode<TMetadata>) => boolean) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const upstream = new Map<string, string[]>();
    connections.forEach((connection) => {
        const ids = upstream.get(connection.toNodeId);
        if (ids) ids.push(connection.fromNodeId);
        else upstream.set(connection.toNodeId, [connection.fromNodeId]);
    });
    const queue = [...(upstream.get(nodeId) || [])];
    const visited = new Set<string>();
    let index = 0;
    while (index < queue.length) {
        const id = queue[index++]!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = byId.get(id);
        if (node && predicate(node)) return node;
        queue.push(...(upstream.get(id) || []));
    }
    return null;
}
