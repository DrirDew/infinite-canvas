import { canvasToScreen, getCanvasDocumentIssues, resolveCanvasShortcut, screenToCanvas, type CanvasDocument } from "../src/headless.js";

const document: CanvasDocument<{ value: number }> = {
    nodes: [{ id: "node", type: "test", title: "Node", position: { x: 0, y: 0 }, width: 100, height: 80, metadata: { value: 1 } }],
    connections: [],
};

getCanvasDocumentIssues(document);
screenToCanvas(10, 20, { x: 0, y: 0, k: 1 }, { left: 0, top: 0 });
canvasToScreen({ x: 10, y: 20 }, { x: 0, y: 0, k: 1 });
resolveCanvasShortcut({ key: "z", ctrlKey: true });
