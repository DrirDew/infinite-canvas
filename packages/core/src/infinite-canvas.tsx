import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type WheelEvent } from "react";
import { zoomViewportAtPoint } from "./geometry";
import type { CanvasBackgroundMode, CanvasTheme } from "./theme";
import type { CanvasTool, ViewportTransform } from "./types";

const DEFAULT_IGNORE_SELECTOR = "[data-canvas-no-zoom]";
const NODE_SELECTOR = "[data-node-id],[data-connection-id]";
const GRID_SIZE = 48;

type PanState = {
    active: boolean;
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
    ignoreSelector?: string;
    onViewportChange: (viewport: ViewportTransform) => void;
    onCanvasMouseDown?: (event: PointerEvent<HTMLDivElement>) => void;
    onCanvasDeselect?: () => void;
    onCanvasDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
    onDrop?: (event: DragEvent<HTMLDivElement>) => void;
    children?: ReactNode;
};

export function InfiniteCanvas({
    containerRef,
    viewport,
    theme,
    tool,
    backgroundMode = "lines",
    ignoreSelector = DEFAULT_IGNORE_SELECTOR,
    onViewportChange,
    onCanvasMouseDown,
    onCanvasDeselect,
    onCanvasDoubleClick,
    onContextMenu,
    onDrop,
    children,
}: InfiniteCanvasProps) {
    const panRef = useRef<PanState>({ active: false, x: 0, y: 0, initialX: 0, initialY: 0, moved: false, background: false });
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

    useEffect(() => {
        const down = (event: KeyboardEvent) => {
            if (event.key === "Control") setControl(true);
            if (event.code !== "Space" || isEditable(event.target)) return;
            event.preventDefault();
            setSpace(true);
        };
        const up = (event: KeyboardEvent) => {
            if (event.key === "Control") setControl(false);
            if (event.code !== "Space" || isEditable(event.target)) return;
            event.preventDefault();
            setSpace(false);
        };
        const blur = () => {
            setSpace(false);
            setControl(false);
            panRef.current.active = false;
            setPanning(false);
            document.body.style.cursor = "";
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("blur", blur);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("blur", blur);
            document.body.style.cursor = "";
        };
    }, []);

    useEffect(() => {
        const move = (event: globalThis.PointerEvent) => {
            const pan = panRef.current;
            if (!pan.active) return;
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
        const up = () => {
            const pan = panRef.current;
            if (!pan.active) return;
            if (!pan.moved && pan.background) deselectRef.current?.();
            pan.active = false;
            setPanning(false);
            document.body.style.cursor = "";
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, []);

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
    const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (ignored(event.target, ignoreSelector) || (event.target instanceof Element && event.target.closest("[data-connection-create-menu]"))) return;
        const background = !(event.target instanceof Element && event.target.closest(NODE_SELECTOR));
        const pointerTool = event.ctrlKey ? invertTool(tool) : activeTool;
        if (event.button === 1 || (event.button === 0 && pointerTool === "pan")) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            panRef.current = { active: true, x: event.clientX, y: event.clientY, initialX: viewport.x, initialY: viewport.y, moved: false, background };
            setPanning(true);
            document.body.style.cursor = "grabbing";
        } else if (event.button === 0 && background) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onCanvasMouseDown?.(event);
        }
    };
    const wheel = (event: WheelEvent<HTMLDivElement>) => {
        if (ignored(event.target, ignoreSelector)) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        onViewportChange(zoomViewportAtPoint(viewport, { x, y }, viewport.k * Math.pow(1.1, -event.deltaY / 100)));
    };
    const grid = GRID_SIZE * viewport.k;
    const backgroundImage =
        backgroundMode === "dots"
            ? `radial-gradient(circle, ${theme.canvas.dot} ${viewport.k < 0.12 ? 0.8 : 1.15}px, transparent 1.35px)`
            : `linear-gradient(${theme.canvas.line} 1px, transparent 1px),linear-gradient(90deg,${theme.canvas.line} 1px,transparent 1px)`;

    return (
        <div
            ref={containerRef}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", userSelect: "none", background: theme.canvas.background, cursor: panning ? "grabbing" : activeTool === "pan" ? "grab" : undefined }}
            onPointerDown={pointerDown}
            onDoubleClick={(event) => {
                if (!ignored(event.target, ignoreSelector) && !(event.target instanceof Element && event.target.closest(NODE_SELECTOR))) onCanvasDoubleClick?.(event);
            }}
            onWheel={wheel}
            onContextMenu={onContextMenu}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
        >
            {backgroundMode === "blank" ? null : (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4, backgroundImage, backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${viewport.x % grid}px ${viewport.y % grid}px` }} />
            )}
            <div style={{ position: "absolute", transformOrigin: "top left", transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.k})` }}>{children}</div>
        </div>
    );
}

const invertTool = (tool: CanvasTool): CanvasTool => (tool === "select" ? "pan" : "select");
const ignored = (target: EventTarget | null, selector: string) => target instanceof Element && Boolean(target.closest(selector));
const isEditable = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof Element && Boolean(target.closest("[contenteditable='true']")));
