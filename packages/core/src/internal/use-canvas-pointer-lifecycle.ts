import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeRect } from "../geometry.js";
import type { CanvasCommands, CanvasConnectionDropResult, CanvasRect, Position } from "../types.js";
import { subscribeWindowEvent } from "./window-events.js";

type PointerOwner = { id: number; kind: "marquee" | "node" | "connection" };
type Marquee = { start: Position; initialNodeIds: string[] };

export function useCanvasPointerLifecycle<TMetadata>({ commands, toCanvas, onNodeClick, onConnectionEnd }: { commands: CanvasCommands<TMetadata>; toCanvas: (clientX: number, clientY: number) => Position; onNodeClick?: (nodeId: string) => void; onConnectionEnd?: (result: CanvasConnectionDropResult) => void }) {
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const commandsRef = useRef(commands);
    const callbacksRef = useRef({ onNodeClick, onConnectionEnd });
    const ownerRef = useRef<PointerOwner | null>(null);
    const marqueeRef = useRef<Marquee | null>(null);
    const frameRef = useRef<number | null>(null);
    commandsRef.current = commands;
    callbacksRef.current = { onNodeClick, onConnectionEnd };

    const canStart = useCallback((pointerId: number) => !ownerRef.current || ownerRef.current.id === pointerId, []);
    const claim = useCallback((pointerId: number, kind: PointerOwner["kind"]) => {
        if (!canStart(pointerId)) return false;
        ownerRef.current = { id: pointerId, kind };
        return true;
    }, [canStart]);
    const claimNode = useCallback((pointerId: number) => claim(pointerId, "node"), [claim]);
    const claimConnection = useCallback((pointerId: number) => claim(pointerId, "connection"), [claim]);
    const startMarquee = useCallback((pointerId: number, start: Position, initialNodeIds: string[]) => {
        if (!claim(pointerId, "marquee")) return false;
        marqueeRef.current = { start, initialNodeIds };
        setSelectionRect(normalizeRect(start, start));
        return true;
    }, [claim]);
    const cancelSelection = useCallback(() => {
        marqueeRef.current = null;
        setSelectionRect(null);
    }, []);

    useEffect(() => {
        const clearFrame = () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        };
        const clear = () => {
            clearFrame();
            ownerRef.current = null;
            marqueeRef.current = null;
            setSelectionRect(null);
        };
        const move = (event: globalThis.PointerEvent) => {
            const owner = ownerRef.current;
            if (!owner || event.pointerId !== owner.id) return;
            const current = commandsRef.current;
            if (owner.kind === "connection") return void current.moveConnection(toCanvas(event.clientX, event.clientY));
            if (owner.kind === "node") {
                clearFrame();
                frameRef.current = requestAnimationFrame(() => {
                    current.moveNodeDrag({ x: event.clientX, y: event.clientY });
                    frameRef.current = null;
                });
                return;
            }
            const marquee = marqueeRef.current;
            if (!marquee) return;
            const rect = normalizeRect(marquee.start, toCanvas(event.clientX, event.clientY));
            current.selectNodesInRect(rect, marquee.initialNodeIds);
            setSelectionRect(rect);
        };
        const up = (event: globalThis.PointerEvent) => {
            const owner = ownerRef.current;
            if (!owner || event.pointerId !== owner.id) return;
            clearFrame();
            if (owner.kind === "node") {
                const drag = commandsRef.current.endNodeDrag({ x: event.clientX, y: event.clientY });
                if (drag.clickedNodeId) callbacksRef.current.onNodeClick?.(drag.clickedNodeId);
            } else if (owner.kind === "connection") {
                const result = commandsRef.current.endConnection(toCanvas(event.clientX, event.clientY));
                if (result) callbacksRef.current.onConnectionEnd?.(result);
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
            clearFrame();
        };
    }, [toCanvas]);

    return { selectionRect, canStart, claimNode, claimConnection, startMarquee, cancelSelection };
}
