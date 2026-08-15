import { useEffect, useMemo, useRef, useState } from "react";
import { canvasDefaults } from "../defaults.js";
import { createCanvasDocumentSnapshot, validateCanvasDocument } from "../document.js";
import { createCanvasViewportSnapshot, validateCanvasViewport } from "../geometry.js";
import { createCanvasCommands } from "../internal/create-canvas-commands.js";
import { createCanvasHistory, createCanvasSelection, DEFAULT_INTERACTION, DEFAULT_VIEWPORT, type CanvasBehavior, type CanvasDrag, type CanvasHistory } from "../internal/canvas-state.js";
import type { CanvasClipboard, CanvasConnectionResolver, CanvasDocument, CanvasGroupResolver, CanvasInteractionState, CanvasSelection, UseCanvasOptions, UseCanvasResult } from "../types.js";

/**
 * Creates one isolated canvas instance with immutable document history and stable commands.
 * Initial values are read once unless an authoritative controlled document or viewport is supplied.
 */
export function useCanvas<TMetadata = unknown>({
    document: controlledDocument,
    viewport: controlledViewport,
    initialDocument = { nodes: [], connections: [] },
    initialViewport = DEFAULT_VIEWPORT,
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
    const [documentState, setDocumentState] = useState(() => createCanvasDocumentSnapshot(initialDocument, resolveConnection, canGroupNode));
    const [viewportState, setViewportState] = useState(() => createCanvasViewportSnapshot(initialViewport));
    const [selection, setSelection] = useState<CanvasSelection>(createCanvasSelection);
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [interaction, setInteraction] = useState(DEFAULT_INTERACTION);
    /** Caches validation by controlled document identity instead of rescanning it on every render. */
    const controlledDocumentRef = useRef<{ source?: CanvasDocument<TMetadata>; value?: CanvasDocument<TMetadata> }>({});
    /** Caches validation by controlled viewport identity. */
    const controlledViewportRef = useRef<{ source?: typeof controlledViewport; value?: typeof controlledViewport }>({});
    if (controlledDocument !== undefined && controlledDocumentRef.current.source !== controlledDocument) controlledDocumentRef.current = { source: controlledDocument, value: validateCanvasDocument(controlledDocument, resolveConnection, canGroupNode) };
    if (controlledViewport !== undefined && controlledViewportRef.current.source !== controlledViewport) controlledViewportRef.current = { source: controlledViewport, value: validateCanvasViewport(controlledViewport) };
    const document = controlledDocument === undefined ? documentState : controlledDocumentRef.current.value!;
    const viewport = controlledViewport === undefined ? viewportState : controlledViewportRef.current.value!;
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
    /** Lets stable commands decide at call time whether React state is controlled. */
    const controlledRef = useRef({ document: controlledDocument !== undefined, viewport: controlledViewport !== undefined });
    controlledRef.current = { document: controlledDocument !== undefined, viewport: controlledViewport !== undefined };
    const setDocument: typeof setDocumentState = (next) => {
        if (!controlledRef.current.document) setDocumentState(next);
    };
    const setViewport: typeof setViewportState = (next) => {
        if (!controlledRef.current.viewport) setViewportState(next);
    };
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

    useEffect(() => {
        if (controlledDocument === undefined) return;
        setDocumentState(document);
        if (documentRef.current === document) return;
        documentRef.current = document;
        historyRef.current = createCanvasHistory();
        previewRef.current = null;
        dragRef.current = null;
        const nextSelection = createCanvasSelection();
        selectionRef.current = nextSelection;
        interactionRef.current = DEFAULT_INTERACTION;
        setSelection(nextSelection);
        setInteraction(DEFAULT_INTERACTION);
        setHistoryState({ canUndo: false, canRedo: false });
        onSelectionChangeRef.current?.(nextSelection);
        onInteractionChangeRef.current?.(DEFAULT_INTERACTION);
    }, [controlledDocument, document]);

    useEffect(() => {
        if (controlledViewport === undefined) return;
        setViewportState(viewport);
        viewportRef.current = viewport;
    }, [controlledViewport, viewport]);

    return { document, viewport, selectedNodeIds: selection.nodeIds, selectedConnectionId: selection.connectionId, ...historyState, ...interaction, commands };
}
