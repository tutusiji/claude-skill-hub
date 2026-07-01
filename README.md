# Skill Hub — 内部 Claude Code 插件市场

一个自托管的技能/插件市场，专为 Claude Code 内部团队使用而设计。包含 Web 浏览界面、CI 校验的贡献流程，以及原生 Claude Code 市场集成。

## 架构

```
claude-skill-hub/
├── .claude-plugin/
│   └── marketplace.json        # Claude Code 市场清单
├── plugins/                     # 所有插件目录
│   └── code-review-skill/      # 示例插件
├── scripts/
│   ├── validate-plugin.mjs     # CI 校验（schema + 密钥检查 + 目录结构）
│   ├── generate-registry.mjs   # 为 Web UI 生成 registry.json
│   └── schemas/                # 市场和插件的 JSON schema
├── web/                        # Next.js Web UI
│   └── src/
│       ├── app/                # 页面：浏览、插件详情、贡献指南
│       ├── components/         # SearchBar、CategoryFilter、PluginCard
│       └── lib/                # 类型定义、工具函数、生成的 registry
├── .github/workflows/
│   ├── validate-pr.yml         # PR 校验 CI
│   └── deploy-web.yml          # Web UI 构建 + 部署
└── CONTRIBUTING.md             # 贡献指南
```

## 快速开始

### 用户 — 安装插件

在 Claude Code 中：

```bash
# 添加内部市场（一次性操作）
/plugin marketplace add <your-org>/claude-skill-hub

# 浏览并安装
/plugin install code-review-skill@internal-skill-hub
```

或者直接访问内部部署的 Web UI 地址浏览。

### 贡献者 — 添加插件

1. 按照 [CONTRIBUTING.md](CONTRIBUTING.md) 中的结构规范创建 `plugins/<your-plugin>/` 目录
2. 运行 `node scripts/validate-plugin.mjs` 校验
3. 在 `.claude-plugin/marketplace.json` 中注册
4. 提交 PR — CI 会自动校验

### 管理员 — 部署

```bash
# 生成 registry 数据
node scripts/generate-registry.mjs

# 本地运行 Web UI
cd web && npm install && npm run dev

# 生产构建
cd web && npm run build

# Docker 部署
docker build -f web/Dockerfile -t skill-hub .
```

## Web UI

Web UI 是一个 Next.js 应用，读取生成的 `registry.json` 数据，提供以下功能：

- 按分类筛选浏览所有插件
- 对名称、描述、关键词和技能进行全文搜索
- 插件详情页展示技能列表，支持一键复制安装命令
- 贡献指南页面，提供分步操作说明

每次合并到 main 分支都会重新生成 registry，确保 Web UI 始终反映最新的市场状态。

## CI 工作流

| 工作流 | 触发条件 | 用途 |
|--------|---------|------|
| `validate-pr.yml` | 向 main 提交 PR | 校验插件结构、检查密钥泄露、验证市场注册 |
| `deploy-web.yml` | 推送到 main | 生成 registry、构建 Web UI、部署到内部环境 |

## 自定义配置

- **市场名称**：修改 `.claude-plugin/marketplace.json` 中的 `name` 字段
- **分类**：编辑 `web/src/lib/types.ts` 和 `CONTRIBUTING.md`
- **部署目标**：修改 `.github/workflows/deploy-web.yml` 适配你的内部环境
- **审核团队**：创建或更新 CODEOWNERS 文件以自动分配审核人
