import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, InfiniteCanvas, canvasThemes, normalizeRect, screenToCanvas, useCanvas, type CanvasDocument, type CanvasRect, type ViewportTransform } from "@infinite-canvas/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function Demo({ title, accent, initial }: { title: string; accent: string; initial: ViewportTransform }) {
    const ref = useRef<HTMLDivElement>(null);
    const count = useRef(2);
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const { document, viewport, selectedNodeIds, connectionInteraction, canUndo, canRedo, commands } = useCanvas({ document: initialDocument(title), viewport: initial });
    const toCanvas = useCallback(
        (clientX: number, clientY: number) => {
            const rect = ref.current?.getBoundingClientRect();
            return screenToCanvas(clientX, clientY, commands.getViewport(), { left: rect?.left || 0, top: rect?.top || 0 });
        },
        [commands],
    );

    useEffect(() => {
        const move = (event: PointerEvent) => {
            if (commands.getInteraction().connectionInteraction) {
                commands.moveConnection(toCanvas(event.clientX, event.clientY));
                return;
            }
            if (commands.getInteraction().isNodeDragging) {
                commands.moveNodeDrag({ x: event.clientX, y: event.clientY });
                return;
            }
            if (!selectionStartRef.current) return;
            const rect = normalizeRect(selectionStartRef.current, toCanvas(event.clientX, event.clientY));
            setSelectionRect(rect);
            commands.selectNodesInRect(rect);
        };
        const up = (event: PointerEvent) => {
            const result = commands.endConnection(toCanvas(event.clientX, event.clientY));
            if (result?.connection) {
                const connection = result.connection;
                if (!commands.getDocument().connections.some((item) => item.fromNodeId === connection.fromNodeId && item.toNodeId === connection.toNodeId)) commands.addConnection({ id: `${title}-connection-${Date.now()}`, ...connection });
            }
            commands.endNodeDrag({ x: event.clientX, y: event.clientY });
            selectionStartRef.current = null;
            setSelectionRect(null);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
    }, [commands, title, toCanvas]);

    const add = () => {
        const index = ++count.current;
        const id = `${title}-${index}`;
        commands.addNode({ id, type: "demo", title: id, position: { x: 70 + index * 28, y: 60 + index * 24 }, width: 180, height: 112 });
        commands.selectNodes([id]);
    };
    const resize = () => {
        const id = [...selectedNodeIds][0];
        const node = document.nodes.find((item) => item.id === id);
        if (!node) return;
        commands.startNodeResize(id);
        commands.resizeNode(id, node.width + 40, node.height + 24);
        commands.endNodeResize();
    };
    const paste = () => {
        const stamp = Date.now();
        commands.pasteClipboard({
            position: { x: 300, y: 180 },
            createNodeId: (node, index) => `${node.type}-${stamp}-${index}`,
            createConnectionId: (_, index) => `${title}-pasted-connection-${stamp}-${index}`,
            mapNode: (node) => ({ ...node, title: `${node.title} Copy` }),
        });
    };

    return (
        <section>
            <header>
                <span>{title}</span>
                <nav>
                    <button onClick={add}>新增</button>
                    <button disabled={!selectedNodeIds.size} onClick={() => commands.removeNodes(selectedNodeIds)}>
                        删除
                    </button>
                    <button disabled={selectedNodeIds.size !== 1} onClick={resize}>
                        放大
                    </button>
                    <button disabled={!selectedNodeIds.size} onClick={commands.copySelection}>
                        复制
                    </button>
                    <button onClick={paste}>
                        粘贴
                    </button>
                    <button disabled={!canUndo} onClick={commands.undo}>
                        撤销
                    </button>
                    <button disabled={!canRedo} onClick={commands.redo}>
                        重做
                    </button>
                </nav>
                <output>{Math.round(viewport.k * 100)}%</output>
            </header>
            <div className="stage">
                <InfiniteCanvas
                    containerRef={ref}
                    viewport={viewport}
                    theme={canvasThemes.light}
                    tool="select"
                    backgroundMode="dots"
                    onViewportChange={commands.setViewport}
                    onCanvasDeselect={commands.clearSelection}
                    onCanvasMouseDown={(event) => {
                        const start = toCanvas(event.clientX, event.clientY);
                        commands.clearSelection();
                        selectionStartRef.current = start;
                        setSelectionRect(normalizeRect(start, start));
                    }}
                >
                    <CanvasConnectionLayer nodes={document.nodes} connections={document.connections} interaction={connectionInteraction} theme={canvasThemes.light} />
                    {document.nodes.map((node) => (
                        <CanvasNodeShell
                            key={node.id}
                            node={node}
                            className="demo-node"
                            onMouseDown={(event) => {
                                event.stopPropagation();
                                commands.selectNodes([node.id]);
                                commands.startNodeDrag([node.id], { x: event.clientX, y: event.clientY });
                            }}
                            style={{ borderColor: selectedNodeIds.has(node.id) ? accent : "#aaa399" }}
                        >
                            <CanvasNodeConnectionHandles
                                visible
                                theme={canvasThemes.light}
                                onConnectStart={(event, handleType) => commands.startConnection({ nodeId: node.id, handleType }, toCanvas(event.clientX, event.clientY))}
                            />
                            <CanvasNodeResizeHandles node={node} scale={viewport.k} onResizeStart={commands.startNodeResize} onResize={commands.resizeNode} onResizeEnd={commands.endNodeResize} />
                            <i style={{ background: accent }} />
                            独立实例<strong>{node.title.replace(`${title}-`, "")}</strong>
                            <small>拖动 · 缩放 · 连线 · 剪贴板</small>
                        </CanvasNodeShell>
                    ))}
                    {selectionRect ? <CanvasSelectionBox rect={selectionRect} scale={viewport.k} theme={canvasThemes.light} /> : null}
                </InfiniteCanvas>
                <CanvasMinimap nodes={document.nodes} viewport={viewport} viewportSize={{ width: ref.current?.clientWidth || 800, height: ref.current?.clientHeight || 500 }} theme={canvasThemes.light} onViewportChange={commands.setViewport} nodeColor={() => accent} width={144} height={96} style={{ bottom: 12, left: 12 }} />
            </div>
        </section>
    );
}

const initialDocument = (title: string): CanvasDocument => ({
    nodes: [
        { id: `${title}-1`, type: "demo", title: `${title}-1`, position: { x: 70, y: 60 }, width: 180, height: 112 },
        { id: `${title}-2`, type: "demo", title: `${title}-2`, position: { x: 340, y: 220 }, width: 180, height: 112 },
    ],
    connections: [],
});

function App() {
    return (
        <main>
            <div className="intro">
                <p>CORE / 08</p>
                <h1>
                    一块画布，
                    <br />
                    任意产品。
                </h1>
                <aside>
                    这个应用只组合 <code>@infinite-canvas/core</code>。两个实例的文档、交互、连线、剪贴板和撤销历史完全隔离。
                </aside>
            </div>
            <div className="grid">
                <Demo title="A" accent="#ff5c35" initial={{ x: 30, y: 30, k: 1 }} />
                <Demo title="B" accent="#197e67" initial={{ x: 30, y: 30, k: 1 }} />
            </div>
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
