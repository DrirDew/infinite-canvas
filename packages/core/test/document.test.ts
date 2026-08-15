import { expect, test } from "bun:test";
import { addDocumentNodes, cloneCanvasDocument, createCanvasDocumentSnapshot, getCanvasDocumentIssues, updateDocumentNode, type CanvasDocument, type CanvasNode } from "../src";

const node = (id: string): CanvasNode => ({ id, type: "item", title: "", position: { x: 0, y: 0 }, width: 10, height: 10 });

test("reports invalid canvas document structure without mutating it", () => {
    const document: CanvasDocument<{ color: string }> = {
        nodes: [
            { id: "group", type: "box", role: "group", title: "", position: { x: 0, y: 0 }, width: 100, height: 100, metadata: { color: "red" } },
            { id: "a", type: "item", groupId: "missing", title: "", position: { x: 0, y: 0 }, width: 10, height: 10, metadata: { color: "blue" } },
            { id: "a", type: "item", title: "", position: { x: 20, y: 0 }, width: 10, height: 10, metadata: { color: "green" } },
        ],
        connections: [
            { id: "self", fromNodeId: "a", toNodeId: "a" },
            { id: "group", fromNodeId: "group", toNodeId: "a" },
            { id: "missing", fromNodeId: "a", toNodeId: "missing" },
        ],
    };
    expect(getCanvasDocumentIssues(document).map((issue) => issue.type)).toEqual(["duplicate-node-id", "invalid-group", "self-connection", "group-connection", "missing-connection-node"]);
    expect(getCanvasDocumentIssues({ nodes: [{ ...node("group"), role: "group" }, { ...node("child"), groupId: "group" }], connections: [] }, undefined, () => false)).toEqual([{ type: "rejected-group", id: "child" }]);
});

test("keeps node updates structurally valid", () => {
    const document: CanvasDocument = {
        nodes: [{ ...node("group"), role: "group" }, { ...node("child"), groupId: "group" }, node("other")],
        connections: [{ id: "edge", fromNodeId: "child", toNodeId: "other" }],
    };
    expect(updateDocumentNode(document, "child", { id: "other" })).toBe(document);
    expect(updateDocumentNode(document, "child", { groupId: "missing" }).nodes[1].groupId).toBeUndefined();
    expect(updateDocumentNode(document, "group", { id: "renamed" })).toMatchObject({
        nodes: [{ id: "renamed" }, { id: "child", groupId: "renamed" }, { id: "other" }],
    });
    expect(updateDocumentNode(document, "child", { role: "group" }).connections).toEqual([]);
    expect(updateDocumentNode(document, "child", { width: 0 })).toBe(document);
});

test("rejects invalid node geometry and detaches external snapshots", () => {
    const document: CanvasDocument = { nodes: [node("a")], connections: [] };
    expect(getCanvasDocumentIssues({ nodes: [{ ...node("bad"), position: { x: Number.NaN, y: 0 }, height: 0 }], connections: [] }).map((issue) => issue.type)).toEqual(["invalid-node-position", "invalid-node-size"]);
    expect(addDocumentNodes(document, [{ ...node("bad"), width: -1 }])).toBe(document);
    const clone = cloneCanvasDocument(document);
    expect(clone).not.toBe(document);
    expect(clone.nodes[0]).not.toBe(document.nodes[0]);
    expect(clone.nodes[0]?.position).not.toBe(document.nodes[0]?.position);
    expect(() => createCanvasDocumentSnapshot({ nodes: [{ ...node("bad"), width: 0 }], connections: [] })).toThrow("invalid-node-size:bad");
});
