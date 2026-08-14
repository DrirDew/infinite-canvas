import { expect, test } from "bun:test";
import { countCanvasGroupChildren, findCanvasUpstreamNode, getCanvasDownstreamNodes, getCanvasRelations, getCanvasUpstreamNodes, type CanvasNode } from "../src";

test("derives group counts and related connection highlights", () => {
    const nodes: CanvasNode[] = [
        { id: "group", type: "box", role: "group", title: "", position: { x: 0, y: 0 }, width: 100, height: 100 },
        { id: "a", type: "item", groupId: "group", title: "", position: { x: 0, y: 0 }, width: 10, height: 10 },
        { id: "b", type: "item", groupId: "group", title: "", position: { x: 20, y: 0 }, width: 10, height: 10 },
    ];
    expect(countCanvasGroupChildren(nodes).get("group")).toBe(2);
    const related = getCanvasRelations("a", [{ id: "ab", fromNodeId: "a", toNodeId: "b" }]);
    expect([...related.nodeIds]).toEqual(["a", "b"]);
    expect([...related.connectionIds]).toEqual(["ab"]);
    expect(getCanvasUpstreamNodes("b", nodes, [{ id: "ab", fromNodeId: "a", toNodeId: "b" }]).map((node) => node.id)).toEqual(["a"]);
    expect(getCanvasDownstreamNodes("a", nodes, [{ id: "ab", fromNodeId: "a", toNodeId: "b" }]).map((node) => node.id)).toEqual(["b"]);
    expect(findCanvasUpstreamNode("b", nodes, [{ id: "ga", fromNodeId: "group", toNodeId: "a" }, { id: "ab", fromNodeId: "a", toNodeId: "b" }], (node) => node.role === "group")?.id).toBe("group");
});
