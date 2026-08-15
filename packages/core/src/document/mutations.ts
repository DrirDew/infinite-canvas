import { normalizeConnection } from "../geometry.js";
import type { CanvasConnection, CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasNode, CanvasNodePatch, CanvasSelection } from "../types.js";
import { getCanvasDocumentIssues, hasValidCanvasNodeGeometry } from "./validation.js";

/** Creates a detached structural snapshot while preserving host-owned metadata references. */
export function cloneCanvasDocument<TMetadata>(document: CanvasDocument<TMetadata>): CanvasDocument<TMetadata> {
    return { nodes: document.nodes.map((node) => ({ ...node, position: { ...node.position } })), connections: document.connections.map((connection) => ({ ...connection })) };
}

/** Validates an external document and returns the detached snapshot accepted by a canvas instance. */
export function createCanvasDocumentSnapshot<TMetadata>(document: CanvasDocument<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>, groupResolver?: CanvasGroupResolver<TMetadata>) {
    validateCanvasDocument(document, resolver, groupResolver);
    return cloneCanvasDocument(document);
}

/** Validates an immutable controlled document and returns the same authoritative reference. */
export function validateCanvasDocument<TMetadata>(document: CanvasDocument<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>, groupResolver?: CanvasGroupResolver<TMetadata>) {
    const issues = getCanvasDocumentIssues(document, resolver, groupResolver);
    if (issues.length) throw new TypeError(`Invalid canvas document: ${issues.map((issue) => `${issue.type}:${issue.id}`).join(", ")}`);
    return document;
}

/** Adds unique, geometrically valid nodes and normalizes their group membership. */
export function addDocumentNodes<TMetadata>(document: CanvasDocument<TMetadata>, nodes: readonly CanvasNode<TMetadata>[], groupResolver?: CanvasGroupResolver<TMetadata>) {
    const ids = new Set(document.nodes.map((node) => node.id));
    let added = nodes.filter((node) => {
        if (!node.id || ids.has(node.id) || !hasValidCanvasNodeGeometry(node)) return false;
        ids.add(node.id);
        return true;
    });
    const available = new Map([...document.nodes, ...added].map((node) => [node.id, node]));
    added = added.map((node) => {
        const group = node.groupId ? available.get(node.groupId) : undefined;
        const valid = group?.role === "group" && node.groupId !== node.id && (!groupResolver || groupResolver(node, group));
        return { ...node, position: { ...node.position }, groupId: node.groupId && !valid ? undefined : node.groupId };
    });
    return added.length ? { ...document, nodes: [...document.nodes, ...added] } : document;
}

/** Updates one node while preserving document IDs, geometry, groups, and connections. */
export function updateDocumentNode<TMetadata>(document: CanvasDocument<TMetadata>, id: string, patch: CanvasNodePatch<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>, groupResolver?: CanvasGroupResolver<TMetadata>) {
    const index = document.nodes.findIndex((node) => node.id === id);
    if (index < 0) return document;
    const node = document.nodes[index];
    let next = typeof patch === "function" ? patch(node) : { ...node, ...patch };
    if (next === node) return document;
    if (!next.id || !hasValidCanvasNodeGeometry(next) || (next.id !== id && document.nodes.some((item) => item.id === next.id))) return document;
    const nodes = document.nodes.map((item, itemIndex) => {
        if (itemIndex === index) return next;
        if (item.groupId !== id) return item;
        return { ...item, groupId: next.role === "group" ? next.id : undefined };
    });
    const group = next.groupId ? nodes.find((item) => item.id === next.groupId && item.role === "group") : undefined;
    const groupId = next.groupId && next.groupId !== next.id && group && (!groupResolver || groupResolver(next, group)) ? next.groupId : undefined;
    if (groupId !== next.groupId) nodes[index] = next = { ...next, groupId };
    if (sameCanvasNode(node, next)) nodes[index] = next = node;
    const connections = document.connections.flatMap((connection) => {
        if (connection.fromNodeId !== id && connection.toNodeId !== id) return [connection];
        const normalized = normalizeConnection(connection.fromNodeId === id ? next.id : connection.fromNodeId, connection.toNodeId === id ? next.id : connection.toNodeId, nodes, "source", resolver, connection.fromHandleId, connection.toHandleId);
        return normalized ? [sameCanvasConnectionRoute(connection, normalized) ? connection : applyCanvasConnectionRoute(connection, normalized)] : [];
    });
    return nodes.every((item, itemIndex) => item === document.nodes[itemIndex]) && connections.length === document.connections.length && connections.every((connection, connectionIndex) => connection === document.connections[connectionIndex]) ? document : { ...document, nodes, connections };
}

/** Removes nodes, incident connections, and references from surviving group children. */
export function removeDocumentNodes<TMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const changed = document.nodes.some((node) => removed.has(node.id) || Boolean(node.groupId && removed.has(node.groupId))) || document.connections.some((connection) => removed.has(connection.fromNodeId) || removed.has(connection.toNodeId));
    if (!changed) return document;
    return {
        nodes: document.nodes.filter((node) => !removed.has(node.id)).map((node) => (node.groupId && removed.has(node.groupId) ? { ...node, groupId: undefined } : node)),
        connections: document.connections.filter((connection) => !removed.has(connection.fromNodeId) && !removed.has(connection.toNodeId)),
    };
}

/** Adds unique connections whose endpoints and host policies are valid. */
export function addDocumentConnections<TMetadata>(document: CanvasDocument<TMetadata>, connections: readonly CanvasConnection[], resolver?: CanvasConnectionResolver<TMetadata>) {
    const ids = new Set(document.connections.map((connection) => connection.id));
    const added = connections.flatMap((connection) => {
        if (!connection.id || ids.has(connection.id)) return [];
        const normalized = normalizeConnection(connection.fromNodeId, connection.toNodeId, document.nodes, "source", resolver, connection.fromHandleId, connection.toHandleId);
        if (!normalized) return [];
        ids.add(connection.id);
        return [applyCanvasConnectionRoute(connection, normalized)];
    });
    return added.length ? { ...document, connections: [...document.connections, ...added] } : document;
}

/** Removes connections by ID while preserving the original snapshot for no-op edits. */
export function removeDocumentConnections<TMetadata>(document: CanvasDocument<TMetadata>, ids: Iterable<string>) {
    const removed = new Set(ids);
    if (!removed.size) return document;
    const connections = document.connections.filter((connection) => !removed.has(connection.id));
    return connections.length === document.connections.length ? document : { ...document, connections };
}

/** Removes selected IDs that no longer exist in the supplied document. */
export function cleanCanvasSelection<TMetadata>(document: CanvasDocument<TMetadata>, selection: CanvasSelection): CanvasSelection {
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const connectionIds = new Set(document.connections.map((connection) => connection.id));
    const selected = new Set([...selection.nodeIds].filter((id) => nodeIds.has(id)));
    const connectionId = selection.connectionId && connectionIds.has(selection.connectionId) ? selection.connectionId : null;
    return selected.size === selection.nodeIds.size && connectionId === selection.connectionId ? selection : { nodeIds: selected, connectionId };
}

const sameCanvasNode = <TMetadata>(first: CanvasNode<TMetadata>, second: CanvasNode<TMetadata>) => first.id === second.id && first.type === second.type && first.role === second.role && first.groupId === second.groupId && first.title === second.title && first.position.x === second.position.x && first.position.y === second.position.y && first.width === second.width && first.height === second.height && first.metadata === second.metadata;
/** Returns whether connection endpoints and persistent port IDs are unchanged. */
const sameCanvasConnectionRoute = (first: Pick<CanvasConnection, "fromNodeId" | "toNodeId" | "fromHandleId" | "toHandleId">, second: Pick<CanvasConnection, "fromNodeId" | "toNodeId" | "fromHandleId" | "toHandleId">) => first.fromNodeId === second.fromNodeId && first.toNodeId === second.toNodeId && first.fromHandleId === second.fromHandleId && first.toHandleId === second.toHandleId;
/** Applies an authoritative normalized route and clears port IDs omitted by host policy. */
const applyCanvasConnectionRoute = (connection: CanvasConnection, route: Omit<CanvasConnection, "id">): CanvasConnection => {
    const { fromHandleId: _fromHandleId, toHandleId: _toHandleId, ...identity } = connection;
    return { ...identity, ...route };
};
