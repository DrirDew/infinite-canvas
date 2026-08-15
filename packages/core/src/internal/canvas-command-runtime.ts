import type { Dispatch, SetStateAction } from "react";
import { cleanCanvasSelection } from "../document.js";
import type { CanvasClipboard, CanvasConnectionResolver, CanvasDocument, CanvasDocumentUpdater, CanvasGroupResolver, CanvasInteractionState, CanvasSelection, ViewportTransform, ViewportUpdater } from "../types.js";
import { createCanvasViewportSnapshot } from "../geometry.js";
import { createCanvasHistory, DEFAULT_INTERACTION, type CanvasBehavior, type CanvasDrag, type CanvasHistory } from "./canvas-state.js";

type HistoryState = { canUndo: boolean; canRedo: boolean };
type Latest<T> = { current: T };
export type CanvasCommandContext<TMetadata> = {
    documentRef: Latest<CanvasDocument<TMetadata>>;
    viewportRef: Latest<ViewportTransform>;
    selectionRef: Latest<CanvasSelection>;
    interactionRef: Latest<CanvasInteractionState>;
    historyRef: Latest<CanvasHistory<TMetadata>>;
    previewRef: Latest<CanvasDocument<TMetadata> | null>;
    dragRef: Latest<CanvasDrag<TMetadata> | null>;
    clipboardRef: Latest<CanvasClipboard<TMetadata> | null>;
    onDocumentChangeRef: Latest<((document: CanvasDocument<TMetadata>) => void) | undefined>;
    onViewportChangeRef: Latest<((viewport: ViewportTransform) => void) | undefined>;
    onSelectionChangeRef: Latest<((selection: CanvasSelection) => void) | undefined>;
    onInteractionChangeRef: Latest<((interaction: CanvasInteractionState) => void) | undefined>;
    connectionResolverRef: Latest<CanvasConnectionResolver<TMetadata> | undefined>;
    groupResolverRef: Latest<CanvasGroupResolver<TMetadata> | undefined>;
    behaviorRef: Latest<CanvasBehavior>;
    setDocument: Dispatch<SetStateAction<CanvasDocument<TMetadata>>>;
    setViewport: Dispatch<SetStateAction<ViewportTransform>>;
    setSelection: Dispatch<SetStateAction<CanvasSelection>>;
    setInteraction: Dispatch<SetStateAction<CanvasInteractionState>>;
    setHistoryState: Dispatch<SetStateAction<HistoryState>>;
};

export function createCanvasCommandRuntime<TMetadata>({ documentRef, viewportRef, selectionRef, interactionRef, historyRef, previewRef, onDocumentChangeRef, onViewportChangeRef, onSelectionChangeRef, onInteractionChangeRef, behaviorRef, setDocument, setViewport: setViewportState, setSelection, setInteraction, setHistoryState }: CanvasCommandContext<TMetadata>) {
    const updateHistoryState = () => setHistoryState({ canUndo: Boolean(historyRef.current.past.length), canRedo: Boolean(historyRef.current.future.length) });
    const updateSelection = (next: CanvasSelection, force = false) => {
        if (!force && sameSelection(selectionRef.current, next)) return;
        selectionRef.current = next;
        setSelection(next);
        onSelectionChangeRef.current?.(next);
    };
    const updateInteraction = (next: CanvasInteractionState) => {
        interactionRef.current = next;
        setInteraction(next);
        onInteractionChangeRef.current?.(next);
    };
    const setViewport = (updater: ViewportUpdater) => {
        const value = typeof updater === "function" ? updater(viewportRef.current) : updater;
        const next = createCanvasViewportSnapshot(value);
        if (next.x === viewportRef.current.x && next.y === viewportRef.current.y && next.k === viewportRef.current.k) return viewportRef.current;
        viewportRef.current = next;
        setViewportState(next);
        onViewportChangeRef.current?.(next);
        return next;
    };
    const cleanSelection = (next: CanvasDocument<TMetadata>) => {
        const selection = cleanCanvasSelection(next, selectionRef.current);
        if (selection !== selectionRef.current) updateSelection(selection);
    };
    const cleanInteraction = (next: CanvasDocument<TMetadata>) => {
        const connection = interactionRef.current.connectionInteraction;
        if (!connection) return;
        const ids = new Set(next.nodes.map((node) => node.id));
        if (!ids.has(connection.handle.nodeId)) updateInteraction({ ...interactionRef.current, connectionInteraction: null });
        else if (connection.targetNodeId && !ids.has(connection.targetNodeId)) updateInteraction({ ...interactionRef.current, connectionInteraction: { ...connection, targetNodeId: null } });
    };
    const publish = (next: CanvasDocument<TMetadata>) => {
        documentRef.current = next;
        setDocument(next);
        onDocumentChangeRef.current?.(next);
    };
    const pushHistory = (entry: CanvasDocument<TMetadata>) => {
        const past = historyRef.current.past;
        historyRef.current.past = [...past.slice(Math.max(0, past.length - behaviorRef.current.historyLimit + 1)), entry];
        historyRef.current.future = [];
        updateHistoryState();
    };
    const commitPreview = () => {
        const previous = previewRef.current;
        previewRef.current = null;
        if (!previous || previous === documentRef.current) return;
        pushHistory(previous);
        onDocumentChangeRef.current?.(documentRef.current);
    };
    const cancelPreview = () => {
        const previous = previewRef.current;
        if (!previous) return;
        previewRef.current = null;
        documentRef.current = previous;
        setDocument(previous);
        cleanSelection(previous);
        cleanInteraction(previous);
    };
    const transaction = (updater: CanvasDocumentUpdater<TMetadata>) => {
        const hadPreview = Boolean(previewRef.current);
        commitPreview();
        if (hadPreview) updateInteraction(DEFAULT_INTERACTION);
        const current = documentRef.current;
        const next = updater(current);
        if (next === current) return current;
        pushHistory(current);
        publish(next);
        cleanSelection(next);
        cleanInteraction(next);
        return next;
    };
    const restore = (next: CanvasDocument<TMetadata>) => {
        previewRef.current = null;
        publish(next);
        cleanSelection(next);
        cleanInteraction(next);
        updateHistoryState();
    };
    const preview = (updater: CanvasDocumentUpdater<TMetadata>) => {
        previewRef.current ||= documentRef.current;
        const next = updater(documentRef.current);
        if (next !== documentRef.current) {
            documentRef.current = next;
            setDocument(next);
            cleanSelection(next);
        }
        return next;
    };
    return { updateHistoryState, updateSelection, updateInteraction, setViewport, publish, transaction, restore, preview, commitPreview, cancelPreview };
}

const sameSelection = (first: CanvasSelection, second: CanvasSelection) => first.connectionId === second.connectionId && first.nodeIds.size === second.nodeIds.size && [...first.nodeIds].every((id) => second.nodeIds.has(id));
