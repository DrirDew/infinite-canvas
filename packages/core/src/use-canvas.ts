import { useMemo, useRef, useState } from "react";
import { addDocumentConnections, addDocumentNodes, cleanCanvasSelection, removeDocumentConnections, removeDocumentNodes, updateDocumentNode } from "./document";
import { nodesInRect } from "./geometry";
import type { BaseCanvasNodeMetadata, CanvasCommands, CanvasConnection, CanvasDocument, CanvasDocumentUpdater, CanvasNode, CanvasNodePatch, CanvasSelection, UseCanvasOptions, UseCanvasResult, ViewportTransform, ViewportUpdater } from "./types";

type CanvasHistory<TMetadata extends BaseCanvasNodeMetadata> = {
    past: CanvasDocument<TMetadata>[];
    future: CanvasDocument<TMetadata>[];
};

const HISTORY_LIMIT = 50;
const DEFAULT_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 };
const emptySelection = (): CanvasSelection => ({ nodeIds: new Set(), connectionId: null });
const emptyHistory = <TMetadata extends BaseCanvasNodeMetadata>(): CanvasHistory<TMetadata> => ({ past: [], future: [] });

export function useCanvas<TMetadata extends BaseCanvasNodeMetadata = BaseCanvasNodeMetadata>({
    document: initialDocument = { nodes: [], connections: [] },
    viewport: initialViewport = DEFAULT_VIEWPORT,
    onDocumentChange,
    onViewportChange,
}: UseCanvasOptions<TMetadata> = {}): UseCanvasResult<TMetadata> {
    const [document, setDocumentState] = useState(initialDocument);
    const [viewport, setViewportState] = useState(initialViewport);
    const [selection, setSelection] = useState<CanvasSelection>(emptySelection);
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const documentRef = useRef(document);
    const viewportRef = useRef(viewport);
    const selectionRef = useRef(selection);
    const historyRef = useRef<CanvasHistory<TMetadata>>(emptyHistory());
    const previewRef = useRef<CanvasDocument<TMetadata> | null>(null);
    const onChangeRef = useRef(onDocumentChange);
    const onViewportChangeRef = useRef(onViewportChange);
    onChangeRef.current = onDocumentChange;
    onViewportChangeRef.current = onViewportChange;

    const commands = useMemo(() => {
        const updateHistoryState = () => setHistoryState({ canUndo: Boolean(historyRef.current.past.length), canRedo: Boolean(historyRef.current.future.length) });
        const updateSelection = (next: CanvasSelection) => {
            selectionRef.current = next;
            setSelection(next);
        };
        const setViewport = (updater: ViewportUpdater) => {
            const next = typeof updater === "function" ? updater(viewportRef.current) : updater;
            viewportRef.current = next;
            setViewportState(next);
            onViewportChangeRef.current?.(next);
            return next;
        };
        const cleanSelection = (next: CanvasDocument<TMetadata>) => {
            const selection = cleanCanvasSelection(next, selectionRef.current);
            if (selection !== selectionRef.current) updateSelection(selection);
        };
        const publish = (next: CanvasDocument<TMetadata>) => {
            documentRef.current = next;
            setDocumentState(next);
            onChangeRef.current?.(next);
        };
        const pushHistory = (entry: CanvasDocument<TMetadata>) => {
            historyRef.current.past = [...historyRef.current.past.slice(1 - HISTORY_LIMIT), entry];
            historyRef.current.future = [];
            updateHistoryState();
        };
        const transaction = (updater: CanvasDocumentUpdater<TMetadata>) => {
            const current = documentRef.current;
            const next = updater(current);
            if (next === current) return current;
            previewRef.current = null;
            pushHistory(current);
            publish(next);
            cleanSelection(next);
            return next;
        };
        const restore = (next: CanvasDocument<TMetadata>) => {
            previewRef.current = null;
            publish(next);
            cleanSelection(next);
            updateHistoryState();
        };

        return {
            setDocument(next: CanvasDocument<TMetadata>) {
                historyRef.current = emptyHistory();
                previewRef.current = null;
                documentRef.current = next;
                selectionRef.current = emptySelection();
                setDocumentState(next);
                setSelection(selectionRef.current);
                updateHistoryState();
            },
            addNode: (node: CanvasNode<TMetadata>) => transaction((document) => addDocumentNodes(document, [node])),
            addNodes: (nodes: CanvasNode<TMetadata>[]) => transaction((document) => addDocumentNodes(document, nodes)),
            updateNode: (id: string, patch: CanvasNodePatch<TMetadata>) => transaction((document) => updateDocumentNode(document, id, patch)),
            removeNodes: (ids: Iterable<string>) => transaction((document) => removeDocumentNodes(document, ids)),
            addConnection: (connection: CanvasConnection) => transaction((document) => addDocumentConnections(document, [connection])),
            addConnections: (connections: CanvasConnection[]) => transaction((document) => addDocumentConnections(document, connections)),
            removeConnections: (ids: Iterable<string>) => transaction((document) => removeDocumentConnections(document, ids)),
            selectNodes: (ids: Iterable<string>) => updateSelection({ nodeIds: new Set(ids), connectionId: null }),
            selectNodesInRect(rect, initialIds: Iterable<string> = []) {
                const nodeIds = new Set(initialIds);
                nodesInRect(documentRef.current.nodes, rect).forEach((node) => nodeIds.add(node.id));
                updateSelection({ nodeIds, connectionId: null });
                return nodeIds;
            },
            selectConnection: (connectionId: string | null) => updateSelection({ nodeIds: new Set(), connectionId }),
            clearSelection: () => updateSelection(emptySelection()),
            getDocument: () => documentRef.current,
            getViewport: () => viewportRef.current,
            getSelection: () => selectionRef.current,
            getHistoryDocuments: () => [...historyRef.current.past, ...historyRef.current.future],
            transaction,
            setViewport,
            undo() {
                const previous = historyRef.current.past.pop();
                if (!previous) return;
                historyRef.current.future.push(documentRef.current);
                restore(previous);
            },
            redo() {
                const next = historyRef.current.future.pop();
                if (!next) return;
                historyRef.current.past.push(documentRef.current);
                restore(next);
            },
            preview(updater: CanvasDocumentUpdater<TMetadata>) {
                previewRef.current ||= documentRef.current;
                const next = updater(documentRef.current);
                if (next !== documentRef.current) {
                    documentRef.current = next;
                    setDocumentState(next);
                    cleanSelection(next);
                }
                return next;
            },
            commitPreview() {
                const previous = previewRef.current;
                previewRef.current = null;
                if (!previous || previous === documentRef.current) return;
                pushHistory(previous);
                onChangeRef.current?.(documentRef.current);
            },
        } satisfies CanvasCommands<TMetadata>;
    }, []);

    return { document, viewport, selectedNodeIds: selection.nodeIds, selectedConnectionId: selection.connectionId, ...historyState, commands };
}
