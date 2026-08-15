import {
    CanvasConnectionLayer,
    CanvasMinimap,
    CanvasNodeConnectionHandles,
    CanvasNodeResizeHandles,
    CanvasNodeShell,
    CanvasSelectionBox,
    InfiniteCanvas,
    canvasThemes,
    resolveCanvasShortcut,
    useCanvas,
    useCanvasInteractions,
    useCanvasVirtualization,
    type CanvasBackgroundMode,
    type CanvasColorTheme,
    type CanvasDocument,
    type CanvasNode,
    type Position,
} from "@basketikun/infinite-canvas";
import { Compass, Copy, Focus, Hand, Image, Link2, Maximize2, Moon, MousePointer2, Play, Redo2, RotateCcw, Sun, Trash2, Type, Undo2, Upload, Video } from "lucide-react";
import { memo, useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type NodeKind = "text" | "image" | "video";
type ExampleMetadata = { content?: string; src?: string; fileName?: string };
type ExampleNode = CanvasNode<ExampleMetadata>;

const presets: Record<NodeKind, { label: string; description: string; width: number; height: number }> = {
    text: { label: "文本", description: "提示词、脚本与说明", width: 300, height: 210 },
    image: { label: "图片", description: "参考图与生成结果", width: 320, height: 240 },
    video: { label: "视频", description: "分镜与动态预览", width: 360, height: 240 },
};

const initialDocument: CanvasDocument<ExampleMetadata> = {
    nodes: [
        { id: "text-brief", type: "text", title: "创意简报", position: { x: 80, y: 110 }, width: 300, height: 210, metadata: { content: "为一家海边书店制作夏日短片。\n\n画面从清晨的蓝色海面开始，镜头掠过窗边翻动的书页，最后停在一句话：让故事找到潮汐。" } },
        { id: "image-keyframe", type: "image", title: "主视觉", position: { x: 500, y: 70 }, width: 360, height: 270, metadata: { src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85", fileName: "coast-keyframe.jpg" } },
        { id: "video-preview", type: "video", title: "动态预览", position: { x: 980, y: 115 }, width: 400, height: 260, metadata: { src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", fileName: "motion-preview.mp4" } },
    ],
    connections: [
        { id: "brief-to-image", fromNodeId: "text-brief", toNodeId: "image-keyframe" },
        { id: "image-to-video", fromNodeId: "image-keyframe", toNodeId: "video-preview" },
    ],
};

const icons = { text: Type, image: Image, video: Video };
const colors = { text: "#d6a84b", image: "#3f9d78", video: "#dc714e" };

function App() {
    const containerRef = useRef<HTMLDivElement>(null);
    const idRef = useRef(0);
    const [tool, setTool] = useState<"select" | "pan">("select");
    const [colorTheme, setColorTheme] = useState<CanvasColorTheme>("light");
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("dots");
    const [showMinimap, setShowMinimap] = useState(true);
    const theme = canvasThemes[colorTheme];
    const canvas = useCanvas<ExampleMetadata>({ initialDocument, initialViewport: { x: 110, y: 110, k: 0.78 } });
    const interactions = useCanvasInteractions({
        commands: canvas.commands,
        containerRef,
        onConnectionEnd: ({ connection }) => {
            if (!connection) return;
            const duplicate = canvas.commands.getDocument().connections.some((item) => item.fromNodeId === connection.fromNodeId && item.toNodeId === connection.toNodeId);
            if (!duplicate) canvas.commands.addConnection({ id: createId("connection", idRef), ...connection });
        },
    });
    const { visibleNodes, visibleNodeIds } = useCanvasVirtualization(canvas.document.nodes, canvas.viewport, interactions.containerSize);
    const selectedNode = canvas.document.nodes.find((node) => canvas.selectedNodeIds.has(node.id));
    const selectedCount = canvas.selectedNodeIds.size + Number(Boolean(canvas.selectedConnectionId));

    const addNode = (type: NodeKind, position = interactions.getCanvasCenter(), metadata?: ExampleMetadata) => {
        const preset = presets[type];
        const id = createId(type, idRef);
        canvas.commands.addNode({ id, type, title: preset.label, position: { x: position.x - preset.width / 2, y: position.y - preset.height / 2 }, width: preset.width, height: preset.height, metadata });
        canvas.commands.selectNodes([id]);
        return id;
    };
    const removeSelection = () => {
        if (canvas.selectedNodeIds.size) canvas.commands.removeNodes(canvas.selectedNodeIds);
        else if (canvas.selectedConnectionId) canvas.commands.removeConnections([canvas.selectedConnectionId]);
    };
    const paste = (position = interactions.getCanvasCenter()) => canvas.commands.pasteClipboard({ position, createNodeId: (node) => createId(node.type, idRef), createConnectionId: () => createId("connection", idRef) });
    const uploadFiles = async (files: readonly File[], position = interactions.getCanvasCenter()) => {
        const media = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
        const sources = await Promise.all(media.map(readFile));
        const nodes = media.map((file, index) => {
            const type: NodeKind = file.type.startsWith("video/") ? "video" : "image";
            const preset = presets[type];
            return { id: createId(type, idRef), type, title: file.name, position: { x: position.x - preset.width / 2 + index * 34, y: position.y - preset.height / 2 + index * 34 }, width: preset.width, height: preset.height, metadata: { src: sources[index], fileName: file.name } } satisfies ExampleNode;
        });
        if (nodes.length) {
            canvas.commands.addNodes(nodes);
            canvas.commands.selectNodes(nodes.map((node) => node.id));
        }
    };
    const chooseMedia = (nodeId?: string, accept = "image/*,video/*") => pickFiles(accept, async (files) => {
        if (!nodeId) return uploadFiles(files);
        const file = files[0];
        if (file) canvas.commands.updateNode(nodeId, { title: file.name, metadata: { src: await readFile(file), fileName: file.name } });
    });
    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        void uploadFiles([...event.dataTransfer.files], interactions.toCanvas(event.clientX, event.clientY));
    };
    const shortcutRef = useRef({ canvas, paste, removeSelection });
    shortcutRef.current = { canvas, paste, removeSelection };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable='true']")) return;
            const shortcut = resolveCanvasShortcut(event);
            if (!shortcut) return;
            event.preventDefault();
            const current = shortcutRef.current;
            if (shortcut === "undo") current.canvas.commands.undo();
            else if (shortcut === "redo") current.canvas.commands.redo();
            else if (shortcut === "select-all") current.canvas.commands.selectNodes(current.canvas.commands.getDocument().nodes.map((node) => node.id));
            else if (shortcut === "copy") current.canvas.commands.copySelection();
            else if (shortcut === "paste") current.paste();
            else if (shortcut === "delete") current.removeSelection();
            else if (shortcut === "escape") {
                current.canvas.commands.cancelConnection();
                current.canvas.commands.clearSelection();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <main className="example-shell" style={themeVariables(theme, colorTheme)}>
            <aside className="library-panel">
                <div className="brand"><span className="brand-mark">∞</span><span><strong>Infinite Canvas</strong><small>CORE EXAMPLE</small></span></div>
                <div className="panel-heading"><span>创建节点</span><small>{canvas.document.nodes.length} 个节点</small></div>
                <div className="node-library">
                    {(Object.keys(presets) as NodeKind[]).map((type) => {
                        const Icon = icons[type];
                        return <button key={type} type="button" onClick={() => addNode(type)}><span className="library-icon" style={{ color: colors[type] }}><Icon size={18} /></span><span><strong>{presets[type].label}</strong><small>{presets[type].description}</small></span><span className="add-mark">＋</span></button>;
                    })}
                </div>
                <button className="upload-card" type="button" onClick={() => chooseMedia()}><Upload size={17} /><span><strong>导入媒体</strong><small>图片、视频或直接拖入画布</small></span></button>
                <div className="guide-card"><span>画布交互</span><p>滚轮缩放 · 空格拖动画布<br />框选 / Shift 多选 · 拖拽端口连线</p><kbd>⌘ / Ctrl + Z</kbd><small>撤销上一步</small></div>
            </aside>

            <section className="workspace">
                <header className="topbar">
                    <div><strong>创意分镜</strong><span className="live-dot" /><small>本地 Core 实例</small></div>
                    <div><span>{canvas.document.nodes.length} 节点</span><span>{canvas.document.connections.length} 连线</span><button type="button" title="切换主题" onClick={() => setColorTheme(colorTheme === "light" ? "dark" : "light")}>{colorTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button></div>
                </header>

                <InfiniteCanvas containerRef={containerRef} viewport={canvas.viewport} theme={theme} tool={tool} backgroundMode={backgroundMode} ariaLabel="Core 示例画布" onViewportChange={interactions.onViewportChange} onCanvasPointerDown={interactions.onCanvasPointerDown} onCanvasDeselect={canvas.commands.clearSelection} onCanvasDoubleClick={(event) => addNode("text", interactions.toCanvas(event.clientX, event.clientY))} onDrop={onDrop}>
                    <CanvasConnectionLayer nodes={canvas.document.nodes} connections={canvas.document.connections} visibleNodeIds={visibleNodeIds} interaction={canvas.connectionInteraction} selectedConnectionId={canvas.selectedConnectionId} theme={theme} onConnectionSelect={interactions.onConnectionSelect} />
                    {visibleNodes.map((node) => <ExampleCanvasNode key={node.id} node={node} selected={canvas.selectedNodeIds.has(node.id)} connecting={Boolean(canvas.connectionInteraction)} scale={canvas.viewport.k} themeName={colorTheme} onPointerDown={interactions.onNodePointerDown} onPointerDownCapture={interactions.onNodePointerDownCapture} onConnectStart={interactions.onConnectionStart} onResizeStart={interactions.onNodeResizeStart} onResize={interactions.onNodeResize} onResizeEnd={interactions.onNodeResizeEnd} onResizeCancel={interactions.onNodeResizeCancel} onUpdate={canvas.commands.updateNode} onChooseMedia={chooseMedia} />)}
                    {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={canvas.viewport.k} theme={theme} /> : null}
                </InfiniteCanvas>

                {selectedNode ? <div className="selection-toolbar" style={{ left: canvas.viewport.x + (selectedNode.position.x + selectedNode.width / 2) * canvas.viewport.k, top: canvas.viewport.y + selectedNode.position.y * canvas.viewport.k - 14 }}><button type="button" onClick={() => interactions.focusNode(selectedNode.id)}><Focus size={14} />聚焦</button><button type="button" onClick={() => { canvas.commands.copySelection(); paste({ x: selectedNode.position.x + selectedNode.width + 80, y: selectedNode.position.y + selectedNode.height / 2 }); }}><Copy size={14} />复制</button><button className="danger" type="button" onClick={removeSelection}><Trash2 size={14} />删除</button></div> : null}

                <div className="canvas-dock">
                    <DockButton label={tool === "select" ? "选择工具" : "平移工具"} active onClick={() => setTool(tool === "select" ? "pan" : "select")}>{tool === "select" ? <MousePointer2 /> : <Hand />}</DockButton>
                    <DockButton label="撤销" disabled={!canvas.canUndo} onClick={canvas.commands.undo}><Undo2 /></DockButton>
                    <DockButton label="重做" disabled={!canvas.canRedo} onClick={canvas.commands.redo}><Redo2 /></DockButton>
                    <i />
                    {(Object.keys(presets) as NodeKind[]).map((type) => { const Icon = icons[type]; return <DockButton key={type} label={`添加${presets[type].label}`} onClick={() => addNode(type)}><Icon /></DockButton>; })}
                    <DockButton label="导入媒体" onClick={() => chooseMedia()}><Upload /></DockButton>
                    {selectedCount ? <><i /><DockButton label="删除选择" danger onClick={removeSelection}><Trash2 /></DockButton></> : null}
                </div>

                <div className="viewport-controls">
                    <button type="button" className={showMinimap ? "active" : ""} title="切换小地图" onClick={() => setShowMinimap(!showMinimap)}><Compass size={16} /></button>
                    <button type="button" title="重置视口" onClick={interactions.resetViewport}><Maximize2 size={16} /></button>
                    <input aria-label="画布缩放" type="range" min="10" max="240" value={Math.round(canvas.viewport.k * 100)} onChange={(event) => interactions.setZoom(Number(event.target.value) / 100)} />
                    <output>{Math.round(canvas.viewport.k * 100)}%</output>
                    <button type="button" title="切换背景" onClick={() => setBackgroundMode(backgroundMode === "dots" ? "lines" : backgroundMode === "lines" ? "blank" : "dots")}><RotateCcw size={15} /></button>
                </div>
                {showMinimap ? <CanvasMinimap nodes={canvas.document.nodes} viewport={canvas.viewport} viewportSize={interactions.containerSize} theme={theme} onViewportChange={interactions.onViewportChange} nodeColor={(node) => colors[node.type as NodeKind]} width={176} height={116} className="minimap" ariaLabel="画布小地图" /> : null}
            </section>
        </main>
    );
}

const ExampleCanvasNode = memo(function ExampleCanvasNode({ node, selected, connecting, scale, themeName, onPointerDown, onPointerDownCapture, onConnectStart, onResizeStart, onResize, onResizeEnd, onResizeCancel, onUpdate, onChooseMedia }: { node: ExampleNode; selected: boolean; connecting: boolean; scale: number; themeName: CanvasColorTheme; onPointerDown: (event: PointerEvent, id: string) => void; onPointerDownCapture: (event: PointerEvent, id: string) => void; onConnectStart: (event: PointerEvent, id: string, type: "source" | "target") => void; onResizeStart: (id: string) => void; onResize: (id: string, width: number, height: number, position?: Position) => void; onResizeEnd: (id: string) => void; onResizeCancel: (id: string) => void; onUpdate: (id: string, patch: Partial<ExampleNode>) => unknown; onChooseMedia: (id: string, accept: string) => void }) {
    const type = node.type as NodeKind;
    const Icon = icons[type];
    const [draft, setDraft] = useState(node.metadata?.content || "");
    useEffect(() => setDraft(node.metadata?.content || ""), [node.metadata?.content]);
    return (
        <CanvasNodeShell node={node} className={`example-node ${type}-node ${selected ? "selected" : ""}`} data-theme={themeName} onPointerDown={(event) => onPointerDown(event, node.id)} onPointerDownCapture={(event) => onPointerDownCapture(event, node.id)}>
            <div className="node-label"><span style={{ color: colors[type] }}><Icon size={14} />{node.title}</span><small>{type}</small></div>
            <div className="node-body">
                {type === "text" ? <textarea data-canvas-no-zoom aria-label="文本内容" value={draft} placeholder="输入提示词或说明…" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== (node.metadata?.content || "")) onUpdate(node.id, { metadata: { ...node.metadata, content: draft } }); }} /> : node.metadata?.src ? type === "image" ? <img src={node.metadata.src} alt={node.title} draggable={false} /> : <video src={node.metadata.src} controls loop muted playsInline data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} /> : <button type="button" className="media-empty" data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onClick={() => onChooseMedia(node.id, type === "image" ? "image/*" : "video/*")}><span style={{ color: colors[type] }}>{type === "image" ? <Image size={24} /> : <Play size={24} />}</span><strong>选择{presets[type].label}</strong><small>点击上传本地文件</small></button>}
            </div>
            {selected ? <CanvasNodeResizeHandles node={node} scale={scale} keepAspectRatio={type !== "text"} minWidth={180} minHeight={130} renderHandle={() => <span className="resize-handle" />} onResizeStart={onResizeStart} onResize={onResize} onResizeEnd={onResizeEnd} onResizeCancel={onResizeCancel} /> : null}
            <CanvasNodeConnectionHandles nodeId={node.id} visible={selected || connecting} theme={canvasThemes[themeName]} onConnectStart={onConnectStart} renderHandle={() => <span className="connection-handle"><Link2 size={10} /></span>} />
        </CanvasNodeShell>
    );
});

function DockButton({ label, active, danger, disabled, onClick, children }: { label: string; active?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return <button type="button" className={`${active ? "active" : ""} ${danger ? "danger" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

const createId = (prefix: string, ref: { current: number }) => `${prefix}-${Date.now().toString(36)}-${++ref.current}`;
const readFile = (file: File) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
const pickFiles = (accept: string, onFiles: (files: File[]) => void) => { const input = document.createElement("input"); input.type = "file"; input.accept = accept; input.multiple = true; input.onchange = () => onFiles([...(input.files || [])]); input.click(); };
const themeVariables = (theme: (typeof canvasThemes)[CanvasColorTheme], name: CanvasColorTheme) => ({ "--canvas-bg": theme.canvas.background, "--panel": theme.node.panel, "--surface": theme.node.fill, "--border": theme.node.stroke, "--text": theme.node.text, "--muted": theme.node.faint, "--soft": theme.toolbar.itemHover, "--active": theme.node.activeStroke, "--shadow": name === "dark" ? "rgba(0,0,0,.35)" : "rgba(57,48,38,.13)" } as CSSProperties);

createRoot(document.getElementById("root")!).render(<App />);
