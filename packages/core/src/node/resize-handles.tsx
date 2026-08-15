import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { canvasDefaults } from "../defaults.js";
import { resizeNodeBounds } from "../geometry.js";
import { subscribeWindowEvent } from "../internal/window-events.js";
import type { CanvasNode, CanvasResizeCorner } from "../types.js";

/** Layout, geometry, rendering, and lifecycle options for node resize handles. */
export type CanvasNodeResizeHandlesProps<TMetadata = unknown> = {
    node: CanvasNode<TMetadata>;
    scale: number;
    keepAspectRatio?: boolean;
    ratio?: number;
    minWidth?: number;
    minHeight?: number;
    handleSize?: number;
    renderHandle?: (corner: CanvasResizeCorner) => ReactNode;
    onResizeStart?: (nodeId: string) => void;
    onResize: (nodeId: string, width: number, height: number, position: CanvasNode<TMetadata>["position"]) => void;
    onResizeEnd?: (nodeId: string) => void;
    onResizeCancel?: (nodeId: string) => void;
};

const resizeHandleStyles = (offset: number): Record<CanvasResizeCorner, CSSProperties> => ({
    "top-left": { left: offset, top: offset, cursor: "nwse-resize" },
    "top-right": { right: offset, top: offset, cursor: "nesw-resize" },
    "bottom-left": { left: offset, bottom: offset, cursor: "nesw-resize" },
    "bottom-right": { right: offset, bottom: offset, cursor: "nwse-resize" },
});

/** Renders four scale-independent resize handles and emits immutable node bounds. */
export function CanvasNodeResizeHandles<TMetadata>({ node, scale, keepAspectRatio = false, ratio = node.width / (node.height || 1), minWidth = canvasDefaults.resizeMinWidth, minHeight = canvasDefaults.resizeMinHeight, handleSize = canvasDefaults.resizeHandleSize, renderHandle, onResizeStart, onResize, onResizeEnd, onResizeCancel }: CanvasNodeResizeHandlesProps<TMetadata>) {
    handleSize = Math.max(0, handleSize);
    const resize = useRef({ active: false, pointerId: 0, nodeId: "", corner: "bottom-right" as CanvasResizeCorner, x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, scale: 1, minWidth: 24, minHeight: 24, keepAspectRatio: false, ratio: 1, dispose: [] as (() => void)[] });
    const callbacks = useRef({ onResize, onResizeEnd, onResizeCancel });
    callbacks.current = { onResize, onResizeEnd, onResizeCancel };
    const move = useCallback((event: globalThis.PointerEvent) => {
        const current = resize.current;
        if (!current.active || event.pointerId !== current.pointerId) return;
        const bounds = resizeNodeBounds({ position: { x: current.left, y: current.top }, width: current.width, height: current.height }, current.corner, { x: (event.clientX - current.x) / current.scale, y: (event.clientY - current.y) / current.scale }, current.keepAspectRatio, current.ratio, current.minWidth, current.minHeight);
        callbacks.current.onResize(current.nodeId, bounds.width, bounds.height, bounds.position);
    }, []);
    const finish = useCallback((commit: boolean) => {
        if (!resize.current.active) return;
        const nodeId = resize.current.nodeId;
        resize.current.active = false;
        resize.current.dispose.forEach((dispose) => dispose());
        if (commit) callbacks.current.onResizeEnd?.(nodeId);
        else callbacks.current.onResizeCancel?.(nodeId);
    }, []);
    const up = useCallback((event: globalThis.PointerEvent) => {
        if (event.pointerId === resize.current.pointerId) finish(true);
    }, [finish]);
    const cancel = useCallback((event: globalThis.PointerEvent) => {
        if (event.pointerId === resize.current.pointerId) finish(false);
    }, [finish]);
    const blur = useCallback(() => finish(false), [finish]);

    useEffect(() => () => finish(false), [finish]);

    const start = (event: PointerEvent, corner: CanvasResizeCorner) => {
        if (event.button !== 0 || resize.current.active) return;
        event.preventDefault();
        event.stopPropagation();
        onResizeStart?.(node.id);
        resize.current = { active: true, pointerId: event.pointerId, nodeId: node.id, corner, x: event.clientX, y: event.clientY, left: node.position.x, top: node.position.y, width: node.width, height: node.height, scale, minWidth, minHeight, keepAspectRatio, ratio, dispose: [] };
        resize.current.dispose = [subscribeWindowEvent("pointermove", move), subscribeWindowEvent("pointerup", up), subscribeWindowEvent("pointercancel", cancel), subscribeWindowEvent("blur", blur)];
    };

    return Object.entries(resizeHandleStyles(-handleSize / 2)).map(([value, style]) => {
        const corner = value as CanvasResizeCorner;
        return <div key={corner} data-resize-handle={corner} style={{ position: "absolute", zIndex: 50, display: "grid", placeItems: "center", width: handleSize, height: handleSize, touchAction: "none", ...style }} onPointerDown={(event) => start(event, corner)}>{renderHandle?.(corner)}</div>;
    });
}
