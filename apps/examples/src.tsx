import { InfiniteCanvas, canvasThemes, normalizeRect, screenToCanvas, useCanvas, type CanvasDocument, type CanvasRect, type ViewportTransform } from "@infinite-canvas/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function Demo({ title, accent, initial }: { title: string; accent: string; initial: ViewportTransform }) {
    const ref = useRef<HTMLDivElement>(null);
    const count = useRef(1);
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<CanvasRect | null>(null);
    const { document, viewport, selectedNodeIds, canUndo, canRedo, commands } = useCanvas({ document: initialDocument(title), viewport: initial });
    const toCanvas = useCallback(
        (clientX: number, clientY: number) => {
            const rect = ref.current?.getBoundingClientRect();
            return screenToCanvas(clientX, clientY, commands.getViewport(), { left: rect?.left || 0, top: rect?.top || 0 });
        },
        [commands],
    );

    useEffect(() => {
        const move = (event: PointerEvent) => {
            if (!selectionStartRef.current) return;
            const rect = normalizeRect(selectionStartRef.current, toCanvas(event.clientX, event.clientY));
            setSelectionRect(rect);
            commands.selectNodesInRect(rect);
        };
        const up = () => {
            selectionStartRef.current = null;
            setSelectionRect(null);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
    }, [commands, toCanvas]);

    const add = () => {
        const index = ++count.current;
        const id = `${title}-${index}`;
        commands.addNode({ id, type: "demo", title: id, position: { x: 70 + index * 28, y: 60 + index * 24 }, width: 180, height: 112 });
        commands.selectNodes([id]);
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
                    {document.nodes.map((node) => (
                        <article
                            key={node.id}
                            data-node-id={node.id}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                commands.selectNodes([node.id]);
                            }}
                            style={{ borderColor: selectedNodeIds.has(node.id) ? accent : "#aaa399", transform: `translate(${node.position.x}px,${node.position.y}px)`, width: node.width, height: node.height }}
                        >
                            <i style={{ background: accent }} />
                            独立实例<strong>{node.title.replace(`${title}-`, "")}</strong>
                            <small>选择 · 框选 · 视口 · 历史</small>
                        </article>
                    ))}
                    {selectionRect ? <div style={{ position: "absolute", left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height, border: `1px dashed ${accent}`, pointerEvents: "none" }} /> : null}
                </InfiniteCanvas>
            </div>
        </section>
    );
}

const initialDocument = (title: string): CanvasDocument => ({ nodes: [{ id: `${title}-1`, type: "demo", title: `${title}-1`, position: { x: 70, y: 60 }, width: 180, height: 112 }], connections: [] });

function App() {
    return (
        <main>
            <div className="intro">
                <p>CORE / 03</p>
                <h1>
                    一块画布，
                    <br />
                    任意产品。
                </h1>
                <aside>
                    这个应用只组合 <code>@infinite-canvas/core</code>。两个实例的文档、视口、框选和撤销历史完全隔离。
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
