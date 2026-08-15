import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { canvasDefaults } from "../defaults.js";
import { nodeBounds } from "../geometry/nodes.js";
import type { CanvasTheme } from "../theme.js";
import type { CanvasNode, CanvasSize, ViewportTransform } from "../canvas/model.js";

/** Props for the interactive overview of document bounds and the current viewport. */
export type CanvasMinimapProps<TMetadata = unknown> = {
    nodes: readonly CanvasNode<TMetadata>[];
    viewport: ViewportTransform;
    viewportSize: CanvasSize;
    theme: CanvasTheme;
    onViewportChange: (viewport: ViewportTransform) => void;
    nodeColor?: (node: CanvasNode<TMetadata>) => string;
    nodeStyle?: (node: CanvasNode<TMetadata>) => CSSProperties;
    renderNode?: (node: CanvasNode<TMetadata>) => ReactNode;
    viewportStyle?: CSSProperties;
    width?: number;
    height?: number;
    worldPadding?: number;
    minNodeSize?: number;
    minViewportSize?: number;
    keyboardStep?: number;
    tabIndex?: number;
    ariaLabel?: string;
    className?: string;
    style?: CSSProperties;
};

/** Renders an interactive minimap that recenters the existing viewport scale. */
export function CanvasMinimap<TMetadata>({ nodes, viewport, viewportSize, theme, onViewportChange, nodeColor, nodeStyle, renderNode, viewportStyle, width = canvasDefaults.minimapWidth, height = canvasDefaults.minimapHeight, worldPadding = canvasDefaults.minimapWorldPadding, minNodeSize = canvasDefaults.minimapNodeSize, minViewportSize = canvasDefaults.minimapViewportSize, keyboardStep = canvasDefaults.minimapKeyboardStep, tabIndex = 0, ariaLabel = "Canvas minimap", className, style }: CanvasMinimapProps<TMetadata>) {
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef<number | null>(null);
    const layout = useMemo(() => {
        const padding = Math.max(0, worldPadding);
        if (!nodes.length) {
            const size = Math.max(padding * 2, 1);
            const scale = Math.min(width / size, height / size);
            return { bounds: { x: -size / 2, y: -size / 2, width: size, height: size }, scale, offset: { x: (width - size * scale) / 2, y: (height - size * scale) / 2 } };
        }
        const bounds = nodeBounds(nodes);
        const world = { x: bounds.left - padding, y: bounds.top - padding, width: bounds.right - bounds.left + padding * 2, height: bounds.bottom - bounds.top + padding * 2 };
        const scale = Math.min(width / world.width, height / world.height);
        return { bounds: world, scale, offset: { x: (width - world.width * scale) / 2, y: (height - world.height * scale) / 2 } };
    }, [height, nodes, width, worldPadding]);
    const toMap = (x: number, y: number) => ({ x: (x - layout.bounds.x) * layout.scale + layout.offset.x, y: (y - layout.bounds.y) * layout.scale + layout.offset.y });
    const viewportStart = toMap(-viewport.x / viewport.k, -viewport.y / viewport.k);
    const viewportEnd = toMap((-viewport.x + viewportSize.width) / viewport.k, (-viewport.y + viewportSize.height) / viewport.k);
    const update = (event: PointerEvent<HTMLDivElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const world = { x: (event.clientX - rect.left - layout.offset.x) / layout.scale + layout.bounds.x, y: (event.clientY - rect.top - layout.offset.y) / layout.scale + layout.bounds.y };
        onViewportChange({ x: viewportSize.width / 2 - world.x * viewport.k, y: viewportSize.height / 2 - world.y * viewport.k, k: viewport.k });
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = Math.max(0, keyboardStep);
        const delta = event.key === "ArrowLeft" ? { x: step, y: 0 } : event.key === "ArrowRight" ? { x: -step, y: 0 } : event.key === "ArrowUp" ? { x: 0, y: step } : event.key === "ArrowDown" ? { x: 0, y: -step } : null;
        if (!delta) return;
        event.preventDefault();
        event.stopPropagation();
        onViewportChange({ x: viewport.x + delta.x, y: viewport.y + delta.y, k: viewport.k });
    };
    return (
        <div data-canvas-minimap data-canvas-no-zoom role="region" tabIndex={tabIndex} aria-label={ariaLabel} className={className} style={{ position: "absolute", bottom: 96, left: 24, zIndex: 50, width, height, overflow: "hidden", borderRadius: 8, border: `1px solid ${theme.toolbar.border}`, boxShadow: "0 16px 40px rgba(0,0,0,.24)", backdropFilter: "blur(4px)", background: theme.toolbar.panel, ...style }} onKeyDown={onKeyDown}>
            <div
                ref={ref}
                style={{ position: "relative", width: "100%", height: "100%", cursor: "crosshair" }}
                onPointerDown={(event) => {
                    if (dragging.current !== null && dragging.current !== event.pointerId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragging.current = event.pointerId;
                    update(event);
                }}
                onPointerMove={(event) => {
                    if (dragging.current === event.pointerId) update(event);
                }}
                onPointerUp={(event) => {
                    if (dragging.current === event.pointerId) dragging.current = null;
                }}
                onPointerCancel={(event) => {
                    if (dragging.current === event.pointerId) dragging.current = null;
                }}
            >
                {nodes.map((node) => {
                    const position = toMap(node.position.x, node.position.y);
                    return <div key={node.id} data-node-id={node.id} style={{ position: "absolute", left: position.x, top: position.y, width: Math.max(node.width * layout.scale, minNodeSize), height: Math.max(node.height * layout.scale, minNodeSize), borderRadius: 1, opacity: 0.8, background: nodeColor?.(node) || theme.node.muted, ...nodeStyle?.(node) }}>{renderNode?.(node)}</div>;
                })}
                <div data-minimap-viewport style={{ position: "absolute", pointerEvents: "none", left: viewportStart.x, top: viewportStart.y, width: Math.max(viewportEnd.x - viewportStart.x, minViewportSize), height: Math.max(viewportEnd.y - viewportStart.y, minViewportSize), border: `1px solid ${theme.node.activeStroke}`, background: `${theme.node.activeStroke}18`, ...viewportStyle }} />
            </div>
        </div>
    );
}
