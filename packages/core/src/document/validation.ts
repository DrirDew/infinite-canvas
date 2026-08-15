import { normalizeConnection } from "../geometry.js";
import type { CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasNode } from "../types.js";

/** A machine-readable problem found while validating an external document. */
export type CanvasDocumentIssue = {
    type: "empty-node-id" | "duplicate-node-id" | "invalid-node-position" | "invalid-node-size" | "invalid-group" | "rejected-group" | "empty-connection-id" | "duplicate-connection-id" | "missing-connection-node" | "self-connection" | "group-connection" | "rejected-connection";
    id: string;
};

/** Returns whether a node has finite coordinates and strictly positive finite dimensions. */
export function hasValidCanvasNodeGeometry<TMetadata>(node: CanvasNode<TMetadata>) {
    return Number.isFinite(node.position.x) && Number.isFinite(node.position.y) && Number.isFinite(node.width) && Number.isFinite(node.height) && node.width > 0 && node.height > 0;
}

/**
 * Reports structural and geometric document problems without mutating the input.
 * Hosts can use the returned issue list before loading persisted or remote data.
 */
export function getCanvasDocumentIssues<TMetadata>(document: CanvasDocument<TMetadata>, resolver?: CanvasConnectionResolver<TMetadata>, groupResolver?: CanvasGroupResolver<TMetadata>) {
    const issues: CanvasDocumentIssue[] = [];
    const nodeIds = new Set<string>();
    document.nodes.forEach((node) => {
        if (!node.id) issues.push({ type: "empty-node-id", id: node.id });
        else if (nodeIds.has(node.id)) issues.push({ type: "duplicate-node-id", id: node.id });
        else nodeIds.add(node.id);
        if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) issues.push({ type: "invalid-node-position", id: node.id });
        if (!Number.isFinite(node.width) || !Number.isFinite(node.height) || node.width <= 0 || node.height <= 0) issues.push({ type: "invalid-node-size", id: node.id });
    });
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    document.nodes.forEach((node) => {
        const group = node.groupId ? nodes.get(node.groupId) : undefined;
        if (node.groupId && (node.groupId === node.id || group?.role !== "group")) issues.push({ type: "invalid-group", id: node.id });
        else if (group && groupResolver && !groupResolver(node, group)) issues.push({ type: "rejected-group", id: node.id });
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
        else {
            const normalized = normalizeConnection(from.id, to.id, document.nodes, "source", resolver, connection.fromHandleId, connection.toHandleId);
            if (!normalized || normalized.fromNodeId !== connection.fromNodeId || normalized.toNodeId !== connection.toNodeId || normalized.fromHandleId !== connection.fromHandleId || normalized.toHandleId !== connection.toHandleId) issues.push({ type: "rejected-connection", id: connection.id });
        }
    });
    return issues;
}
