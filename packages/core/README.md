# @infinite-canvas/core

可独立嵌入 React 应用的无限画布核心，提供画布文档、选择、撤销重做、视口、主题和几何工具，不包含 AI、插件、持久化或官方 Web 业务。

```tsx
import { CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, InfiniteCanvas, canvasThemes, useCanvas, useCanvasInteractions } from "@infinite-canvas/core";

const canvas = useCanvas({
    document: { nodes: [], connections: [] },
    viewport: { x: 0, y: 0, k: 1 },
    onDocumentChange: saveDocument,
});
const interactions = useCanvasInteractions({
    commands: canvas.commands,
    containerRef: ref,
    onConnectionEnd: (result) => result.connection && canvas.commands.addConnection({ id: createConnectionId(), ...result.connection }),
});

canvas.commands.addNode(node);
canvas.commands.startNodeDrag([node.id], pointer);
canvas.commands.moveNodeDrag(nextPointer);
canvas.commands.endNodeDrag(nextPointer);
canvas.commands.startConnection({ nodeId: node.id, handleType: "source" }, position);
const result = canvas.commands.endConnection(targetPosition);
if (result?.connection) canvas.commands.addConnection({ id, ...result.connection });
canvas.commands.copySelection();
canvas.commands.pasteClipboard({ position, createNodeId, createConnectionId });
canvas.commands.undo();

<InfiniteCanvas containerRef={ref} viewport={canvas.viewport} theme={canvasThemes.light} tool="select" onViewportChange={canvas.commands.setViewport} onCanvasMouseDown={interactions.onCanvasMouseDown}>
    {canvas.document.nodes.map((node) => (
        <CanvasNodeShell key={node.id} node={node} onMouseDown={(event) => interactions.onNodeMouseDown(event, node.id)} onMouseDownCapture={(event) => interactions.onNodeSelectCapture(event, node.id)}>
            {renderNode(node)}
            <CanvasNodeResizeHandles node={node} scale={canvas.viewport.k} onResizeStart={canvas.commands.startNodeResize} onResize={canvas.commands.resizeNode} onResizeEnd={canvas.commands.endNodeResize} />
            <CanvasNodeConnectionHandles visible theme={canvasThemes.light} onConnectStart={(event, handleType) => canvas.commands.startConnection({ nodeId: node.id, handleType }, interactions.toCanvas(event.clientX, event.clientY))} />
        </CanvasNodeShell>
    ))}
    {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={canvas.viewport.k} theme={canvasThemes.light} /> : null}
</InfiniteCanvas>;
```

视口属于画布实例状态，不进入文档撤销历史。`useCanvasInteractions` 提供容器尺寸、坐标转换和画布中心点。节点拖动、缩放、分组吸附、连线预览和画布剪贴板由 `useCanvas` 的稳定命令管理，连续节点预览和一次粘贴分别只生成一条文档历史。Core 不生成节点或连线 ID，连线与粘贴均由接入应用提供 ID。跨平台快捷键通过 `resolveCanvasShortcut` 识别，系统剪贴板媒体读取和持久化仍由接入应用负责。

仓库内运行 `bun run dev:examples` 可查看文档快照回调、自定义节点内容、未知节点占位和多实例隔离示例。

## 源码职责

- `types.ts`：公开文档、节点、选择和命令类型。
- `document.ts`：无 React 依赖的文档修改、选择清理和剪贴板变换逻辑。
- `use-canvas.ts`：实例状态、历史、事务和预览命令。
- `use-canvas-interactions.ts`：容器尺寸、坐标转换、框选、节点选择与拖动、连线移动和全局指针生命周期。
- `infinite-canvas.tsx`：基础视口、平移、缩放和背景渲染。
- `connection-layer.tsx` / `selection-box.tsx`：连线、连线预览和框选渲染。
- `minimap.tsx`：可自定义节点颜色的独立小地图。
- `node.tsx`：节点定位外壳、四角缩放控制、连接端口和未知节点占位。
- `shortcuts.ts`：跨平台画布快捷键识别。
- `geometry.ts` / `theme.ts`：纯几何工具与画布主题。
