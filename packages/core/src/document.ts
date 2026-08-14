import { nodeBounds, normalizeConnection } from "./geometry";
import type { CanvasClipboard, CanvasConnection, CanvasConnectionResolver, CanvasDocument, CanvasNode, CanvasNodePatch, CanvasPasteOptions, CanvasSelection } from "./types";

export type CanvasDocumentIssue = {
    type: "empty-node-id" | "duplicate-node-id" | "invalid-group" | "empty-connection-id" | "duplicate-connection-id" | "missing-connection-node" | "self-connection" | "group-connection" | "rejected-connection";
    id: string;
};

export function getCanvasDocumentIssues<TMetadata>(document: CanvasDocument<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>) {
    const issues: CanvasDocumentIssue[] = [];
    const nodeIds = new Set<string>();
    document.nodes.forEach((node) => {
        if (!node.id) issues.push({ type: "empty-node-id", id: node.id });
        else if (nodeIds.has(node.id)) issues.push({ type: "duplicate-node-id", id: node.id });
        else nodeIds.add(node.id);
    });
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    document.nodes.forEach((node) => {
        if (node.groupId && (node.groupId === node.id || nodes.get(node.groupId)?.role !== "group")) issues.push({ type: "invalid-group", id: node.id });
    });
    const connectionIds = new Set<string>();
    document.connections.forEach((connection) => {
        if (!connection.id) issues.push({ type: "empty-connection-id", id: connection.id });
        else if (connectionIds.has(connection.id)) issues.push({ type: "duplicate-connection-id", id: connection.id });
        else connectionIds.add(connection.id);
        const from = nodes.get(connection.fromNodeId);
        const to = nodes.get(connection.toNodeId);
        if (!from || !to) issues.push({ type: "missing-connection-node", id: connection.id });
        else if (from.id === to.id) issues.push({ type: "self-connection", id: connection.id });
        else if (from.role === "group" || to.role === "group") issues.push({ type: "group-connection", id: connection.id });
        else if (!normalizeConnection(from.id, to.id, document.nodes, "source", resolver)) issues.push({ type: "rejected-connection", id: connection.id });
    });
    return issues;
}

export function addDocumentNodes<TMetadata>(document: CanvasDocument<TMetadata>, nodes: CanvasNode<TMetadata>[]) {
    const ids = new Set(document.nodes.map((node) => node.id));
    let added = nodes.filter((node) => {
        if (!node.id || ids.has(node.id)) return false;
        ids.add(node.id);
        return true;
    });
    const available = new Map([...document.nodes, ...added].map((node) => [node.id, node]));
    added = added.map((node) => (node.groupId && (node.groupId === node.id || available.get(node.groupId)?.role !== "group") ? { ...node, groupId: undefined } : node));
    return added.length ? { ...document, nodes: [...document.nodes, ...added] } : document;
}

export function updateDocumentNode<TMetadata>(document: CanvasDocument<TMetadata>, id: string, patch: CanvasNodePatch<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>) {
    const index = document.nodes.findIndex((node) => node.id === id);
    if (index < 0) return document;
    const node = document.nodes[index];
    let next = typeof patch === "function" ? patch(node) : { ...node, ...patch };
    if (next === node) return document;
    if (!next.id || (next.id !== id && document.nodes.some((item) => item.id === next.id))) return document;
    const nodes = document.nodes.map((item, itemIndex) => {
        if (itemIndex === index) return next;
        if (item.groupId !== id) return item;
        return { ...item, groupId: next.role === "group" ? next.id : undefined };
    });
    const groupId = next.groupId && next.groupId !== next.id && nodes.some((item) => item.id === next.groupId && item.role === "group") ? next.groupId : undefined;
    if (groupId !== next.groupId) nodes[index] = next = { ...next, groupId };
    const connections = document.connections.flatMap((connection) => {
        if (connection.fromNodeId !== id && connection.toNodeId !== id) return [connection];
        const normalized = normalizeConnection(connection.fromNodeId === id ? next.id : connection.fromNodeId, connection.toNodeId === id ? next.id : connection.toNodeId, nodes, "source", resolver);
        return normalized ? [{ ...connection, ...normalized }] : [];
    });
    return { ...document, nodes, connections };
}

export function removeDocumentNodes<TMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const changed =
        document.nodes.some((node) => removed.has(node.id) || Boolean(node.groupId && removed.has(node.groupId))) || document.connections.some((connection) => removed.has(connection.fromNodeId) || removed.has(connection.toNodeId));
    if (!changed) return document;
    return {
        nodes: document.nodes.filter((node) => !removed.has(node.id)).map((node) => (node.groupId && removed.has(node.groupId) ? { ...node, groupId: undefined } : node)),
        connections: document.connections.filter((connection) => !removed.has(connection.fromNodeId) && !removed.has(connection.toNodeId)),
    };
}

export function addDocumentConnections<TMetadata>(document: CanvasDocument<TMetadata>, connections: CanvasConnection[], resolver?: CanvasConnectionResolver<TMetadata>) {
    const ids = new Set(document.connections.map((connection) => connection.id));
    const added = connections.flatMap((connection) => {
        if (!connection.id || ids.has(connection.id)) return [];
        const normalized = normalizeConnection(connection.fromNodeId, connection.toNodeId, document.nodes, "source", resolver);
        if (!normalized) return [];
        ids.add(connection.id);
        return [{ ...connection, ...normalized }];
    });
    return added.length ? { ...document, connections: [...document.connections, ...added] } : document;
}

export function removeDocumentConnections<TMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const connections = document.connections.filter((connection) => !removed.has(connection.id));
    return connections.length === document.connections.length ? document : { ...document, connections };
}

export function cleanCanvasSelection<TMetadata>(document: CanvasDocument<TMetadata>, selection: CanvasSelection): CanvasSelection {
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const connectionIds = new Set(document.connections.map((connection) => connection.id));
    const selected = new Set([...selection.nodeIds].filter((id) => nodeIds.has(id)));
    const connectionId = selection.connectionId && connectionIds.has(selection.connectionId) ? selection.connectionId : null;
    return selected.size === selection.nodeIds.size && connectionId === selection.connectionId ? selection : { nodeIds: selected, connectionId };
}

export function createCanvasClipboard<TMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>): CanvasClipboard<TMetadata> | null {
    const selected = new Set(ids);
    const nodes = document.nodes.filter((node) => selected.has(node.id)).map((node) => ({ ...node, position: { ...node.position } }));
    return nodes.length ? { nodes, connections: document.connections.filter((connection) => selected.has(connection.fromNodeId) && selected.has(connection.toNodeId)).map((connection) => ({ ...connection })) } : null;
}

export function pasteCanvasClipboard<TMetadata>(clipboard: CanvasClipboard<TMetadata>, options: CanvasPasteOptions<TMetadata>): CanvasClipboard<TMetadata> {
    const bounds = nodeBounds(clipboard.nodes);
    const dx = options.position.x - (bounds.left + bounds.right) / 2;
    const dy = options.position.y - (bounds.top + bounds.bottom) / 2;
    const ids = new Map(clipboard.nodes.map((node, index) => [node.id, options.createNodeId(node, index)] as const));
    const nodes = clipboard.nodes.map((node, index) => {
        const next = { ...node, id: ids.get(node.id)!, groupId: node.groupId ? ids.get(node.groupId) : undefined, position: { x: node.position.x + dx, y: node.position.y + dy } };
        return options.mapNode?.(next, index) || next;
    });
    const connections = clipboard.connections.flatMap<CanvasConnection>((connection, index) => {
        const fromNodeId = ids.get(connection.fromNodeId);
        const toNodeId = ids.get(connection.toNodeId);
        return fromNodeId && toNodeId ? [{ ...connection, id: options.createConnectionId(connection, index), fromNodeId, toNodeId }] : [];
    });
    return { nodes, connections };
}
