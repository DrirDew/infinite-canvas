import { useMemo, useRef, type CSSProperties, type PointerEvent } from "react";
import type { CanvasTheme } from "./theme";
import type { BaseCanvasNodeMetadata, CanvasNode, ViewportTransform } from "./types";

export type CanvasMinimapProps<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata> = {
    nodes: CanvasNode<TMetadata>[];
    viewport: ViewportTransform;
    viewportSize: { width: number; height: number };
    theme: CanvasTheme;
    onViewportChange: (viewport: ViewportTransform) => void;
    nodeColor?: (node: CanvasNode<TMetadata>) => string;
    width?: number;
    height?: number;
    style?: CSSProperties;
};

export function CanvasMinimap<TMetadata extends BaseCanvasNodeMetadata>({ nodes, viewport, viewportSize, theme, onViewportChange, nodeColor, width = 240, height = 160, style }: CanvasMinimapProps<TMetadata>) {
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const layout = useMemo(() => {
        if (!nodes.length) return { bounds: { x: -500, y: -500, width: 1000, height: 1000 }, scale: 0.16, offset: { x: 40, y: 0 } };
        const bounds = nodes.reduce((value, node) => ({ left: Math.min(value.left, node.position.x), top: Math.min(value.top, node.position.y), right: Math.max(value.right, node.position.x + node.width), bottom: Math.max(value.bottom, node.position.y + node.height) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const world = { x: bounds.left - 500, y: bounds.top - 500, width: bounds.right - bounds.left + 1000, height: bounds.bottom - bounds.top + 1000 };
        const scale = Math.min(width / world.width, height / world.height);
        return { bounds: world, scale, offset: { x: (width - world.width * scale) / 2, y: (height - world.height * scale) / 2 } };
    }, [height, nodes, width]);
    const toMap = (x: number, y: number) => ({ x: (x - layout.bounds.x) * layout.scale + layout.offset.x, y: (y - layout.bounds.y) * layout.scale + layout.offset.y });
    const viewportStart = toMap(-viewport.x / viewport.k, -viewport.y / viewport.k);
    const viewportEnd = toMap((-viewport.x + viewportSize.width) / viewport.k, (-viewport.y + viewportSize.height) / viewport.k);
    const update = (event: PointerEvent<HTMLDivElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const world = { x: (event.clientX - rect.left - layout.offset.x) / layout.scale + layout.bounds.x, y: (event.clientY - rect.top - layout.offset.y) / layout.scale + layout.bounds.y };
        onViewportChange({ x: viewportSize.width / 2 - world.x * viewport.k, y: viewportSize.height / 2 - world.y * viewport.k, k: viewport.k });
    };
    return (
        <div style={{ position: "absolute", bottom: 96, left: 24, zIndex: 50, width, height, overflow: "hidden", borderRadius: 8, border: `1px solid ${theme.toolbar.border}`, boxShadow: "0 16px 40px rgba(0,0,0,.24)", backdropFilter: "blur(4px)", background: theme.toolbar.panel, ...style }}>
            <div
                ref={ref}
                style={{ position: "relative", width: "100%", height: "100%", cursor: "crosshair" }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragging.current = true;
                    update(event);
                }}
                onPointerMove={(event) => {
                    if (dragging.current) update(event);
                }}
                onPointerUp={() => (dragging.current = false)}
                onPointerCancel={() => (dragging.current = false)}
            >
                {nodes.map((node) => {
                    const position = toMap(node.position.x, node.position.y);
                    return <div key={node.id} data-node-id={node.id} style={{ position: "absolute", left: position.x, top: position.y, width: Math.max(node.width * layout.scale, 2), height: Math.max(node.height * layout.scale, 2), borderRadius: 1, opacity: 0.8, background: nodeColor?.(node) || theme.node.muted }} />;
                })}
                <div style={{ position: "absolute", pointerEvents: "none", left: viewportStart.x, top: viewportStart.y, width: Math.max(viewportEnd.x - viewportStart.x, 4), height: Math.max(viewportEnd.y - viewportStart.y, 4), border: `1px solid ${theme.node.activeStroke}`, background: `${theme.node.activeStroke}18` }} />
            </div>
        </div>
    );
}
