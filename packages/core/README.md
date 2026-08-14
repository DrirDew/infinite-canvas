# @infinite-canvas/core

可独立嵌入 React 应用的无限画布核心，提供画布文档、选择、撤销重做、视口、主题和几何工具，不包含 AI、插件、持久化或官方 Web 业务。

包提供三个入口：根入口包含全部 API；`@infinite-canvas/core/headless` 只导出文档、几何、选择器、快捷键、主题和配置；`@infinite-canvas/core/react` 只导出 Hooks 与基础渲染组件。非 React 工具或服务可使用 headless 入口，避免加载 React 模块。

Core 的公开边界包括文档与实例状态、基础编辑命令、指针与视口交互、剪贴板、快捷键识别和基础渲染。节点 `type` 是接入应用定义的普通字符串；需要参与分组引擎的节点使用 `role: "group"`，子节点通过顶层 `groupId` 归属分组。泛型 `metadata` 不受 Core 字段约束，可由接入应用自由定义。项目存储、系统剪贴板媒体、ID 生成、节点业务内容、AI、Agent 与插件宿主由接入应用负责。

实例返回的 `selectedNodeIds`、`CanvasSelection.nodeIds` 和框选结果使用 `ReadonlySet`，接入应用通过选择命令修改状态，不直接写入 Core 内部集合。

包以 MIT 协议发布，npm 产物包含 README、许可证以及 `core`、`headless`、`react` 三个声明完整的公开入口。

```tsx
import { CanvasNodeConnectionHandles, CanvasNodeResizeHandles, CanvasNodeShell, CanvasSelectionBox, InfiniteCanvas, canvasThemes, getCanvasDocumentIssues, useCanvas, useCanvasEditor, useCanvasInteractions } from "@infinite-canvas/core";

const canvas = useCanvas({
    document: { nodes: [], connections: [] },
    viewport: { x: 0, y: 0, k: 1 },
    onDocumentChange: saveDocument,
    onSelectionChange: syncInspectorSelection,
    onInteractionChange: syncInteractionStatus,
    resolveConnection: optionalConnectionPolicy,
    canGroupNode: (node, group) => group.type !== "locked-group",
    historyLimit: 100,
    groupPadding: 24,
});
const interactions = useCanvasInteractions({
    commands: canvas.commands,
    containerRef: ref,
    minZoom: 0.1,
    maxZoom: 4,
    focusDuration: 300,
    onViewportInput: closeTransientOverlays,
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
canvas.commands.cancelPreview();
canvas.commands.undo();

const issues = getCanvasDocumentIssues(externalDocument, optionalConnectionPolicy);
if (!issues.length) canvas.commands.setDocument(externalDocument); // 同步清空选择与历史，并触发 onDocumentChange
interactions.focusNode(node.id);
interactions.setZoom(1.5);
interactions.resetViewport();

// 也可以一次组合两个 Hook，嵌套配置用于区分状态回调与交互输入回调。
const editor = useCanvasEditor({
    canvas: { document, onDocumentChange: saveDocument },
    interactions: { containerRef: ref, onViewportInput: closeTransientOverlays },
});

<InfiniteCanvas containerRef={ref} viewport={canvas.viewport} theme={canvasThemes.light} tool="select" gridSize={40} minZoom={0.1} maxZoom={4} ariaLabel="Workflow editor" onViewportChange={interactions.onViewportChange} onCanvasPointerDown={interactions.onCanvasPointerDown}>
    {canvas.document.nodes.map((node) => (
        <CanvasNodeShell key={node.id} node={node} onPointerDown={(event) => interactions.onNodePointerDown(event, node.id)} onPointerDownCapture={(event) => interactions.onNodePointerDownCapture(event, node.id)}>
            {renderNode(node)}
            <CanvasNodeResizeHandles node={node} scale={canvas.viewport.k} minWidth={24} minHeight={24} onResizeStart={interactions.onNodeResizeStart} onResize={interactions.onNodeResize} onResizeEnd={interactions.onNodeResizeEnd} onResizeCancel={interactions.onNodeResizeCancel} />
            <CanvasNodeConnectionHandles nodeId={node.id} visible theme={canvasThemes.light} onConnectStart={interactions.onConnectionStart} />
        </CanvasNodeShell>
    ))}
    {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={canvas.viewport.k} theme={canvasThemes.light} /> : null}
</InfiniteCanvas>;
```

视口属于画布实例状态，不进入文档撤销历史。`useCanvasInteractions` 提供容器尺寸、坐标转换、画布中心点、中心缩放、复位和节点聚焦动画，并允许配置缩放范围、聚焦覆盖率、最大缩放和动画时长；`onViewportInput` 只通知平移、滚轮和小地图等外部视口输入，返回的 `onViewportChange` 则用于连接这些渲染入口。`InfiniteCanvas` 可配置相同缩放范围与背景网格间距，并通过 `className`、`style`、`tabIndex` 和 `ariaLabel` 接入宿主布局与可访问名称。空格和 Control 工具切换只作用于当前聚焦实例，平移由 Pointer Capture 管理；多个画布同时存在时不会互相清理键盘状态或全局抓取光标。画布、节点、缩放控制点和连线端口统一使用 Pointer Events。节点拖动、缩放、分组吸附、连线预览和画布剪贴板由 `useCanvas` 的稳定命令管理，连续节点预览和一次粘贴分别只生成一条文档历史；缩放的 `pointercancel`、窗口失焦或控制点卸载会通过 `cancelNodeResize` 恢复预览起点，低层预览也可通过 `cancelPreview` 取消，undo/redo 会先取消尚未提交的预览。文档、视口、选择和交互状态分别可通过回调接入外部存储、检查器或状态面板。新增节点和连线命令会过滤重复 ID、无效分组、悬空端点、自连线、分组连线及策略拒绝的连线；粘贴复用相同校验，不会让接入方返回的空或冲突 ID 污染文档；节点更新会拒绝空或重复 ID，并在重命名、角色和类型变化时同步维护分组与关联连线；`transaction` 作为低层原子更新入口由接入方自行保证文档结构。Core 默认按源/目标端口确定连线方向，接入应用可通过 `resolveConnection` 注入节点类型规则，通过 `canGroupNode` 统一约束拖拽、新增、更新、粘贴和外部文档校验中的节点分组组合，并通过 `historyLimit`、`dragThreshold`、`groupPadding`、`connectionHandleRadius` 和 `connectionNodePadding` 调整实例行为；默认值统一导出为 `canvasDefaults`。`CanvasConnectionLayer` 的 `resolvePath` 可让普通连线与活动预览统一使用直线、折线或自定义路由，`resolveStyle`、`previewStyle` 和 `hitStrokeWidth` 可分别定制持久连线、预览和命中范围。Core 不生成节点或连线 ID，连线与粘贴均由接入应用提供 ID。跨平台快捷键通过 `resolveCanvasShortcut` 识别，系统剪贴板媒体读取和持久化仍由接入应用负责。

仓库内运行 `bun run dev:examples` 可查看文档快照回调、自定义节点内容、未知节点占位和多实例隔离示例。

`CanvasSelectionBox` 保持随缩放稳定的默认描边，同时允许通过 `className`、`style` 和 `rectProps` 覆盖容器与矩形 SVG 属性。`CanvasMinimap` 可配置 `worldPadding`、节点和视口最小可见尺寸，并通过 `className`、`style` 接入应用布局。

## 源码职责

- `model.ts` / `commands.ts` / `options.ts`：分别定义画布数据模型、实例命令和 Hook 配置；`types.ts` 保持统一公开类型入口。
- `defaults.ts`：公开且可覆盖的引擎默认参数。
- `headless.ts` / `react.ts`：无 React 能力与 React 运行时能力的独立包入口。
- `document.ts`：无 React 依赖的文档校验、修改、选择清理和剪贴板变换逻辑。
- `selectors.ts`：分组数量、上下游节点、图遍历与关联高亮等纯派生查询。
- `use-canvas.ts`：只组合 React 实例状态、最新配置引用和稳定命令对象。
- `internal/canvas-state.ts` / `internal/create-canvas-commands.ts`：维护实例临时状态结构，并构造文档、历史、预览和交互命令。
- `use-canvas-editor.ts`：一次组合实例状态与交互编排的高层 Hook。
- `use-canvas-viewport.ts`：容器尺寸、坐标转换、缩放、复位和节点聚焦动画。
- `use-canvas-interactions.ts`：组合视口能力，并管理框选、节点选择与拖动、连线和全局指针生命周期。
- `internal/window-events.ts`：按事件类型复用单个 window 监听，并向各画布实例分发全局生命周期事件。
- `infinite-canvas.tsx`：基础视口、平移、缩放和背景渲染。
- `connection-layer.tsx` / `selection-box.tsx`：不限制世界坐标范围的连线、连线预览和框选渲染。
- `minimap.tsx`：可自定义节点颜色、世界边距和最小可见尺寸的独立小地图。
- `node.tsx`：节点定位外壳、四角缩放控制、连接端口和未知节点占位。
- `shortcuts.ts`：跨平台画布快捷键识别。
- `geometry/viewport.ts`、`geometry/nodes.ts`、`geometry/connections.ts`：按视口、节点分组和连线职责拆分的纯几何工具；`geometry.ts` 保持统一公开入口。
- `theme.ts`：画布主题 token。
