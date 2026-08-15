import type { Dispatch, SetStateAction } from "react";
import type { CanvasClipboard, CanvasDocument, CanvasInteractionState, CanvasSelection, ViewportTransform } from "../canvas/model.js";
import type { CanvasDocumentUpdater, ViewportUpdater } from "../canvas/commands.js";
import type { CanvasListeners, CanvasPolicies } from "../canvas/options.js";
import type { CanvasBehavior, CanvasDrag, CanvasHistory } from "./canvas-state.js";

type Latest<T> = { current: T };
export type CanvasHistoryState = { canUndo: boolean; canRedo: boolean };

export type CanvasCommandContext<TMetadata> = {
    documentRef: Latest<CanvasDocument<TMetadata>>;
    viewportRef: Latest<ViewportTransform>;
    selectionRef: Latest<CanvasSelection>;
    interactionRef: Latest<CanvasInteractionState>;
    historyRef: Latest<CanvasHistory<TMetadata>>;
    previewRef: Latest<CanvasDocument<TMetadata> | null>;
    dragRef: Latest<CanvasDrag<TMetadata> | null>;
    clipboardRef: Latest<CanvasClipboard<TMetadata> | null>;
    listenersRef: Latest<CanvasListeners<TMetadata>>;
    policiesRef: Latest<CanvasPolicies<TMetadata>>;
    behaviorRef: Latest<CanvasBehavior>;
    setDocument: Dispatch<SetStateAction<CanvasDocument<TMetadata>>>;
    setViewport: Dispatch<SetStateAction<ViewportTransform>>;
    setSelection: Dispatch<SetStateAction<CanvasSelection>>;
    setInteraction: Dispatch<SetStateAction<CanvasInteractionState>>;
    setHistoryState: Dispatch<SetStateAction<CanvasHistoryState>>;
};

export type CanvasCommandRuntime<TMetadata> = {
    updateHistoryState: () => void;
    updateSelection: (selection: CanvasSelection, force?: boolean) => void;
    updateInteraction: (interaction: CanvasInteractionState) => void;
    setViewport: (updater: ViewportUpdater) => ViewportTransform;
    publish: (document: CanvasDocument<TMetadata>) => void;
    mutate: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    transaction: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    restore: (document: CanvasDocument<TMetadata>) => void;
    preview: (updater: CanvasDocumentUpdater<TMetadata>) => CanvasDocument<TMetadata>;
    commitPreview: () => void;
    cancelPreview: () => void;
};
