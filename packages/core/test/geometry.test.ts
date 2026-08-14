import { describe, expect, test } from "bun:test";
import { canvasToScreen, centerViewport, findConnectionDropTarget, fitNodeSize, fitViewportToNode, getConnectionPath, nodesInRect, nodesInViewport, normalizeConnection, normalizeRect, resizeNodeBounds, screenToCanvas, zoomViewport, zoomViewportAtPoint } from "../src";

describe("core geometry", () => {
    test("keeps node ratios and connection direction", () => {
        expect(fitNodeSize(1200, 600)).toEqual({ width: 640, height: 320 });
        const nodes = [
            { id: "image", type: "image", title: "", position: { x: 0, y: 0 }, width: 1, height: 1 },
            { id: "config", type: "config", title: "", position: { x: 0, y: 0 }, width: 1, height: 1 },
        ];
        expect(normalizeConnection("image", "config", nodes, "source")).toEqual({ fromNodeId: "image", toNodeId: "config" });
        expect(normalizeConnection("image", "config", nodes, "target")).toEqual({ fromNodeId: "config", toNodeId: "image" });
        expect(normalizeConnection("image", "config", nodes, "source", () => null)).toBeNull();
    });

    test("converts coordinates and finds nodes inside a normalized rectangle", () => {
        const viewport = { x: 100, y: 50, k: 2 };
        expect(screenToCanvas(320, 190, viewport, { left: 20, top: 40 })).toEqual({ x: 100, y: 50 });
        expect(canvasToScreen({ x: 100, y: 50 }, viewport, { left: 20, top: 40 })).toEqual({ x: 320, y: 190 });
        const rect = normalizeRect({ x: 180, y: 180 }, { x: 40, y: 40 });
        expect(rect).toEqual({ x: 40, y: 40, width: 140, height: 140 });
        expect(
            nodesInRect(
                [
                    { id: "inside", type: "test", title: "", position: { x: 50, y: 50 }, width: 40, height: 40 },
                    { id: "outside", type: "test", title: "", position: { x: 200, y: 200 }, width: 40, height: 40 },
                ],
                rect,
            ).map((node) => node.id),
        ).toEqual(["inside"]);
        expect(nodesInViewport([{ id: "visible", type: "test", title: "", position: { x: 0, y: 0 }, width: 40, height: 40 }], viewport, { width: 200, height: 200 })).toHaveLength(1);
    });

    test("centers, zooms, and fits viewport targets", () => {
        const size = { width: 800, height: 600 };
        expect(centerViewport(size)).toEqual({ x: 400, y: 300, k: 1 });
        expect(zoomViewport({ x: 400, y: 300, k: 1 }, size, 2)).toEqual({ x: 400, y: 300, k: 2 });
        expect(zoomViewportAtPoint({ x: 0, y: 0, k: 1 }, { x: 100, y: 50 }, 2)).toEqual({ x: -100, y: -50, k: 2 });
        expect(fitViewportToNode({ id: "node", type: "test", title: "", position: { x: 100, y: 50 }, width: 200, height: 100 }, size)).toEqual({ x: 200, y: 200, k: 1 });
    });

    test("resizes nodes from any corner with optional ratio locking", () => {
        const node = { position: { x: 100, y: 100 }, width: 300, height: 200 };
        expect(resizeNodeBounds(node, "top-left", { x: 50, y: 20 })).toEqual({ position: { x: 150, y: 120 }, width: 250, height: 180 });
        expect(resizeNodeBounds(node, "bottom-right", { x: 100, y: 10 }, true, 1.5)).toEqual({ position: { x: 100, y: 100 }, width: 400, height: 400 / 1.5 });
        expect(resizeNodeBounds(node, "bottom-right", { x: -500, y: -500 })).toEqual({ position: { x: 100, y: 100 }, width: 24, height: 24 });
    });

    test("finds valid connection targets and reports blocked nearby nodes", () => {
        const nodes = [
            { id: "a", type: "test", title: "", position: { x: 0, y: 0 }, width: 100, height: 100 },
            { id: "b", type: "test", title: "", position: { x: 200, y: 0 }, width: 100, height: 100 },
        ];
        expect(findConnectionDropTarget(nodes, { nodeId: "a", handleType: "source" }, { x: 250, y: 50 })).toEqual({ nodeId: "b", isNearNode: true });
        expect(findConnectionDropTarget(nodes, { nodeId: "a", handleType: "source" }, { x: 50, y: 50 })).toEqual({ nodeId: null, isNearNode: true });
    });

    test("builds stable and active connection paths", () => {
        const from = { id: "a", type: "test", title: "", position: { x: 0, y: 0 }, width: 100, height: 100 };
        const to = { id: "b", type: "test", title: "", position: { x: 300, y: 100 }, width: 100, height: 100 };
        expect(getConnectionPath(from, to)).toBe("M 100 50 C 200 50, 200 150, 300 150");
        expect(getConnectionPath(from, to, { handle: { nodeId: "a", handleType: "source" }, pointer: { x: 220, y: 80 }, targetNodeId: "b" })).toBe("M 100 50 C 200 50, 200 150, 300 150");
    });
});
