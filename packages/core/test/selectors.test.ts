import { expect, test } from "bun:test";
import { countCanvasGroupChildren, getCanvasRelations, type CanvasNode } from "../src";

test("derives group counts and related connection highlights", () => {
    const nodes: CanvasNode[] = [
        { id: "group", type: "box", role: "group", title: "", position: { x: 0, y: 0 }, width: 100, height: 100 },
        { id: "a", type: "item", title: "", position: { x: 0, y: 0 }, width: 10, height: 10, metadata: { groupId: "group" } },
        { id: "b", type: "item", title: "", position: { x: 20, y: 0 }, width: 10, height: 10, metadata: { groupId: "group" } },
    ];
    expect(countCanvasGroupChildren(nodes).get("group")).toBe(2);
    const related = getCanvasRelations("a", [{ id: "ab", fromNodeId: "a", toNodeId: "b" }]);
    expect([...related.nodeIds]).toEqual(["a", "b"]);
    expect([...related.connectionIds]).toEqual(["ab"]);
});
