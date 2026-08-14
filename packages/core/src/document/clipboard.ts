import { nodeBounds } from "../geometry.js";
import type { CanvasClipboard, CanvasConnection, CanvasDocument, CanvasPasteOptions } from "../types.js";

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
