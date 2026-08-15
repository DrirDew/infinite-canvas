import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { normalizeRect } from "../geometry/nodes.js";
import type { CanvasCommands } from "../canvas/commands.js";
import type { CanvasConnectionDropResult, CanvasRect, Position } from "../canvas/model.js";
import { createLatestAnimationFrame } from "./latest-animation-frame.js";
import { acquireCanvasPointer, canOwnCanvasPointer, releaseCanvasPointer } from "./pointer-ownership.js";
import { subscribeWindowEvent } from "./window-events.js";

type PointerOwner = { id: number; kind: "marquee" | "node" | "connection" };
type Marquee = { start: Position; initialNodeIds: string[] };

/** Coordinates one pointer-owned edit lifecycle across the canvas and window boundaries. */
export function useCanvasPointerLifecycle<TMetadata>({ commands, containerRef, toCanvas, onNodeClick, onConnectionEnd }: { commands: CanvasCommands<TMetadata>; containerRef: RefObject<HTMLDivElement | null>; toCanvas: (clientX: number, clientY: number) => Position; onNodeClick?: (nodeId: string) => void; onConnectionEnd?: (result: CanvasConnectionDropResult) => void }) {
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onNodeClick, onConnectionEnd });
    const tokenRef = useRef({});
    const surfaceRef = useRef<Element | null>(null);
    const ownerRef = useRef<PointerOwner | null>(null);
    const marqueeRef = useRef<Marquee | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onNodeClick, onConnectionEnd };

    const canStart = useCallback((pointerId: number) => {
        const surface = containerRef.current;
        return (!ownerRef.current || ownerRef.current.id === pointerId) && (!surface || canOwnCanvasPointer(surface, tokenRef.current, pointerId));
    }, [containerRef]);
    const claim = useCallback((pointerId: number, kind: PointerOwner["kind"]) => {
        const surface = containerRef.current;
        if (!canStart(pointerId) || (surface && !acquireCanvasPointer(surface, tokenRef.current, pointerId))) return false;
        surfaceRef.current = surface;
        ownerRef.current = { id: pointerId, kind };
        return true;
    }, [canStart, containerRef]);
    const claimNode = useCallback((pointerId: number) => claim(pointerId, "node"), [claim]);
    const claimConnection = useCallback((pointerId: number) => claim(pointerId, "connection"), [claim]);
    const startMarquee = useCallback((pointerId: number, start: Position, initialNodeIds: string[]) => {
        if (!claim(pointerId, "marquee")) return false;
        marqueeRef.current = { start, initialNodeIds };
        setSelectionRect(normalizeRect(start, start));
        return true;
    }, [claim]);
    const cancelSelection = useCallback(() => {
        if (ownerRef.current?.kind === "marquee") {
            if (surfaceRef.current) releaseCanvasPointer(surfaceRef.current, tokenRef.current);
            surfaceRef.current = null;
            ownerRef.current = null;
        }
        marqueeRef.current = null;
        setSelectionRect(null);
    }, []);

    useEffect(() => {
        /** Applies one coalesced pointer coordinate to the active interaction. */
        const applyMove = (pointer: Position) => {
            const owner = ownerRef.current;
            if (!owner) return;
            const current = commandsRef.current;
            if (owner.kind === "connection") return void current.moveConnection(toCanvas(pointer.x, pointer.y));
            if (owner.kind === "node") return void current.moveNodeDrag(pointer);
            const marquee = marqueeRef.current;
            if (!marquee) return;
            const rect = normalizeRect(marquee.start, toCanvas(pointer.x, pointer.y));
            current.selectNodesInRect(rect, marquee.initialNodeIds);
            setSelectionRect(rect);
        };
        const moveFrame = createLatestAnimationFrame(applyMove);
        const clear = () => {
            moveFrame.clear();
            if (surfaceRef.current) releaseCanvasPointer(surfaceRef.current, tokenRef.current);
            surfaceRef.current = null;
            ownerRef.current = null;
            marqueeRef.current = null;
            setSelectionRect(null);
        };
        /** Keeps only the newest pointer coordinate and processes it at most once per frame. */
        const move = (event: globalThis.PointerEvent) => {
            const owner = ownerRef.current;
            if (!owner || event.pointerId !== owner.id) return;
            moveFrame.push({ x: event.clientX, y: event.clientY });
        };
        const up = (event: globalThis.PointerEvent) => {
            const owner = ownerRef.current;
            if (!owner || event.pointerId !== owner.id) return;
            moveFrame.clear();
            if (owner.kind === "node") {
                const drag = commandsRef.current.endNodeDrag({ x: event.clientX, y: event.clientY });
                if (drag.clickedNodeId) callbacksRef.current.onNodeClick?.(drag.clickedNodeId);
            } else if (owner.kind === "connection") {
                const result = commandsRef.current.endConnection(toCanvas(event.clientX, event.clientY));
                if (result) callbacksRef.current.onConnectionEnd?.(result);
            } else {
                const marquee = marqueeRef.current;
                if (marquee) commandsRef.current.selectNodesInRect(normalizeRect(marquee.start, toCanvas(event.clientX, event.clientY)), marquee.initialNodeIds);
            }
            clear();
        };
        const cancel = (event?: Event) => {
            const owner = ownerRef.current;
            if (!owner || (event instanceof globalThis.PointerEvent && event.pointerId !== owner.id)) return;
            if (owner.kind === "node") commandsRef.current.endNodeDrag();
            else if (owner.kind === "connection") commandsRef.current.cancelConnection();
            clear();
        };
        const unsubscribe = [subscribeWindowEvent("pointermove", move), subscribeWindowEvent("pointerup", up), subscribeWindowEvent("pointercancel", cancel), subscribeWindowEvent("blur", cancel)];
        return () => {
            unsubscribe.forEach((dispose) => dispose());
            moveFrame.clear();
            if (ownerRef.current?.kind === "node") commandsRef.current.endNodeDrag();
            else if (ownerRef.current?.kind === "connection") commandsRef.current.cancelConnection();
            if (surfaceRef.current) releaseCanvasPointer(surfaceRef.current, tokenRef.current);
            surfaceRef.current = null;
            ownerRef.current = null;
            marqueeRef.current = null;
        };
    }, [toCanvas]);

    return { selectionRect, canStart, claimNode, claimConnection, startMarquee, cancelSelection };
}
