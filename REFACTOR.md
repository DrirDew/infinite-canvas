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
- `apps/example`：只引入 core 的最小演示项目。
- `@infinite-canvas/plugin-sdk`：面向 Web 应用插件的开发契约，不属于 core。

Core 只提供画布能力和扩展切入点，不实现插件、业务、持久化或 AI。Web 负责产品能力，并用 Cordis 管理应用插件。

## 2. Monorepo 结构

```text
infinite-canvas/
├── apps/
│   ├── web/                 # 官方 Web 应用
│   ├── docs/                # 文档站
│   └── example/             # Core 最小演示项目
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

`apps/example` 只依赖 core，用于演示基础画布能力并验证 core 可以脱离官方 Web 独立使用。第三方应用同样可以直接安装 core，并通过公开切入点组合自己的节点和业务；是否建立插件系统由第三方应用自行决定。

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
3. **建立 Example**：新增 `apps/example`，只依赖 `@infinite-canvas/core`，用它验证 Core 的公开入口与多实例隔离。
4. **Web 接回 Core**：Web 通过 Core 公开 API 组合项目、生成任务、素材、Agent 与插件适配，不直接访问 Core 内部 store。
5. **替换插件运行时**：删除旧 loader/runtime 后再接入 Cordis，不保留两套运行时并行。
