import { expect, test } from "bun:test";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, CanvasUnknownNode, InfiniteCanvas, canvasThemes, type CanvasNode } from "../src";

const nodes: CanvasNode[] = [
    { id: "a", type: "test", title: "A", position: { x: 0, y: 0 }, width: 100, height: 100 },
    { id: "b", type: "test", title: "B", position: { x: 300, y: 100 }, width: 100, height: 100 },
];

test("renders core connection, selection, and minimap layers", () => {
    expect(renderToString(<InfiniteCanvas containerRef={createRef<HTMLDivElement>()} viewport={{ x: 0, y: 0, k: 1 }} theme={canvasThemes.light} tool="select" className="custom-canvas" ariaLabel="Editor" onViewportChange={() => {}} />)).toContain('tabindex="0" aria-label="Editor"');
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} selectedConnectionId="ab" theme={canvasThemes.light} />)).toContain('data-connection-id="ab"');
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} theme={canvasThemes.light} resolvePath={() => "M 0 0 L 1 1"} />)).toContain('d="M 0 0 L 1 1"');
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} theme={canvasThemes.light} hitStrokeWidth={24} resolveStyle={() => ({ stroke: "red", strokeWidth: 5, strokeDasharray: "2 2" })} />)).toContain('stroke="red" stroke-width="5" stroke-dasharray="2 2"');
    expect(renderToString(<CanvasSelectionBox rect={{ x: 10, y: 20, width: 30, height: 40 }} scale={2} theme={canvasThemes.light} />)).toContain('stroke-dasharray="3 2"');
    expect(renderToString(<CanvasSelectionBox rect={{ x: 10, y: 20, width: 30, height: 40 }} scale={2} theme={canvasThemes.light} className="custom-selection" rectProps={{ stroke: "red", strokeDasharray: "none" }} />)).toContain('class="custom-selection"');
    expect(renderToString(<CanvasMinimap nodes={nodes} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} />)).toContain('data-node-id="a"');
    expect(renderToString(<CanvasMinimap nodes={nodes} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} worldPadding={100} minNodeSize={6} className="custom-minimap" />)).toContain('class="custom-minimap"');
    expect(renderToString(<CanvasMinimap nodes={[]} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} worldPadding={100} />)).toContain("width:640px");
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
