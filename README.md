# Skill Hub — 内部 AI 编程工具插件与技能市场

一套自托管的插件/技能市场,面向公司内部使用。支持 **Claude Code、Codex CLI、Kimi Code、OpenCode、CodeWhale** 等多种 AI 编程工具。提供 Web 浏览界面、Web 表单上传 + 管理员审核的上架流程、CI 校验,以及原生 Claude Code marketplace 集成。

> 架构与数据流细节见 [docs/architecture.md](docs/architecture.md)。本文是快速概览。

## 特性

- **多工具兼容** — 每个插件详情页按工具显示对应安装命令;插件可声明 `compatibility` 限定支持的工具
- **Web 上传 + 审核上架** — 贡献者通过 Web 表单上传 ZIP,管理员审核后一键上架,前台即时可见,无需 Git 操作
- **双轨插件源** — 静态插件(随仓库分发,23 个)+ 动态插件(管理员上架,运行时合并展示)
- **文件系统存储** — JSON 数据文件 + 文件系统,无需数据库
- **四层校验** — plugin.json schema + 结构 + 一致性 + 密钥扫描,上传前自测 + 上架前复审
- **嵌套兼容** — `findPluginRoot` 递归搜索,支持 ZIP 内任意深度嵌套和纯 skill 包(无 plugin.json)
- **原生 marketplace 集成** — 通过 Git smart HTTP 服务,`claude plugin marketplace add` 即可接入
- **离线导入** — `fetch-plugin.mjs` 在联网机器从 GitHub 拉取打包,`import-plugin.mjs` 在内网导入

## 支持的工具

| 工具 | 厂商 | 安装命令 | 技能文件 |
|------|------|----------|----------|
| Claude Code | Anthropic | `claude plugin install <name>@internal-skill-hub` | SKILL.md |
| Codex CLI | OpenAI | `codex --plugin <name>` | AGENTS.md |
| Kimi Code | Moonshot | `kimi plugin install <name>@internal-skill-hub` | SKILL.md |
| OpenCode | Open Source | `opencode plugin add <name>` | AGENTS.md |
| CodeWhale | CodeWhale | `codewhale plugin install <name>@internal-skill-hub` | SKILL.md |

> `@internal-skill-hub` 是添加 marketplace 时起的本地别名,可自行修改。

## 快速开始

### 用户 — 安装插件

```bash
# 1. 添加 marketplace(一次性,URL 替换为你的内部部署地址)
claude plugin marketplace add http://10.0.43.61:7789/skill-hub.git

# 2. 浏览 Web UI,或直接安装
claude plugin install <plugin-name>@internal-skill-hub
```

其他工具的安装命令见上表,或在 Web UI 插件详情页一键复制。纯 skill 包(无 plugin.json)走 `~/.claude/skills/`,插件包走 `~/.claude/plugins/`。

### 贡献者 — 上传插件

1. 按插件结构打包成 `.zip` 或 `.tar.gz`(结构见 [CONTRIBUTING.md](CONTRIBUTING.md))
2. 打开 Web UI 的「贡献」页,填写姓名/工号/邮箱/部门/描述/分类并上传
3. 点击「上传前验证」自测(四层校验 + 密钥扫描,实时反馈错误/警告)
4. 提交审核 — 管理员审核通过后一键上架,前台立即可见

> 平台团队维护的静态插件直接放在 `plugins/` 目录,走 `scripts/validate-plugin.mjs` + CI 校验(见下文)。

### 管理员 — 部署

```bash
# 生成静态 registry(从 marketplace.json 读取静态插件)
node scripts/generate-registry.mjs

# Web UI
cd web && npm install && npm run dev      # 开发
cd web && npm run build                   # 生产构建(standalone output)

# 生产部署:Docker Compose 一键启动(完整步骤见 docs/deploy.md)
#   docker compose up -d        # 启动 web(:7788) + git-server(:7789)
#   git push internal main      # 推送代码到内部 git 仓库
# web 容器关键环境变量:
#   ADMIN_PASSWORD    管理员密码          (必填,否则登录禁用)
#   AUTH_SECRET       token 签名密钥      (可选,默认复用 ADMIN_PASSWORD)
#   DATA_DIR/UPLOAD_DIR  数据/上传目录    (默认 ./data、./uploads)
#   SYNC_SCRIPT_PATH  同步脚本路径        (默认指向 systemd 布局;Docker Compose 下用 git push 同步)
```

完整部署步骤见 [docs/deploy.md](docs/deploy.md)。

## 仓库结构

```
claude-skill-hub/
├── .claude-plugin/marketplace.json   # 源码侧 marketplace 清单(静态插件)
├── plugins/                          # 静态插件目录(随仓库分发,23 个)
├── scripts/
│   ├── validate-plugin.mjs           # CI/本地校验(schema + 密钥 + 结构)
│   ├── generate-registry.mjs         # 生成 web/src/lib/registry.json
│   ├── fetch-plugin.mjs              # 联网机器:从 GitHub 拉取打包
│   ├── import-plugin.mjs             # 内网机器:导入并注册
│   ├── sync-marketplace.sh           # 同步已发布插件到 Git marketplace 仓库
│   └── schemas/                      # marketplace + plugin JSON schema
├── web/                              # Next.js 15 Web UI(App Router + Tailwind)
│   └── src/
│       ├── app/                      # 浏览/详情/贡献/指南/管理后台 + API 路由
│       ├── components/               # PluginCard / SearchBar / InstallCommands ...
│       └── lib/                      # storage / validator / auth / types / registry.json
├── deploy/                           # nginx-*.conf(systemd 旧式部署用)
├── docker-compose.yml                # Docker Compose 编排(web 服务)
├── Dockerfile                        # web 容器多阶段构建
├── docs/                             # architecture / deploy / 用户指南
└── .github/workflows/                # validate-pr.yml / deploy-web.yml
```

## 离线导入(内网无 GitHub)

```bash
# 联网机器:从 GitHub 拉取并打包成 .tar.gz
node scripts/fetch-plugin.mjs --repo <owner/repo> [--path <plugin-path>] [--ref <ref>]

# 传到内网机器后导入并注册
node scripts/import-plugin.mjs --package <name>.tar.gz [--category <cat>] [--keywords kw1,kw2]
```

两个脚本不带参数运行即可打印完整用法(`node scripts/fetch-plugin.mjs`)。

## CI

| Workflow | 触发 | 作用 |
|----------|------|------|
| `validate-pr.yml` | PR to main(改 `plugins/`、`marketplace.json`、`scripts/`) | 校验插件结构、密钥扫描、marketplace 注册 |
| `deploy-web.yml` | Push to main | 生成 registry、构建 Web UI、部署 |

## 自定义

- **Marketplace 别名** — Docker Compose 部署用 `internal-skill-hub`(源码 `.claude-plugin/marketplace.json` 的 `name`);systemd 部署下 `sync-marketplace.sh` 生成的对外名为 `skill-hub`
- **分类** — 编辑 `web/src/lib/types.ts` 的 `CATEGORIES` 和 `CONTRIBUTING.md`
- **部署目标** — 改 `.github/workflows/deploy-web.yml`
- **数据/上传目录** — `DATA_DIR` / `UPLOAD_DIR` 环境变量
- **同步脚本路径** — `SYNC_SCRIPT_PATH` 环境变量

## 安全

- 管理员认证:Cookie + **HMAC 签名 token**,密钥取 `AUTH_SECRET`,回退 `ADMIN_PASSWORD`
- **必须设置 `ADMIN_PASSWORD` 环境变量**,未配置时管理员登录禁用
- 上传大小限制 50MB(nginx `client_max_body_size 50m` 三套配置均已设置)
- 密钥扫描两道关卡:贡献者上传前 + 管理员上架前
- 插件名校验防路径穿越;禁止硬编码密钥、外部网络调用(除非文档说明)

详见 [docs/architecture.md](docs/architecture.md) 安全设计章节。
