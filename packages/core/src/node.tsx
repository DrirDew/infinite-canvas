import { useCallback, useEffect, useRef, type CSSProperties, type HTMLAttributes, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { resizeNodeBounds } from "./geometry";
import type { CanvasNode, CanvasResizeCorner } from "./types";
import type { CanvasTheme } from "./theme";

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
    onResizeStart?: (nodeId: string) => void;
    onResize: (nodeId: string, width: number, height: number, position: CanvasNode<TMetadata>["position"]) => void;
    onResizeEnd?: (nodeId: string) => void;
};

const resizeHandleStyles: Record<CanvasResizeCorner, CSSProperties> = {
    "top-left": { left: -14, top: -14, cursor: "nwse-resize" },
    "top-right": { right: -14, top: -14, cursor: "nesw-resize" },
    "bottom-left": { left: -14, bottom: -14, cursor: "nesw-resize" },
    "bottom-right": { right: -14, bottom: -14, cursor: "nwse-resize" },
};

export function CanvasNodeResizeHandles<TMetadata>({ node, scale, keepAspectRatio = false, ratio = node.width / (node.height || 1), minWidth = 24, minHeight = 24, onResizeStart, onResize, onResizeEnd }: CanvasNodeResizeHandlesProps<TMetadata>) {
    const resize = useRef({ active: false, pointerId: 0, corner: "bottom-right" as CanvasResizeCorner, x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, keepAspectRatio: false, ratio: 1 });
    const move = useCallback(
        (event: globalThis.PointerEvent) => {
            const current = resize.current;
            if (!current.active || event.pointerId !== current.pointerId) return;
            const bounds = resizeNodeBounds({ position: { x: current.left, y: current.top }, width: current.width, height: current.height }, current.corner, { x: (event.clientX - current.x) / scale, y: (event.clientY - current.y) / scale }, current.keepAspectRatio, current.ratio, minWidth, minHeight);
            onResize(node.id, bounds.width, bounds.height, bounds.position);
        },
        [minHeight, minWidth, node.id, onResize, scale],
    );
    const end = useCallback(() => {
        if (!resize.current.active) return;
        resize.current.active = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        window.removeEventListener("blur", end);
        onResizeEnd?.(node.id);
    }, [move, node.id, onResizeEnd]);

    useEffect(() => () => end(), [end]);

    const start = (event: PointerEvent, corner: CanvasResizeCorner) => {
        event.preventDefault();
        event.stopPropagation();
        onResizeStart?.(node.id);
        resize.current = { active: true, pointerId: event.pointerId, corner, x: event.clientX, y: event.clientY, left: node.position.x, top: node.position.y, width: node.width, height: node.height, keepAspectRatio, ratio };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        window.addEventListener("blur", end);
    };

    return Object.entries(resizeHandleStyles).map(([corner, style]) => <div key={corner} data-resize-handle={corner} style={{ position: "absolute", zIndex: 50, width: 28, height: 28, touchAction: "none", ...style }} onPointerDown={(event) => start(event, corner as CanvasResizeCorner)} />);
}

export type CanvasNodeConnectionHandlesProps = {
    nodeId: string;
    visible: boolean;
    theme: CanvasTheme;
    source?: boolean;
    target?: boolean;
    onConnectStart: (event: MouseEvent, nodeId: string, handleType: "source" | "target") => void;
};

export function CanvasNodeConnectionHandles({ nodeId, visible, theme, source = true, target = true, onConnectStart }: CanvasNodeConnectionHandlesProps) {
    return (
        <>
            {target ? <CanvasNodeConnectionHandle side="left" visible={visible} theme={theme} onMouseDown={(event) => onConnectStart(event, nodeId, "target")} /> : null}
            {source ? <CanvasNodeConnectionHandle side="right" visible={visible} theme={theme} onMouseDown={(event) => onConnectStart(event, nodeId, "source")} /> : null}
        </>
    );
}

function CanvasNodeConnectionHandle({ side, visible, theme, onMouseDown }: { side: "left" | "right"; visible: boolean; theme: CanvasTheme; onMouseDown: (event: MouseEvent) => void }) {
    return (
        <div
            data-connection-handle={side === "left" ? "target" : "source"}
            style={{ position: "absolute", top: "50%", [side]: -24, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, cursor: "crosshair", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transform: "translateY(-50%)", transition: "opacity 150ms" }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => {
                event.stopPropagation();
                onMouseDown(event);
            }}
        >
            <div style={{ width: 12, height: 12, border: `2px solid ${theme.node.muted}`, borderRadius: "50%", background: theme.node.panel }} />
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
