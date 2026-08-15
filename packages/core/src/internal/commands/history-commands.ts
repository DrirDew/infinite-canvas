import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";
import { DEFAULT_INTERACTION } from "../canvas-state.js";

export function createHistoryCommands<TMetadata>(context: CanvasCommandContext<TMetadata>, runtime: CanvasCommandRuntime<TMetadata>) {
    const { documentRef, viewportRef, selectionRef, interactionRef, historyRef, previewRef } = context;
    const { transaction, setViewport, restore, preview, commitPreview, cancelPreview, updateInteraction } = runtime;
    return {
        getDocument: () => documentRef.current,
        getViewport: () => viewportRef.current,
        getSelection: () => selectionRef.current,
        getInteraction: () => interactionRef.current,
        getHistoryDocuments: () => [...historyRef.current.past, ...historyRef.current.future],
        transaction,
        setViewport,
        undo() {
            if (previewRef.current) {
                cancelPreview();
                updateInteraction(DEFAULT_INTERACTION);
                return;
            }
            const previous = historyRef.current.past.pop();
            if (!previous) return;
            historyRef.current.future.push(documentRef.current);
            restore(previous);
        },
        redo() {
            if (previewRef.current) {
                cancelPreview();
                updateInteraction(DEFAULT_INTERACTION);
                return;
            }
            const next = historyRef.current.future.pop();
            if (!next) return;
            historyRef.current.past.push(documentRef.current);
            restore(next);
        },
        preview,
        commitPreview,
        cancelPreview,
    };
}
