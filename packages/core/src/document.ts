import type { BaseCanvasNodeMetadata, CanvasConnection, CanvasDocument, CanvasNode, CanvasNodePatch, CanvasSelection } from "./types";

export const addDocumentNodes = <TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, nodes: CanvasNode<TMetadata>[]) => (nodes.length ? { ...document, nodes: [...document.nodes, ...nodes] } : document);

export function updateDocumentNode<TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, id: string, patch: CanvasNodePatch<TMetadata>) {
    const index = document.nodes.findIndex((node) => node.id === id);
    if (index < 0) return document;
    const node = document.nodes[index];
    const next = typeof patch === "function" ? patch(node) : { ...node, ...patch };
    if (next === node) return document;
    const nodes = [...document.nodes];
    nodes[index] = next;
    return { ...document, nodes };
}

export function removeDocumentNodes<TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const changed =
        document.nodes.some((node) => removed.has(node.id) || Boolean(node.metadata?.groupId && removed.has(node.metadata.groupId))) || document.connections.some((connection) => removed.has(connection.fromNodeId) || removed.has(connection.toNodeId));
    if (!changed) return document;
    return {
        nodes: document.nodes.filter((node) => !removed.has(node.id)).map((node) => (node.metadata?.groupId && removed.has(node.metadata.groupId) ? { ...node, metadata: { ...node.metadata, groupId: undefined } } : node)),
        connections: document.connections.filter((connection) => !removed.has(connection.fromNodeId) && !removed.has(connection.toNodeId)),
    };
}

export const addDocumentConnections = <TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, connections: CanvasConnection[]) =>
    connections.length ? { ...document, connections: [...document.connections, ...connections] } : document;

export function removeDocumentConnections<TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const connections = document.connections.filter((connection) => !removed.has(connection.id));
    return connections.length === document.connections.length ? document : { ...document, connections };
}

export function cleanCanvasSelection<TMetadata extends BaseCanvasNodeMetadata>(document: CanvasDocument<TMetadata>, selection: CanvasSelection): CanvasSelection {
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const connectionIds = new Set(document.connections.map((connection) => connection.id));
    const selected = new Set([...selection.nodeIds].filter((id) => nodeIds.has(id)));
    const connectionId = selection.connectionId && connectionIds.has(selection.connectionId) ? selection.connectionId : null;
    return selected.size === selection.nodeIds.size && connectionId === selection.connectionId ? selection : { nodeIds: selected, connectionId };
}
