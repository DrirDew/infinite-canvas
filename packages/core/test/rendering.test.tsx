import { expect, test } from "bun:test";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, CanvasUnknownNode, InfiniteCanvas, canvasThemes, type CanvasNode, type CanvasTheme } from "../src";

const nodes: CanvasNode[] = [
    { id: "a", type: "test", title: "A", position: { x: 0, y: 0 }, width: 100, height: 100 },
    { id: "b", type: "test", title: "B", position: { x: 300, y: 100 }, width: 100, height: 100 },
];
const customTheme: CanvasTheme = { ...canvasThemes.light, canvas: { ...canvasThemes.light.canvas, background: "rebeccapurple" } };

test("renders core connection, selection, and minimap layers", () => {
    const canvasHtml = renderToString(<InfiniteCanvas containerRef={createRef<HTMLDivElement>()} viewport={{ x: 0, y: 0, k: 1 }} theme={customTheme} tool="select" className="custom-canvas" ariaLabel="Editor" backgroundStyle={{ opacity: 1, pointerEvents: "auto" }} renderBackground={({ mode }) => <span data-custom-background={mode} />} contentClassName="custom-content" contentStyle={{ color: "red", transform: "scale(2)" }} onViewportChange={() => {}} />);
    expect(canvasHtml).toContain('tabindex="0" aria-label="Editor"');
    expect(canvasHtml).toContain('data-canvas-root="true"');
    expect(canvasHtml).toContain('data-canvas-background="true"');
    expect(canvasHtml).toContain('data-canvas-content="true" class="custom-content"');
    expect(canvasHtml).toContain("pointer-events:none");
    expect(canvasHtml).toContain("color:red");
    expect(canvasHtml).toContain("transform:translate(0px,0px) scale(1)");
    expect(canvasHtml).toContain("background:rebeccapurple");
    expect(canvasHtml).toContain('data-custom-background="lines"');
    const selectedConnectionHtml = renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} selectedConnectionId="ab" theme={canvasThemes.light} getConnectionAriaLabel={() => "A to B"} />);
    expect(selectedConnectionHtml).toContain('data-connection-id="ab"');
    expect(selectedConnectionHtml).toContain('role="button" tabindex="0" aria-label="A to B" aria-pressed="true"');
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} theme={canvasThemes.light} resolvePath={() => "M 0 0 L 1 1"} />)).toContain('d="M 0 0 L 1 1"');
    const connectionHtml = renderToString(<CanvasConnectionLayer nodes={nodes} connections={[{ id: "ab", fromNodeId: "a", toNodeId: "b" }]} theme={canvasThemes.light} hitStrokeWidth={24} className="custom-connections" style={{ zIndex: 2 }} resolveStyle={() => ({ stroke: "red", strokeWidth: 5, strokeDasharray: "2 2" })} />);
    expect(connectionHtml).toContain('class="custom-connections"');
    expect(connectionHtml).toContain('data-canvas-connections="true"');
    expect(connectionHtml).toContain('stroke="red" stroke-width="5" stroke-dasharray="2 2"');
    expect(renderToString(<CanvasConnectionLayer nodes={nodes} connections={[]} interaction={{ handle: { nodeId: "a", handleType: "source" }, pointer: { x: 200, y: 50 }, targetNodeId: null }} theme={canvasThemes.light} />)).toContain('data-connection-preview="true"');
    expect(renderToString(<CanvasSelectionBox rect={{ x: 10, y: 20, width: 30, height: 40 }} scale={2} theme={canvasThemes.light} />)).toContain('stroke-dasharray="3 2"');
    expect(renderToString(<CanvasSelectionBox rect={{ x: 10, y: 20, width: 30, height: 40 }} scale={2} theme={canvasThemes.light} className="custom-selection" rectProps={{ stroke: "red", strokeDasharray: "none" }} />)).toContain('class="custom-selection"');
    const minimapHtml = renderToString(<CanvasMinimap nodes={nodes} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} />);
    expect(minimapHtml).toContain('data-canvas-no-zoom="true"');
    expect(minimapHtml).toContain('data-canvas-minimap="true"');
    expect(minimapHtml).toContain('data-minimap-viewport="true"');
    expect(minimapHtml).toContain('role="region" tabindex="0" aria-label="Canvas minimap"');
    expect(minimapHtml).toContain('data-node-id="a"');
    expect(renderToString(<CanvasMinimap nodes={nodes} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} worldPadding={100} minNodeSize={6} className="custom-minimap" nodeStyle={() => ({ borderRadius: 8 })} renderNode={(node) => <span data-minimap-content={node.id} />} />)).toContain('data-minimap-content="a"');
    expect(renderToString(<CanvasMinimap nodes={[]} viewport={{ x: 0, y: 0, k: 1 }} viewportSize={{ width: 800, height: 600 }} theme={canvasThemes.light} onViewportChange={() => {}} worldPadding={100} />)).toContain("width:640px");
});

test("renders core node shell, controls, and unknown placeholder", () => {
    const node = nodes[0];
    const html = renderToString(
        <CanvasNodeShell node={node}>
            <CanvasNodeResizeHandles node={node} scale={1} renderHandle={(corner) => <span data-custom-resize={corner} />} onResize={() => {}} />
            <CanvasNodeConnectionHandles nodeId={node.id} visible theme={canvasThemes.light} renderHandle={(type) => <span data-custom-handle={type} />} onConnectStart={() => {}} />
            <CanvasUnknownNode type="missing" theme={canvasThemes.light} />
        </CanvasNodeShell>,
    );
    expect(html).toContain('data-node-id="a"');
    expect(html).toContain('data-resize-handle="bottom-right"');
    expect(html).toContain('data-custom-resize="bottom-right"');
    expect(html).toContain('data-connection-handle="source"');
    expect(html).toContain('data-custom-handle="source"');
    expect(html).toContain('data-unknown-node-type="missing"');
    expect(html).toContain("No renderer is registered for missing.");
});
