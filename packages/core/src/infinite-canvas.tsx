import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type WheelEvent } from "react";
import { canvasDefaults } from "./defaults.js";
import { zoomViewportAtPoint } from "./geometry.js";
import { acquireBodyCursor, releaseBodyCursor } from "./internal/body-cursor.js";
import { acquireCanvasPointer, canOwnCanvasPointer, releaseCanvasPointer } from "./internal/pointer-ownership.js";
import { subscribeWindowEvent } from "./internal/window-events.js";
import type { CanvasBackgroundMode, CanvasTheme } from "./theme.js";
import type { CanvasTool, ViewportTransform } from "./types.js";

const DEFAULT_IGNORE_SELECTOR = "[data-canvas-no-zoom]";
const NODE_SELECTOR = "[data-node-id],[data-connection-id]";
type PanState = {
    active: boolean;
    pointerId: number;
    x: number;
    y: number;
    initialX: number;
    initialY: number;
    moved: boolean;
    background: boolean;
};

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
export type CanvasBackgroundRenderContext = { viewport: ViewportTransform; theme: CanvasTheme; mode: CanvasBackgroundMode; gridSize: number };

export function InfiniteCanvas({
    containerRef,
    viewport,
    theme,
    tool,
    backgroundMode = "lines",
    gridSize = canvasDefaults.gridSize,
    minZoom = canvasDefaults.minZoom,
    maxZoom = canvasDefaults.maxZoom,
    ignoreSelector = DEFAULT_IGNORE_SELECTOR,
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
    const panRef = useRef<PanState>({ active: false, pointerId: -1, x: 0, y: 0, initialX: 0, initialY: 0, moved: false, background: false });
    const panOwnerRef = useRef({});
    const panSurfaceRef = useRef<Element | null>(null);
    const frameRef = useRef<number | null>(null);
    const nextViewportRef = useRef<ViewportTransform | null>(null);
    const viewportRef = useRef(viewport);
    const viewportChangeRef = useRef(onViewportChange);
    const deselectRef = useRef(onCanvasDeselect);
    const [space, setSpace] = useState(false);
    const [control, setControl] = useState(false);
    const [panning, setPanning] = useState(false);
    viewportRef.current = viewport;
    viewportChangeRef.current = onViewportChange;
    deselectRef.current = onCanvasDeselect;

    const releasePan = useCallback(() => {
        if (panSurfaceRef.current) releaseCanvasPointer(panSurfaceRef.current, panOwnerRef.current);
        panSurfaceRef.current = null;
        releaseBodyCursor(panOwnerRef.current);
    }, []);

    const cancel = useCallback(() => {
        setSpace(false);
        setControl(false);
        panRef.current.active = false;
        nextViewportRef.current = null;
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        setPanning(false);
        releasePan();
    }, [releasePan]);

    useEffect(() => {
        const unsubscribe = subscribeWindowEvent("blur", cancel);
        return () => {
            unsubscribe();
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            releasePan();
        };
    }, [cancel, releasePan]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const prevent = (event: globalThis.WheelEvent) => {
            if (!ignored(event.target, ignoreSelector)) event.preventDefault();
        };
        element.addEventListener("wheel", prevent, { passive: false });
        return () => element.removeEventListener("wheel", prevent);
    }, [containerRef, ignoreSelector]);

    const activeTool = control || space ? invertTool(tool) : tool;
    const move = (event: PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current;
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        const dx = event.clientX - pan.x;
        const dy = event.clientY - pan.y;
        pan.moved ||= Math.abs(dx) > 3 || Math.abs(dy) > 3;
        nextViewportRef.current = { x: pan.initialX + dx, y: pan.initialY + dy, k: viewportRef.current.k };
        if (frameRef.current) return;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            if (nextViewportRef.current) viewportChangeRef.current(nextViewportRef.current);
        });
    };
    const end = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
        const pan = panRef.current;
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        if (!cancelled && !pan.moved && pan.background) deselectRef.current?.();
        pan.active = false;
        setPanning(false);
        releasePan();
    };
    const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (panRef.current.active && event.pointerId !== panRef.current.pointerId) return;
        if (ignored(event.target, ignoreSelector) || (event.target instanceof Element && event.target.closest("[data-connection-create-menu]"))) return;
        const background = !(event.target instanceof Element && event.target.closest(NODE_SELECTOR));
        const pointerTool = event.ctrlKey ? invertTool(tool) : activeTool;
        if (event.button === 1 || (event.button === 0 && pointerTool === "pan")) {
            if (!acquireCanvasPointer(event.currentTarget, panOwnerRef.current, event.pointerId)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            panSurfaceRef.current = event.currentTarget;
            panRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY, initialX: viewport.x, initialY: viewport.y, moved: false, background };
            setPanning(true);
            acquireBodyCursor(panOwnerRef.current);
        } else if (event.button === 0 && background) {
            if (!canOwnCanvasPointer(event.currentTarget, panOwnerRef.current, event.pointerId)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onCanvasPointerDown?.(event);
        }
    };
    const wheel = (event: WheelEvent<HTMLDivElement>) => {
        if (ignored(event.target, ignoreSelector)) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const lower = Math.max(0.001, minZoom);
        onViewportChange(zoomViewportAtPoint(viewport, { x, y }, viewport.k * Math.pow(1.1, -event.deltaY / 100), lower, Math.max(lower, maxZoom)));
    };
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
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", userSelect: "none", touchAction: "none", outline: "none", background: theme.canvas.background, cursor: panning ? "grabbing" : activeTool === "pan" ? "grab" : undefined, ...style }}
            onPointerDownCapture={(event) => {
                if (!isEditable(event.target)) event.currentTarget.focus({ preventScroll: true });
            }}
            onPointerDown={pointerDown}
            onPointerMove={move}
            onPointerUp={(event) => end(event)}
            onPointerCancel={(event) => end(event, true)}
            onKeyDown={(event) => {
                if (event.key === "Control") setControl(true);
                if (event.code !== "Space" || isEditable(event.target)) return;
                event.preventDefault();
                setSpace(true);
            }}
            onKeyUp={(event) => {
                if (event.key === "Control") setControl(false);
                if (event.code !== "Space" || isEditable(event.target)) return;
                event.preventDefault();
                setSpace(false);
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) cancel();
            }}
            onDoubleClick={(event) => {
                if (!ignored(event.target, ignoreSelector) && !(event.target instanceof Element && event.target.closest(NODE_SELECTOR))) onCanvasDoubleClick?.(event);
            }}
            onWheel={wheel}
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

const invertTool = (tool: CanvasTool): CanvasTool => (tool === "select" ? "pan" : "select");
const ignored = (target: EventTarget | null, selector: string) => target instanceof Element && Boolean(target.closest(selector));
const isEditable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],[role='textbox']"));
