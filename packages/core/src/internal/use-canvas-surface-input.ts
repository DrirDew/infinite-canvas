import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject, type WheelEvent } from "react";
import { zoomViewportAtPoint } from "../geometry/viewport.js";
import type { CanvasTool, ViewportTransform } from "../canvas/model.js";
import { acquireBodyCursor, releaseBodyCursor } from "./body-cursor.js";
import { acquireCanvasPointer, canOwnCanvasPointer, releaseCanvasPointer } from "./pointer-ownership.js";
import { subscribeWindowEvent } from "./window-events.js";

export const DEFAULT_CANVAS_IGNORE_SELECTOR = "[data-canvas-no-zoom]";
export const CANVAS_NODE_SELECTOR = "[data-node-id],[data-connection-id]";
export const isCanvasInputIgnored = (target: EventTarget | null, selector: string) => target instanceof Element && Boolean(target.closest(selector));
const isEditable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],[role='textbox']"));
const invertTool = (tool: CanvasTool): CanvasTool => (tool === "select" ? "pan" : "select");
type PanState = { active: boolean; pointerId: number; x: number; y: number; initialX: number; initialY: number; moved: boolean; background: boolean };

export function useCanvasSurfaceInput({ containerRef, viewport, tool, minZoom, maxZoom, ignoreSelector, onViewportChange, onCanvasPointerDown, onCanvasDeselect }: { containerRef: RefObject<HTMLDivElement | null>; viewport: ViewportTransform; tool: CanvasTool; minZoom: number; maxZoom: number; ignoreSelector: string; onViewportChange: (viewport: ViewportTransform) => void; onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void; onCanvasDeselect?: () => void }) {
    const panRef = useRef<PanState>({ active: false, pointerId: -1, x: 0, y: 0, initialX: 0, initialY: 0, moved: false, background: false });
    const ownerRef = useRef({});
    const surfaceRef = useRef<Element | null>(null);
    const frameRef = useRef<number | null>(null);
    const nextViewportRef = useRef<ViewportTransform | null>(null);
    const viewportRef = useRef(viewport);
    const optionsRef = useRef({ tool, minZoom, maxZoom, ignoreSelector });
    const callbacksRef = useRef({ onViewportChange, onCanvasPointerDown, onCanvasDeselect });
    const [space, setSpace] = useState(false);
    const [control, setControl] = useState(false);
    const [panning, setPanning] = useState(false);
    const activeTool = control || space ? invertTool(tool) : tool;
    const activeToolRef = useRef(activeTool);
    viewportRef.current = viewport;
    optionsRef.current = { tool, minZoom, maxZoom, ignoreSelector };
    callbacksRef.current = { onViewportChange, onCanvasPointerDown, onCanvasDeselect };
    activeToolRef.current = activeTool;

    const releasePan = useCallback(() => {
        if (surfaceRef.current) releaseCanvasPointer(surfaceRef.current, ownerRef.current);
        surfaceRef.current = null;
        releaseBodyCursor(ownerRef.current);
    }, []);
    const cancel = useCallback(() => {
        setSpace(false);
        setControl(false);
        panRef.current.active = false;
        nextViewportRef.current = null;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        setPanning(false);
        releasePan();
    }, [releasePan]);

    useEffect(() => {
        const unsubscribe = subscribeWindowEvent("blur", cancel);
        return () => {
            unsubscribe();
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            releasePan();
        };
    }, [cancel, releasePan]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const prevent = (event: globalThis.WheelEvent) => {
            if (!isCanvasInputIgnored(event.target, optionsRef.current.ignoreSelector)) event.preventDefault();
        };
        element.addEventListener("wheel", prevent, { passive: false });
        return () => element.removeEventListener("wheel", prevent);
    }, [containerRef]);

    const onPointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!isEditable(event.target)) event.currentTarget.focus({ preventScroll: true });
    }, []);
    const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current;
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        const dx = event.clientX - pan.x;
        const dy = event.clientY - pan.y;
        pan.moved ||= Math.abs(dx) > 3 || Math.abs(dy) > 3;
        nextViewportRef.current = { x: pan.initialX + dx, y: pan.initialY + dy, k: viewportRef.current.k };
        if (frameRef.current !== null) return;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            if (nextViewportRef.current) callbacksRef.current.onViewportChange(nextViewportRef.current);
        });
    }, []);
    const end = useCallback((event: PointerEvent<HTMLDivElement>, cancelled = false) => {
        const pan = panRef.current;
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        if (!cancelled && !pan.moved && pan.background) callbacksRef.current.onCanvasDeselect?.();
        if (cancelled) {
            nextViewportRef.current = null;
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        pan.active = false;
        setPanning(false);
        releasePan();
    }, [releasePan]);
    const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current;
        const { tool, ignoreSelector } = optionsRef.current;
        if (pan.active && event.pointerId !== pan.pointerId) return;
        if (isCanvasInputIgnored(event.target, ignoreSelector) || (event.target instanceof Element && event.target.closest("[data-connection-create-menu]"))) return;
        const background = !(event.target instanceof Element && event.target.closest(CANVAS_NODE_SELECTOR));
        const pointerTool = event.ctrlKey ? invertTool(tool) : activeToolRef.current;
        if (event.button === 1 || (event.button === 0 && pointerTool === "pan")) {
            if (!acquireCanvasPointer(event.currentTarget, ownerRef.current, event.pointerId)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            surfaceRef.current = event.currentTarget;
            panRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY, initialX: viewportRef.current.x, initialY: viewportRef.current.y, moved: false, background };
            setPanning(true);
            acquireBodyCursor(ownerRef.current);
        } else if (event.button === 0 && background) {
            if (!canOwnCanvasPointer(event.currentTarget, ownerRef.current, event.pointerId)) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            callbacksRef.current.onCanvasPointerDown?.(event);
        }
    }, []);
    const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
        const { ignoreSelector, minZoom, maxZoom } = optionsRef.current;
        if (isCanvasInputIgnored(event.target, ignoreSelector)) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const lower = Math.max(0.001, minZoom);
        callbacksRef.current.onViewportChange(zoomViewportAtPoint(viewportRef.current, { x: event.clientX - rect.left, y: event.clientY - rect.top }, viewportRef.current.k * Math.pow(1.1, -event.deltaY / 100), lower, Math.max(lower, maxZoom)));
    }, [containerRef]);
    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Control") setControl(true);
        if (event.code !== "Space" || isEditable(event.target)) return;
        event.preventDefault();
        setSpace(true);
    }, []);
    const onKeyUp = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Control") setControl(false);
        if (event.code !== "Space" || isEditable(event.target)) return;
        event.preventDefault();
        setSpace(false);
    }, []);
    const onBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) cancel();
    }, [cancel]);
    const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => end(event, true), [end]);

    return { activeTool, panning, onPointerDownCapture, onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel, onKeyDown, onKeyUp, onBlur, onWheel };
}
