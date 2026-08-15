import type { CSSProperties, DragEvent, MouseEvent, PointerEvent, ReactNode, RefObject } from "react";
import { canvasDefaults } from "../defaults.js";
import { CANVAS_NODE_SELECTOR, DEFAULT_CANVAS_IGNORE_SELECTOR, isCanvasInputIgnored, useCanvasSurfaceInput } from "../internal/use-canvas-surface-input.js";
import type { CanvasBackgroundMode, CanvasTheme } from "../theme.js";
import type { CanvasTool, ViewportTransform } from "../canvas/model.js";

/** Props for the viewport surface, background, and transformed world-content layer. */
export type InfiniteCanvasProps = {
    containerRef: RefObject<HTMLDivElement | null>;
    viewport: ViewportTransform;
    theme: CanvasTheme;
    tool: CanvasTool;
    backgroundMode?: CanvasBackgroundMode;
    gridSize?: number;
    minZoom?: number;
    maxZoom?: number;
    ignoreSelector?: string;
    className?: string;
    style?: CSSProperties;
    tabIndex?: number;
    ariaLabel?: string;
    backgroundStyle?: CSSProperties;
    renderBackground?: (context: CanvasBackgroundRenderContext) => ReactNode;
    contentClassName?: string;
    contentStyle?: CSSProperties;
    onViewportChange: (viewport: ViewportTransform) => void;
    onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
    onCanvasDeselect?: () => void;
    onCanvasDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
    onDrop?: (event: DragEvent<HTMLDivElement>) => void;
    children?: ReactNode;
};
/** Values supplied to a custom background renderer. */
export type CanvasBackgroundRenderContext = { viewport: ViewportTransform; theme: CanvasTheme; mode: CanvasBackgroundMode; gridSize: number };

/** Renders the focusable infinite-canvas surface and applies viewport transforms. */
export function InfiniteCanvas({
    containerRef,
    viewport,
    theme,
    tool,
    backgroundMode = "lines",
    gridSize = canvasDefaults.gridSize,
    minZoom = canvasDefaults.minZoom,
    maxZoom = canvasDefaults.maxZoom,
    ignoreSelector = DEFAULT_CANVAS_IGNORE_SELECTOR,
    className,
    style,
    tabIndex = 0,
    ariaLabel = "Infinite canvas",
    backgroundStyle,
    renderBackground,
    contentClassName,
    contentStyle,
    onViewportChange,
    onCanvasPointerDown,
    onCanvasDeselect,
    onCanvasDoubleClick,
    onContextMenu,
    onDrop,
    children,
}: InfiniteCanvasProps) {
    const input = useCanvasSurfaceInput({ containerRef, viewport, tool, minZoom, maxZoom, ignoreSelector, onViewportChange, onCanvasPointerDown, onCanvasDeselect });
    const grid = Math.max(1, gridSize) * viewport.k;
    const backgroundImage =
        backgroundMode === "dots"
            ? `radial-gradient(circle, ${theme.canvas.dot} ${viewport.k < 0.12 ? 0.8 : 1.15}px, transparent 1.35px)`
            : `linear-gradient(${theme.canvas.line} 1px, transparent 1px),linear-gradient(90deg,${theme.canvas.line} 1px,transparent 1px)`;
    const customBackground = renderBackground?.({ viewport, theme, mode: backgroundMode, gridSize });

    return (
        <div
            ref={containerRef}
            data-canvas-root
            className={className}
            tabIndex={tabIndex}
            aria-label={ariaLabel}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", userSelect: "none", touchAction: "none", outline: "none", background: theme.canvas.background, cursor: input.panning ? "grabbing" : input.activeTool === "pan" ? "grab" : undefined, ...style }}
            onPointerDownCapture={input.onPointerDownCapture}
            onPointerDown={input.onPointerDown}
            onPointerMove={input.onPointerMove}
            onPointerUp={input.onPointerUp}
            onPointerCancel={input.onPointerCancel}
            onKeyDown={input.onKeyDown}
            onKeyUp={input.onKeyUp}
            onBlur={input.onBlur}
            onDoubleClick={(event) => {
                if (!isCanvasInputIgnored(event.target, ignoreSelector) && !(event.target instanceof Element && event.target.closest(CANVAS_NODE_SELECTOR))) onCanvasDoubleClick?.(event);
            }}
            onWheel={input.onWheel}
            onContextMenu={onContextMenu}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
        >
            {backgroundMode === "blank" && customBackground == null ? null : (
                <div data-canvas-background style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: customBackground == null ? backgroundImage : undefined, backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${viewport.x % grid}px ${viewport.y % grid}px`, ...backgroundStyle, pointerEvents: "none" }}>{customBackground}</div>
            )}
            <div data-canvas-content className={contentClassName} style={{ ...contentStyle, position: "absolute", transformOrigin: "top left", transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.k})` }}>{children}</div>
        </div>
    );
}
