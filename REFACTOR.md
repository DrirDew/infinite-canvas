# Infinite Canvas 重构架构

> A（basketikun）：拆分 Core。
> B（Soldier）：插件系统设计。
> C（yukkcat）：拆分 Agent Panel。Agent Panel 是可独立运行并可接入画布的 Codex / Claude Code Web UI。
> 三人统一在 `refactor/plugin` 分支协作，不单独创建分支。
> 等待 monorepo 改造完成后开始开发。
> 最终目标：core 是独立、稳定的画布引擎；Web 是完整产品和唯一插件平台；第三方可以单独使用 core，也可以在自己的应用层建立不同的插件体系。

## 1. 架构结论

项目重构为 monorepo，主要由以下部分组成：

- `@infinite-canvas/core`：可独立发布和嵌入的 React 画布引擎。
- `apps/web`：基于 core 构建的完整 AI 创作应用，也是唯一的插件宿主。
- `apps/examples`：只引入 core 的最小演示项目。
- `@infinite-canvas/plugin-sdk`：面向 Web 应用插件的开发契约，不属于 core。

Core 只提供画布能力和扩展切入点，不实现插件、业务、持久化或 AI。Web 负责产品能力，并用 Cordis 管理应用插件。

## 2. Monorepo 结构

```text
infinite-canvas/
├── apps/
│   ├── web/                 # 官方 Web 应用
│   ├── docs/                # 文档站
│   └── examples/            # Core 最小演示项目
├── packages/
│   ├── core/                # @infinite-canvas/core
│   ├── plugin-sdk/          # @infinite-canvas/plugin-sdk
│   └── canvas-agent/        # @basketikun/canvas-agent
├── plugins/
│   ├── user/                # 插件模板和示例
│   └── registry/            # 官方插件清单
```

应用统一放在 `apps/`，可发布模块统一放在 `packages/`。当前不拆分 engine、adapter、ui、contracts 等预备包；出现真实的第二种渲染器或独立消费需求后再拆。

## 3. 系统关系

```mermaid
flowchart LR
    Consumer[第三方 React 应用] --> Core[@infinite-canvas/core]
    Example[Core Example] --> Core
    Web[官方 Web 应用] --> Core
    Web --> Runtime[Cordis 插件运行时]
    System[System Plugins] --> Runtime
    User[User Plugins] --> Runtime
    Runtime --> Extensions[应用贡献服务]
    Extensions --> Web
    Extensions --> Adapter[画布适配]
    Adapter --> Core
    SDK[@infinite-canvas/plugin-sdk] --> System
    SDK --> User
```

`apps/examples` 只依赖 core，用于演示基础画布能力并验证 core 可以脱离官方 Web 独立使用。第三方应用同样可以直接安装 core，并通过公开切入点组合自己的节点和业务；是否建立插件系统由第三方应用自行决定。

## 4. Core 画布引擎

### 4.1 负责范围

- 画布坐标、网格、平移、缩放和视口。
- 节点渲染、移动、缩放、选择和分组。
- 连线、剪贴板、撤销重做和基础交互。
- 画布文档、节点定义、命令、事件和实例状态。
- 未知节点占位、小地图能力和基础主题变量。
- 同一页面多画布实例隔离。

### 4.2 扩展切入点

Core 通过受控文档、节点定义、命令、事件回调、实例句柄和主题变量供外部组合。它不关心这些扩展来自应用代码还是插件。

### 4.3 不负责范围

- 插件安装、生命周期、manifest、SDK 和插件清单。
- AI 请求、模型配置、API Key 和生成任务。
- 项目、素材、对话和业务数据持久化。
- 路由、导航、设置、应用主题和完整工作台 UI。
- Ant Design、Cordis、Agent 和官方应用服务。

## 5. Web 应用

Web 是 core 的主要消费者，在画布引擎之上增加：

- 项目、素材、提示词和本地持久化。
- 图片、视频、音频和文本生成。
- 生成任务创建、状态维护、轮询、取消和重试。
- 图片与媒体编辑工具。
- Agent、模型配置和 AI 服务调用。
- 页面、导航、设置、主题和完整工作台 UI。
- Cordis 插件运行时、插件安装和插件清单。

生成任务属于 Web。无论从创作台还是画布发起生成，都由 Web 创建和跟踪任务；完成后保存结果，再通过 core 命令更新画布。Core 不认识任务队列和 AI 服务。

Web 插件产生的节点贡献会转换为 core 的节点定义，画布动作会转换为 core 命令，插件页面、工具栏和面板仍由 Web 渲染。

## 6. Web 插件系统

### 6.1 统一运行时

Web 只有一套插件系统：

- System Plugin 随应用构建并在启动时加载。
- User Plugin 由用户主动安装。
- 两者使用相同的贡献模型，并由同一个 Cordis runtime 管理生命周期。
- Core 不感知插件，也不依赖 plugin-sdk。

Cordis 负责插件安装后的启动、服务依赖、副作用回收和卸载。Web 负责 User Plugin 的下载、缓存、安装确认和版本记录。

### 6.2 第一版信任模型

第一版不实现 iframe、RPC 和权限隔离。System Plugin 与 User Plugin 都在宿主页面执行，可以访问应用状态、本地数据和用户保存的 AI 服务配置。

首次安装和每次手动更新 User Plugin 前必须明确提示其拥有完整应用访问能力。第一版不自动更新插件；开放无需信任即可安装的公共插件市场前，再重新设计沙箱协议，不保留半套兼容层。

### 6.3 应用贡献

| 贡献                 | 用途                      |
|--------------------|-------------------------|
| Navigation         | 增加、隐藏、替换或重排导航项          |
| Routes             | 注册插件页面和工作台              |
| Themes             | 注册应用和画布主题               |
| Branding           | 修改应用名称、Logo、图标和品牌文案     |
| Commands           | 注册可由页面、工具栏或 Agent 调用的动作 |
| AI Config Policies | 限制可用渠道、模型和 Base URL     |
| Canvas             | 注册节点、工具栏和节点动作           |
| Settings           | 注册设置区块                  |

UI 扩展走 contribution；认证、存储、同步、3D 等可被其他模块调用的能力走明确命名的 Cordis service，不建立万能 service。

同类普通贡献可以并存。认证、存储和品牌等单实例能力由应用设置选择当前实现，安装插件不得静默替换。AI 配置策略可以并存，配置必须通过全部策略。

### 6.4 App 插件示例

| 插件      | 提供能力                     | 主要接入点                                 |
|---------|--------------------------|---------------------------------------|
| 用户认证插件  | 登录、会话、用户信息和访问状态          | Auth service、页面、导航、设置                 |
| 远程服务插件  | 接入项目、素材、任务或团队服务          | 对应业务 service                          |
| 渠道限制插件  | 限制 AI 渠道、模型和 Base URL    | AI Config Policies                    |
| 品牌主题插件  | 修改名称、Logo、品牌文案和视觉主题      | Branding、Themes                       |
| 存储插件    | 切换项目和素材存储位置              | Project Storage、Asset Storage service |
| 3D 全局插件 | 提供共享 3D 场景、资源和 WebGL 工作区 | 3D service、页面、导航、画布节点                 |
| 导演工作台插件 | 提供分镜、镜头、生成动作和独立工作台       | 页面、导航、Commands、Canvas                 |
| 精简导航栏插件 | 隐藏、替换或重排应用入口             | Navigation                            |

这些示例只确定架构边界。只有开始实现对应插件时，才增加它真正需要的 contribution 或 service。

### 6.5 Plugin SDK

Plugin SDK 提供 Web 插件的 manifest、贡献类型、生命周期约定、UI 挂载入口和构建支持，并复用 core 的公开画布类型。插件宿主和运行时始终位于 Web，SDK 不反向进入 core。

## 7. 数据归属

| 数据                | 归属                   |
|-------------------|----------------------|
| 节点、连线和画布结构        | Core Canvas Document |
| 视口和画布编辑状态         | Core 实例或 Web 项目      |
| 项目名称、对话、生成记录和应用设置 | Web                  |
| 图片、视频、音频和素材记录     | Web                  |
| 插件安装、启停、版本和私有数据   | Web 插件系统             |

Core 不提供持久化。第三方使用方自行选择存储方式；官方 Web 默认使用浏览器本地存储。新的数据结构直接切换，不兼容旧画布数据和旧插件数据。

## 8. 架构约束

- Core 必须能被全新的 React 项目独立安装，不依赖官方 Web。
- Example 只依赖 core，不接入 Web、Plugin SDK、Cordis 和业务能力。
- Core 不包含应用插件系统，Web 是唯一插件宿主。
- Web 插件通过公开适配层使用 core，不直接依赖 core 内部 store。
- 插件贡献、导航、主题和节点定义各自只有一个权威来源。
- Cordis 版本精确锁定，并集中在 Web runtime 内，升级不与业务改动混合。
- 不保留旧 loader、旧 runtime、重复公共类型或兼容层。
- 不预先设计尚无真实插件需要的扩展点。

## 9. 实施顺序

1. **Monorepo 基座（已完成）**：Web 与文档站移入 `apps/`，Canvas Agent 与 Plugin SDK 移入 `packages/`，插件移入 `plugins/user`，统一使用根 Bun workspace 和 `bun.lock`。
2. **拆 Core（进行中）**：先迁移画布文档类型、坐标与几何等纯逻辑，再迁移实例状态和基础渲染；Core 内不得引用 `apps/web` 的别名、业务 store、i18n、Ant Design 或持久化。
3. **建立 Examples（已完成）**：新增 `apps/examples`，只依赖 `@infinite-canvas/core`，用它验证 Core 的公开入口与多实例隔离。
4. **Web 接回 Core**：Web 通过 Core 公开 API 组合项目、生成任务、素材、Agent 与插件适配，不直接访问 Core 内部 store。
5. **替换插件运行时**：删除旧 loader/runtime 后再接入 Cordis，不保留两套运行时并行。

## 10. Core 画布引擎重构（实现完成，待人工验收）

下一阶段的目标是让 Core 真正拥有画布文档、实例状态和基础编辑交互，Web 只负责业务组合。迁移期间按可独立提交的小步骤推进，不一次性重写画布页面。

### 10.1 盘点状态边界

梳理 `project.tsx`、`use-canvas-store.ts` 和画布组件中的状态并分为三类：

- Core：节点、连线、视口、选择、移动、缩放、分组和撤销重做。
- Web：项目列表、持久化、AI、素材、Agent、插件和业务弹窗。
- 适配层：把 Web、Agent 和插件动作转换为 Core 命令。

画布文档只能有一个实时权威来源，Web 只保存 Core 文档快照，不同时维护另一份可编辑状态。

### 10.2 建立 Core 文档与状态 API

Core 增加 `CanvasDocument` 和 `useCanvas`，通过受控文档与变更回调接入外部应用：

```ts
type CanvasDocument = {
    nodes: CanvasNode[];
    connections: CanvasConnection[];
};

const canvas = useCanvas({ document, onDocumentChange });
```

第一版只提供当前交互真正需要的命令：

- `setDocument`
- `addNode`、`updateNode`、`removeNodes`
- `addConnection`、`removeConnections`
- `selectNodes`、`clearSelection`
- `undo`、`redo`
- `getDocument`

优先使用 React 原生状态能力，不为 Core 新增状态管理依赖。

### 10.3 迁移基础交互

按以下顺序迁移，每完成一类交互就让 Web 改用对应 Core API：

1. 坐标转换和视口控制。
2. 单选、多选和框选。
3. 节点移动与缩放。
4. 分组、吸附和组内节点移动。
5. 连线创建、选择和删除。
6. 撤销、重做和剪贴板。

第一批先完成视口、坐标与框选：

- `useCanvas` 接管实例 `viewport`，提供稳定的 `setViewport`、`getViewport` 命令；视口不进入文档撤销历史。
- Core 提供屏幕坐标与画布坐标互转、矩形标准化、节点矩形相交查询等纯函数。
- Web 继续负责项目视口持久化，但不再维护另一份可编辑视口状态。
- 框选过程中的起点与当前指针仍是临时交互状态，最终选中节点由 Core 命令写入实例选择状态。

第二批完成节点拖动、缩放、分组与吸附：

- Core 通过 `startNodeDrag`、`moveNodeDrag`、`endNodeDrag` 管理拖动预览和提交，拖动指针与初始位置保存在实例 ref 中。
- 拖动分组时自动带上组内节点，结束时统一处理目标分组吸附、脱离分组和重新归组，只生成一条历史记录。
- Core 通过 `startNodeResize`、`resizeNode`、`endNodeResize` 管理缩放预览与历史，通过 `resizeNodeBounds` 计算四角缩放和比例锁定尺寸。
- Web 继续渲染现有节点和控制点，只负责转发指针坐标与节点业务面板状态，不再拼装拖动、吸附或缩放文档。

第三批完成连线交互：

- Core 通过 `startConnection`、`moveConnection`、`endConnection`、`cancelConnection` 管理连线起点、预览指针、目标节点和取消状态。
- Core 负责按视口比例计算端口与节点命中、排除自身和无效类型组合，并在结束时返回标准化连接端点。
- Core 不生成连线 ID；Web 对有效端点去重并写入文档，落在空白处时继续负责显示“创建并连接节点”业务菜单。
- 连线选择、删除和撤销重做继续复用 Core 文档与选择命令，现有 SVG 连线渲染暂留 Web，等基础渲染阶段统一迁移。

第四批完成画布剪贴板与快捷键：

- Core 通过 `copySelection` 保存实例内剪贴板，只复制选中节点及选区内部连线，不访问浏览器系统剪贴板。
- `pasteClipboard` 负责按目标位置居中、重映射节点与分组 ID、恢复内部连线、选择粘贴结果并生成一条历史；节点和连线 ID 继续由接入应用提供。
- `resolveCanvasShortcut` 统一识别 macOS 和其他平台的撤销、重做、全选、复制、粘贴、删除与取消快捷键。
- Web 保留输入区域过滤、系统剪贴板图片和文本导入、媒体清理以及关闭业务面板等适配逻辑。

### 10.4 迁移基础渲染

Core 负责节点定位外壳、拖动与缩放控制点、连线层、选择框、小地图和未知节点占位。节点具体内容通过节点定义或 `renderNode` 传入。

图片生成、提示词面板、Ant Design 控件和业务工具栏继续由 Web 渲染，不进入 Core。

第一批基础渲染已完成：

- `CanvasConnectionLayer` 接管普通连线、选中态、关联高亮、命中路径和活动连线预览，Web 通过回调处理菜单等业务状态。
- `CanvasSelectionBox` 接管与缩放无关的稳定虚线框样式。
- `CanvasMinimap` 接管世界边界、视口矩形、节点缩略图和拖动导航，节点颜色可由接入应用注入。
- 删除 Web 中对应的连线组件和小地图组件。

第二批基础渲染已完成：

- `CanvasNodeShell` 接管节点 ID、世界坐标、尺寸和布局隔离，具体节点内容仍由接入应用组合。
- `CanvasNodeResizeHandles` 接管四角控制点、缩放比例换算和全局拖动监听，并继续通过 Core 命令提交预览与历史。
- `CanvasNodeConnectionHandles` 接管目标端口、源端口、显隐状态和基础主题样式。
- `CanvasUnknownNode` 提供无插件、无渲染器节点的通用占位，图标和本地化文案由接入应用传入。

### 10.5 Web 接回 Core

- `use-canvas-store` 只保存项目数据和 Core 文档快照。
- `project.tsx` 已删除本地选择 setter 与 `setNodes`、`setConnections` 文档数组适配，选择、普通编辑、媒体导入、AI 流式生成和批量结果均直接调用 Core 命令。
- AI 生成结果已通过 `updateNode` 或 `transaction` 添加、更新节点和连线，多节点初始化继续保持原子提交。
- Agent 操作转换为 Core 命令。
- Web 插件节点定义通过适配层交给 Core。
- Web 已统一从 Core 引用画布主题，并删除重复的 `apps/web/src/lib/canvas-theme.ts`。
- `useCanvasInteractions` 已接管框选、节点选择与拖动、连线移动和全局指针结束/取消监听；Web 只通过回调打开业务面板、创建连线 ID 或显示空白落点菜单。
- 接入应用通过 `useCanvasInteractions` 获取屏幕坐标转换和画布中心点，不再重复读取容器边界与视口。
- `useCanvasInteractions` 统一监听容器尺寸，Web 仅保留首次尺寸确定后的项目视口居中策略。
- 可见节点裁剪改用 Core 的 `nodesInViewport`，Web 不再维护视口边界计算。
- 画布复位、中心缩放、节点适配视口及聚焦动画迁入 `useCanvasInteractions`，Web 仅在调用后关闭业务菜单。
- 节点缩放开始/预览/结束与连线端口起点统一由 `useCanvasInteractions` 转换为 Core 命令，Web 只保留缩放开始时关闭业务展开态。
- 画布平移、滚轮缩放和小地图导航统一通过 Core 视口入口，新的手动视口输入会取消未结束的聚焦动画。
- 连线点击和右键入口先由 Core 更新实例选择，Web 回调只负责关闭或打开业务菜单。
- Web 删除旧框选类型及重复的分组元数据字段，通用画布类型统一以 Core 为源。
- Core 的中心缩放与滚轮锚点缩放共用统一几何函数和缩放上下限。
- 节点缩放控制点统一使用 Pointer Events，并在 pointer cancel、窗口失焦或卸载时结束 Core 预览状态。
- 小地图复用 Core 节点边界函数；视口平移失焦时清理尚未提交的动画帧。
- Core 将容器测量与视口动画拆为独立 `useCanvasViewport`，`useCanvasInteractions` 只组合并扩展编辑交互。
- Core 连线方向只保留通用端口语义，Web 的 Config 禁连与方向规则通过 `resolveConnection` 策略注入。
- Core 删除图片、文本、配置、视频和音频业务类型枚举，节点类型改为应用字符串，分组能力通过独立 `role: "group"` 表达。
- Core 缩放最小尺寸改为通用可配置参数，Web 显式保留官方节点的 `220×160` 限制。
- Core 删除未参与引擎运算的生成状态类型，加载与成功状态继续由 Web 和 Plugin SDK 定义。
- Agent 连线操作复用 Core 标准化与 Web 注入策略，不再自行拼装连接端点。

### 10.6 扩充 Examples

`apps/examples` 已覆盖以下独立验证场景：

- 节点新增、移动、缩放和删除。
- 连线、框选和撤销重做。
- 自定义节点渲染和 `onDocumentChange` 文档快照回调。
- 两个实例的状态完全隔离。
- 未知节点占位。

Examples 仍只依赖 Core，不接入 Web、Plugin SDK、Cordis 和业务服务。

### 10.7 清理与完成标准

- 删除 Web 中已经迁移的重复逻辑和组件，不保留兼容转发层。
- Core 不得引用 `apps/web`、Ant Design、Zustand、i18n、持久化、AI 或插件系统。
- Core 可以被全新的 React 项目安装并通过公开入口使用。
- 更新 Core README、TODO、Pending Tests 和 `CHANGELOG.md`。

本阶段不处理 Cordis、插件沙箱、AI 任务和项目存储重构；Core 接入完成后再开始替换插件运行时。

### 10.8 完成边界

- Core 已独立拥有文档、选择、历史、视口、剪贴板、几何、主题、基础交互和基础渲染。
- Web 仅保留项目持久化、系统剪贴板媒体导入、AI、素材、Agent、插件适配、节点业务内容和弹窗面板。
- Web 键盘监听继续负责输入区过滤、媒体清理和业务界面关闭，实际快捷键识别与画布命令由 Core 提供。
- `apps/examples` 只依赖 Core，用两块画布覆盖状态隔离和公开 API 组合。
- 后续先按 Pending Tests 人工验收；确认通过后再进入 Cordis 插件运行时阶段。
