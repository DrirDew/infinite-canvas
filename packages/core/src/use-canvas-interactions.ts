import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { normalizeRect, screenToCanvas } from "./geometry";
import type { BaseCanvasNodeMetadata, CanvasCommands, CanvasConnectionDropResult, CanvasRect, Position } from "./types";

export type UseCanvasInteractionsOptions<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    commands: CanvasCommands<TMetadata>;
    containerRef: RefObject<HTMLDivElement | null>;
    onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
    onNodePointerDown?: (nodeId: string) => void;
    onNodeSelectionChange?: (nodeIds: Set<string>, nodeId: string) => void;
    onNodeClick?: (nodeId: string) => void;
    onConnectionEnd?: (result: CanvasConnectionDropResult) => void;
};

type Marquee = { start: Position; initialNodeIds: string[] };

export function useCanvasInteractions<TMetadata extends BaseCanvasNodeMetadata>({ commands, containerRef, onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd }: UseCanvasInteractionsOptions<TMetadata>) {
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd });
    const marqueeRef = useRef<Marquee | null>(null);
    const pendingSelectionRef = useRef<{ nodeId: string; ids: Set<string> } | null>(null);
    const frameRef = useRef<number | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd };

    const toCanvas = useCallback(
        (clientX: number, clientY: number) => {
            const rect = containerRef.current?.getBoundingClientRect();
            return screenToCanvas(clientX, clientY, commandsRef.current.getViewport(), { left: rect?.left || 0, top: rect?.top || 0 });
        },
        [containerRef],
    );
    const selectNode = useCallback((event: Pick<MouseEvent, "shiftKey" | "metaKey" | "ctrlKey">, nodeId: string) => {
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
    const onNodeSelectCapture = useCallback(
        (event: MouseEvent, nodeId: string) => {
            if (event.button !== 0) return;
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
    const onNodeMouseDown = useCallback(
        (event: MouseEvent, nodeId: string) => {
            event.stopPropagation();
            const pending = pendingSelectionRef.current;
            const ids = pending?.nodeId === nodeId ? pending.ids : selectNode(event, nodeId);
            pendingSelectionRef.current = null;
            commandsRef.current.startNodeDrag(ids, { x: event.clientX, y: event.clientY });
        },
        [selectNode],
    );
    const onCanvasMouseDown = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            callbacksRef.current.onCanvasPointerDown?.(event);
            if (event.button !== 0) return;
            const start = toCanvas(event.clientX, event.clientY);
            const selection = commandsRef.current.getSelection();
            marqueeRef.current = { start, initialNodeIds: event.shiftKey ? [...selection.nodeIds] : [] };
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
            const current = commandsRef.current;
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            const drag = current.endNodeDrag({ x: event.clientX, y: event.clientY });
            if (drag.clickedNodeId) callbacksRef.current.onNodeClick?.(drag.clickedNodeId);
            marqueeRef.current = null;
            setSelectionRect(null);
            if (!current.getInteraction().connectionInteraction) return;
            const result = current.endConnection(toCanvas(event.clientX, event.clientY));
            if (result) callbacksRef.current.onConnectionEnd?.(result);
        };
        const cancel = () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
            marqueeRef.current = null;
            setSelectionRect(null);
            commandsRef.current.endNodeDrag();
            commandsRef.current.cancelConnection();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
        window.addEventListener("blur", cancel);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
            window.removeEventListener("blur", cancel);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [toCanvas]);

    return { selectionRect, cancelSelection, onCanvasMouseDown, onNodeMouseDown, onNodeSelectCapture };
}
