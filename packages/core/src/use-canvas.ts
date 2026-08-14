import { useMemo, useRef, useState } from "react";
import { canvasDefaults } from "./defaults.js";
import { createCanvasCommands } from "./internal/create-canvas-commands.js";
import { createCanvasHistory, createCanvasSelection, DEFAULT_INTERACTION, DEFAULT_VIEWPORT, type CanvasBehavior, type CanvasDrag, type CanvasHistory } from "./internal/canvas-state.js";
import type { CanvasClipboard, CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasInteractionState, CanvasSelection, UseCanvasOptions, UseCanvasResult } from "./types.js";

export function useCanvas<TMetadata = unknown>({
    document: initialDocument = { nodes: [], connections: [] },
    viewport: initialViewport = DEFAULT_VIEWPORT,
    onDocumentChange,
    onViewportChange,
    onSelectionChange,
    onInteractionChange,
    resolveConnection,
    canGroupNode,
    historyLimit = canvasDefaults.historyLimit,
    dragThreshold = canvasDefaults.dragThreshold,
    groupPadding = canvasDefaults.groupPadding,
    connectionHandleRadius = canvasDefaults.connectionHandleRadius,
    connectionNodePadding = canvasDefaults.connectionNodePadding,
}: UseCanvasOptions<TMetadata> = {}): UseCanvasResult<TMetadata> {
    const behavior: CanvasBehavior = { historyLimit: Math.max(1, historyLimit), dragThreshold: Math.max(0, dragThreshold), groupPadding: Math.max(0, groupPadding), connectionHandleRadius: Math.max(0, connectionHandleRadius), connectionNodePadding: Math.max(0, connectionNodePadding) };
    const [document, setDocument] = useState(initialDocument);
    const [viewport, setViewport] = useState(initialViewport);
    const [selection, setSelection] = useState<CanvasSelection>(createCanvasSelection);
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [interaction, setInteraction] = useState(DEFAULT_INTERACTION);
    const documentRef = useRef<CanvasDocument<TMetadata>>(document);
    const viewportRef = useRef(viewport);
    const selectionRef = useRef(selection);
    const interactionRef = useRef(interaction);
    const historyRef = useRef<CanvasHistory<TMetadata>>(createCanvasHistory());
    const previewRef = useRef<CanvasDocument<TMetadata> | null>(null);
    const dragRef = useRef<CanvasDrag<TMetadata> | null>(null);
    const clipboardRef = useRef<CanvasClipboard<TMetadata> | null>(null);
    const onDocumentChangeRef = useRef(onDocumentChange);
    const onViewportChangeRef = useRef(onViewportChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onInteractionChangeRef = useRef(onInteractionChange);
    const connectionResolverRef = useRef<CanvasConnectionResolver<TMetadata> | undefined>(resolveConnection);
    const groupResolverRef = useRef<CanvasGroupResolver<TMetadata> | undefined>(canGroupNode);
    const behaviorRef = useRef(behavior);
    onDocumentChangeRef.current = onDocumentChange;
    onViewportChangeRef.current = onViewportChange;
    onSelectionChangeRef.current = onSelectionChange;
    onInteractionChangeRef.current = onInteractionChange;
    connectionResolverRef.current = resolveConnection;
    groupResolverRef.current = canGroupNode;
    behaviorRef.current = behavior;

    const commands = useMemo(
        () =>
            createCanvasCommands({
                documentRef,
                viewportRef,
                selectionRef,
                interactionRef,
                historyRef,
                previewRef,
                dragRef,
                clipboardRef,
                onDocumentChangeRef,
                onViewportChangeRef,
                onSelectionChangeRef,
                onInteractionChangeRef,
                connectionResolverRef,
                groupResolverRef,
                behaviorRef,
                setDocument,
                setViewport,
                setSelection,
                setInteraction,
                setHistoryState,
            }),
        [],
    );

    return { document, viewport, selectedNodeIds: selection.nodeIds, selectedConnectionId: selection.connectionId, ...historyState, ...interaction, commands };
}
