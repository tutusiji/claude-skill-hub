# 用户使用指南

面向内部 Claude Code 用户的配置和操作手册。

## 一次性配置

### 1. 添加内部 Marketplace

在终端执行（不是在 Claude Code 内部）：

```bash
# 裸 Git 仓库方案
claude plugin marketplace add http://10.9.43.61:7789/skill-hub.git

# Gitea 方案（如果管理员用的是 Gitea）
claude plugin marketplace add http://10.9.43.61:7789/platform-team/skill-hub.git
```

或者在 Claude Code 交互界面内执行：

```
/plugin marketplace add http://10.9.43.61:7789/skill-hub.git
```

### 2. 设置离线环境变量

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```

然后 `source ~/.bashrc` 或重新打开终端。

### 3. 验证 Marketplace 已注册

```bash
claude plugin marketplace list
```

或在 Claude Code 内：

```
/plugin marketplace list
```

应看到 `internal-skill-hub` 出现在列表中。

## 日常使用

### 浏览插件

**Web 界面**：浏览器打开 http://10.9.43.61:7788

支持搜索和分类筛选，每个插件详情页有安装命令可一键复制。

**Claude Code 内**：

```
/plugin
```

打开插件管理器，在 Discover 标签页浏览所有可用插件。

### 安装插件

在 Claude Code 内执行：

```
/plugin install <plugin-name>@internal-skill-hub
```

例如：

```
/plugin install code-review-skill@internal-skill-hub
```

安装后，插件提供的 skills 会自动被 Claude Code 发现和触发。

### 使用已安装的 skill

安装后直接在对话中使用，或显式调用：

```
/code-review-skill:code-review
```

插件 skill 命名规则是 `/<plugin-name>:<skill-name>`。

### 更新 Marketplace

当有新插件上架时，需要更新本地 marketplace 缓存才能看到：

```bash
claude plugin marketplace update internal-skill-hub
```

或交互界面内：

```
/plugin marketplace update internal-skill-hub
```

### 卸载插件

```
/plugin uninstall code-review-skill
```

## 管理多个 Marketplace

如果同时使用官方 marketplace 和内部 marketplace：

```bash
# 查看所有已注册的 marketplace
claude plugin marketplace list

# 官方 marketplace（需要外网，内网不可用）
# claude plugin marketplace add anthropics/claude-plugins-official

# 内部 marketplace
claude plugin marketplace add http://10.9.43.61:7789/skill-hub.git
```

安装时通过 `@marketplace-name` 指定来源：

```
/plugin install code-review-skill@internal-skill-hub
/plugin install some-official-plugin@claude-plugins-official
```

## 故障排查

### Marketplace 添加失败

```
Error: git clone failed
```

检查：
1. 内网能访问 `http://10.9.43.61:7789`（`curl http://10.9.43.61:7789`）
2. Git 仓库路径正确（联系管理员确认）
3. `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` 是否设置

### 插件安装失败

```
Error: plugin not found
```

检查：
1. 先更新 marketplace：`/plugin marketplace update internal-skill-hub`
2. 确认插件名拼写正确（在 Web UI 上确认）
3. 确认 marketplace 名称是 `internal-skill-hub`（不是 URL）

### 插件加载错误

```
/plugin
```

打开 Errors 标签页查看具体错误。常见原因：
- SKILL.md frontmatter 格式错误
- 插件依赖的外部工具未安装
- 插件脚本没有执行权限

### Marketplace 缓存被清除

离线环境下 git pull 失败会清除缓存。解决方法：

```bash
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
```

设置后 git pull 失败时保留上次的缓存，不影响已安装插件的使用。

## 快速参考卡

| 操作 | 命令 |
|------|------|
| 添加内部 marketplace | `claude plugin marketplace add http://10.9.43.61:7789/skill-hub.git` |
| 更新 marketplace | `claude plugin marketplace update internal-skill-hub` |
| 列出 marketplace | `claude plugin marketplace list` |
| 浏览插件 (Web) | 浏览器打开 `http://10.9.43.61:7788` |
| 浏览插件 (CLI) | `/plugin` → Discover 标签 |
| 安装插件 | `/plugin install <name>@internal-skill-hub` |
| 卸载插件 | `/plugin uninstall <name>` |
| 查看已安装 | `/plugin` → Installed 标签 |
| 查看错误 | `/plugin` → Errors 标签 |
