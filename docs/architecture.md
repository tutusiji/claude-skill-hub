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

### 添加 Marketplace

```bash
# 内网环境添加 Skill Hub marketplace
claude plugin marketplace add http://10.9.43.61:7789/skill-hub.git
```

### 安装插件

```bash
# 通过 marketplace 安装（推荐）
claude plugin install <plugin-name>@internal-skill-hub
```

### 离线安装（下载 ZIP）

```bash
# 插件包（有 .claude-plugin/plugin.json）
unzip <name>.zip -d ~/.claude/plugins/

# 纯技能包（仅 skills/ 目录）
unzip <name>.zip -d /tmp/<name> && cp -r /tmp/<name>/skills/* ~/.claude/skills/
```

> **架构说明**：marketplace 由 `git-server` 容器提供（lighttpd + git-http-backend，Git smart HTTP 协议）。更新插件后执行 `git push internal main` 同步到 bare 仓库（`git-data` volume），用户即装即得。详见 [deploy.md](deploy.md)。

---

## 6. 安全设计

### 6.1 密钥防护

| 层 | 机制 | 位置 |
|----|------|------|
| 贡献者 | 上传前验证按钮 | 提交前 |
| 管理员 | 审核时验证 | 上架前 |

扫描模式：API key 前缀 (sk-, AKIA, ghp_, gho_, ghs_)、RSA/EC 私钥头、高熵密码字符串。

### 6.2 访问控制

- 管理后台需登录（Cookie + **HMAC 签名 token**，密钥取 `AUTH_SECRET`，回退 `ADMIN_PASSWORD`）
- **必须设置 `ADMIN_PASSWORD` 环境变量**，未配置时登录禁用
- 登录限流：5 次失败后锁定 5 分钟（内存级，按 IP/username）
- 上传大小限制 50MB（systemd+nginx 部署由 `client_max_body_size` 兜底；Docker Compose 无反向代理，需应用层校验）
- 上传文件名重命名为 `<timestamp>-<original-name>` 防路径冲突
- 管理端 API 均校验 `verifyAuth()`
- 插件名校验防路径穿越（`getPluginDir` 拒绝 `..`/`/`/`\`，避免越权访问非插件目录）

### 6.3 插件安全约束

- 禁止包含硬编码密钥/令牌/凭证
- 禁止外部网络调用（除非有文档说明）
- 禁止文件系统操作超出项目范围
- 所有插件仅限内部使用

---

## 7. 部署架构

### 7.1 Docker Compose 部署（推荐）

两个容器，一键启动（完整步骤见 [deploy.md](deploy.md)）：

```
docker compose up -d
        │
        ├── web         :7788 → 容器:3000   Web UI（Next.js standalone）
        └── git-server  :7789 → 容器:7789   Git HTTP Server（lighttpd + git-http-backend）
```

- **web** — Web UI + API（浏览/搜索/上传/管理后台）。`DATA_DIR`/`UPLOAD_DIR` 在容器内，建议挂载 volume 持久化
- **git-server** — 给 Claude Code 用的 Git smart HTTP 服务，`claude plugin install` 时 git clone 此仓库；bare 仓库存于 `git-data` volume

### 7.2 关键环境变量（web 容器）

| 变量 | 作用 | 默认 |
|------|------|------|
| `DATA_DIR` | 运行时数据目录（submissions/published/stats） | `./data` |
| `UPLOAD_DIR` | 上传文件目录 | `./uploads` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码（**必填**，否则登录禁用） | — |
| `AUTH_SECRET` | token 签名密钥（可选，默认复用 `ADMIN_PASSWORD`） | — |
| `SYNC_SCRIPT_PATH` | 发布/删除/编辑时调用的同步脚本 | `/root/projects/claude-skill-hub/scripts/sync-marketplace.sh` |
| `NEXT_PUBLIC_MARKETPLACE_URL` | 详情页显示的 marketplace URL | `http://10.9.43.61:7789/skill-hub.git` |

> **关于同步脚本**：`sync-marketplace.sh` 默认指向 systemd+nginx 部署的 `/opt/skill-hub` 布局。Docker Compose 部署下，git marketplace 通过 `git push internal main` 更新（见 deploy.md「更新插件后重新部署」）；如需发布动态插件时自动同步到 git-server 容器，改写该脚本并通过 `SYNC_SCRIPT_PATH` 指定。

### 7.3 更新流程

```bash
# 1. 推送代码到内部 git 仓库（git-server 提供）
git push internal main

# 2. 重建 Web UI（插件展示更新）
docker compose up -d --build web
```

### 7.4 旧式 systemd + nginx 部署（可选）

如不使用 Docker Compose，也可用 systemd + nginx 直跑 standalone 构建：nginx 反代到 Next.js standalone（:7788），配置模板见 `deploy/nginx-*.conf`（含 `client_max_body_size 50m`）。此模式下 `SYNC_SCRIPT_PATH` 默认路径生效，发布动态插件时自动同步到 bare 仓库。

---

## 8. 关键文件索引

| 文件 | 职责 |
|------|------|
| [web/src/lib/storage.ts](../web/src/lib/storage.ts) | 核心存储引擎：提交/发布/删除/统计 |
| [web/src/lib/validator.ts](../web/src/lib/validator.ts) | 插件验证库：schema + 结构 + 密钥扫描 + 递归 findPluginRoot |
| [web/src/lib/published-plugins.ts](../web/src/lib/published-plugins.ts) | 轻量级已发布插件读取器（服务端组件安全使用） |
| [web/src/lib/auth.ts](../web/src/lib/auth.ts) | Cookie + HMAC token 认证 + 登录限流 |
| [web/src/lib/types.ts](../web/src/lib/types.ts) | TypeScript 类型定义 |
| [web/src/lib/registry.json](../web/src/lib/registry.json) | 静态插件数据（23 插件，42 技能） |
| [web/src/app/page.tsx](../web/src/app/page.tsx) | 首页：静态 + 动态插件合并展示 |
| [web/src/app/plugins/[name]/page.tsx](../web/src/app/plugins/[name]/page.tsx) | 插件详情页（SSG + 动态 fallback） |
| [web/src/app/contribute/page.tsx](../web/src/app/contribute/page.tsx) | 贡献页面（表单 + 验证 + 教程） |
| [web/src/app/admin/dashboard/page.tsx](../web/src/app/admin/dashboard/page.tsx) | 管理后台 Dashboard |
| [web/src/app/api/contribute/route.ts](../web/src/app/api/contribute/route.ts) | 贡献上传 API |
| [web/src/app/api/validate/route.ts](../web/src/app/api/validate/route.ts) | 上传前验证 API |
| [web/src/app/api/admin/submissions/[id]/publish/route.ts](../web/src/app/api/admin/submissions/[id]/publish/route.ts) | 上架 API |
| [web/next.config.ts](../web/next.config.ts) | standalone output |
| [web/tailwind.config.ts](../web/tailwind.config.ts) | brand 橙色色板 |
