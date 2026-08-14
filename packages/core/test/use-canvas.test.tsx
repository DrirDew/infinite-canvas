import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { useCanvas, type CanvasConnection, type CanvasConnectionResolver, type CanvasDocument, type CanvasNode, type UseCanvasOptions } from "../src";

type Metadata = { value?: number };
const node = (id: string, metadata?: Metadata): CanvasNode<Metadata> => ({
    id,
    type: "test",
    title: id,
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    metadata,
});
const connection = (id: string, fromNodeId: string, toNodeId: string): CanvasConnection => ({ id, fromNodeId, toNodeId });

function createCanvas(document: CanvasDocument<Metadata> = { nodes: [], connections: [] }, resolveConnection?: CanvasConnectionResolver<Metadata>, options?: CanvasOptions) {
    let canvas!: ReturnType<typeof useCanvas<Metadata>>;
    function Capture() {
        canvas = useCanvas<Metadata>({ document, resolveConnection, ...options });
        return null;
    }
    renderToString(<Capture />);
    return canvas;
}

type CanvasOptions = Pick<UseCanvasOptions<Metadata>, "historyLimit" | "dragThreshold" | "groupPadding" | "connectionHandleRadius" | "connectionNodePadding" | "canGroupNode" | "onDocumentChange" | "onSelectionChange" | "onInteractionChange">;

test("adds, updates, and removes nodes and connections", () => {
    const canvas = createCanvas();
    canvas.commands.addNodes([node("a"), node("b")]);
    canvas.commands.updateNode("a", (current) => ({
        ...current,
        metadata: { value: 2 },
    }));
    canvas.commands.addConnection(connection("ab", "a", "b"));
    expect(canvas.commands.getDocument()).toEqual({
        nodes: [node("a", { value: 2 }), node("b")],
        connections: [connection("ab", "a", "b")],
    });
    canvas.commands.removeConnections(["ab"]);
    canvas.commands.removeNodes(["b"]);
    expect(canvas.commands.getDocument()).toEqual({
        nodes: [node("a", { value: 2 })],
        connections: [],
    });
});

test("add commands reject duplicate ids and invalid connections", () => {
    const canvas = createCanvas({ nodes: [node("a"), { ...node("group"), role: "group" }], connections: [] });
    canvas.commands.addNodes([node("a"), { ...node("b"), groupId: "missing" }, node("b")]);
    canvas.commands.addConnections([
        connection("valid", "a", "b"),
        connection("valid", "b", "a"),
        connection("missing", "a", "missing"),
        connection("self", "a", "a"),
        connection("group", "a", "group"),
    ]);
    expect(canvas.commands.getDocument().nodes.map((item) => item.id)).toEqual(["a", "group", "b"]);
    expect(canvas.commands.getDocument().connections).toEqual([connection("valid", "a", "b")]);
    expect(canvas.commands.getDocument().nodes[2].groupId).toBeUndefined();
});

test("node updates reject duplicate ids and clean invalid relationships", () => {
    const canvas = createCanvas({ nodes: [{ ...node("group"), role: "group" }, { ...node("child"), groupId: "group" }, node("other")], connections: [connection("edge", "child", "other")] });
    canvas.commands.updateNode("child", { id: "other" });
    expect(canvas.commands.getDocument().nodes[1].id).toBe("child");
    canvas.commands.updateNode("group", { role: undefined });
    expect(canvas.commands.getDocument().nodes[1].groupId).toBeUndefined();
    canvas.commands.updateNode("child", { role: "group" });
    expect(canvas.commands.getDocument().connections).toEqual([]);
});

test("removing nodes clears related connections, child groups, and selection", () => {
    const canvas = createCanvas({
        nodes: [node("group"), { ...node("child"), groupId: "group" }, node("other")],
        connections: [connection("edge", "group", "other")],
    });
    canvas.commands.selectNodes(["group", "child"]);
    canvas.commands.removeNodes(["group"]);
    expect(canvas.commands.getDocument()).toEqual({
        nodes: [node("child"), node("other")],
        connections: [],
    });
    expect([...canvas.commands.getSelection().nodeIds]).toEqual(["child"]);
});

test("transaction creates one history entry and new edits clear redo", () => {
    const canvas = createCanvas();
    canvas.commands.transaction((document) => ({
        nodes: [...document.nodes, node("a"), node("b")],
        connections: [connection("ab", "a", "b")],
    }));
    canvas.commands.undo();
    expect(canvas.commands.getDocument()).toEqual({ nodes: [], connections: [] });
    canvas.commands.redo();
    expect(canvas.commands.getDocument().nodes.map(({ id }) => id)).toEqual(["a", "b"]);
    canvas.commands.undo();
    canvas.commands.addNode(node("c"));
    canvas.commands.redo();
    expect(canvas.commands.getDocument().nodes.map(({ id }) => id)).toEqual(["c"]);
});

test("instances keep documents, selections, and history isolated", () => {
    const first = createCanvas();
    const second = createCanvas();
    first.commands.addNode(node("a"));
    first.commands.selectNodes(["a"]);
    second.commands.addNode(node("b"));
    second.commands.selectNodes(["b"]);
    first.commands.undo();
    expect(first.commands.getDocument().nodes).toEqual([]);
    expect([...first.commands.getSelection().nodeIds]).toEqual([]);
    expect(second.commands.getDocument().nodes).toEqual([node("b")]);
    expect([...second.commands.getSelection().nodeIds]).toEqual(["b"]);
});

test("document replacement publishes the new snapshot and resets history", () => {
    let snapshot: CanvasDocument<Metadata> | null = null;
    const canvas = createCanvas(undefined, undefined, { onDocumentChange: (document) => (snapshot = document) });
    canvas.commands.addNode(node("old"));
    const next = { nodes: [node("new")], connections: [] };
    canvas.commands.setDocument(next);
    expect(snapshot).toBe(next);
    expect(canvas.commands.getDocument()).toBe(next);
    expect(canvas.commands.getHistoryDocuments()).toEqual([]);
});

test("viewport and rectangle selection stay inside each instance", () => {
    const first = createCanvas({ nodes: [node("a"), { ...node("b"), position: { x: 200, y: 200 } }], connections: [] });
    const second = createCanvas({ nodes: [node("c")], connections: [] });
    first.commands.setViewport({ x: 80, y: 40, k: 2 });
    first.commands.selectNodesInRect({ x: -10, y: -10, width: 120, height: 120 });
    expect(first.commands.getViewport()).toEqual({ x: 80, y: 40, k: 2 });
    expect([...first.commands.getSelection().nodeIds]).toEqual(["a"]);
    expect(second.commands.getViewport()).toEqual({ x: 0, y: 0, k: 1 });
    expect([...second.commands.getSelection().nodeIds]).toEqual([]);
});

test("selection commands discard missing document ids", () => {
    const canvas = createCanvas({ nodes: [node("a")], connections: [] });
    canvas.commands.selectNodes(["a", "missing"]);
    expect([...canvas.commands.getSelection().nodeIds]).toEqual(["a"]);
    canvas.commands.selectConnection("missing");
    expect(canvas.commands.getSelection().connectionId).toBeNull();
    expect([...canvas.commands.selectNodesInRect({ x: 1000, y: 1000, width: 10, height: 10 }, ["a", "missing"])]).toEqual(["a"]);
});

test("drag previews commit once, snap into groups, and cancel safely", () => {
    const canvas = createCanvas({
        nodes: [node("a"), { ...node("group"), type: "group", role: "group", position: { x: 300, y: 0 }, width: 400, height: 300 }],
        connections: [],
    });
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    canvas.commands.moveNodeDrag({ x: 300, y: 0 });
    canvas.commands.endNodeDrag({ x: 300, y: 0 });
    expect(canvas.commands.getDocument().nodes[0]).toEqual({ ...node("a"), groupId: "group", position: { x: 324, y: 24 } });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(1);
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    canvas.commands.moveNodeDrag({ x: 100, y: 0 });
    canvas.commands.endNodeDrag();
    expect(canvas.commands.getDocument().nodes[0].position).toEqual({ x: 324, y: 24 });
});

test("accepts instance behavior tuning without changing command identity", () => {
    const canvas = createCanvas({ nodes: [node("a"), { ...node("group"), role: "group", position: { x: 300, y: 0 }, width: 400, height: 300 }], connections: [] }, undefined, { historyLimit: 1, groupPadding: 10 });
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    canvas.commands.endNodeDrag({ x: 300, y: 0 });
    canvas.commands.addNode(node("b"));
    expect(canvas.commands.getDocument().nodes[0]).toMatchObject({ groupId: "group", position: { x: 310, y: 10 } });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(1);
});

test("supports application grouping policies", () => {
    const canvas = createCanvas({ nodes: [node("a"), { ...node("group"), role: "group", position: { x: 300, y: 0 }, width: 400, height: 300 }], connections: [] }, undefined, { canGroupNode: () => false });
    canvas.commands.addNode({ ...node("direct"), groupId: "group" });
    canvas.commands.updateNode("a", { groupId: "group" });
    expect(canvas.commands.getDocument().nodes.slice(-1)[0].groupId).toBeUndefined();
    expect(canvas.commands.getDocument().nodes[0].groupId).toBeUndefined();
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    expect(canvas.commands.moveNodeDrag({ x: 300, y: 0 })).toBeNull();
    canvas.commands.endNodeDrag({ x: 300, y: 0 });
    expect(canvas.commands.getDocument().nodes[0].groupId).toBeUndefined();
});

test("publishes selection and interaction changes", () => {
    let selected: string[] = [];
    let connecting = false;
    const canvas = createCanvas({ nodes: [node("a")], connections: [] }, undefined, {
        onSelectionChange: (selection) => (selected = [...selection.nodeIds]),
        onInteractionChange: (interaction) => (connecting = Boolean(interaction.connectionInteraction)),
    });
    canvas.commands.selectNodes(["a"]);
    canvas.commands.startConnection({ nodeId: "a", handleType: "source" }, { x: 100, y: 50 });
    expect(selected).toEqual(["a"]);
    expect(connecting).toBe(true);
    canvas.commands.cancelConnection();
    expect(connecting).toBe(false);
});

test("dragging groups moves children and resizing creates one history entry", () => {
    const canvas = createCanvas({ nodes: [{ ...node("group"), type: "group", role: "group" }, { ...node("child"), groupId: "group" }], connections: [] });
    canvas.commands.startNodeDrag(["group"], { x: 0, y: 0 });
    canvas.commands.endNodeDrag({ x: 100, y: 50 });
    expect(canvas.commands.getDocument().nodes.map(({ position }) => position)).toEqual([
        { x: 100, y: 50 },
        { x: 100, y: 50 },
    ]);
    canvas.commands.startNodeResize("child");
    canvas.commands.resizeNode("child", 240, 180, { x: 120, y: 70 });
    canvas.commands.endNodeResize();
    expect(canvas.commands.getDocument().nodes[1]).toMatchObject({ width: 240, height: 180, position: { x: 120, y: 70 } });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(2);
});

test("cancels uncommitted previews before undoing history", () => {
    const canvas = createCanvas({ nodes: [node("a")], connections: [] });
    canvas.commands.startNodeResize("a");
    canvas.commands.resizeNode("a", 200, 180);
    canvas.commands.undo();
    expect(canvas.commands.getDocument().nodes[0]).toMatchObject({ width: 100, height: 100 });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(0);
    expect(canvas.commands.getInteraction().isNodeResizing).toBe(false);
});

test("cancels interrupted node resize without history", () => {
    const canvas = createCanvas({ nodes: [node("a")], connections: [] });
    canvas.commands.startNodeResize("a");
    canvas.commands.resizeNode("a", 200, 180);
    canvas.commands.cancelNodeResize();
    expect(canvas.commands.getDocument().nodes[0]).toMatchObject({ width: 100, height: 100 });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(0);
    expect(canvas.commands.getInteraction().isNodeResizing).toBe(false);
});

test("commits an active preview before a new transaction", () => {
    const canvas = createCanvas({ nodes: [node("a")], connections: [] });
    canvas.commands.startNodeResize("a");
    canvas.commands.resizeNode("a", 200, 180);
    canvas.commands.addNode(node("b"));
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(2);
    expect(canvas.commands.getInteraction().isNodeResizing).toBe(false);
    canvas.commands.undo();
    expect(canvas.commands.getDocument().nodes).toHaveLength(1);
    expect(canvas.commands.getDocument().nodes[0]).toMatchObject({ width: 200, height: 180 });
});

test("connection interaction resolves targets without generating ids", () => {
    const canvas = createCanvas({ nodes: [node("a"), { ...node("b"), position: { x: 200, y: 0 } }], connections: [] });
    const other = createCanvas({ nodes: [node("other")], connections: [] });
    canvas.commands.startConnection({ nodeId: "a", handleType: "source" }, { x: 100, y: 50 });
    expect(canvas.commands.moveConnection({ x: 250, y: 50 })).toEqual({ nodeId: "b", isNearNode: true });
    expect(canvas.commands.getInteraction().connectionInteraction?.targetNodeId).toBe("b");
    expect(other.commands.getInteraction().connectionInteraction).toBeNull();
    const result = canvas.commands.endConnection({ x: 250, y: 50 });
    expect(result?.connection).toEqual({ fromNodeId: "a", toNodeId: "b" });
    expect(canvas.commands.getInteraction().connectionInteraction).toBeNull();
    expect(canvas.commands.getDocument().connections).toEqual([]);
    canvas.commands.addConnection({ id: "ab", ...result!.connection! });
    expect(canvas.commands.getDocument().connections).toEqual([connection("ab", "a", "b")]);
    const blocked = createCanvas({ nodes: [node("a"), { ...node("b"), position: { x: 200, y: 0 } }], connections: [] }, () => null);
    blocked.commands.addConnection(connection("ab", "a", "b"));
    expect(blocked.commands.getDocument().connections).toEqual([]);
    blocked.commands.startConnection({ nodeId: "a", handleType: "source" }, { x: 100, y: 50 });
    expect(blocked.commands.moveConnection({ x: 250, y: 50 })).toEqual({ nodeId: null, isNearNode: true });
});

test("clipboard remaps groups and connections in one isolated transaction", () => {
    const canvas = createCanvas({
        nodes: [{ ...node("group"), type: "group", role: "group", width: 300, height: 300 }, { ...node("child"), groupId: "group", position: { x: 50, y: 50 } }],
        connections: [connection("edge", "group", "child")],
    });
    const other = createCanvas();
    canvas.commands.selectNodes(["group", "child"]);
    expect(canvas.commands.copySelection()?.connections).toEqual([connection("edge", "group", "child")]);
    const pasted = canvas.commands.pasteClipboard({
        position: { x: 1000, y: 1000 },
        createNodeId: (current) => `copy-${current.id}`,
        createConnectionId: (current) => `copy-${current.id}`,
        mapNode: (current) => ({ ...current, title: `${current.title} Copy` }),
    });
    expect(pasted?.nodes.map(({ id, metadata, groupId, position }) => ({ id, metadata, groupId, position }))).toEqual([
        { id: "copy-group", metadata: undefined, groupId: undefined, position: { x: 850, y: 850 } },
        { id: "copy-child", metadata: undefined, groupId: "copy-group", position: { x: 900, y: 900 } },
    ]);
    expect(pasted?.connections).toEqual([connection("copy-edge", "copy-group", "copy-child")]);
    expect([...canvas.commands.getSelection().nodeIds]).toEqual(["copy-group", "copy-child"]);
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(1);
    expect(other.commands.getClipboard()).toBeNull();
    canvas.commands.undo();
    expect(canvas.commands.getDocument().nodes).toHaveLength(2);
});

test("clipboard paste rejects colliding generated ids", () => {
    const canvas = createCanvas({ nodes: [node("a"), node("b")], connections: [connection("edge", "a", "b")] });
    canvas.commands.selectNodes(["a", "b"]);
    canvas.commands.copySelection();
    expect(
        canvas.commands.pasteClipboard({
            position: { x: 500, y: 500 },
            createNodeId: (current) => current.id,
            createConnectionId: (current) => `copy-${current.id}`,
        }),
    ).toBeNull();
    expect(canvas.commands.getDocument()).toEqual({ nodes: [node("a"), node("b")], connections: [connection("edge", "a", "b")] });
    expect(canvas.commands.getHistoryDocuments()).toEqual([]);
});
