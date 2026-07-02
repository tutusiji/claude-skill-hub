# Skill Hub 架构设计文档

## 1. 概述

Skill Hub 是一套面向公司内部的 Claude Code 插件分发平台。系统采用**文件管理架构**（非 Git 仓库模式），通过 Web 表单上传插件包，管理员审核后一键上架，前台自动展示。

### 核心流程

```
贡献者 → 表单上传 ZIP → 管理员审核 → 验证通过 → 一键上架 → 前台展示
                                    ↓
                              验证失败/拒绝 → 删除工单
```

### 设计目标

| 目标 | 实现方式 |
|------|----------|
| 零外部依赖 | 文件系统存储 + JSON 数据文件，不需要数据库 |
| 上传即用 | Web 表单上传 ZIP，无需 Git 操作 |
| 质量闸门 | 用户上传前自测 + 管理员审核时验证 |
| 嵌套兼容 | 递归搜索 ZIP 内插件根目录，支持任意层级嵌套 |
| 内网安全 | 密钥扫描 + 无外部网络调用 |

---

## 2. 目录结构

```
claude-skill-hub/
├── plugins/                           # 静态插件目录（随仓库分发）
│   └── code-review-skill/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   └── code-review/
│       │       └── SKILL.md
│       └── commands/
│
├── scripts/
│   ├── validate-plugin.mjs            # 原始验证脚本（CI/本地）
│   └── schemas/
│       ├── marketplace.schema.json
│       └── plugin.schema.json
│
├── web/                               # Next.js Web UI
│   ├── next.config.ts                 # standalone output + bodySizeLimit 50mb
│   ├── package.json
│   ├── tailwind.config.ts             # brand 色板：橙色 #ea9518
│   └── src/
│       ├── app/
│       │   ├── layout.tsx             # 全局布局（header + footer + 暗色/亮色切换）
│       │   ├── page.tsx               # 首页：静态插件 + 动态已发布插件合并展示
│       │   ├── globals.css            # CSS 变量主题
│       │   ├── icon.svg               # 橙色拼图块 favicon
│       │   ├── plugins/[name]/page.tsx  # 插件详情页（SSG + 动态 fallback）
│       │   ├── contribute/page.tsx    # 贡献页面（表单 + 上传前验证 + 教程）
│       │   ├── guide/page.tsx         # 使用指南
│       │   ├── admin/
│       │   │   ├── page.tsx           # 管理后台登录
│       │   │   └── dashboard/page.tsx # 管理后台（提交审核/插件管理/统计数据）
│       │   └── api/
│       │       ├── contribute/route.ts        # 贡献上传 API
│       │       ├── validate/route.ts           # 上传前验证 API
│       │       ├── stats/route.ts              # 公开统计 API
│       │       ├── published-plugins/route.ts  # 已发布插件公开列表
│       │       ├── plugins/[name]/download/route.ts  # 下载追踪
│       │       └── admin/
│       │           ├── login/route.ts
│       │           ├── logout/route.ts
│       │           └── submissions/
│       │               ├── route.ts                    # 提交列表
│       │               └── [id]/
│       │                   ├── route.ts                # 状态更新 + 删除
│       │                   ├── validate/route.ts       # 管理员验证
│       │                   ├── publish/route.ts        # 上架
│       │                   └── download/route.ts       # 下载审核文件
│       ├── components/
│       │   ├── search-bar.tsx
│       │   ├── category-filter.tsx
│       │   ├── plugin-card.tsx
│       │   ├── copy-button.tsx
│       │   ├── copy-button-with-tracking.tsx
│       │   └── error-boundary.tsx
│       └── lib/
│           ├── types.ts               # TypeScript 类型定义
│           ├── registry.json          # 静态插件数据（23 插件）
│           ├── storage.ts             # 核心存储引擎（提交/发布/删除/统计）
│           ├── validator.ts           # 插件验证库（递归 findPluginRoot）
│           ├── published-plugins.ts   # 轻量级已发布插件读取器
│           ├── auth.ts                # Cookie-based 认证
│           └── utils.ts
│
├── docs/
│   └── architecture.md                # 本文档
│
└── package.json
```

### 运行时数据目录

```
/opt/skill-hub/                        # 生产环境数据根目录
├── data/
│   ├── submissions.json               # 提交记录
│   ├── published-plugins.json         # 已发布插件元数据
│   ├── plugin-stats.json              # 下载统计
│   ├── plugin-status.json             # 上下架状态
│   ├── download-log.json              # 下载日志（最近 200 条）
│   ├── plugins/                       # 已发布插件的解压目录
│   │   └── <plugin-name>/
│   │       ├── .claude-plugin/plugin.json
│   │       ├── skills/...
│   │       └── commands/...
│   └── tmp/                           # 解压临时目录（用后即删）
└── uploads/                           # 上传的原始 ZIP/TAR.GZ 文件
    └── <timestamp>-<filename>.zip
```

---

## 3. 核心组件

### 3.1 存储引擎（storage.ts）

文件系统的封装层，管理所有运行时数据。核心函数：

| 函数 | 职责 |
|------|------|
| `createSubmission()` | 保存上传文件到 uploads/，写入 submissions.json |
| `getSubmissions()` | 读取所有提交记录 |
| `getSubmission(id)` | 获取单条提交 |
| `updateSubmissionStatus(id, status)` | 更新提交状态（pending/approved/rejected/published） |
| `publishSubmission(id)` | 解压 ZIP → 递归查找插件根 → 复制到 plugins/ → 写入 published-plugins.json |
| `deleteSubmission(id)` | 删除上传文件 + 提交记录 + 已发布插件（如已上架） |
| `getPublishedPlugins()` | 读取已发布插件列表 |
| `incrementDownload(name)` | 下载计数 + 写日志 |

**ZIP 嵌套目录处理**：`publishSubmission` 调用 `validator.ts` 的 `findPluginRoot()`，递归搜索解压目录中包含 `.claude-plugin/plugin.json` 的子目录。无论 ZIP 内是平铺结构还是多层嵌套（如 `skills-main/skills-main/...`），都能正确定位插件根目录。

### 3.2 验证系统（validator.ts）

四层校验，用户和管理员各一个入口：

```
validator.ts
├── 1. plugin.json schema 校验
│   └── 必填字段 (name, version, description, category)
│   └── 字段格式 (name 小写连字符, version semver, description ≥10 字符)
│
├── 2. 插件结构校验
│   ├── .claude-plugin/plugin.json 存在且 JSON 合法
│   ├── skills/<name>/SKILL.md 存在且有 YAML frontmatter
│   └── commands/<name>.md（可选）
│
├── 3. 一致性检查
│   └── plugin.json name 与目录名一致
│
└── 4. 密钥扫描
    └── 正则匹配 sk-*, AKIA*, ghp_*, RSA/EC PRIVATE KEY
    └── 扫描 .md/.json/.js/.ts/.py/.sh/.yaml/.txt 文件
```

**两个验证入口**：
- `POST /api/validate` — 贡献者上传前自测（FormData 上传文件）
- `GET /api/admin/submissions/[id]/validate` — 管理员审核时验证

**findPluginRoot 递归搜索**：先检查当前目录是否有 `.claude-plugin/plugin.json`，没有则递归遍历所有子目录（跳过 `.` 开头和 `node_modules`），支持 ZIP 内任意深度的嵌套目录结构。

### 3.3 认证系统（auth.ts）

Cookie-based token 认证（非 JWT 库，自实现）：

- `login(username, password)` → 生成 base64 编码的 token（含过期时间），设置 HttpOnly cookie
- `verifyAuth()` → 从 cookie 读取 token，验证未过期
- 管理员凭据通过环境变量配置

### 3.4 Web UI 层

#### 技术栈

- **框架**: Next.js 15 (App Router, standalone output)
- **样式**: Tailwind CSS + CSS 变量（暗色/亮色主题）
- **主题色**: 橙色 `#ea9518`（brand 色板）
- **图标**: lucide-react
- **部署**: systemd + nginx 反代（非 Docker）

#### 页面架构

```
layout.tsx (全局布局: header + footer + 主题切换)
├── page.tsx (首页 — 客户端组件)
│   ├── 静态 registry.json 插件 (23 个)
│   ├── 动态 published-plugins.json 插件 (管理员上架)
│   ├── SearchBar + CategoryFilter
│   └── PluginCard[] (下载量 TOP 3 显示 Flame 图标)
│
├── plugins/[name]/page.tsx (详情页 — 服务端组件)
│   ├── SSG 预渲染静态插件 (generateStaticParams)
│   ├── dynamicParams=true → 动态已发布插件 SSR 按需渲染
│   └── CopyButtonWithTracking (复制安装命令 + 下载追踪)
│
├── contribute/page.tsx (贡献页面)
│   ├── 四步教程（创建目录 → plugin.json → SKILL.md → 打包上传）
│   ├── 上传前验证按钮（实时显示错误/警告/概要）
│   └── 提交表单（姓名/工号/邮箱/部门/描述/文件）
│
└── admin/dashboard/page.tsx (管理后台)
    ├── 提交审核 Tab
    │   ├── 每条提交：下载审核 / 验证 / 上架 / 通过 / 拒绝 / 删除
    │   └── 验证结果展开：错误列表 + 警告列表 + 插件元信息
    ├── 插件管理 Tab（上下架）
    └── 统计数据 Tab（总插件/技能/分类/贡献者/下载量）
```

#### 静态 + 动态插件合并展示

首页 mount 时 fetch `/api/published-plugins`，将动态插件合并到静态 `registry.json` 插件列表中。搜索、分类筛选、下载量排序均在前端 `useMemo` 中完成。

插件详情页设置 `dynamicParams = true`，SSG 插件走预渲染，动态上架的插件走 SSR 按需渲染。

---

## 4. 数据流

### 4.1 贡献者提交流程

```
贡献者                           Web UI                        后端
  │                               │                              │
  │  1. 填写表单 + 选择 ZIP        │                              │
  │  2. 点击"上传前验证" ─────────→│ POST /api/validate           │
  │                               │   → 解压到临时目录            │
  │                               │   → findPluginRoot 递归查找  │
  │                               │   → 四层校验                  │
  │  3. 查看验证结果 ←─────────────│ ← { passed, errors, ... }   │
  │                               │                              │
  │  4. 点击"提交审核" ───────────→│ POST /api/contribute         │
  │                               │   → 保存文件到 uploads/       │
  │                               │   → 写入 submissions.json     │
  │  5. 收到成功确认 ←─────────────│ ← { success, id }           │
```

### 4.2 管理员审核上架流程

```
管理员                          Dashboard                      后端
  │                               │                              │
  │  1. 登录管理后台              │                              │
  │  2. 查看提交列表              │                              │
  │  3. 点击"验证" ──────────────→│ GET /api/.../validate        │
  │  4. 查看验证结果              │   → 四层校验                  │
  │     ✓ 通过 → "上架"按钮出现   │                              │
  │     ✗ 失败 → 显示错误列表     │                              │
  │                               │                              │
  │  5. 点击"上架" ──────────────→│ POST /api/.../publish        │
  │                               │   → 解压 ZIP                 │
  │                               │   → findPluginRoot 递归查找  │
  │                               │   → 复制到 data/plugins/     │
  │                               │   → 写入 published-plugins.json
  │                               │   → 状态改为 published       │
  │  6. 前台立即可见 ←────────────│                              │
```

### 4.3 用户浏览安装流程

```
用户 (浏览器)                    Web UI
  │                               │
  │  1. 访问首页                  │
  │     → 静态插件 + 动态已发布插件合并展示
  │     → 搜索/分类筛选           │
  │                               │
  │  2. 点击插件卡片              │
  │     → /plugins/[name]         │
  │     → SSG 预渲染 or SSR 动态  │
  │                               │
  │  3. 复制安装命令              │
  │     → POST /api/.../download  │
  │     → 下载计数 +1             │
  │                               │
  │  4. 下载 ZIP 包安装            │
  │     插件包: ~/.claude/plugins/ │
  │     纯技能: ~/.claude/skills/  │
```

---

## 5. 安装方式

### 插件包（有 `.claude-plugin/plugin.json`）

```bash
# 1. 从平台下载 ZIP 包
# 2. 解压到 Claude Code 插件目录
unzip <plugin-name>.zip -d ~/.claude/plugins/
# 3. 重启 Claude Code 即可使用
```

### 纯技能包（仅 `skills/` 目录，如 Anthropic 官方 skills-main）

```bash
# 1. 从平台下载 ZIP 包
# 2. 解压后将 skills 目录内容复制到 Claude Code 技能目录
unzip <skill-pack>.zip -d /tmp/<skill-pack>
cp -r /tmp/<skill-pack>/skills/* ~/.claude/skills/
# 3. 重启 Claude Code 即可使用
```

> **注意**：旧版基于 Git marketplace 的安装方式 (`claude plugin marketplace add <git-url>`) 已废弃。
> 当前平台采用文件上传 + 审核上架模式，通过下载 ZIP 包进行安装。

---

## 6. 安全设计

### 5.1 密钥防护

| 层 | 机制 | 位置 |
|----|------|------|
| 贡献者 | 上传前验证按钮 | 提交前 |
| 管理员 | 审核时验证 | 上架前 |

扫描模式：API key 前缀 (sk-, AKIA, ghp_, gho_, ghs_)、RSA/EC 私钥头、高熵密码字符串。

### 5.2 访问控制

- 管理后台需登录（Cookie-based token 认证）
- 上传文件大小限制 50MB（next.config.ts `serverActions.bodySizeLimit`）
- 上传文件名重命名为 `<timestamp>-<original-name>` 防路径冲突
- 管理端 API 均校验 `verifyAuth()`

### 5.3 插件安全约束

- 禁止包含硬编码密钥/令牌/凭证
- 禁止外部网络调用（除非有文档说明）
- 禁止文件系统操作超出项目范围
- 所有插件仅限内部使用

---

## 6. 部署架构

### 6.1 生产部署（systemd + nginx）

```
浏览器 → nginx (HTTPS :7504) → Next.js standalone (:7788)
                                        │
                                        ├── /opt/skill-hub/data/     (数据目录)
                                        └── /opt/skill-hub/uploads/  (上传目录)
```

- **systemd 服务**: `skill-hub.service`，运行 `node .next/standalone/server.js`
- **nginx**: `/etc/nginx/conf.d/skill-hub-7504.conf`，SSL 证书 `/etc/nginx/ssl/joox.cc.pem`
- **环境变量**: `DATA_DIR=/opt/skill-hub/data`、`UPLOAD_DIR=/opt/skill-hub/uploads`

### 6.2 构建部署流程

```bash
cd web
npm run build
cp -r .next/static .next/standalone/.next/static   # standalone 必须手动复制 static
sudo systemctl restart skill-hub.service
```

⚠️ **不要在 production .next 目录上运行 `npm run dev`** — 会覆盖构建产物导致 JS chunk 404。

---

## 7. 关键文件索引

| 文件 | 职责 |
|------|------|
| [web/src/lib/storage.ts](../web/src/lib/storage.ts) | 核心存储引擎：提交/发布/删除/统计 |
| [web/src/lib/validator.ts](../web/src/lib/validator.ts) | 插件验证库：schema + 结构 + 密钥扫描 + 递归 findPluginRoot |
| [web/src/lib/published-plugins.ts](../web/src/lib/published-plugins.ts) | 轻量级已发布插件读取器（服务端组件安全使用） |
| [web/src/lib/auth.ts](../web/src/lib/auth.ts) | Cookie-based token 认证 |
| [web/src/lib/types.ts](../web/src/lib/types.ts) | TypeScript 类型定义 |
| [web/src/lib/registry.json](../web/src/lib/registry.json) | 静态插件数据（23 插件，42 技能） |
| [web/src/app/page.tsx](../web/src/app/page.tsx) | 首页：静态 + 动态插件合并展示 |
| [web/src/app/plugins/[name]/page.tsx](../web/src/app/plugins/[name]/page.tsx) | 插件详情页（SSG + 动态 fallback） |
| [web/src/app/contribute/page.tsx](../web/src/app/contribute/page.tsx) | 贡献页面（表单 + 验证 + 教程） |
| [web/src/app/admin/dashboard/page.tsx](../web/src/app/admin/dashboard/page.tsx) | 管理后台 Dashboard |
| [web/src/app/api/contribute/route.ts](../web/src/app/api/contribute/route.ts) | 贡献上传 API |
| [web/src/app/api/validate/route.ts](../web/src/app/api/validate/route.ts) | 上传前验证 API |
| [web/src/app/api/admin/submissions/[id]/publish/route.ts](../web/src/app/api/admin/submissions/[id]/publish/route.ts) | 上架 API |
| [web/next.config.ts](../web/next.config.ts) | standalone output + 50MB bodySizeLimit |
| [web/tailwind.config.ts](../web/tailwind.config.ts) | brand 橙色色板 |
