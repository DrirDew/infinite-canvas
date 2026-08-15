import type { Position } from "../../canvas/model.js";
import { updateDocumentNode } from "../../document/mutations.js";
import { findContainingGroupId, findGroupDropTarget, isGroupNode, snapNodesIntoGroup } from "../../geometry/nodes.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";
import { createNodeDragInteraction, DEFAULT_INTERACTION, NODE_RESIZE_INTERACTION } from "../canvas-state.js";

export function createNodeInteractionCommands<TMetadata>(context: CanvasCommandContext<TMetadata>, runtime: CanvasCommandRuntime<TMetadata>) {
    const { documentRef, viewportRef, interactionRef, dragRef, policiesRef, behaviorRef } = context;
    const { preview, commitPreview, cancelPreview, updateInteraction } = runtime;
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
        const target = findGroupDropTarget(movedIds, nodes, policiesRef.current.grouping);
        if (finalize) nodes = target ? snapNodesIntoGroup(movedIds, nodes, target, behaviorRef.current.groupPadding) : nodes.map((node) => {
            if (!movedIds.has(node.id) || isGroupNode(node)) return node;
            const groupId = findContainingGroupId(node, nodes, policiesRef.current.grouping);
            return node.groupId === groupId ? node : { ...node, groupId };
        });
        preview(() => ({ ...drag.document, nodes }));
        const dropTargetGroupId = target?.id || null;
        if (interactionRef.current.kind === "node-drag" && interactionRef.current.dropTargetGroupId !== dropTargetGroupId) updateInteraction(createNodeDragInteraction(dropTargetGroupId));
        return dropTargetGroupId;
    };
    return {
        startNodeDrag(ids: Iterable<string>, pointer: Position) {
            commitPreview();
            const selected = new Set(ids);
            const moved = new Set(selected);
            documentRef.current.nodes.forEach((node) => {
                if (node.groupId && selected.has(node.groupId)) moved.add(node.id);
            });
            const positions = new Map(documentRef.current.nodes.filter((node) => moved.has(node.id)).map((node) => [node.id, node.position] as const));
            if (!positions.size) return;
            dragRef.current = { start: pointer, document: documentRef.current, positions, moved: false };
            updateInteraction(createNodeDragInteraction());
        },
        moveNodeDrag: (pointer: Position) => moveNodeDrag(pointer),
        endNodeDrag(pointer?: Position) {
            const drag = dragRef.current;
            if (!drag) return { moved: false, clickedNodeId: null };
            if (pointer) moveNodeDrag(pointer, true);
            const result = { moved: drag.moved, clickedNodeId: !drag.moved && drag.positions.size === 1 ? drag.positions.keys().next().value || null : null };
            try {
                if (drag.moved && pointer) commitPreview();
                else cancelPreview();
                return result;
            } finally {
                dragRef.current = null;
                if (interactionRef.current.kind !== "idle") updateInteraction(DEFAULT_INTERACTION);
            }
        },
        startNodeResize(id: string) {
            if (!documentRef.current.nodes.some((node) => node.id === id)) return;
            commitPreview();
            updateInteraction(NODE_RESIZE_INTERACTION);
        },
        resizeNode: (id: string, width: number, height: number, position?: Position) => preview((document) => updateDocumentNode(document, id, (node) => ({ ...node, width, height, position: position || node.position }), policiesRef.current.connection, policiesRef.current.grouping)),
        endNodeResize() {
            if (!interactionRef.current.isNodeResizing) return;
            try {
                commitPreview();
            } finally {
                if (interactionRef.current.kind !== "idle") updateInteraction(DEFAULT_INTERACTION);
            }
        },
        cancelNodeResize() {
            if (!interactionRef.current.isNodeResizing) return;
            cancelPreview();
            updateInteraction(DEFAULT_INTERACTION);
        },
    };
}
