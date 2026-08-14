import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { centerViewport, fitViewportToNode, normalizeRect, screenToCanvas, zoomViewport } from "./geometry";
import type { BaseCanvasNodeMetadata, CanvasCommands, CanvasConnection, CanvasConnectionDropResult, CanvasRect, CanvasSize, Position, ViewportTransform } from "./types";

export type UseCanvasInteractionsOptions<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    commands: CanvasCommands<TMetadata>;
    containerRef: RefObject<HTMLDivElement | null>;
    onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
    onNodePointerDown?: (nodeId: string) => void;
    onNodeSelectionChange?: (nodeIds: Set<string>, nodeId: string) => void;
    onNodeClick?: (nodeId: string) => void;
    onConnectionEnd?: (result: CanvasConnectionDropResult) => void;
    onContainerResize?: (size: CanvasSize) => void;
    onResizeStart?: (nodeId: string) => void;
    onViewportChange?: (viewport: ViewportTransform) => void;
    onConnectionSelect?: (connection: CanvasConnection) => void;
    onConnectionContextMenu?: (event: MouseEvent<SVGPathElement>, connection: CanvasConnection) => void;
};

type Marquee = { start: Position; initialNodeIds: string[] };

export function useCanvasInteractions<TMetadata extends BaseCanvasNodeMetadata>({ commands, containerRef, onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onContainerResize, onResizeStart, onViewportChange: onViewportUpdate, onConnectionSelect: onConnectionSelected, onConnectionContextMenu: onConnectionMenu }: UseCanvasInteractionsOptions<TMetadata>) {
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const [containerSize, setContainerSize] = useState<CanvasSize>({ width: 0, height: 0 });
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onContainerResize, onResizeStart, onViewportUpdate, onConnectionSelected, onConnectionMenu });
    const containerSizeRef = useRef(containerSize);
    const marqueeRef = useRef<Marquee | null>(null);
    const pendingSelectionRef = useRef<{ nodeId: string; ids: Set<string> } | null>(null);
    const frameRef = useRef<number | null>(null);
    const viewportFrameRef = useRef<number | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onCanvasPointerDown, onNodePointerDown, onNodeSelectionChange, onNodeClick, onConnectionEnd, onContainerResize, onResizeStart, onViewportUpdate, onConnectionSelected, onConnectionMenu };

    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const update = () => {
            const { width, height } = element.getBoundingClientRect();
            if (containerSizeRef.current.width === width && containerSizeRef.current.height === height) return;
            const size = { width, height };
            containerSizeRef.current = size;
            setContainerSize(size);
            callbacksRef.current.onContainerResize?.(size);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [containerRef]);

    const toCanvas = useCallback(
        (clientX: number, clientY: number) => {
            const rect = containerRef.current?.getBoundingClientRect();
            return screenToCanvas(clientX, clientY, commandsRef.current.getViewport(), { left: rect?.left || 0, top: rect?.top || 0 });
        },
        [containerRef],
    );
    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return toCanvas((rect?.left || 0) + (rect?.width || 0) / 2, (rect?.top || 0) + (rect?.height || 0) / 2);
    }, [containerRef, toCanvas]);
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
    const onConnectionStart = useCallback((event: MouseEvent, nodeId: string, handleType: "source" | "target") => {
        event.stopPropagation();
        commandsRef.current.startConnection({ nodeId, handleType }, toCanvas(event.clientX, event.clientY));
    }, [toCanvas]);
    const onNodeResizeStart = useCallback((nodeId: string) => {
        commandsRef.current.startNodeResize(nodeId);
        callbacksRef.current.onResizeStart?.(nodeId);
    }, []);
    const onNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => commandsRef.current.resizeNode(nodeId, width, height, position), []);
    const onNodeResizeEnd = useCallback(() => commandsRef.current.endNodeResize(), []);
    const onConnectionSelect = useCallback((connection: CanvasConnection) => {
        commandsRef.current.selectConnection(connection.id);
        callbacksRef.current.onConnectionSelected?.(connection);
    }, []);
    const onConnectionContextMenu = useCallback((event: MouseEvent<SVGPathElement>, connection: CanvasConnection) => {
        commandsRef.current.selectConnection(connection.id);
        callbacksRef.current.onConnectionMenu?.(event, connection);
    }, []);
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
    const cancelViewportAnimation = useCallback(() => {
        if (viewportFrameRef.current) cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
    }, []);
    const resetViewport = useCallback(() => {
        cancelViewportAnimation();
        return commandsRef.current.setViewport(centerViewport(containerSizeRef.current));
    }, [cancelViewportAnimation]);
    const onViewportChange = useCallback(
        (viewport: ViewportTransform) => {
            cancelViewportAnimation();
            const next = commandsRef.current.setViewport(viewport);
            callbacksRef.current.onViewportUpdate?.(next);
            return next;
        },
        [cancelViewportAnimation],
    );
    const setZoom = useCallback(
        (scale: number) => {
            cancelViewportAnimation();
            return commandsRef.current.setViewport((viewport) => zoomViewport(viewport, containerSizeRef.current, scale));
        },
        [cancelViewportAnimation],
    );
    const focusNode = useCallback(
        (nodeId: string) => {
            const node = commandsRef.current.getDocument().nodes.find((item) => item.id === nodeId);
            if (!node) return false;
            cancelViewportAnimation();
            commandsRef.current.selectNodes([nodeId]);
            const start = commandsRef.current.getViewport();
            const target = fitViewportToNode(node, containerSizeRef.current);
            let started = 0;
            const step = (now: number) => {
                started ||= now;
                const progress = Math.min((now - started) / 450, 1);
                const t = 1 - Math.pow(1 - progress, 3);
                commandsRef.current.setViewport({ x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t, k: start.k + (target.k - start.k) * t });
                viewportFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null;
            };
            viewportFrameRef.current = requestAnimationFrame(step);
            return true;
        },
        [cancelViewportAnimation],
    );

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
            cancelViewportAnimation();
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
            cancelViewportAnimation();
        };
    }, [cancelViewportAnimation, toCanvas]);

    return { containerSize, selectionRect, toCanvas, getCanvasCenter, resetViewport, setZoom, focusNode, cancelSelection, cancelViewportAnimation, onViewportChange, onCanvasMouseDown, onNodeMouseDown, onNodeSelectCapture, onConnectionStart, onConnectionSelect, onConnectionContextMenu, onNodeResizeStart, onNodeResize, onNodeResizeEnd };
}
