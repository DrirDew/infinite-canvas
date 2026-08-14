# @infinite-canvas/core

可独立嵌入 React 应用的无限画布核心，提供画布文档、选择、撤销重做、视口、主题和几何工具，不包含 AI、插件、持久化或官方 Web 业务。

```tsx
import { InfiniteCanvas, canvasThemes, useCanvas } from "@infinite-canvas/core";

const canvas = useCanvas({
    document: { nodes: [], connections: [] },
    viewport: { x: 0, y: 0, k: 1 },
    onDocumentChange: saveDocument,
});

canvas.commands.addNode(node);
canvas.commands.startNodeDrag([node.id], pointer);
canvas.commands.moveNodeDrag(nextPointer);
canvas.commands.endNodeDrag(nextPointer);
canvas.commands.startConnection({ nodeId: node.id, handleType: "source" }, position);
const result = canvas.commands.endConnection(targetPosition);
if (result?.connection) canvas.commands.addConnection({ id, ...result.connection });
canvas.commands.undo();

<InfiniteCanvas containerRef={ref} viewport={canvas.viewport} theme={canvasThemes.light} tool="select" onViewportChange={canvas.commands.setViewport} />;
```

视口属于画布实例状态，不进入文档撤销历史。节点拖动、缩放、分组吸附和连线预览由 `useCanvas` 的稳定命令管理，连续节点预览只在结束时生成一条文档历史。Core 不生成节点或连线 ID，接入应用根据 `endConnection` 返回的标准化端点决定保存连线或打开业务菜单。坐标、框选、缩放和连线命中计算使用公开纯函数，持久化仍由接入应用负责。

仓库内运行 `bun run dev:examples` 可查看多实例示例。

## 源码职责

- `types.ts`：公开文档、节点、选择和命令类型。
- `document.ts`：无 React 依赖的文档修改与选择清理逻辑。
- `use-canvas.ts`：实例状态、历史、事务和预览命令。
- `infinite-canvas.tsx`：基础视口、平移、缩放和背景渲染。
- `geometry.ts` / `theme.ts`：纯几何工具与画布主题。
