# Infinite Canvas 重构架构

> A（basketikun）：拆分 Core。
> B（Soldier）：插件系统设计。
> C（yukkcat）：拆分 Agent Panel。Agent Panel 是可独立运行并可接入画布的 Codex / Claude Code Web UI。
> 三人统一在 `refactor/plugin` 分支协作，不单独创建分支。
> 最终目标：Core 是独立、稳定的画布引擎；Web 是完整产品和唯一插件平台；Agent Panel 可独立运行也可嵌入 Web。

## 1. 架构结论

项目采用 monorepo，主要由以下部分组成：

- `@basketikun/infinite-canvas`：可独立发布和嵌入的 React 画布引擎。
- `apps/web`：基于 Core 构建的完整 AI 创作应用，也是唯一的插件宿主。
- `apps/example`：只引入 Core 的独立演示项目。
- `@basketikun/plugin-sdk`：面向 Web 应用插件的开发契约，不属于 Core。
- `@basketikun/canvas-agent`：连接网页与本地 Codex / Claude Code、提供 MCP 和本地服务。
- Agent Panel：独立的 Agent 对话 Web UI，通过适配器独立运行或嵌入官方 Web。

Core 只提供画布能力和扩展切入点，不实现插件、业务、持久化或 AI。Web 负责产品能力和插件宿主，Canvas Agent 负责本地 Agent 协议与进程，Agent Panel 负责通用对话界面。

## 2. Monorepo 结构

```text
infinite-canvas/
├── apps/
│   ├── web/                 # 官方 Web 应用与插件宿主
│   ├── docs/                # 文档站
│   └── examples/            # Core 独立示例
├── packages/
│   ├── core/                # @basketikun/infinite-canvas
│   ├── plugin-sdk/          # @basketikun/plugin-sdk
│   ├── canvas-agent/        # @basketikun/canvas-agent
│   └── agent-panel/         # 可独立运行和嵌入的 Agent Panel
└── plugins/
    ├── user/                # 插件模板和示例
    └── registry/            # 官方插件清单
```

应用统一放在 `apps/`，可发布模块统一放在 `packages/`。不预先拆分没有真实独立消费需求的 engine、adapter、ui、contracts 等包。

## 3. 系统关系

```mermaid
flowchart LR
    Consumer[第三方 React 应用] --> Core[@basketikun/infinite-canvas]
    Example[Core Example] --> Core
    Web[官方 Web 应用] --> Core
    Web --> Panel[Agent Panel]
    Standalone[独立 Agent 页面] --> Panel
    Panel --> Agent[Canvas Agent]
    Agent --> Codex[Codex / Claude Code]
    Agent --> MCP[Canvas MCP]
    Web --> Runtime[Cordis 插件运行时]
    System[System Plugins] --> Runtime
    User[User Plugins] --> Runtime
    Runtime --> Extensions[应用贡献服务]
    Extensions --> Web
    Extensions --> Adapter[画布适配]
    Adapter --> Core
    SDK[@basketikun/plugin-sdk] --> System
    SDK --> User
```

`apps/example` 只依赖 Core，用于验证 Core 可以脱离官方 Web 独立使用。第三方应用可以直接安装 Core，并在自己的应用层建立不同的插件或 Agent 体系。

## 4. Core 画布引擎（已完成）

Core 已完成独立拆分，负责：

- 画布文档、节点、连线、选择、历史和剪贴板。
- 坐标、视口、平移、缩放、框选、拖动、缩放、分组和连线交互。
- 节点外壳、控制点、连线层、选择框、小地图、未知节点占位和基础主题。
- 实例隔离、公开命令、事件回调、几何函数和宿主策略注入。

Core 不负责插件、AI、Agent、业务持久化、路由、完整工作台 UI 或官方应用服务。后续只维护公共 API、缺陷和真实消费方需要的扩展点，详细使用方式见 `packages/core/README.md`。

## 5. Web 应用

Web 是 Core 的主要消费者，在画布引擎之上增加：

- 项目、素材、提示词和本地持久化。
- 图片、视频、音频和文本生成。
- 生成任务创建、状态维护、轮询、取消和重试。
- 图片与媒体编辑工具。
- Agent、模型配置和 AI 服务调用。
- 页面、导航、设置、主题和完整工作台 UI。
- Cordis 插件运行时、插件安装和插件清单。

生成任务属于 Web。无论从创作台还是画布发起生成，都由 Web 创建和跟踪任务；完成后保存结果，再通过 Core 命令更新画布。Core 不认识任务队列和 AI 服务。

Web 插件产生的节点贡献会转换为 Core 节点定义，画布动作会转换为 Core 命令，插件页面、工具栏和面板仍由 Web 渲染。

## 6. Web 插件系统

### 6.1 统一运行时

Web 只有一套插件系统：

- System Plugin 随应用构建并在启动时加载。
- User Plugin 由用户主动安装。
- 两者使用相同的贡献模型，并由同一个 Cordis runtime 管理生命周期。
- Core 不感知插件，也不依赖 Plugin SDK。

Cordis 负责插件启动、服务依赖、副作用回收和卸载。Web 负责 User Plugin 的下载、缓存、安装确认和版本记录。

### 6.2 第一版信任模型

第一版不实现 iframe、RPC 和权限隔离。System Plugin 与 User Plugin 都在宿主页面执行，可以访问应用状态、本地数据和用户保存的 AI 服务配置。

首次安装和每次手动更新 User Plugin 前必须明确提示其拥有完整应用访问能力。第一版不自动更新插件；开放无需信任即可安装的公共插件市场前，再重新设计沙箱协议，不保留半套兼容层。

### 6.3 应用贡献

| 贡献 | 用途 |
| --- | --- |
| Navigation | 增加、隐藏、替换或重排导航项 |
| Routes | 注册插件页面和工作台 |
| Themes | 注册应用和画布主题 |
| Branding | 修改应用名称、Logo、图标和品牌文案 |
| Commands | 注册可由页面、工具栏或 Agent 调用的动作 |
| AI Config Policies | 限制可用渠道、模型和 Base URL |
| Canvas | 注册节点、工具栏和节点动作 |
| Settings | 注册设置区块 |

UI 扩展走 contribution；认证、存储、同步、3D 等可被其他模块调用的能力走明确命名的 Cordis service，不建立万能 service。

同类普通贡献可以并存。认证、存储和品牌等单实例能力由应用设置选择当前实现，安装插件不得静默替换。AI 配置策略可以并存，配置必须通过全部策略。

### 6.4 App 插件示例

| 插件 | 提供能力 | 主要接入点 |
| --- | --- | --- |
| 用户认证插件 | 登录、会话、用户信息和访问状态 | Auth service、页面、导航、设置 |
| 远程服务插件 | 接入项目、素材、任务或团队服务 | 对应业务 service |
| 渠道限制插件 | 限制 AI 渠道、模型和 Base URL | AI Config Policies |
| 品牌主题插件 | 修改名称、Logo、品牌文案和视觉主题 | Branding、Themes |
| 存储插件 | 切换项目和素材存储位置 | Project Storage、Asset Storage service |
| 3D 全局插件 | 提供共享 3D 场景、资源和 WebGL 工作区 | 3D service、页面、导航、画布节点 |
| 导演工作台插件 | 提供分镜、镜头、生成动作和独立工作台 | 页面、导航、Commands、Canvas |
| 精简导航栏插件 | 隐藏、替换或重排应用入口 | Navigation |

这些示例只确定架构边界。只有开始实现对应插件时，才增加它真正需要的 contribution 或 service。

### 6.5 Plugin SDK

Plugin SDK 提供 Web 插件的 manifest、贡献类型、生命周期约定、UI 挂载入口和构建支持，并复用 Core 的公开画布类型。插件宿主和运行时始终位于 Web，SDK 不反向进入 Core。

## 7. Agent Panel 架构

### 7.1 目标

Agent Panel 是可独立运行并可嵌入 Web 的 React 对话界面，同一套 UI 支持 Codex 和 Claude Code。它不直接依赖画布页面、Web 路由或业务 store。

### 7.2 负责范围

- 线程、消息、流式回复、过程时间线、Markdown、代码块和附件展示。
- 模型、权限、审批、MCP 状态、Skill 和诊断入口。
- 输入框、引用、滚动跟随、加载与错误状态等通用交互。
- 将统一 Agent 协议事件转换为可渲染的消息和进度状态。

### 7.3 宿主适配

Agent Panel 通过适配器获取宿主能力：

- `transport`：连接 Canvas Agent，发送请求并订阅事件。
- `storage`：保存线程选择、界面偏好和必要的消息元数据。
- `references`：提供画布节点、素材或其他宿主资源引用。
- `actions`：请求宿主执行画布操作、打开资源或处理审批。
- `theme`、`locale`：由独立应用或官方 Web 注入主题和语言。

独立运行时使用默认适配器；嵌入 Web 时由 Web 注入画布、素材和业务动作。Panel 不直接导入 Web store，也不直接修改 Core 文档。

### 7.4 Canvas Agent 边界

Canvas Agent 负责本地 HTTP/SSE、Codex/Claude Code 进程、协议归一化、MCP、文件附件和本地持久化；Agent Panel 只消费稳定协议，不包含 Node 服务和 CLI 进程逻辑。

Codex 与 Claude Code 的原始事件在 Canvas Agent 侧转换为统一事件。Provider 特有内容保留在可选扩展字段中，不让 Panel 组件到处分支判断 Provider。

### 7.5 组合方式

- 独立模式：独立入口组合 Agent Panel、默认适配器和 Canvas Agent 连接配置。
- Web 模式：官方 Web 直接组合同一个 Agent Panel，并注入画布引用、画布操作审批、主题和业务面板动作。
- 其他应用：第三方可以只使用 Agent Panel 与 Canvas Agent，不需要安装 Core 或 Web 插件系统。

## 8. 数据归属

| 数据 | 归属 |
| --- | --- |
| 节点、连线和画布结构 | Core Canvas Document |
| 视口和画布编辑状态 | Core 实例或 Web 项目 |
| 项目名称、素材、生成记录和应用设置 | Web |
| 插件安装、启停、版本和私有数据 | Web 插件系统 |
| Agent 进程、协议事件和本地附件 | Canvas Agent |
| Agent 对话展示状态和宿主引用 | Agent Panel / 宿主适配层 |

Core 不提供持久化。第三方使用方自行选择存储方式；官方 Web 默认使用浏览器本地存储。新的数据结构直接切换，不兼容旧画布数据和旧插件数据。

## 9. 架构约束

- Core 必须能被全新的 React 项目独立安装，不依赖官方 Web。
- Examples 只依赖 Core，不接入 Web、Plugin SDK、Cordis 和业务能力。
- Core 不包含应用插件系统，Web 是唯一插件宿主。
- Web 插件通过公开适配层使用 Core，不直接依赖 Core 内部状态。
- Agent Panel 不直接依赖 Web store、画布页面或 Canvas Agent 的 Node 实现。
- Canvas Agent 不渲染 Web UI，Provider 原始协议不泄漏到通用 Panel 组件。
- 插件贡献、导航、主题和节点定义各自只有一个权威来源。
- Cordis 版本精确锁定并集中在 Web runtime 内，升级不与业务改动混合。
- 不保留旧 loader、旧 runtime、重复公共类型或兼容层。
- 不预先设计尚无真实需求的扩展点。

## 10. 实施顺序

1. **Monorepo 基座（已完成）**：Web、文档、Core、Canvas Agent、Plugin SDK 和插件已迁入统一 workspace。
2. **Core 拆分与 Web 接入（已完成）**：Core 已独立发布，Examples 和官方 Web 已改用公开 API。
3. **拆分 Agent Panel**：抽离通用 React UI 和宿主适配器，提供独立入口，再由官方 Web 接回同一实现。
4. **替换插件运行时**：删除旧 loader/runtime 后接入 Cordis，不保留两套运行时并行。
5. **扩展真实插件能力**：只按实际插件需求增加 contribution、service、权限或沙箱能力。
