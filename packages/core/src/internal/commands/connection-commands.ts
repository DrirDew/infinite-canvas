import type { CanvasConnectionDropResult, ConnectionHandle, Position } from "../../canvas/model.js";
import { findConnectionDropTarget, normalizeConnection } from "../../geometry/connections.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";
import { createConnectionInteraction, DEFAULT_INTERACTION } from "../canvas-state.js";

export function createConnectionCommands<TMetadata>(context: CanvasCommandContext<TMetadata>, { updateInteraction }: CanvasCommandRuntime<TMetadata>) {
    const { documentRef, viewportRef, interactionRef, policiesRef, behaviorRef } = context;
    const moveConnection = (position: Position) => {
        const current = interactionRef.current.connectionInteraction;
        if (!current) return null;
        const target = findConnectionDropTarget(documentRef.current.nodes, current.handle, position, viewportRef.current.k, policiesRef.current.connection, behaviorRef.current.connectionHandleRadius, behaviorRef.current.connectionNodePadding);
        updateInteraction(createConnectionInteraction({ handle: current.handle, pointer: position, targetNodeId: target.nodeId }));
        return target;
    };
    return {
        startConnection(handle: ConnectionHandle, position: Position) {
            if (!documentRef.current.nodes.some((node) => node.id === handle.nodeId)) return;
            updateInteraction(createConnectionInteraction({ handle, pointer: position, targetNodeId: null }));
        },
        moveConnection,
        endConnection(position: Position) {
            const target = moveConnection(position);
            const current = interactionRef.current.connectionInteraction;
            if (!target || !current) return null;
            const connection = target.nodeId ? normalizeConnection(current.handle.nodeId, target.nodeId, documentRef.current.nodes, current.handle.handleType, policiesRef.current.connection, current.handle.handleId) : null;
            const result: CanvasConnectionDropResult = { ...target, handle: current.handle, position, connection };
            updateInteraction(DEFAULT_INTERACTION);
            return result;
        },
        cancelConnection() {
            if (interactionRef.current.kind === "connection") updateInteraction(DEFAULT_INTERACTION);
        },
    };
}
