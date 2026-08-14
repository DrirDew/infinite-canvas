import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { centerViewport, fitViewportToNode, screenToCanvas, zoomViewport } from "./geometry";
import type { CanvasCommands, CanvasSize, ViewportTransform } from "./types";

export type UseCanvasViewportOptions<TMetadata = unknown> = {
    commands: CanvasCommands<TMetadata>;
    containerRef: RefObject<HTMLDivElement | null>;
    onContainerResize?: (size: CanvasSize) => void;
    onViewportChange?: (viewport: ViewportTransform) => void;
};

export function useCanvasViewport<TMetadata>({ commands, containerRef, onContainerResize, onViewportChange }: UseCanvasViewportOptions<TMetadata>) {
    const [containerSize, setContainerSize] = useState<CanvasSize>({ width: 0, height: 0 });
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onContainerResize, onViewportChange });
    const containerSizeRef = useRef(containerSize);
    const frameRef = useRef<number | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onContainerResize, onViewportChange };

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
    const cancelViewportAnimation = useCallback(() => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
    }, []);
    const resetViewport = useCallback(() => {
        cancelViewportAnimation();
        return commandsRef.current.setViewport(centerViewport(containerSizeRef.current));
    }, [cancelViewportAnimation]);
    const handleViewportChange = useCallback(
        (viewport: ViewportTransform) => {
            cancelViewportAnimation();
            const next = commandsRef.current.setViewport(viewport);
            callbacksRef.current.onViewportChange?.(next);
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
                frameRef.current = progress < 1 ? requestAnimationFrame(step) : null;
            };
            frameRef.current = requestAnimationFrame(step);
            return true;
        },
        [cancelViewportAnimation],
    );

    useEffect(() => {
        window.addEventListener("blur", cancelViewportAnimation);
        return () => {
            window.removeEventListener("blur", cancelViewportAnimation);
            cancelViewportAnimation();
        };
    }, [cancelViewportAnimation]);

    return { containerSize, toCanvas, getCanvasCenter, resetViewport, setZoom, focusNode, cancelViewportAnimation, onViewportChange: handleViewportChange };
}
