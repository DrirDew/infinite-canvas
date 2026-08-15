import type { CanvasConnection, CanvasNode } from "../../canvas/model.js";
import type { CanvasPasteOptions } from "../../canvas/commands.js";
import { createCanvasClipboard, pasteCanvasClipboard } from "../../document/clipboard.js";
import { addDocumentConnections, addDocumentNodes } from "../../document/mutations.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";

export function createClipboardCommands<TMetadata>(context: CanvasCommandContext<TMetadata>, { mutate, updateSelection }: CanvasCommandRuntime<TMetadata>) {
    const { documentRef, selectionRef, clipboardRef, policiesRef } = context;
    return {
        copySelection() {
            clipboardRef.current = createCanvasClipboard(documentRef.current, selectionRef.current.nodeIds);
            return clipboardRef.current;
        },
        pasteClipboard(options: CanvasPasteOptions<TMetadata>) {
            const clipboard = clipboardRef.current;
            if (!clipboard?.nodes.length) return null;
            const pasted = pasteCanvasClipboard(clipboard, options);
            let nodes: CanvasNode<TMetadata>[] = [];
            let connections: CanvasConnection[] = [];
            mutate((document) => {
                const withNodes = addDocumentNodes(document, pasted.nodes, policiesRef.current.grouping);
                nodes = withNodes.nodes.slice(document.nodes.length);
                if (!nodes.length) return document;
                const ids = new Set(nodes.map((node) => node.id));
                const withConnections = addDocumentConnections(withNodes, pasted.connections.filter((connection) => ids.has(connection.fromNodeId) && ids.has(connection.toNodeId)), policiesRef.current.connection);
                connections = withConnections.connections.slice(document.connections.length);
                return withConnections;
            });
            if (!nodes.length) return null;
            updateSelection({ nodeIds: new Set(nodes.map((node) => node.id)), connectionId: null });
            return { nodes, connections };
        },
        getClipboard: () => clipboardRef.current,
    };
}
