import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { useCanvas, type CanvasConnection, type CanvasDocument, type CanvasNode } from "../src";

type Metadata = { groupId?: string; value?: number };
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

function createCanvas(document: CanvasDocument<Metadata> = { nodes: [], connections: [] }) {
    let canvas!: ReturnType<typeof useCanvas<Metadata>>;
    function Capture() {
        canvas = useCanvas<Metadata>({ document });
        return null;
    }
    renderToString(<Capture />);
    return canvas;
}

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

test("removing nodes clears related connections, child groups, and selection", () => {
    const canvas = createCanvas({
        nodes: [node("group"), node("child", { groupId: "group" }), node("other")],
        connections: [connection("edge", "group", "other")],
    });
    canvas.commands.selectNodes(["group", "child"]);
    canvas.commands.removeNodes(["group"]);
    expect(canvas.commands.getDocument()).toEqual({
        nodes: [node("child", { groupId: undefined }), node("other")],
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

test("drag previews commit once, snap into groups, and cancel safely", () => {
    const canvas = createCanvas({
        nodes: [node("a"), { ...node("group"), type: "group", position: { x: 300, y: 0 }, width: 400, height: 300 }],
        connections: [],
    });
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    canvas.commands.moveNodeDrag({ x: 300, y: 0 });
    canvas.commands.endNodeDrag({ x: 300, y: 0 });
    expect(canvas.commands.getDocument().nodes[0]).toEqual({ ...node("a", { groupId: "group" }), position: { x: 324, y: 24 } });
    expect(canvas.commands.getHistoryDocuments()).toHaveLength(1);
    canvas.commands.startNodeDrag(["a"], { x: 0, y: 0 });
    canvas.commands.moveNodeDrag({ x: 100, y: 0 });
    canvas.commands.endNodeDrag();
    expect(canvas.commands.getDocument().nodes[0].position).toEqual({ x: 324, y: 24 });
});

test("dragging groups moves children and resizing creates one history entry", () => {
    const canvas = createCanvas({ nodes: [{ ...node("group"), type: "group" }, node("child", { groupId: "group" })], connections: [] });
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
