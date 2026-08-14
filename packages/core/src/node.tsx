import { useCallback, useEffect, useRef, type CSSProperties, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { resizeNodeBounds } from "./geometry.js";
import { subscribeWindowEvent } from "./internal/window-events.js";
import type { CanvasNode, CanvasResizeCorner } from "./types.js";
import type { CanvasTheme } from "./theme.js";

export type CanvasNodeShellProps<TMetadata = unknown> = HTMLAttributes<HTMLDivElement> & { node: CanvasNode<TMetadata> };

export function CanvasNodeShell<TMetadata>({ node, style, ...props }: CanvasNodeShellProps<TMetadata>) {
    return <div {...props} data-node-id={node.id} style={{ ...style, position: "absolute", transform: `translate(${node.position.x}px,${node.position.y}px)`, width: node.width, height: node.height, contain: "layout style" }} />;
}

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

export function CanvasNodeResizeHandles<TMetadata>({ node, scale, keepAspectRatio = false, ratio = node.width / (node.height || 1), minWidth = 24, minHeight = 24, handleSize = 28, renderHandle, onResizeStart, onResize, onResizeEnd, onResizeCancel }: CanvasNodeResizeHandlesProps<TMetadata>) {
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
    const up = useCallback(() => finish(true), [finish]);
    const cancel = useCallback(() => finish(false), [finish]);

    useEffect(() => () => finish(false), [finish]);

    const start = (event: PointerEvent, corner: CanvasResizeCorner) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onResizeStart?.(node.id);
        resize.current = { active: true, pointerId: event.pointerId, nodeId: node.id, corner, x: event.clientX, y: event.clientY, left: node.position.x, top: node.position.y, width: node.width, height: node.height, scale, minWidth, minHeight, keepAspectRatio, ratio, dispose: [] };
        resize.current.dispose = [subscribeWindowEvent("pointermove", move), subscribeWindowEvent("pointerup", up), subscribeWindowEvent("pointercancel", cancel), subscribeWindowEvent("blur", cancel)];
    };

    return Object.entries(resizeHandleStyles(-handleSize / 2)).map(([value, style]) => {
        const corner = value as CanvasResizeCorner;
        return <div key={corner} data-resize-handle={corner} style={{ position: "absolute", zIndex: 50, display: "grid", placeItems: "center", width: handleSize, height: handleSize, touchAction: "none", ...style }} onPointerDown={(event) => start(event, corner)}>{renderHandle?.(corner)}</div>;
    });
}

export type CanvasNodeConnectionHandlesProps = {
    nodeId: string;
    visible: boolean;
    theme: CanvasTheme;
    source?: boolean;
    target?: boolean;
    hitSize?: number;
    offset?: number;
    indicatorSize?: number;
    renderHandle?: (handleType: "source" | "target") => ReactNode;
    onConnectStart: (event: PointerEvent, nodeId: string, handleType: "source" | "target") => void;
};

export function CanvasNodeConnectionHandles({ nodeId, visible, theme, source = true, target = true, hitSize = 48, offset = 24, indicatorSize = 12, renderHandle, onConnectStart }: CanvasNodeConnectionHandlesProps) {
    hitSize = Math.max(0, hitSize);
    indicatorSize = Math.max(0, indicatorSize);
    return (
        <>
            {target ? <CanvasNodeConnectionHandle side="left" handleType="target" visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "target")} /> : null}
            {source ? <CanvasNodeConnectionHandle side="right" handleType="source" visible={visible} theme={theme} hitSize={hitSize} offset={offset} indicatorSize={indicatorSize} renderHandle={renderHandle} onPointerDown={(event) => onConnectStart(event, nodeId, "source")} /> : null}
        </>
    );
}

function CanvasNodeConnectionHandle({ side, handleType, visible, theme, hitSize, offset, indicatorSize, renderHandle, onPointerDown }: { side: "left" | "right"; handleType: "source" | "target"; visible: boolean; theme: CanvasTheme; hitSize: number; offset: number; indicatorSize: number; renderHandle?: CanvasNodeConnectionHandlesProps["renderHandle"]; onPointerDown: (event: PointerEvent) => void }) {
    return (
        <div
            data-connection-handle={side === "left" ? "target" : "source"}
            style={{ position: "absolute", top: "50%", [side]: -offset, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", width: hitSize, height: hitSize, cursor: "crosshair", touchAction: "none", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transform: "translateY(-50%)", transition: "opacity 150ms" }}
            onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                onPointerDown(event);
            }}
        >
            {renderHandle?.(handleType) ?? <div style={{ width: indicatorSize, height: indicatorSize, border: `2px solid ${theme.node.muted}`, borderRadius: "50%", background: theme.node.panel }} />}
        </div>
    );
}

export type CanvasUnknownNodeProps = { type: string; theme: CanvasTheme; title?: ReactNode; description?: ReactNode; icon?: ReactNode; style?: CSSProperties };

export function CanvasUnknownNode({ type, theme, title = "Unknown node", description = `No renderer is registered for ${type}.`, icon, style }: CanvasUnknownNodeProps) {
    return (
        <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, textAlign: "center", color: theme.node.placeholder, ...style }}>
            {icon}
            <span style={{ fontSize: 14 }}>{title}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{description}</span>
        </div>
    );
}
