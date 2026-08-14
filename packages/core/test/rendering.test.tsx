import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, CanvasUnknownNode, canvasThemes, type CanvasNode } from "../src";

const nodes: CanvasNode[] = [
    { id: "a", type: "test", title: "A", position: { x: 0, y: 0 }, width: 100, height: 100 },
    { id: "b", type: "test", title: "B", position: { x: 300, y: 100 }, width: 100, height: 100 },
];

test("renders core connection, selection, and minimap layers", () => {
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} selectedConnectionId="ab" theme={canvasThemes.light} />)).toContain('data-connection-id="ab"');
    expect(renderToString(<CanvasSelectionBox rect={{ x: 10, y: 20, width: 30, height: 40 }} scale={2} theme={canvasThemes.light} />)).toContain('stroke-dasharray="3 2"');
    expect(renderToString(<CanvasMinimap nodes={nodes} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} />)).toContain('data-node-id="a"');
});

test("renders core node shell, controls, and unknown placeholder", () => {
    const node = nodes[0];
    const html = renderToString(
        <CanvasNodeShell node={node}>
            <CanvasNodeResizeHandles node={node} scale={1} onResize={() => {}} />
            <CanvasNodeConnectionHandles nodeId={node.id} visible theme={canvasThemes.light} onConnectStart={() => {}} />
            <CanvasUnknownNode type="missing" theme={canvasThemes.light} />
        </CanvasNodeShell>,
    );
    expect(html).toContain('data-node-id="a"');
    expect(html).toContain('data-resize-handle="bottom-right"');
    expect(html).toContain('data-connection-handle="source"');
    expect(html).toContain("No renderer is registered for missing.");
});
