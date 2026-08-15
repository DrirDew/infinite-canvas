import type { CanvasConnection, CanvasDocument, CanvasNode } from "../../canvas/model.js";
import type { CanvasNodePatch } from "../../canvas/commands.js";
import { addDocumentConnections, addDocumentNodes, createCanvasDocumentSnapshot, removeDocumentConnections, removeDocumentNodes, updateDocumentNode } from "../../document/mutations.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";
import { createCanvasHistory, createCanvasSelection, DEFAULT_INTERACTION } from "../canvas-state.js";

export function createDocumentCommands<TMetadata>(context: CanvasCommandContext<TMetadata>, runtime: CanvasCommandRuntime<TMetadata>) {
    const { historyRef, previewRef, dragRef, policiesRef } = context;
    const { publish, mutate, updateHistoryState, updateInteraction, updateSelection } = runtime;
    return {
        setDocument(next: CanvasDocument<TMetadata>) {
            historyRef.current = createCanvasHistory();
            previewRef.current = null;
            dragRef.current = null;
            publish(createCanvasDocumentSnapshot(next, policiesRef.current.connection, policiesRef.current.grouping));
            updateSelection(createCanvasSelection(), true);
            updateInteraction(DEFAULT_INTERACTION);
            updateHistoryState();
        },
        addNode: (node: CanvasNode<TMetadata>) => mutate((document) => addDocumentNodes(document, [node], policiesRef.current.grouping)),
        addNodes: (nodes: readonly CanvasNode<TMetadata>[]) => mutate((document) => addDocumentNodes(document, nodes, policiesRef.current.grouping)),
        updateNode: (id: string, patch: CanvasNodePatch<TMetadata>) => mutate((document) => updateDocumentNode(document, id, patch, policiesRef.current.connection, policiesRef.current.grouping)),
        removeNodes: (ids: Iterable<string>) => mutate((document) => removeDocumentNodes(document, ids)),
        addConnection: (connection: CanvasConnection) => mutate((document) => addDocumentConnections(document, [connection], policiesRef.current.connection)),
        addConnections: (connections: readonly CanvasConnection[]) => mutate((document) => addDocumentConnections(document, connections, policiesRef.current.connection)),
        removeConnections: (ids: Iterable<string>) => mutate((document) => removeDocumentConnections(document, ids)),
    };
}
