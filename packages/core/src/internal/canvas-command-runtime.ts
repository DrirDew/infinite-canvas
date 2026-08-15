import { cleanCanvasSelection, validateCanvasDocument } from "../document/mutations.js";
import type { CanvasDocument, CanvasInteractionState, CanvasSelection } from "../canvas/model.js";
import type { CanvasDocumentUpdater, ViewportUpdater } from "../canvas/commands.js";
import { createCanvasViewportSnapshot } from "../geometry/viewport.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "./canvas-command-context.js";
import { DEFAULT_INTERACTION } from "./canvas-state.js";

export function createCanvasCommandRuntime<TMetadata>({ documentRef, viewportRef, selectionRef, interactionRef, historyRef, previewRef, listenersRef, policiesRef, behaviorRef, setDocument, setViewport: setViewportState, setSelection, setInteraction, setHistoryState }: CanvasCommandContext<TMetadata>): CanvasCommandRuntime<TMetadata> {
    const updateHistoryState = () => setHistoryState({ canUndo: Boolean(historyRef.current.past.length), canRedo: Boolean(historyRef.current.future.length) });
    const updateSelection = (next: CanvasSelection, force = false) => {
        if (!force && sameSelection(selectionRef.current, next)) return;
        selectionRef.current = next;
        setSelection(next);
        listenersRef.current.selection?.(next);
    };
    const updateInteraction = (next: CanvasInteractionState) => {
        interactionRef.current = next;
        setInteraction(next);
        listenersRef.current.interaction?.(next);
    };
    const setViewport = (updater: ViewportUpdater) => {
        const value = typeof updater === "function" ? updater(viewportRef.current) : updater;
        const next = createCanvasViewportSnapshot(value);
        if (next.x === viewportRef.current.x && next.y === viewportRef.current.y && next.k === viewportRef.current.k) return viewportRef.current;
        viewportRef.current = next;
        setViewportState(next);
        listenersRef.current.viewport?.(next);
        return next;
    };
    const cleanSelection = (next: CanvasDocument<TMetadata>) => {
        const selection = cleanCanvasSelection(next, selectionRef.current);
        if (selection !== selectionRef.current) updateSelection(selection);
    };
    const cleanInteraction = (next: CanvasDocument<TMetadata>) => {
        const interaction = interactionRef.current;
        if (interaction.kind !== "connection") return;
        const connection = interaction.connectionInteraction;
        const ids = new Set(next.nodes.map((node) => node.id));
        if (!ids.has(connection.handle.nodeId)) updateInteraction(DEFAULT_INTERACTION);
        else if (connection.targetNodeId && !ids.has(connection.targetNodeId)) updateInteraction({ ...interaction, connectionInteraction: { ...connection, targetNodeId: null } });
    };
    const publish = (next: CanvasDocument<TMetadata>) => {
        documentRef.current = next;
        setDocument(next);
        listenersRef.current.document?.(next);
    };
    const pushHistory = (entry: CanvasDocument<TMetadata>) => {
        const past = historyRef.current.past;
        historyRef.current.past = [...past.slice(Math.max(0, past.length - behaviorRef.current.historyLimit + 1)), entry];
        historyRef.current.future = [];
        updateHistoryState();
    };
    const validateCommit = (next: CanvasDocument<TMetadata>) => validateCanvasDocument(next, policiesRef.current.connection, policiesRef.current.grouping);
    const commitPreview = () => {
        const previous = previewRef.current;
        if (!previous) return;
        if (previous === documentRef.current) {
            previewRef.current = null;
            return;
        }
        try {
            validateCommit(documentRef.current);
        } catch (error) {
            previewRef.current = null;
            documentRef.current = previous;
            setDocument(previous);
            cleanSelection(previous);
            cleanInteraction(previous);
            updateInteraction(DEFAULT_INTERACTION);
            throw error;
        }
        previewRef.current = null;
        pushHistory(previous);
        listenersRef.current.document?.(documentRef.current);
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
    const applyTransaction = (updater: CanvasDocumentUpdater<TMetadata>, validate: boolean) => {
        const hadPreview = Boolean(previewRef.current);
        commitPreview();
        if (hadPreview) updateInteraction(DEFAULT_INTERACTION);
        const current = documentRef.current;
        const next = updater(current);
        if (next === current) return current;
        if (validate) validateCommit(next);
        pushHistory(current);
        publish(next);
        cleanSelection(next);
        cleanInteraction(next);
        return next;
    };
    const mutate = (updater: CanvasDocumentUpdater<TMetadata>) => applyTransaction(updater, false);
    const transaction = (updater: CanvasDocumentUpdater<TMetadata>) => applyTransaction(updater, true);
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
    return { updateHistoryState, updateSelection, updateInteraction, setViewport, publish, mutate, transaction, restore, preview, commitPreview, cancelPreview };
}

const sameSelection = (first: CanvasSelection, second: CanvasSelection) => first.connectionId === second.connectionId && first.nodeIds.size === second.nodeIds.size && [...first.nodeIds].every((id) => second.nodeIds.has(id));
