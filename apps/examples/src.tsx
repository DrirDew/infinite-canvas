import { CanvasConnectionLayer, CanvasMinimap, CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, InfiniteCanvas, canvasThemes, useCanvas, useCanvasInteractions, type CanvasDocument } from "@infinite-canvas/core";
import { useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type NodeKind = "text" | "image" | "video" | "config" | "group";
type DemoMetadata = { label: string; description: string; icon: string; accent?: string };

const kinds: Array<{ type: NodeKind; label: string; icon: string; description: string }> = [
    { type: "text", label: "文本", icon: "T", description: "提示词与内容" },
    { type: "image", label: "图片", icon: "▧", description: "图片输入与结果" },
    { type: "video", label: "视频", icon: "▹", description: "视频生成结果" },
    { type: "config", label: "生成配置", icon: "⌘", description: "模型与生成参数" },
    { type: "group", label: "组", icon: "□", description: "整理画布节点" },
];

const initialDocument: CanvasDocument<DemoMetadata> = {
    nodes: [
        { id: "text-1", type: "text", title: "创意提示", position: { x: 100, y: 180 }, width: 240, height: 150, metadata: kinds[0] },
        { id: "image-1", type: "image", title: "视觉草图", position: { x: 510, y: 80 }, width: 250, height: 180, metadata: kinds[1] },
        { id: "video-1", type: "video", title: "动态预览", position: { x: 940, y: 150 }, width: 300, height: 180, metadata: kinds[2] },
        { id: "group-1", type: "group", role: "group", title: "生成流程", position: { x: 500, y: 390 }, width: 540, height: 300, metadata: kinds[4] },
        { id: "config-1", type: "config", groupId: "group-1", title: "图像生成", position: { x: 560, y: 465 }, width: 260, height: 160, metadata: { ...kinds[3], accent: "#b9f76a" } },
    ],
    connections: [
        { id: "connection-1", fromNodeId: "text-1", toNodeId: "image-1" },
        { id: "connection-2", fromNodeId: "image-1", toNodeId: "video-1" },
        { id: "connection-3", fromNodeId: "text-1", toNodeId: "config-1" },
    ],
};

function App() {
    const containerRef = useRef<HTMLDivElement>(null);
    const nextId = useRef(1);
    const { document, viewport, selectedNodeIds, selectedConnectionId, connectionInteraction, canUndo, canRedo, commands } = useCanvas<DemoMetadata>({ document: initialDocument, viewport: { x: 110, y: 90, k: 0.82 } });
    const interactions = useCanvasInteractions({
        commands,
        containerRef,
        onConnectionEnd: ({ connection }) => {
            if (connection && !commands.getDocument().connections.some((item) => item.fromNodeId === connection.fromNodeId && item.toNodeId === connection.toNodeId)) commands.addConnection({ id: `connection-${Date.now()}`, ...connection });
        },
    });
    const selectedNode = document.nodes.find((node) => selectedNodeIds.has(node.id));
    const addNode = (type: NodeKind) => {
        const item = kinds.find((kind) => kind.type === type)!;
        const center = interactions.getCanvasCenter();
        const id = `${type}-${Date.now()}-${nextId.current++}`;
        commands.addNode({ id, type, role: type === "group" ? "group" : undefined, title: item.label, position: { x: center.x - 130 + nextId.current * 18, y: center.y - 80 + nextId.current * 14 }, width: type === "group" ? 440 : 260, height: type === "group" ? 260 : 160, metadata: item });
        commands.selectNodes([id]);
    };
    const removeSelection = () => selectedNodeIds.size ? commands.removeNodes(selectedNodeIds) : selectedConnectionId ? commands.removeConnections([selectedConnectionId]) : undefined;

    return (
        <main className="app-shell">
            <aside className="sidebar">
                <div className="brand"><span>∞</span><strong>Canvas Core</strong></div>
                <div className="side-heading"><span>节点</span><small>{document.nodes.length} 个元素</small></div>
                <div className="node-library">
                    {kinds.map((item) => <button key={item.type} onClick={() => addNode(item.type)}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.description}</small></span><b>＋</b></button>)}
                </div>
                <div className="boundary-note"><span>CORE / HOST</span><p>画布行为由 Core 提供，节点内容由当前 Examples 宿主实现。</p></div>
            </aside>

            <section className="workspace">
                <header className="topbar"><div><button className="icon-button">☰</button><strong>产品画布</strong><span className="status-dot" /> <small>Core 独立示例</small></div><div><span>{document.nodes.length} 节点</span><span>{document.connections.length} 连线</span><code>v0.15.1</code></div></header>
                <InfiniteCanvas containerRef={containerRef} viewport={viewport} theme={canvasThemes.dark} tool="select" backgroundMode="lines" onViewportChange={interactions.onViewportChange} onCanvasPointerDown={interactions.onCanvasPointerDown} onCanvasDeselect={commands.clearSelection}>
                    <CanvasConnectionLayer nodes={document.nodes} connections={document.connections} interaction={connectionInteraction} selectedConnectionId={selectedConnectionId} theme={canvasThemes.dark} onConnectionSelect={interactions.onConnectionSelect} />
                    {document.nodes.map((node) => {
                        const group = node.role === "group";
                        return (
                            <CanvasNodeShell key={node.id} node={node} className={`canvas-node ${group ? "group-node" : ""} ${selectedNodeIds.has(node.id) ? "selected" : ""}`} onPointerDown={(event) => interactions.onNodePointerDown(event, node.id)} onPointerDownCapture={(event) => interactions.onNodePointerDownCapture(event, node.id)}>
                                {group ? <><div className="group-title"><i>{node.metadata?.icon}</i><strong>{node.title}</strong><small>{document.nodes.filter((item) => item.groupId === node.id).length} 个节点</small></div><div className="group-surface" /></> : <><div className="node-title"><span><i>{node.metadata?.icon}</i>{node.title}</span><small>{node.type}</small></div><div className={`node-preview ${node.type}`}><b>{node.metadata?.icon}</b><span>{node.metadata?.description}</span>{node.type === "config" ? <em>flux-pro · 1:1 · 3 张</em> : null}</div></>}
                                <CanvasNodeResizeHandles node={node} scale={viewport.k} renderHandle={() => <span className="resize-dot" />} onResizeStart={interactions.onNodeResizeStart} onResize={interactions.onNodeResize} onResizeEnd={interactions.onNodeResizeEnd} onResizeCancel={interactions.onNodeResizeCancel} />
                                {!group ? <CanvasNodeConnectionHandles nodeId={node.id} visible={selectedNodeIds.has(node.id) || Boolean(connectionInteraction)} theme={canvasThemes.dark} onConnectStart={interactions.onConnectionStart} /> : null}
                            </CanvasNodeShell>
                        );
                    })}
                    {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={viewport.k} theme={canvasThemes.dark} /> : null}
                </InfiniteCanvas>

                {selectedNode ? <div className="node-toolbar" style={{ left: viewport.x + (selectedNode.position.x + selectedNode.width / 2) * viewport.k, top: viewport.y + selectedNode.position.y * viewport.k - 18 }}><button onClick={() => interactions.focusNode(selectedNode.id)}>◎ 聚焦</button><button onClick={removeSelection}>⌫ 删除</button></div> : null}
                <div className="bottom-toolbar"><button className="active">↖</button><button disabled={!canUndo} onClick={commands.undo}>↶</button><button disabled={!canRedo} onClick={commands.redo}>↷</button><span /><button onClick={() => addNode("text")}>T</button><button onClick={() => addNode("image")}>▧</button><button onClick={() => addNode("video")}>▹</button><button onClick={() => addNode("config")}>⌘</button><span /><button onClick={removeSelection}>⌫</button></div>
                <div className="zoom-control"><button onClick={interactions.resetViewport}>⌾</button><input aria-label="画布缩放" type="range" min="20" max="160" value={Math.round(viewport.k * 100)} onChange={(event) => interactions.setZoom(Number(event.target.value) / 100)} /><output>{Math.round(viewport.k * 100)}%</output></div>
                <CanvasMinimap nodes={document.nodes} viewport={viewport} viewportSize={interactions.containerSize} theme={canvasThemes.dark} onViewportChange={interactions.onViewportChange} nodeColor={(node) => node.metadata?.accent || (node.role === "group" ? "#55504c" : "#8b8680")} width={164} height={108} className="minimap" />
            </section>
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
