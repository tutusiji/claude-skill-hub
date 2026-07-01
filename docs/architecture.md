# Skill Hub 架构设计文档

## 1. 概述

Skill Hub 是一套面向公司内部的 Claude Code 插件分发平台。它由三个核心层组成：

- **Marketplace 仓库层** — 遵循 Claude Code 原生 `marketplace.json` 规范的 Git 仓库，是插件存储和分发的唯一数据源 (single source of truth)。
- **Web UI 层** — Next.js 应用，从 marketplace 仓库生成 registry 数据，提供浏览、搜索、详情查看和安装命令复制。
- **CI/CD 层** — GitHub Actions 流水线，负责 PR 验证、密钥扫描、registry 生成和 Web UI 自动部署。

此外还有一个横切关注点：**贡献审核流程**，通过 CI 闸门 + 人工 review 保障插件质量。

### 设计目标

| 目标 | 实现方式 |
|------|----------|
| 零外部依赖 | Web UI 读静态 registry.json，不需要数据库或搜索引擎 |
| Claude Code 原生兼容 | marketplace.json 遵循 Anthropic 官方 schema，`/plugin marketplace add` 直接接入 |
| 贡献有闸门 | CI 自动校验 schema、结构、密钥，人工 review 才能合并 |
| 百人团队可扩展 | 纯 Git 仓库 + 静态前端，无状态瓶颈 |
| 内网安全 | 密钥扫描 + 无外部网络调用 + UNLICENSED |

---

## 2. 目录结构

```
claude-skill-hub/
├── .claude-plugin/
│   └── marketplace.json              # Claude Code marketplace 入口（唯一数据源）
│
├── plugins/                           # 所有插件目录
│   └── code-review-skill/             # 示例插件
│       ├── .claude-plugin/
│       │   └── plugin.json            # 插件清单（name, version, description, category）
│       ├── skills/
│       │   └── code-review/
│       │       └── SKILL.md           # Skill 定义（YAML frontmatter + Markdown 指令）
│       └── commands/                  # 可选：slash 命令
│
├── scripts/
│   ├── validate-plugin.mjs            # CI 和本地验证脚本
│   ├── generate-registry.mjs          # 从 marketplace.json 生成 Web UI 数据
│   └── schemas/
│       ├── marketplace.schema.json    # marketplace.json 的 JSON Schema
│       └── plugin.schema.json         # plugin.json 的 JSON Schema
│
├── web/                               # Next.js Web UI
│   ├── Dockerfile                     # 生产部署镜像
│   ├── next.config.ts                 # standalone output 模式
│   ├── package.json
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx             # 全局布局（header + footer）
│       │   ├── page.tsx               # 首页：浏览 + 搜索 + 分类筛选
│       │   ├── globals.css            # 暗色主题 CSS 变量
│       │   ├── plugins/[name]/page.tsx  # 插件详情页
│       │   └── contribute/page.tsx    # 贡献指南页
│       ├── components/
│       │   ├── search-bar.tsx         # 搜索输入框
│       │   ├── category-filter.tsx    # 分类筛选标签组
│       │   ├── plugin-card.tsx        # 插件卡片
│       │   └── copy-button.tsx        # 一键复制安装命令
│       └── lib/
│           ├── types.ts               # TypeScript 类型定义
│           ├── utils.ts               # cn() 类名合并工具
│           └── registry.json          # 生成产物，Web UI 的数据源
│
├── .github/workflows/
│   ├── validate-pr.yml                # PR 验证流水线
│   └── deploy-web.yml                 # Web UI 构建部署流水线
│
├── docs/
│   └── architecture.md                # 本文档
│
├── CONTRIBUTING.md                    # 贡献指南
├── README.md                          # 项目说明
└── package.json                       # 根 package.json（validate + generate-registry 脚本）
```

---

## 3. 核心组件

### 3.1 Marketplace 仓库层

#### marketplace.json

位于 `.claude-plugin/marketplace.json`，是整个系统的唯一数据源。Claude Code CLI 通过 `/plugin marketplace add <org>/<repo>` 读取此文件来注册 marketplace。

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "internal-skill-hub",
  "version": "1.0.0",
  "owner": { "name": "...", "email": "..." },
  "metadata": { "description": "...", "version": "1.0.0" },
  "plugins": [
    {
      "name": "code-review-skill",
      "description": "...",
      "source": "./plugins/code-review-skill",
      "version": "1.0.0",
      "category": "developer-tools",
      "keywords": ["code-review", "security"]
    }
  ]
}
```

关键字段：
- `name` — marketplace 标识符，安装时用 `@internal-skill-hub` 引用
- `plugins[].source` — 相对于仓库根目录的插件路径，必须以 `./` 开头
- `plugins[].category` — 用于 Web UI 分类筛选

#### 插件结构

每个插件是 `plugins/` 下的一个目录，包含：

| 文件/目录 | 必需 | 说明 |
|-----------|------|------|
| `.claude-plugin/plugin.json` | 是 | 插件清单，定义 name/version/description/category |
| `skills/<skill-name>/SKILL.md` | 是 | Skill 定义，YAML frontmatter (name, description) + Markdown 指令体 |
| `commands/<cmd-name>.md` | 否 | Slash 命令定义 |

plugin.json 的 `name` 必须与目录名一致，且为 lowercase hyphen-case。

SKILL.md 的 frontmatter `description` 是 Claude Code 触发 skill 的主要依据，需明确描述做什么和何时使用。

### 3.2 验证脚本层

#### validate-plugin.mjs

CI 和本地共用的验证脚本，执行四类检查：

```
validate-plugin.mjs
├── 1. marketplace.json schema 校验
│   └── 必填字段 (name, version, owner, plugins)
│   └── 字段类型和格式 (version 匹配 semver)
│
├── 2. 插件结构校验（遍历 marketplace.json 中每个 plugin entry）
│   ├── plugin.json 存在且 JSON 合法
│   ├── plugin.json schema 校验
│   ├── manifest name 与目录名一致
│   └── SKILL.md 存在且有 YAML frontmatter
│
├── 3. 双向一致性检查
│   ├── marketplace.json 中引用的 source 路径必须存在
│   └── 磁盘上的插件目录必须在 marketplace.json 中注册（warning）
│
└── 4. 密钥扫描
    └── 正则匹配 sk-*, AKIA*, ghp_*, RSA PRIVATE KEY 等
    └── 扫描 .md/.json/.js/.ts/.py/.sh/.yaml/.txt 文件
```

退出码：0 = 通过，1 = 有 error。warning 不阻断。

#### generate-registry.mjs

从 marketplace.json + 插件目录生成 `web/src/lib/registry.json`，作为 Web UI 的静态数据源。

数据流：
```
marketplace.json          插件目录
     │                       │
     └───────┬───────────────┘
             │
    generate-registry.mjs
             │
     ┌───────┴───────────┐
     │  遍历 plugins[]    │
     │  读取 plugin.json  │
     │  收集 skills[]     │
     │  收集 commands[]   │
     └───────┬───────────┘
             │
    registry.json
    (Web UI 数据源)
```

registry.json 的每条记录合并了 marketplace.json entry 和 plugin.json manifest，并附带从 SKILL.md frontmatter 解析的 skills 列表和从 commands/ 目录收集的命令列表。

### 3.3 Web UI 层

#### 技术栈

- **框架**: Next.js 15 (App Router, standalone output)
- **样式**: Tailwind CSS + CSS 变量（暗色主题）
- **图标**: lucide-react
- **数据**: 静态 registry.json，构建时注入，无需运行时数据库
- **部署**: Docker (standalone 模式)

#### 页面架构

```
layout.tsx (全局布局: header + footer)
├── page.tsx (首页 — 客户端组件)
│   ├── SearchBar          # 全文搜索
│   ├── CategoryFilter     # 分类标签筛选
│   └── PluginCard[]       # 插件卡片网格
│
├── plugins/[name]/page.tsx (详情页 — 服务端组件, SSG)
│   ├── 插件元信息展示
│   ├── CopyButton         # 复制安装命令
│   ├── Skills 列表
│   └── Commands 列表
│
└── contribute/page.tsx (贡献指南 — 静态页面)
    └── 四步引导 + 审核标准
```

#### 客户端 vs 服务端组件划分

| 组件 | 渲染模式 | 原因 |
|------|----------|------|
| `page.tsx` (首页) | Client | 需要搜索/筛选的交互状态 |
| `plugins/[name]/page.tsx` | Server (SSG) | 静态内容，构建时预渲染 |
| `contribute/page.tsx` | Server | 纯静态内容 |
| `search-bar.tsx` | Client | 受控输入 |
| `category-filter.tsx` | Client | 点击交互 |
| `copy-button.tsx` | Client | clipboard API |
| `plugin-card.tsx` | Server | 纯展示，无交互状态 |

#### 数据流

```
registry.json (构建时生成)
      │
      ▼
  page.tsx
  ├── 导入 registry.json → plugins[]
  ├── useMemo 计算 allCategories
  ├── useMemo 计算 categoryCounts
  └── useMemo 根据 query + category 过滤
      │
      ▼
  PluginCard 渲染
  └── 点击 → 跳转 /plugins/[name]
              └── generateStaticParams 预渲染所有插件详情页
```

#### 搜索实现

纯前端内存搜索，无后端依赖。搜索范围覆盖：
- 插件名称 (name)
- 插件描述 (description)
- 关键词 (keywords[])
- Skill 名称和描述 (skills[].name, skills[].description)

搜索 + 分类筛选可叠加，均为 client-side `useMemo` 过滤。

#### 主题系统

使用 CSS 变量定义暗色主题，在 `globals.css` 中声明：

```css
:root {
  --background: #0f1117;
  --foreground: #e4e4e7;
  --card: #1a1a24;
  --border: #2a2a3a;
  --muted: #71717a;
}
```

Tailwind 通过 `tailwind.config.ts` 的 `brand` 色板扩展，用于强调色（搜索框聚焦、选中状态、安装命令高亮）。

### 3.4 CI/CD 层

#### validate-pr.yml（PR 验证）

触发条件：PR 修改了 `plugins/**`、`.claude-plugin/marketplace.json` 或 `scripts/**`。

```
checkout → setup-node → validate-plugin.mjs → generate-registry.mjs
    │
    ├── 检查新增插件是否已注册到 marketplace.json
    │   (git diff 提取变更的插件目录名 → 查 marketplace.json)
    │
    └── grep 密钥扫描（CI 层二次检查，不依赖脚本）
```

任何步骤失败都会阻断 PR 合并。

#### deploy-web.yml（Web UI 部署）

触发条件：push 到 main 分支且修改了 marketplace.json、plugins/ 或 web/。

```
checkout → setup-node → generate-registry.mjs → npm ci → npm run build
    │
    ├── docker build (standalone 模式)
    │
    └── deploy (TODO: 推送内部 registry + 重启服务)
```

部署部分是模板代码，需要根据实际内部基础设施填写（Docker registry 地址、部署服务器、SSH 命令等）。

---

## 4. 数据流全景

### 4.1 贡献者提交流程

```
贡献者                          Git 仓库                        CI
  │                               │                              │
  │  1. 创建 plugins/my-plugin/   │                              │
  │  2. 写 plugin.json + SKILL.md │                              │
  │  3. node validate-plugin.mjs  │                              │
  │  4. 注册到 marketplace.json   │                              │
  │  5. git push + 开 PR ─────────│─────────────────────────────→│
  │                               │                              │
  │                               │                   6. CI 跑 validate-pr.yml
  │                               │                      ├── schema 校验
  │                               │                      ├── 结构检查
  │                               │                      ├── 密钥扫描
  │                               │                      └── 注册检查
  │                               │                              │
  │  7. CI 通过 ←────────────────│─────────────────────────────│
  │                               │                              │
  │  8. 平台团队 review           │                              │
  │  9. 合并到 main ─────────────→│                              │
  │                               │                   10. 触发 deploy-web.yml
  │                               │                       ├── generate-registry
  │                               │                       ├── build Next.js
  │                               │                       └── deploy Docker
  │                               │                              │
  │                               │              11. Web UI 更新，新插件可见
```

### 4.2 用户安装流程

```
用户 (Claude Code CLI)
  │
  │  1. /plugin marketplace add <org>/claude-skill-hub
  │     → CLI 拉取仓库，读取 .claude-plugin/marketplace.json
  │     → marketplace 注册为 "internal-skill-hub"
  │
  │  2. /plugin install my-plugin@internal-skill-hub
  │     → CLI 从 source 路径拉取插件文件
  │     → 安装到 ~/.claude/plugins/
  │
  │  3. 插件的 skills 自动被 Claude Code 发现和触发
```

### 4.3 Web UI 数据流

```
marketplace.json + plugins/
        │
        │ generate-registry.mjs (构建时)
        ▼
  registry.json (静态文件)
        │
        │ Next.js import (构建时)
        ▼
   page.tsx (客户端)
   ├── 搜索/筛选 (useMemo, 内存中)
   └── PluginCard 渲染
        │
        │ 用户点击
        ▼
   /plugins/[name] (SSG 预渲染)
   └── generateStaticParams → 每个插件一个静态 HTML
```

整个 Web UI 没有运行时数据获取，所有数据在构建时注入。这意味着 Web UI 内容更新 = 重新构建（由 deploy-web.yml 自动完成）。

---

## 5. 安全设计

### 5.1 密钥防护（双重检查）

| 层 | 机制 | 位置 |
|----|------|------|
| 本地 | `validate-plugin.mjs` 的 `checkSecrets()` | 贡献者提交前 |
| CI | `validate-pr.yml` 的 grep 扫描 | PR 合并前 |

扫描模式：API key 前缀 (sk-, AKIA, ghp_)、RSA/EC 私钥头、高熵密码字符串。

### 5.2 插件安全约束

通过 CONTRIBUTING.md 和 review 流程约定：
- 禁止外部网络调用（除非有文档说明）
- 禁止文件系统操作超出项目范围
- 禁止 `eval()` 或动态代码执行
- 所有插件 UNLICENSED，仅限内部使用

### 5.3 访问控制

- Git 仓库设为私有，仅内部员工可访问
- Claude Code 的 `/plugin marketplace add` 需要仓库读权限
- Web UI 部署在内网，通过内网网关控制访问
- 合并权限通过 CODEOWNERS + branch protection 控制

---

## 6. 扩展性考量

### 6.1 当前方案的限制

| 限制 | 影响 | 缓解方式 |
|------|------|----------|
| 搜索是前端内存 | 插件数量 >500 时首屏加载变慢 | 迁移到 Meilisearch / Algolia |
| registry.json 构建时生成 | Web UI 更新有部署延迟 | 加 webhook + 增量重建 |
| 无用户系统 | 无法跟踪谁安装了什么 | 接入内部 SSO + 安装统计 |
| 无版本历史 | 插件更新后旧版本不可用 | marketplace.json 支持多版本 source |

### 6.2 扩展路径

**搜索增强**: 当插件数量增长到数百级别时，可参考 buildwithclaude 项目引入 Meilisearch 做后端搜索。registry.json 仍作为数据源，但搜索请求走 Meilisearch API。

**安装统计**: 在 `/plugin install` 命令外包裹一层内部 CLI 工具，记录安装事件到内部数据库，Web UI 增加下载量展示。

**多版本支持**: marketplace.json 的 `source` 字段可指向不同 Git ref 或子目录，实现同一名多版本共存。

**审核工作流增强**: 引入标签系统（pending-review / approved / changes-requested），通过 GitHub Labels 管理审核状态，CI 根据标签决定是否允许合并。

---

## 7. 技术选型理由

### 为什么用 marketplace.json 而不是自建 registry API

Claude Code 原生支持 `/plugin marketplace add <git-repo>`，它读取 `.claude-plugin/marketplace.json`。这是 Anthropic 官方规范的分发通道。自建 API 需要额外维护服务、认证、可用性，而 Git 仓库天然解决版本控制、权限管理、变更追溯。百人团队的规模下，一个 Git 仓库完全够用。

### 为什么 Web UI 读静态 registry.json 而不是实时读 Git

实时读 Git API 有延迟、有 rate limit、有可用性风险。registry.json 在构建时生成并注入到前端 bundle 中，Web UI 变成纯静态应用，部署简单、访问快。代价是更新有部署延迟（从合并到部署通常 1-2 分钟），对内部工具场景完全可接受。

### 为什么用 Next.js 而不是纯 React SPA

- SSG 预渲染插件详情页，SEO 友好（内网搜索可索引）
- standalone output 模式产出的 Docker 镜像很小（不含 node_modules）
- App Router 的 server/client 组件划分让交互页面和静态页面各得其所
- 与 Claude Code 生态中的 buildwithclaude 等项目技术栈一致，便于参考

### 为什么验证脚本用 Node.js ESM 而不是 Python

CI 环境已经需要 Node.js（Next.js 构建），用 Node.js 写验证脚本不需要额外安装 Python 运行时。ESM 模块语法清晰，且 generate-registry.mjs 需要处理 JSON 和文件系统，Node.js 的 `fs` 模块天然适合。

---

## 8. 关键文件索引

| 文件 | 职责 |
|------|------|
| [.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json) | Marketplace 入口，Claude Code 读取的唯一配置 |
| [plugins/code-review-skill/](../plugins/code-review-skill/) | 示例插件，展示标准插件结构 |
| [scripts/validate-plugin.mjs](../scripts/validate-plugin.mjs) | 验证脚本，CI 和本地共用 |
| [scripts/generate-registry.mjs](../scripts/generate-registry.mjs) | Registry 生成器，marketplace.json → registry.json |
| [scripts/schemas/marketplace.schema.json](../scripts/schemas/marketplace.schema.json) | marketplace.json 的 JSON Schema |
| [scripts/schemas/plugin.schema.json](../scripts/schemas/plugin.schema.json) | plugin.json 的 JSON Schema |
| [web/src/app/page.tsx](../web/src/app/page.tsx) | 首页，浏览 + 搜索 + 筛选 |
| [web/src/app/plugins/[name]/page.tsx](../web/src/app/plugins/[name]/page.tsx) | 插件详情页 |
| [web/src/app/contribute/page.tsx](../web/src/app/contribute/page.tsx) | 贡献指南页 |
| [web/src/lib/types.ts](../web/src/lib/types.ts) | TypeScript 类型定义 |
| [web/src/lib/registry.json](../web/src/lib/registry.json) | 生成产物，Web UI 数据源 |
| [.github/workflows/validate-pr.yml](../.github/workflows/validate-pr.yml) | PR 验证流水线 |
| [.github/workflows/deploy-web.yml](../.github/workflows/deploy-web.yml) | Web UI 构建部署流水线 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献者指南 |
