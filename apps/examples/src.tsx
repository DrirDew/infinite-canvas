import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, CanvasUnknownNode, InfiniteCanvas, canvasThemes, useCanvas, useCanvasInteractions, type CanvasDocument, type ViewportTransform } from "@infinite-canvas/core";
import { useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function Demo({ title, accent, initial }: { title: string; accent: string; initial: ViewportTransform }) {
    const ref = useRef<HTMLDivElement>(null);
    const count = useRef(2);
    const snapshot = useRef<CanvasDocument>(null!);
    snapshot.current ||= initialDocument(title);
    const { document, viewport, selectedNodeIds, connectionInteraction, canUndo, canRedo, commands } = useCanvas({ document: snapshot.current, viewport: initial, onDocumentChange: (next) => (snapshot.current = next) });
    const interactions = useCanvasInteractions({
        commands,
        containerRef: ref,
        onConnectionEnd: (result) => {
            if (result.connection) {
                const connection = result.connection;
                if (!commands.getDocument().connections.some((item) => item.fromNodeId === connection.fromNodeId && item.toNodeId === connection.toNodeId)) commands.addConnection({ id: `${title}-connection-${Date.now()}`, ...connection });
            }
        },
    });

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
                    <button disabled={selectedNodeIds.size !== 1} onClick={() => interactions.focusNode([...selectedNodeIds][0])}>
                        聚焦
                    </button>
                    <button onClick={interactions.resetViewport}>复位</button>
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
                <output>SNAPSHOT {snapshot.current.nodes.length} · {Math.round(viewport.k * 100)}%</output>
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
                    onCanvasMouseDown={interactions.onCanvasMouseDown}
                >
                    <CanvasConnectionLayer nodes={document.nodes} connections={document.connections} interaction={connectionInteraction} theme={canvasThemes.light} />
                    {document.nodes.map((node) => (
                        <CanvasNodeShell
                            key={node.id}
                            node={node}
                            className="demo-node"
                            onMouseDown={(event) => interactions.onNodeMouseDown(event, node.id)}
                            onMouseDownCapture={(event) => interactions.onNodeSelectCapture(event, node.id)}
                            style={{ borderColor: selectedNodeIds.has(node.id) ? accent : "#aaa399" }}
                        >
                            <CanvasNodeConnectionHandles
                                visible
                                theme={canvasThemes.light}
                                onConnectStart={(event, handleType) => commands.startConnection({ nodeId: node.id, handleType }, interactions.toCanvas(event.clientX, event.clientY))}
                            />
                            <CanvasNodeResizeHandles node={node} scale={viewport.k} onResizeStart={commands.startNodeResize} onResize={commands.resizeNode} onResizeEnd={commands.endNodeResize} />
                            {node.type === "missing" ? (
                                <CanvasUnknownNode type={node.type} theme={canvasThemes.light} title="未注册节点" description="由 Core 提供安全占位" />
                            ) : (
                                <>
                                    <i style={{ background: accent }} />
                                    独立实例<strong>{node.title.replace(`${title}-`, "")}</strong>
                                    <small>拖动 · 缩放 · 连线 · 剪贴板</small>
                                </>
                            )}
                        </CanvasNodeShell>
                    ))}
                    {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={viewport.k} theme={canvasThemes.light} /> : null}
                </InfiniteCanvas>
                <CanvasMinimap nodes={document.nodes} viewport={viewport} viewportSize={interactions.containerSize} theme={canvasThemes.light} onViewportChange={commands.setViewport} nodeColor={() => accent} width={144} height={96} style={{ bottom: 12, left: 12 }} />
            </div>
        </section>
    );
}

const initialDocument = (title: string): CanvasDocument => ({
    nodes: [
        { id: `${title}-1`, type: "demo", title: `${title}-1`, position: { x: 70, y: 60 }, width: 180, height: 112 },
        { id: `${title}-2`, type: "missing", title: `${title}-2`, position: { x: 340, y: 220 }, width: 180, height: 112 },
    ],
    connections: [],
});

function App() {
    return (
        <main>
            <div className="intro">
                <p>CORE / 13</p>
                <h1>
                    一块画布，
                    <br />
                    任意产品。
                </h1>
                <aside>
                    这个应用只组合 <code>@infinite-canvas/core</code>。两个实例的文档快照、交互、连线、剪贴板和撤销历史完全隔离，并展示未知节点占位。
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
