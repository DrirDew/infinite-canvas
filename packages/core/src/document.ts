import { nodeBounds } from "./geometry";
import type { CanvasClipboard, CanvasConnection, CanvasDocument, CanvasNode, CanvasNodePatch, CanvasPasteOptions, CanvasSelection } from "./types";

export const addDocumentNodes = <TMetadata,>(document: CanvasDocument<TMetadata>, nodes: CanvasNode<TMetadata>[]) => (nodes.length ? { ...document, nodes: [...document.nodes, ...nodes] } : document);

export function updateDocumentNode<TMetadata>(document: CanvasDocument<TMetadata>, id: string, patch: CanvasNodePatch<TMetadata>) {
    const index = document.nodes.findIndex((node) => node.id === id);
    if (index < 0) return document;
    const node = document.nodes[index];
    const next = typeof patch === "function" ? patch(node) : { ...node, ...patch };
    if (next === node) return document;
    const nodes = [...document.nodes];
    nodes[index] = next;
    return { ...document, nodes };
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

export const addDocumentConnections = <TMetadata,>(document: CanvasDocument<TMetadata>, connections: CanvasConnection[]) =>
    connections.length ? { ...document, connections: [...document.connections, ...connections] } : document;

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
