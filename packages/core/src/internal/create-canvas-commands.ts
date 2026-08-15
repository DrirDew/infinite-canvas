import { addDocumentConnections, addDocumentNodes, createCanvasClipboard, createCanvasDocumentSnapshot, pasteCanvasClipboard, removeDocumentConnections, removeDocumentNodes, updateDocumentNode } from "../document.js";
import { findConnectionDropTarget, findContainingGroupId, findGroupDropTarget, isGroupNode, nodesInRect, normalizeConnection, snapNodesIntoGroup } from "../geometry.js";
import type { CanvasCommands, CanvasConnection, CanvasConnectionDropResult, CanvasNode, CanvasNodePatch, CanvasPasteOptions, ConnectionHandle, Position } from "../types.js";
import { createCanvasCommandRuntime, type CanvasCommandContext } from "./canvas-command-runtime.js";
import { createCanvasHistory, createCanvasSelection, DEFAULT_INTERACTION } from "./canvas-state.js";

export function createCanvasCommands<TMetadata>(context: CanvasCommandContext<TMetadata>): CanvasCommands<TMetadata> {
    const { documentRef, viewportRef, selectionRef, interactionRef, historyRef, previewRef, dragRef, clipboardRef, connectionResolverRef, groupResolverRef, behaviorRef } = context;
    const { updateHistoryState, updateSelection, updateInteraction, setViewport, publish, transaction, restore, preview, commitPreview, cancelPreview } = createCanvasCommandRuntime(context);
    const moveNodeDrag = (pointer: Position, finalize = false) => {
        const drag = dragRef.current;
        if (!drag) return null;
        drag.moved ||= Math.abs(pointer.x - drag.start.x) > behaviorRef.current.dragThreshold || Math.abs(pointer.y - drag.start.y) > behaviorRef.current.dragThreshold;
        if (!drag.moved) return null;
        const dx = (pointer.x - drag.start.x) / viewportRef.current.k;
        const dy = (pointer.y - drag.start.y) / viewportRef.current.k;
        const movedIds = new Set(drag.positions.keys());
        let nodes = drag.document.nodes.map((node) => {
            const position = drag.positions.get(node.id);
            return position ? { ...node, position: { x: position.x + dx, y: position.y + dy } } : node;
        });
        const target = findGroupDropTarget(movedIds, nodes, groupResolverRef.current);
        if (finalize) {
            nodes = target
                ? snapNodesIntoGroup(movedIds, nodes, target, behaviorRef.current.groupPadding)
                : nodes.map((node) => {
                      if (!movedIds.has(node.id) || isGroupNode(node)) return node;
                      const groupId = findContainingGroupId(node, nodes, groupResolverRef.current);
                      return node.groupId === groupId ? node : { ...node, groupId };
                  });
        }
        preview(() => ({ ...drag.document, nodes }));
        const dropTargetGroupId = target?.id || null;
        if (interactionRef.current.dropTargetGroupId !== dropTargetGroupId) updateInteraction({ ...interactionRef.current, dropTargetGroupId });
        return dropTargetGroupId;
    };
    const moveConnection = (position: Position) => {
        const current = interactionRef.current.connectionInteraction;
        if (!current) return null;
        const target = findConnectionDropTarget(documentRef.current.nodes, current.handle, position, viewportRef.current.k, connectionResolverRef.current, behaviorRef.current.connectionHandleRadius, behaviorRef.current.connectionNodePadding);
        updateInteraction({ ...interactionRef.current, connectionInteraction: { handle: current.handle, pointer: position, targetNodeId: target.nodeId } });
        return target;
    };

    return {
        setDocument(next) {
            historyRef.current = createCanvasHistory();
            previewRef.current = null;
            dragRef.current = null;
            publish(createCanvasDocumentSnapshot(next, connectionResolverRef.current, groupResolverRef.current));
            updateSelection(createCanvasSelection(), true);
            updateInteraction(DEFAULT_INTERACTION);
            updateHistoryState();
        },
        addNode: (node: CanvasNode<TMetadata>) => transaction((document) => addDocumentNodes(document, [node], groupResolverRef.current)),
        addNodes: (nodes: readonly CanvasNode<TMetadata>[]) => transaction((document) => addDocumentNodes(document, nodes, groupResolverRef.current)),
        updateNode: (id: string, patch: CanvasNodePatch<TMetadata>) => transaction((document) => updateDocumentNode(document, id, patch, connectionResolverRef.current, groupResolverRef.current)),
        removeNodes: (ids: Iterable<string>) => transaction((document) => removeDocumentNodes(document, ids)),
        addConnection: (connection: CanvasConnection) => transaction((document) => addDocumentConnections(document, [connection], connectionResolverRef.current)),
        addConnections: (connections: readonly CanvasConnection[]) => transaction((document) => addDocumentConnections(document, connections, connectionResolverRef.current)),
        removeConnections: (ids: Iterable<string>) => transaction((document) => removeDocumentConnections(document, ids)),
        selectNodes(ids) {
            const available = new Set(documentRef.current.nodes.map((node) => node.id));
            updateSelection({ nodeIds: new Set([...ids].filter((id) => available.has(id))), connectionId: null });
        },
        selectNodesInRect(rect, initialIds = []) {
            const nodes = documentRef.current.nodes;
            const available = new Set(nodes.map((node) => node.id));
            const nodeIds = new Set([...initialIds].filter((id) => available.has(id)));
            nodesInRect(nodes, rect).forEach((node) => nodeIds.add(node.id));
            updateSelection({ nodeIds, connectionId: null });
            return nodeIds;
        },
        selectConnection: (connectionId) => updateSelection({ nodeIds: new Set(), connectionId: connectionId && documentRef.current.connections.some((connection) => connection.id === connectionId) ? connectionId : null }),
        clearSelection: () => updateSelection(createCanvasSelection()),
        startNodeDrag(ids, pointer) {
            commitPreview();
            const selected = new Set(ids);
            const moved = new Set(selected);
            documentRef.current.nodes.forEach((node) => {
                if (node.groupId && selected.has(node.groupId)) moved.add(node.id);
            });
            const positions = new Map(documentRef.current.nodes.filter((node) => moved.has(node.id)).map((node) => [node.id, node.position] as const));
            if (!positions.size) return;
            dragRef.current = { start: pointer, document: documentRef.current, positions, moved: false };
            updateInteraction({ ...DEFAULT_INTERACTION, isNodeDragging: true });
        },
        moveNodeDrag: (pointer) => moveNodeDrag(pointer),
        endNodeDrag(pointer) {
            const drag = dragRef.current;
            if (!drag) return { moved: false, clickedNodeId: null };
            if (pointer) moveNodeDrag(pointer, true);
            if (drag.moved && pointer) commitPreview();
            else cancelPreview();
            const result = { moved: drag.moved, clickedNodeId: !drag.moved && drag.positions.size === 1 ? drag.positions.keys().next().value || null : null };
            dragRef.current = null;
            updateInteraction(DEFAULT_INTERACTION);
            return result;
        },
        startNodeResize(id) {
            if (!documentRef.current.nodes.some((node) => node.id === id)) return;
            commitPreview();
            updateInteraction({ ...DEFAULT_INTERACTION, isNodeResizing: true });
        },
        resizeNode: (id, width, height, position) => preview((document) => updateDocumentNode(document, id, (node) => ({ ...node, width, height, position: position || node.position }), connectionResolverRef.current, groupResolverRef.current)),
        endNodeResize() {
            if (!interactionRef.current.isNodeResizing) return;
            commitPreview();
            updateInteraction(DEFAULT_INTERACTION);
        },
        cancelNodeResize() {
            if (!interactionRef.current.isNodeResizing) return;
            cancelPreview();
            updateInteraction(DEFAULT_INTERACTION);
        },
        startConnection(handle: ConnectionHandle, position: Position) {
            if (!documentRef.current.nodes.some((node) => node.id === handle.nodeId)) return;
            updateInteraction({ ...DEFAULT_INTERACTION, connectionInteraction: { handle, pointer: position, targetNodeId: null } });
        },
        moveConnection,
        endConnection(position) {
            const target = moveConnection(position);
            const current = interactionRef.current.connectionInteraction;
            if (!target || !current) return null;
            const connection = target.nodeId ? normalizeConnection(current.handle.nodeId, target.nodeId, documentRef.current.nodes, current.handle.handleType, connectionResolverRef.current, current.handle.handleId) : null;
            const result: CanvasConnectionDropResult = { ...target, handle: current.handle, position, connection };
            updateInteraction({ ...interactionRef.current, connectionInteraction: null });
            return result;
        },
        cancelConnection() {
            if (interactionRef.current.connectionInteraction) updateInteraction({ ...interactionRef.current, connectionInteraction: null });
        },
        copySelection() {
            clipboardRef.current = createCanvasClipboard(documentRef.current, selectionRef.current.nodeIds);
            return clipboardRef.current;
        },
        pasteClipboard(options: CanvasPasteOptions<TMetadata>) {
            const clipboard = clipboardRef.current;
            if (!clipboard?.nodes.length) return null;
            const pasted = pasteCanvasClipboard(clipboard, options);
            let nodes: CanvasNode<TMetadata>[] = [];
            let connections: CanvasConnection[] = [];
            transaction((document) => {
                const withNodes = addDocumentNodes(document, pasted.nodes, groupResolverRef.current);
                nodes = withNodes.nodes.slice(document.nodes.length);
                if (!nodes.length) return document;
                const ids = new Set(nodes.map((node) => node.id));
                const withConnections = addDocumentConnections(withNodes, pasted.connections.filter((connection) => ids.has(connection.fromNodeId) && ids.has(connection.toNodeId)), connectionResolverRef.current);
                connections = withConnections.connections.slice(document.connections.length);
                return withConnections;
            });
            if (!nodes.length) return null;
            updateSelection({ nodeIds: new Set(nodes.map((node) => node.id)), connectionId: null });
            return { nodes, connections };
        },
        getClipboard: () => clipboardRef.current,
        getDocument: () => documentRef.current,
        getViewport: () => viewportRef.current,
        getSelection: () => selectionRef.current,
        getInteraction: () => interactionRef.current,
        getHistoryDocuments: () => [...historyRef.current.past, ...historyRef.current.future],
        transaction,
        setViewport,
        undo() {
            if (previewRef.current) {
                cancelPreview();
                updateInteraction(DEFAULT_INTERACTION);
                return;
            }
            const previous = historyRef.current.past.pop();
            if (!previous) return;
            historyRef.current.future.push(documentRef.current);
            restore(previous);
        },
        redo() {
            if (previewRef.current) {
                cancelPreview();
                updateInteraction(DEFAULT_INTERACTION);
                return;
            }
            const next = historyRef.current.future.pop();
            if (!next) return;
            historyRef.current.past.push(documentRef.current);
            restore(next);
        },
        preview,
        commitPreview,
        cancelPreview,
    };
}
