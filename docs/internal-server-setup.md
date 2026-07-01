# 内部服务器部署指南

## 架构概览

内部服务器 `10.0.43.61` 需要提供两个服务：

```
10.0.43.61
┌─────────────────────────────────────────────────────┐
│                                                     │
│  :7788  Web UI (Next.js)                            │
│          浏览、搜索、查看插件详情、复制安装命令       │
│                                                     │
│  :7789  Git HTTP Server (bare repo)                 │
│          Claude Code marketplace 拉取插件的实际后端  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**为什么需要两个服务？**

Claude Code 的 `/plugin marketplace add` 支持两种 URL 模式：

| 模式 | 命令 | 行为 |
|------|------|------|
| Git URL | `claude plugin marketplace add http://10.0.43.61:7789/skill-hub.git` | clone 整个仓库，相对路径 source 正常工作 |
| HTTP URL | `claude plugin marketplace add http://10.0.43.61:7788/marketplace.json` | **只下载 marketplace.json 本身，不下载插件文件** |

我们的 marketplace.json 中插件 source 是相对路径（`./plugins/xxx`），只有 Git 模式能正常工作。所以必须有一个 git 服务器。

## 第一部分：Git 服务器（端口 7789）

### 方案 A：裸 Git 仓库 + git http-backend（轻量推荐）

适合不想安装额外服务的场景，只需要 git 和 nginx。

```bash
# 1. 在服务器上创建裸仓库
mkdir -p /srv/git/claude-skill-hub.git
cd /srv/git/claude-skill-hub.git
git init --bare

# 2. 配置允许 HTTP 推送（仅内网，安全可放宽）
git config http.receivepack true
git config http.uploadpack true

# 3. 从内网开发机器推送代码
cd /path/to/claude-skill-hub
git remote add internal http://10.0.43.61:7789/claude-skill-hub.git
git push internal main
```

配置 nginx 作为 git HTTP 代理（端口 7789）：

```nginx
# /etc/nginx/conf.d/skill-hub-git.conf
server {
    listen 7789;
    server_name 10.0.43.61;

    location / {
        # git-http-backend
        fastcgi_pass unix:/var/run/fcgiwrap.socket;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /usr/lib/git-core/git-http-backend;
        fastcgi_param GIT_HTTP_EXPORT_ALL "";
        fastcgi_param GIT_PROJECT_ROOT /srv/git;
        fastcgi_param PATH_INFO $uri;
    }
}
```

安装 fcgiwrap：

```bash
sudo apt-get install fcgiwrap
sudo systemctl enable fcgiwrap
sudo systemctl start fcgiwrap
```

验证：

```bash
# 从内网任意机器测试
git clone http://10.0.43.61:7789/claude-skill-hub.git /tmp/test-clone
ls /tmp/test-clone/.claude-plugin/marketplace.json
```

### 方案 B：Gitea（功能完整推荐）

如果需要 Web 界面管理仓库、PR 审核等，安装 Gitea：

```bash
# Docker 一键部署
docker run -d \
  --name gitea \
  -p 7789:3000 \
  -p 2222:22 \
  -v /srv/gitea:/data \
  -e ROOT_URL=http://10.0.43.61:7789/ \
  gitea/gitea:latest
```

在 Gitea Web 界面创建仓库 `claude-skill-hub`，然后推送代码：

```bash
cd /path/to/claude-skill-hub
git remote add internal http://10.0.43.61:7789/platform-team/claude-skill-hub.git
git push internal main
```

用户添加 marketplace 命令：

```bash
claude plugin marketplace add http://10.0.43.61:7789/platform-team/claude-skill-hub.git
```

## 第二部分：Web UI 部署（端口 7788）

### 构建

在内网开发机器上构建（需要 Node.js 20+）：

```bash
cd claude-skill-hub
node scripts/generate-registry.mjs
cd web
npm ci
npm run build
```

### 方案 A：Docker 部署（推荐）

```bash
# 构建镜像
docker build -f web/Dockerfile -t skill-hub-web:latest .

# 运行
docker run -d \
  --name skill-hub-web \
  -p 7788:3000 \
  --restart unless-stopped \
  skill-hub-web:latest
```

### 方案 B：直接运行

```bash
cd web
NODE_ENV=production node server.js &
```

### 方案 C：PM2 守护

```bash
npm install -g pm2
cd web
pm2 start server.js --name skill-hub-web
pm2 save
pm2 startup
```

### 验证

```bash
curl http://10.0.43.61:7788
# 应返回包含 "Plugin Marketplace" 的 HTML
```

## 第三部分：自动化更新

当有新插件上架（git push 到内部仓库后），Web UI 需要重新生成 registry。

### 方式 1：Git Hook 自动重建（推荐）

在内部 git 仓库的 post-receive hook 中触发重建：

```bash
# /srv/git/claude-skill-hub.git/hooks/post-receive
#!/bin/bash
WORK_DIR=/srv/skill-hub-worktree
WEB_DIR=/srv/skill-hub-web

# 检出最新代码
git --work-tree=$WORK_DIR --git-dir=/srv/git/claude-skill-hub.git checkout -f main

# 重新生成 registry
cd $WORK_DIR
node scripts/generate-registry.mjs

# 复制 registry 到 Web 运行目录
cp $WORK_DIR/web/src/lib/registry.json $WEB_DIR/src/lib/registry.json

# 重启 Web UI
cd $WEB_DIR
npm run build
pm2 restart skill-hub-web
```

```bash
chmod +x /srv/git/claude-skill-hub.git/hooks/post-receive
```

### 方式 2：定时轮询（简单）

```bash
# crontab -e
*/5 * * * * cd /srv/skill-hub-worktree && git pull -q && node scripts/generate-registry.mjs && cp web/src/lib/registry.json /srv/skill-hub-web/src/lib/registry.json && cd /srv/skill-hub-web && npm run build && pm2 restart skill-hub-web
```

## 第四部分：环境变量

对于完全离线环境，Claude Code 客户端需要设置以下环境变量：

```bash
# 防止 git pull 失败时清除本地缓存
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1

# 如果 git 仓库较大或网络较慢，增加超时
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```

建议写入 `/etc/profile.d/claude-code.sh` 让所有用户自动生效：

```bash
echo 'export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1' | sudo tee /etc/profile.d/claude-code.sh
echo 'export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000' | sudo tee -a /etc/profile.d/claude-code.sh
```

## 网络拓扑总结

```
                    内部网络 10.0.43.x
┌──────────────┐                        ┌─────────────────────────┐
│  开发者机器   │  git push              │  内部服务器 10.0.43.61   │
│              │ ─────────────────────→ │                         │
│  Claude Code │  :7789 git clone       │  :7788 Web UI           │
│              │ ←───────────────────── │  :7789 Git HTTP Server  │
│              │  :7788 浏览插件         │                         │
└──────────────┘                        └─────────────────────────┘
                                               │
                                               │ git pull (post-receive hook)
                                               ▼
                                        重新生成 registry
                                        重建 Web UI
```
