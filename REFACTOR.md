# Infinite Canvas 重构架构

> A（basketikun）：拆分 Core。
> B（Soldier）：插件系统设计。
> C（yukkcat）：拆分 Agent Panel。Agent Panel 是可独立运行并可接入画布的 Codex / Claude Code Web UI。
> 三人统一在 `refactor/plugin` 分支协作，不单独创建分支。
> 最终目标：Core 是独立、稳定的画布引擎；Web 是固定功能的画布产品；Desktop 是唯一插件平台；Agent Panel 可独立运行也可嵌入 Web。

现有 Web 节点插件系统整体删除，不保留兼容层、旧 SDK、旧插件格式、旧安装记录或旧节点迁移。新的插件系统以 Cordis 管理生命周期和依赖，仅在 Electron Desktop 中运行。

## 1. 架构结论

项目采用 monorepo，主要由以下部分组成：

- `@basketikun/infinite-canvas`：可独立发布和嵌入的 React 画布引擎。
- `apps/web`：基于 Core 构建的固定功能 AI 创作应用，浏览器模式不加载第三方插件。
- `apps/desktop`：加载 Web 界面并运行 Cordis 插件宿主的 Electron 桌面应用。
- `apps/example`：只引入 Core 的独立演示项目。
- Desktop Plugin SDK：桌面插件 Host/Client 契约，在实现首个真实插件时建立。
- `@basketikun/canvas-agent`：连接网页与本地 Codex / Claude Code、提供 MCP 和本地服务。
- Agent Panel：独立的 Agent 对话 Web UI，通过适配器独立运行或嵌入官方 Web。

Core 只提供画布能力和扩展切入点，不实现插件、业务、持久化或 AI。Web 负责固定产品能力，Desktop 负责插件、原生能力和桌面生命周期，Canvas Agent 负责本地 Agent 协议与进程，Agent Panel 负责通用对话界面。

## 2. Monorepo 结构

```text
infinite-canvas/
├── apps/
│   ├── web/                 # 固定功能的官方 Web 应用
│   ├── desktop/             # Electron 应用与唯一插件宿主
│   ├── docs/                # 文档站
│   └── examples/            # Core 独立示例
├── packages/
│   ├── core/                # @basketikun/infinite-canvas
│   ├── canvas-agent/        # @basketikun/canvas-agent
│   └── agent-panel/         # 可独立运行和嵌入的 Agent Panel
└── plugins/
    ├── desktop/             # 后续 Desktop 插件
    └── infinite-canvas/     # 保留的 Codex App / MCP 插件
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
    Desktop[Electron Desktop] --> Web
    Desktop --> Runtime[Cordis 插件运行时]
    Host[插件 Host] --> Runtime
    Runtime --> IPC[Preload / 类型化 IPC]
    IPC --> Client[插件 Client Contributions]
    Client --> Web
    Client --> Adapter[画布适配]
    Adapter --> Core
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

生成任务属于 Web。无论从创作台还是画布发起生成，都由 Web 创建和跟踪任务；完成后保存结果，再通过 Core 命令更新画布。Core 不认识任务队列和 AI 服务。

浏览器版只使用固定的内置节点定义，不提供插件安装、远程代码执行、动态节点注册、插件私有存储或插件管理界面。Desktop 的 Client contribution 可以在桌面环境中向同一套 Web UI 增加能力，但浏览器独立运行时不会加载这些 contribution。

## 6. Desktop 插件系统重构计划

### 6.1 删除旧系统（已完成）

第一阶段完整删除以下旧实现：

- `packages/plugin-sdk/`。
- `plugins/user/` 与 `plugins/registry/`。
- Web 插件 loader、runtime、store、事件总线、节点上下文、管理弹窗和宿主 Hook。
- Vite 本地插件清单、远程插件注册表环境变量、根目录插件构建脚本和发布流程。
- README、功能文档和页面文案中的 Web 节点插件说明。

`plugins/infinite-canvas/` 是 Codex App / MCP 插件，不属于旧 Web 节点插件系统，必须保留。`apps/web/src/services/api/model-plugin.ts` 是模型自定义请求脚本，也不在本次删除范围内。

### 6.2 Web 收敛（已完成）

删除动态节点 registry 后，Web 只保留文本、图片、视频、音频、生成配置和分组等内置节点。节点标题、尺寸、图标、资源解析和面板配置改为静态定义。旧插件节点数据不迁移，Core 的未知节点占位只负责避免渲染崩溃。

### 6.3 Cordis Desktop Runtime

Electron 主进程创建唯一 Cordis root context。插件运行状态包括 `pending`、`loading`、`active`、`failed` 和 `disposed`；服务依赖通过 `inject` 声明；所有注册和资源都由 `ctx.effect()` 持有并在卸载时逆序释放。插件激活失败必须完整回滚，重复 contribution key 必须直接报错，不能静默覆盖。

Cordis 使用精确版本并只安装在 Desktop。第一版不引入 profile、YAML 配置树、动态代码插件、跨页面审批和复杂隔离域。

### 6.4 插件格式

第一版只支持安装本地插件目录，不支持 URL、CDN、公共市场、自动更新或旧 Web 插件格式。插件通过 `package.json` 声明：

```json
{
  "name": "infinite-canvas-plugin-example",
  "version": "1.0.0",
  "infiniteCanvas": {
    "main": "./dist/main.js",
    "client": "./dist/client.js"
  }
}
```

- `main` 在 Electron 主进程运行，通过 Cordis 注册服务、命令和原生能力。
- `client` 在 Renderer 运行，只能注册明确开放的 UI contribution。
- 安装目录位于 Electron `userData/plugins/`。
- 第一版插件视为用户主动安装的可信本地代码，安装时明确提示其拥有桌面应用访问能力。

### 6.5 Host / Client 通信

Electron preload 使用 `contextBridge` 提供类型化插件接口，Renderer 保持 `nodeIntegration: false`。Host 与 Client 只传输 JSON 数据，每次调用校验插件 ID、方法和归属；插件卸载或 Desktop 退出时取消订阅并释放资源。

### 6.6 第一版扩展点

第一版只实现两个真实扩展点：

- `commands`：桌面菜单、快捷动作和原生操作。
- `canvas.nodes`：仅在 Desktop 中增加高级画布节点。

导航、路由、主题、品牌、认证、设置、权限清单、沙箱和其他 service 不预先实现。后续由首个真实插件需求驱动增加，并保持 Service Definition、Provider、Consumer 三者边界明确。

### 6.7 最小验证插件

新 runtime 完成后只增加一个最小 Desktop 插件，验证 Main 命令、Client 画布节点、Host/Client JSON 调用、启停、卸载、冲突拒绝、错误诊断和资源回收。不恢复旧 Markdown、SVG、HTML、Panorama 插件。

### 6.8 分阶段提交

1. 文档确定 Desktop 唯一插件宿主和删除计划。
2. 删除旧 Web 插件系统、SDK、示例与发布链路。
3. 将 Web 画布改为静态内置节点。
4. 在 Electron 主进程建立 Cordis runtime 和插件状态模型。
5. 定义本地插件发现、安装、启停和卸载。
6. 增加 preload 与类型化 IPC，建立 Host/Client 通信。
7. 实现 `commands`、`canvas.nodes` 和最小验证插件。
8. 更新最终功能文档、待测试事项和变更记录。

每个阶段完成后单独提交 Git。阶段之间不保留旧新两套插件 runtime 并行。

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
| Desktop 插件安装、启停、版本和私有数据 | Electron Desktop |
| Agent 进程、协议事件和本地附件 | Canvas Agent |
| Agent 对话展示状态和宿主引用 | Agent Panel / 宿主适配层 |

Core 不提供持久化。第三方使用方自行选择存储方式；官方 Web 默认使用浏览器本地存储。新的数据结构直接切换，不兼容旧画布数据和旧插件数据。

## 9. 架构约束

- Core 必须能被全新的 React 项目独立安装，不依赖官方 Web。
- Examples 只依赖 Core，不接入 Web、Plugin SDK、Cordis 和业务能力。
- Core 和浏览器 Web 不包含插件 runtime，Desktop 是唯一插件宿主。
- Desktop 插件 Client 通过公开适配层使用 Core，不直接依赖 Core 内部状态。
- Electron 桌面壳复用 Web，不建立独立业务实现。
- Agent Panel 不直接依赖 Web store、画布页面或 Canvas Agent 的 Node 实现。
- Canvas Agent 不渲染 Web UI，Provider 原始协议不泄漏到通用 Panel 组件。
- 插件贡献、导航、主题和节点定义各自只有一个权威来源。
- Cordis 版本精确锁定并集中在 Desktop runtime 内，升级不与业务改动混合。
- 不保留旧 loader、旧 runtime、重复公共类型或兼容层。
- 不预先设计尚无真实需求的扩展点。

## 10. 实施顺序

1. **Monorepo 基座（已完成）**：Web、文档、Core、Canvas Agent 和现有模块已迁入统一 workspace。
2. **Core 拆分与 Web 接入（已完成）**：Core 已独立发布，Examples 和官方 Web 已改用公开 API。
3. **Electron 桌面壳（已完成基础壳）**：先直接加载 Web，桌面原生能力按实际需求增加。
4. **删除旧 Web 插件系统（已完成）**：删除旧 loader、runtime、SDK、示例、注册表和发布链路，并将 Web 收敛为固定内置节点。
5. **建立 Desktop 插件 runtime**：在 Electron 主进程接入 Cordis，并建立 Host/Client 通信。
6. **验证最小 Desktop 插件**：只实现命令和画布节点两个扩展点。
7. **拆分 Agent Panel**：抽离通用 React UI 和宿主适配器，提供独立入口，再由官方 Web 接回同一实现。
8. **扩展真实插件能力**：只按实际 Desktop 插件需求增加 contribution、service、权限或沙箱能力。
