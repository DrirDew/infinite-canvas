import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { normalizeRect } from "./geometry.js";
import { subscribeWindowEvent } from "./internal/window-events.js";
import { useCanvasViewport, type UseCanvasViewportOptions } from "./use-canvas-viewport.js";
import type { CanvasConnection, CanvasConnectionDropResult, CanvasRect, Position } from "./types.js";

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

type Marquee = { start: Position; initialNodeIds: string[] };

export function useCanvasInteractions<TMetadata>({ commands, containerRef, onContainerResize, onViewportInput, minZoom, maxZoom, focusCoverage, focusMaxZoom, focusDuration, onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onResizeStart, onConnectionSelect: onConnectionSelected, onConnectionContextMenu: onConnectionMenu }: UseCanvasInteractionsOptions<TMetadata>) {
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onResizeStart, onConnectionSelected, onConnectionMenu });
    const marqueeRef = useRef<Marquee | null>(null);
    const pendingSelectionRef = useRef<{ nodeId: string; ids: Set<string> } | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const frameRef = useRef<number | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onResizeStart, onConnectionSelected, onConnectionMenu };
    const viewport = useCanvasViewport({ commands, containerRef, onContainerResize, onViewportInput, minZoom, maxZoom, focusCoverage, focusMaxZoom, focusDuration });
    const { toCanvas } = viewport;
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
            if (event.button !== 0 || (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId)) return;
            callbacksRef.current.onNodePointerDown?.(nodeId);
            const pending = { nodeId, ids: selectNode(event, nodeId) };
            callbacksRef.current.onNodeSelectionChange?.(pending.ids, nodeId);
            pendingSelectionRef.current = pending;
            queueMicrotask(() => {
                if (pendingSelectionRef.current === pending) pendingSelectionRef.current = null;
            });
        },
        [selectNode],
    );
    const onNodePointerDown = useCallback(
        (event: PointerEvent, nodeId: string) => {
            event.stopPropagation();
            if (event.button !== 0 || (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId)) return;
            const pending = pendingSelectionRef.current;
            const ids = pending?.nodeId === nodeId ? pending.ids : selectNode(event, nodeId);
            pendingSelectionRef.current = null;
            commandsRef.current.startNodeDrag(ids, { x: event.clientX, y: event.clientY });
            if (commandsRef.current.getInteraction().isNodeDragging) pointerIdRef.current = event.pointerId;
        },
        [selectNode],
    );
    const onConnectionStart = useCallback((event: PointerEvent, nodeId: string, handleType: "source" | "target") => {
        event.stopPropagation();
        if (event.button !== 0 || (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId)) return;
        commandsRef.current.startConnection({ nodeId, handleType }, toCanvas(event.clientX, event.clientY));
        if (commandsRef.current.getInteraction().connectionInteraction) pointerIdRef.current = event.pointerId;
    }, [toCanvas]);
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
            if (event.button !== 0 || (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId)) return;
            callbacksRef.current.onCanvasPointerDown?.(event);
            const start = toCanvas(event.clientX, event.clientY);
            const selection = commandsRef.current.getSelection();
            marqueeRef.current = { start, initialNodeIds: event.shiftKey ? [...selection.nodeIds] : [] };
            pointerIdRef.current = event.pointerId;
            setSelectionRect(normalizeRect(start, start));
            if (!event.shiftKey || selection.connectionId) commandsRef.current.clearSelection();
        },
        [toCanvas],
    );
    const cancelSelection = useCallback(() => {
        marqueeRef.current = null;
        setSelectionRect(null);
    }, []);
    useEffect(() => {
        const move = (event: globalThis.PointerEvent) => {
            if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
            const current = commandsRef.current;
            if (current.getInteraction().connectionInteraction) {
                current.moveConnection(toCanvas(event.clientX, event.clientY));
                return;
            }
            if (current.getInteraction().isNodeDragging) {
                if (frameRef.current) cancelAnimationFrame(frameRef.current);
                frameRef.current = requestAnimationFrame(() => {
                    current.moveNodeDrag({ x: event.clientX, y: event.clientY });
                    frameRef.current = null;
                });
                return;
            }
            const marquee = marqueeRef.current;
            if (!marquee) return;
            const rect = normalizeRect(marquee.start, toCanvas(event.clientX, event.clientY));
            current.selectNodesInRect(rect, marquee.initialNodeIds);
            setSelectionRect(rect);
        };
        const up = (event: globalThis.PointerEvent) => {
            if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
            const current = commandsRef.current;
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            const drag = current.endNodeDrag({ x: event.clientX, y: event.clientY });
            if (drag.clickedNodeId) callbacksRef.current.onNodeClick?.(drag.clickedNodeId);
            marqueeRef.current = null;
            pointerIdRef.current = null;
            setSelectionRect(null);
            if (!current.getInteraction().connectionInteraction) return;
            const result = current.endConnection(toCanvas(event.clientX, event.clientY));
            if (result) callbacksRef.current.onConnectionEnd?.(result);
        };
        const cancel = (event?: Event) => {
            if (event instanceof globalThis.PointerEvent && pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
            marqueeRef.current = null;
            pointerIdRef.current = null;
            setSelectionRect(null);
            commandsRef.current.endNodeDrag();
            commandsRef.current.cancelConnection();
        };
        const unsubscribe = [subscribeWindowEvent("pointermove", move), subscribeWindowEvent("pointerup", up), subscribeWindowEvent("pointercancel", cancel), subscribeWindowEvent("blur", cancel)];
        return () => {
            unsubscribe.forEach((dispose) => dispose());
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [toCanvas]);

    return { ...viewport, selectionRect, cancelSelection, onCanvasPointerDown, onNodePointerDown, onNodePointerDownCapture, onConnectionStart, onConnectionSelect, onConnectionContextMenu, onNodeResizeStart, onNodeResize, onNodeResizeEnd, onNodeResizeCancel };
}
