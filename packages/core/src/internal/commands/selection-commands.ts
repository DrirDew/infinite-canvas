import { nodesInRect } from "../../geometry/nodes.js";
import type { CanvasRect } from "../../canvas/model.js";
import type { CanvasCommandContext, CanvasCommandRuntime } from "../canvas-command-context.js";
import { createCanvasSelection } from "../canvas-state.js";

export function createSelectionCommands<TMetadata>({ documentRef }: CanvasCommandContext<TMetadata>, { updateSelection }: CanvasCommandRuntime<TMetadata>) {
    return {
        selectNodes(ids: Iterable<string>) {
            const available = new Set(documentRef.current.nodes.map((node) => node.id));
            updateSelection({ nodeIds: new Set([...ids].filter((id) => available.has(id))), connectionId: null });
        },
        selectNodesInRect(rect: CanvasRect, initialIds: Iterable<string> = []) {
            const nodes = documentRef.current.nodes;
            const available = new Set(nodes.map((node) => node.id));
            const nodeIds = new Set([...initialIds].filter((id) => available.has(id)));
            nodesInRect(nodes, rect).forEach((node) => nodeIds.add(node.id));
            updateSelection({ nodeIds, connectionId: null });
            return nodeIds;
        },
        selectConnection: (connectionId: string | null) => updateSelection({ nodeIds: new Set(), connectionId: connectionId && documentRef.current.connections.some((connection) => connection.id === connectionId) ? connectionId : null }),
        clearSelection: () => updateSelection(createCanvasSelection()),
    };
}
