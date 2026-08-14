import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";
import { useCanvasPointerLifecycle } from "./internal/use-canvas-pointer-lifecycle.js";
import { useCanvasViewport, type UseCanvasViewportOptions } from "./use-canvas-viewport.js";
import type { CanvasConnection, CanvasConnectionDropResult, Position } from "./types.js";

export type UseCanvasInteractionsOptions<TMetadata = unknown> = UseCanvasViewportOptions<TMetadata> & {
    onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
    onNodePointerDown?: (nodeId: string) => void;
    onNodeSelectionChange?: (nodeIds: ReadonlySet<string>, nodeId: string) => void;
    onNodeClick?: (nodeId: string) => void;
    onConnectionEnd?: (result: CanvasConnectionDropResult) => void;
    onResizeStart?: (nodeId: string) => void;
    onConnectionSelect?: (connection: CanvasConnection) => void;
    onConnectionContextMenu?: (event: MouseEvent<SVGPathElement>, connection: CanvasConnection) => void;
};

export function useCanvasInteractions<TMetadata>({ commands, containerRef, onContainerResize, onViewportInput, minZoom, maxZoom, focusCoverage, focusMaxZoom, focusDuration, onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onResizeStart, onConnectionSelect: onConnectionSelected, onConnectionContextMenu: onConnectionMenu }: UseCanvasInteractionsOptions<TMetadata>) {
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onResizeStart, onConnectionSelected, onConnectionMenu });
    const pendingSelectionRef = useRef<{ nodeId: string; ids: Set<string> } | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onResizeStart, onConnectionSelected, onConnectionMenu };
    const viewport = useCanvasViewport({ commands, containerRef, onContainerResize, onViewportInput, minZoom, maxZoom, focusCoverage, focusMaxZoom, focusDuration });
    const { toCanvas } = viewport;
    const { selectionRect, canStart, claimNode, claimConnection, startMarquee, cancelSelection } = useCanvasPointerLifecycle({ commands, containerRef, toCanvas, onNodeClick, onConnectionEnd });
    const selectNode = useCallback((event: Pick<PointerEvent, "shiftKey" | "metaKey" | "ctrlKey">, nodeId: string) => {
        const ids = new Set(commandsRef.current.getSelection().nodeIds);
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (ids.has(nodeId)) ids.delete(nodeId);
            else ids.add(nodeId);
        } else if (!ids.has(nodeId)) {
            ids.clear();
            ids.add(nodeId);
        }
        commandsRef.current.selectNodes(ids);
        return ids;
    }, []);
    const onNodePointerDownCapture = useCallback(
        (event: PointerEvent, nodeId: string) => {
            if (event.button !== 0 || !canStart(event.pointerId)) return;
            callbacksRef.current.onNodePointerDown?.(nodeId);
            const pending = { nodeId, ids: selectNode(event, nodeId) };
            callbacksRef.current.onNodeSelectionChange?.(pending.ids, nodeId);
            pendingSelectionRef.current = pending;
            queueMicrotask(() => {
                if (pendingSelectionRef.current === pending) pendingSelectionRef.current = null;
            });
        },
        [canStart, selectNode],
    );
    const onNodePointerDown = useCallback(
        (event: PointerEvent, nodeId: string) => {
            event.stopPropagation();
            if (event.button !== 0 || !canStart(event.pointerId)) return;
            const pending = pendingSelectionRef.current;
            const ids = pending?.nodeId === nodeId ? pending.ids : selectNode(event, nodeId);
            pendingSelectionRef.current = null;
            commandsRef.current.startNodeDrag(ids, { x: event.clientX, y: event.clientY });
            if (commandsRef.current.getInteraction().isNodeDragging) claimNode(event.pointerId);
        },
        [canStart, claimNode, selectNode],
    );
    const onConnectionStart = useCallback((event: PointerEvent, nodeId: string, handleType: "source" | "target") => {
        event.stopPropagation();
        if (event.button !== 0 || !canStart(event.pointerId)) return;
        commandsRef.current.startConnection({ nodeId, handleType }, toCanvas(event.clientX, event.clientY));
        if (commandsRef.current.getInteraction().connectionInteraction) claimConnection(event.pointerId);
    }, [canStart, claimConnection, toCanvas]);
    const onNodeResizeStart = useCallback((nodeId: string) => {
        commandsRef.current.startNodeResize(nodeId);
        callbacksRef.current.onResizeStart?.(nodeId);
    }, []);
    const onNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => commandsRef.current.resizeNode(nodeId, width, height, position), []);
    const onNodeResizeEnd = useCallback(() => commandsRef.current.endNodeResize(), []);
    const onNodeResizeCancel = useCallback(() => commandsRef.current.cancelNodeResize(), []);
    const onConnectionSelect = useCallback((connection: CanvasConnection) => {
        commandsRef.current.selectConnection(connection.id);
        callbacksRef.current.onConnectionSelected?.(connection);
    }, []);
    const onConnectionContextMenu = useCallback((event: MouseEvent<SVGPathElement>, connection: CanvasConnection) => {
        commandsRef.current.selectConnection(connection.id);
        callbacksRef.current.onConnectionMenu?.(event, connection);
    }, []);
    const onCanvasPointerDown = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0 || !canStart(event.pointerId)) return;
            callbacksRef.current.onCanvasPointerDown?.(event);
            const start = toCanvas(event.clientX, event.clientY);
            const selection = commandsRef.current.getSelection();
            if (!startMarquee(event.pointerId, start, event.shiftKey ? [...selection.nodeIds] : [])) return;
            if (!event.shiftKey || selection.connectionId) commandsRef.current.clearSelection();
        },
        [canStart, startMarquee, toCanvas],
    );

    return { ...viewport, selectionRect, cancelSelection, onCanvasPointerDown, onNodePointerDown, onNodePointerDownCapture, onConnectionStart, onConnectionSelect, onConnectionContextMenu, onNodeResizeStart, onNodeResize, onNodeResizeEnd, onNodeResizeCancel };
}
