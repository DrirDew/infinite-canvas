import { expect, test } from "bun:test";
import { getCanvasDocumentIssues, type CanvasDocument } from "../src";

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
});
