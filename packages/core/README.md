# @infinite-canvas/core

可独立嵌入 React 应用的无限画布引擎，提供文档、选择、历史、视口、几何、指针交互和基础渲染，不包含 AI、插件宿主、持久化或官方 Web 业务。

## 安装与入口

```bash
bun add @infinite-canvas/core react
```

Core 只要求 React 18+，不强制依赖 `react-dom`。包以 MIT 协议发布，使用 NodeNext ESM，并提供源码映射和声明映射。

| 入口 | 内容 |
| --- | --- |
| `@infinite-canvas/core` | 全部公开 API |
| `@infinite-canvas/core/headless` | 文档、几何、选择器、快捷键、主题和默认配置，不加载 React，也不在声明中依赖浏览器 DOM 类型 |
| `@infinite-canvas/core/react` | Hooks 与基础渲染组件 |

## 快速开始

```tsx
import {
    CanvasConnectionLayer,
    CanvasNodeConnectionHandles,
    CanvasNodeResizeHandles,
    CanvasNodeShell,
    CanvasSelectionBox,
    InfiniteCanvas,
    canvasThemes,
    useCanvas,
    useCanvasInteractions,
} from "@infinite-canvas/core";
import { useRef } from "react";

function Editor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvas = useCanvas({
        document: { nodes: [], connections: [] },
        viewport: { x: 0, y: 0, k: 1 },
        onDocumentChange: saveDocument,
    });
    const interactions = useCanvasInteractions({
        commands: canvas.commands,
        containerRef,
        onConnectionEnd: (result) => {
            if (result.connection) canvas.commands.addConnection({ id: createId(), ...result.connection });
        },
    });

    return (
        <InfiniteCanvas
            containerRef={containerRef}
            viewport={canvas.viewport}
            theme={canvasThemes.light}
            tool="select"
            onViewportChange={interactions.onViewportChange}
            onCanvasPointerDown={interactions.onCanvasPointerDown}
            onCanvasDeselect={canvas.commands.clearSelection}
        >
            <CanvasConnectionLayer
                nodes={canvas.document.nodes}
                connections={canvas.document.connections}
                interaction={canvas.connectionInteraction}
                selectedConnectionId={canvas.selectedConnectionId}
                theme={canvasThemes.light}
                onConnectionSelect={interactions.onConnectionSelect}
            />
            {canvas.document.nodes.map((node) => (
                <CanvasNodeShell
                    key={node.id}
                    node={node}
                    onPointerDown={(event) => interactions.onNodePointerDown(event, node.id)}
                    onPointerDownCapture={(event) => interactions.onNodePointerDownCapture(event, node.id)}
                >
                    {renderNode(node)}
                    <CanvasNodeResizeHandles node={node} scale={canvas.viewport.k} onResizeStart={interactions.onNodeResizeStart} onResize={interactions.onNodeResize} onResizeEnd={interactions.onNodeResizeEnd} onResizeCancel={interactions.onNodeResizeCancel} />
                    <CanvasNodeConnectionHandles nodeId={node.id} visible theme={canvasThemes.light} onConnectStart={interactions.onConnectionStart} />
                </CanvasNodeShell>
            ))}
            {interactions.selectionRect ? <CanvasSelectionBox rect={interactions.selectionRect} scale={canvas.viewport.k} theme={canvasThemes.light} /> : null}
        </InfiniteCanvas>
    );
}
```

也可以用 `useCanvasEditor({ canvas, interactions })` 一次组合两个 Hook。嵌套配置用于区分实例状态回调与视口输入回调。

## 文档模型

`CanvasDocument<TMetadata>` 只包含节点和连线。文档是撤销重做的完整快照，视口、选择和临时交互状态不进入历史。

- 节点 `type` 是宿主定义的普通字符串。
- 分组节点使用 `role: "group"`，子节点通过顶层 `groupId` 归属分组。
- `metadata` 完全由宿主定义，不承载 Core 引擎字段。
- Core 不生成节点或连线 ID。
- 节点与连线查询、几何和批量新增 API 接受 readonly 数组。
- 选择结果使用 `ReadonlySet<string>`，修改选择必须调用命令。

外部文档可先通过 `getCanvasDocumentIssues(document, resolveConnection, canGroupNode)` 校验。`setDocument` 用于加载新文档，并清空当前选择、交互和撤销重做历史。

## 命令与历史

`useCanvas` 返回稳定的 `commands` 对象。主要命令分为：

- 文档：`setDocument`、`addNode(s)`、`updateNode`、`removeNodes`、`addConnection(s)`、`removeConnections`。
- 选择：`selectNodes`、`selectNodesInRect`、`selectConnection`、`clearSelection`。
- 交互：节点拖动与缩放、连线开始/移动/结束/取消。
- 剪贴板：`copySelection`、`pasteClipboard`，不访问系统剪贴板。
- 历史：`undo`、`redo`、`preview`、`commitPreview`、`cancelPreview`。
- 原子修改：`transaction(updater)`，一次修改多个节点和连线只产生一条历史。
- 快照读取：`getDocument`、`getViewport`、`getSelection`、`getInteraction`、`getHistoryDocuments`。

连续拖动和缩放只在结束时提交一条历史。粘贴、批量生成和切图等宿主业务应使用 `transaction` 或对应批量命令。

## 策略与回调

`useCanvas` 支持以下接入点：

- `onDocumentChange`：保存最新文档快照。
- `onViewportChange`、`onSelectionChange`、`onInteractionChange`：同步外部检查器或状态面板。
- `resolveConnection`：注入节点类型、端口方向和禁连规则。
- `canGroupNode`：统一约束拖拽、新增、更新、缩放、粘贴和文档校验中的分组关系。
- `historyLimit`、`dragThreshold`、`groupPadding`、`connectionHandleRadius`、`connectionNodePadding`：调整实例行为。

默认参数统一由 `canvasDefaults` 导出。重复选择、等值视口和语义不变的节点更新不会发布重复状态或产生空历史。

## 视口与指针交互

`useCanvasInteractions` 组合 `useCanvasViewport`，提供容器测量、坐标转换、框选、节点拖动、连线、中心缩放、复位和节点聚焦动画。

- `onViewportInput` 只接收平移、滚轮和小地图等手动输入。
- `onViewportChange` 用于连接 `InfiniteCanvas` 和 `CanvasMinimap`。
- `minZoom`、`maxZoom`、`focusCoverage`、`focusMaxZoom`、`focusDuration` 可按实例配置。
- 平移、框选、拖动、缩放、连线和小地图导航按启动 `pointerId` 隔离。
- 同一画布表面的平移与编辑交互互斥，多实例的键盘状态、历史、剪贴板、指针和 body 光标互不影响。
- Space 和 Control 工具切换只作用于当前聚焦画布，输入控件保留原生键盘行为。

跨平台快捷键通过 `resolveCanvasShortcut` 识别。系统剪贴板媒体读取、快捷键副作用和业务弹窗仍由宿主处理。

## 基础渲染与扩展

| 组件 | 能力与扩展点 |
| --- | --- |
| `InfiniteCanvas` | 画布表面、网格、平移和滚轮缩放；支持容器、背景、世界内容层样式及自定义背景 |
| `CanvasNodeShell` | 节点世界坐标定位，透传标准 div 属性 |
| `CanvasNodeResizeHandles` | 四角缩放，可配置最小尺寸、命中尺寸和自定义控制点 |
| `CanvasNodeConnectionHandles` | 源/目标端口，可配置命中尺寸、偏移、指示器和自定义内容 |
| `CanvasConnectionLayer` | 持久连线和活动预览，支持键盘选择与可访问名称，可定制路径、样式、命中宽度与 SVG 容器 |
| `CanvasSelectionBox` | 缩放无关的框选描边，可覆盖容器样式和 rect 属性 |
| `CanvasMinimap` | 世界边界和视口导航，支持方向键及可访问名称，可定制布局、键盘步长、节点内容和视口样式 |
| `CanvasUnknownNode` | 未注册节点的安全占位，可替换标题、描述和图标 |

`InfiniteCanvas.renderBackground` 会收到当前 `viewport`、`theme`、`mode` 和 `gridSize`。Core 始终保持背景点击穿透，并保护世界内容层的视口 transform 不被自定义样式覆盖。

基础画布、背景、内容、连线、连线预览、框选、小地图和未知节点提供稳定的 `data-*` 标记，便于宿主 CSS、自动化测试和调试。

## Core 边界

Core 负责画布文档、实例状态、历史、视口、几何、基础交互和基础渲染。以下能力由宿主负责：

- 项目持久化和数据迁移。
- ID 生成和系统剪贴板媒体。
- 节点业务内容、工具栏、弹窗和国际化。
- AI、Agent、生成任务和素材清理。
- 插件发现、权限、沙箱和运行时。

## 源码职责

- `model.ts` / `commands.ts` / `options.ts`：数据模型、命令和 Hook 配置；`types.ts` 是统一类型入口。
- `document/`：文档校验、修改、选择清理和剪贴板变换；`document.ts` 是公共 barrel。
- `geometry/`：视口、节点/分组和连线几何；`geometry.ts` 是公共 barrel。
- `selectors.ts` / `shortcuts.ts` / `theme.ts` / `defaults.ts`：纯查询、快捷键、主题和默认参数。
- `use-canvas.ts` / `use-canvas-editor.ts`：实例状态与高层组合。
- `use-canvas-viewport.ts` / `use-canvas-interactions.ts`：视口能力与 React 事件编排。
- `internal/canvas-command-runtime.ts` / `create-canvas-commands.ts`：状态发布、历史预览运行时和领域命令。
- `internal/use-canvas-surface-input.ts` / `use-canvas-pointer-lifecycle.ts` / `pointer-ownership.ts` / `window-events.ts`：画布表面输入、编辑指针生命周期、实例所有权和共享全局事件。
- `infinite-canvas.tsx` / `node/` / `connection-layer.tsx` / `selection-box.tsx` / `minimap.tsx`：画布表面、节点外壳与控制、连线、框选和小地图基础渲染；`node.tsx` 保持统一入口。
- `headless.ts` / `react.ts` / `index.ts`：分环境公开入口。

仓库内运行 `bun run dev:examples` 可查看两个独立画布实例、文档快照、选择、拖动、缩放、连线、剪贴板、撤销重做和未知节点占位。
