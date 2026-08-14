import { describe, expect, test } from "bun:test";
import { CanvasNodeType, canvasToScreen, fitNodeSize, nodesInRect, normalizeConnection, normalizeRect, resizeNodeBounds, screenToCanvas } from "../src";

describe("core geometry", () => {
    test("keeps node ratios and connection direction", () => {
        expect(fitNodeSize(1200, 600)).toEqual({ width: 640, height: 320 });
        expect(
            normalizeConnection(
                "image",
                "config",
                [
                    {
                        id: "image",
                        type: CanvasNodeType.Image,
                        title: "",
                        position: { x: 0, y: 0 },
                        width: 1,
                        height: 1,
                    },
                    {
                        id: "config",
                        type: CanvasNodeType.Config,
                        title: "",
                        position: { x: 0, y: 0 },
                        width: 1,
                        height: 1,
                    },
                ],
                "source",
            ),
        ).toEqual({ fromNodeId: "image", toNodeId: "config" });
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
    });

    test("resizes nodes from any corner with optional ratio locking", () => {
        const node = { position: { x: 100, y: 100 }, width: 300, height: 200 };
        expect(resizeNodeBounds(node, "top-left", { x: 50, y: 20 })).toEqual({ position: { x: 150, y: 120 }, width: 250, height: 180 });
        expect(resizeNodeBounds(node, "bottom-right", { x: 100, y: 10 }, true, 1.5)).toEqual({ position: { x: 100, y: 100 }, width: 400, height: 400 / 1.5 });
    });
});
