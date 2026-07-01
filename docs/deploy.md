# 部署指南

## 部署目标

在内部服务器 `10.0.43.61` 上运行 Skill Hub，提供两个服务：

```
10.0.43.61
┌──────────────────────────────────────────────────┐
│                                                  │
│  :7788  Web UI (Next.js)                         │
│          浏览、搜索、查看插件详情、复制安装命令    │
│                                                  │
│  :7789  Git HTTP Server (bare repo)              │
│          Claude Code 拉取插件的实际后端           │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Web UI (:7788)** — 给人看的，浏览器访问
- **Git Server (:7789)** — 给 Claude Code 用的，`/plugin install` 时 git clone 这个仓库

两个服务都要有。Web UI 只负责展示，Claude Code 安装插件时实际拉取的是 git 仓库。

---

## 前置条件

服务器上需要安装：

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 构建 Web UI |
| npm | 10+ | 安装依赖 |
| Git | 2.30+ | bare 仓库 |
| nginx | 任意 | git http-backend 反代（可选，见下方说明） |

检查：

```bash
node --version    # v20.x.x
npm --version     # 10.x.x
git --version     # git version 2.x
```

---

## 第一步：部署 Git 仓库（端口 7789）

Claude Code 的 `/plugin install` 底层是 `git clone` 整个仓库。所以需要一个可 HTTP 访问的 git 仓库。

### 1.1 创建 bare 仓库

```bash
mkdir -p /srv/git/claude-skill-hub.git
cd /srv/git/claude-skill-hub.git
git init --bare
git config http.receivepack true
git config http.uploadpack true
```

### 1.2 推送代码到 bare 仓库

从你的开发机器（当前项目所在机器）推送：

```bash
cd /home/tutuos/CodeLab/claude-skill-hub
git remote add internal http://10.0.43.61:7789/claude-skill-hub.git
git push internal main
```

### 1.3 配置 nginx 提供 HTTP 访问

安装 fcgiwrap（git http-backend 的 FastCGI 包装器）：

```bash
sudo apt-get install fcgiwrap nginx
sudo systemctl enable fcgiwrap
sudo systemctl start fcgiwrap
```

创建 nginx 配置：

```bash
sudo tee /etc/nginx/conf.d/skill-hub-git.conf << 'NGINX'
server {
    listen 7789;
    server_name 10.0.43.61;

    location / {
        fastcgi_pass unix:/var/run/fcgiwrap.socket;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /usr/lib/git-core/git-http-backend;
        fastcgi_param GIT_HTTP_EXPORT_ALL "";
        fastcgi_param GIT_PROJECT_ROOT /srv/git;
        fastcgi_param PATH_INFO $uri;
    }
}
NGINX

sudo nginx -t && sudo systemctl reload nginx
```

### 1.4 验证

从内网任意机器测试：

```bash
git clone http://10.0.43.61:7789/claude-skill-hub.git /tmp/test-clone
ls /tmp/test-clone/.claude-plugin/marketplace.json
# 应看到 marketplace.json 文件
```

---

## 第二步：部署 Web UI（端口 7788）

### 方式 A：Docker 部署（推荐）

```bash
# 在项目根目录构建镜像
cd /path/to/claude-skill-hub
docker build -t skill-hub-web:latest .

# 运行容器
docker run -d \
  --name skill-hub-web \
  -p 7788:3000 \
  --restart unless-stopped \
  skill-hub-web:latest
```

验证：

```bash
curl -sS http://10.0.43.61:7788 | grep -o '插件市场'
# 输出: 插件市场
```

后续更新：

```bash
git pull origin main
docker build -t skill-hub-web:latest .
docker stop skill-hub-web && docker rm skill-hub-web
docker run -d \
  --name skill-hub-web \
  -p 7788:3000 \
  --restart unless-stopped \
  skill-hub-web:latest
```

### 方式 B：直接运行（无 Docker）

```bash
# 1. 安装依赖
cd /path/to/claude-skill-hub/web
npm ci

# 2. 生成 registry（在项目根目录执行）
cd /path/to/claude-skill-hub
node scripts/generate-registry.mjs

# 3. 构建
cd web
npm run build

# 4. 启动
PORT=7788 npm run start
```

验证：

```bash
curl -sS http://10.0.43.61:7788 | grep -o '插件市场'
```

### 方式 C：PM2 守护进程（推荐配合方式 B）

```bash
npm install -g pm2

cd /path/to/claude-skill-hub/web
PORT=7788 pm2 start "npm run start" --name skill-hub-web
pm2 save
pm2 startup    # 开机自启
```

常用 PM2 命令：

```bash
pm2 status              # 查看状态
pm2 logs skill-hub-web  # 查看日志
pm2 restart skill-hub-web
pm2 stop skill-hub-web
```

---

## 第三步：验证完整链路

### 3.1 Web UI 可访问

浏览器打开 `http://10.0.43.61:7788`，应看到 23 个插件卡片、中文导航、主题切换按钮。

### 3.2 Git 仓库可 clone

```bash
git clone http://10.0.43.61:7789/claude-skill-hub.git /tmp/verify
ls /tmp/verify/plugins/
# 应看到所有插件目录
```

### 3.3 Claude Code 可安装插件

在任意内网机器上：

```bash
# 添加内部 marketplace
claude plugin marketplace add http://10.0.43.61:7789/claude-skill-hub.git

# 安装一个插件试试
/plugin install docker-pro@internal-skill-hub
```

---

## 更新插件后的操作

当你新增或修改了插件，需要同步更新两个服务：

```bash
# 1. 推送代码到内部 git 仓库
git push internal main

# 2. 更新 Web UI
# Docker 方式
docker build -t skill-hub-web:latest .
docker stop skill-hub-web && docker rm skill-hub-web
docker run -d --name skill-hub-web -p 7788:3000 --restart unless-stopped skill-hub-web:latest

# 或 PM2 方式
cd /path/to/claude-skill-hub
git pull internal main
node scripts/generate-registry.mjs
cd web && npm run build
pm2 restart skill-hub-web
```

可选：配置 git `post-receive` hook 自动化这一步，见 `docs/internal-server-setup.md` 第三部分。

---

## 端口配置说明

| 配置方式 | 方法 |
|----------|------|
| Docker | `docker run -p <端口>:3000` 映射 |
| 直接运行 | `PORT=<端口> npm run start` |
| PM2 | `PORT=<端口> pm2 start "npm run start" --name skill-hub-web` |
| 环境变量 | 写入 `web/.env` 文件：`PORT=7788` |

Dockerfile 内部固定监听 3000，通过 `-p` 映射到宿主机端口。

---

## 故障排查

### Web UI 打不开

```bash
# 检查容器/进程是否运行
docker ps | grep skill-hub    # Docker 方式
pm2 status                    # PM2 方式

# 检查端口
ss -tlnp | grep 7788

# 查看日志
docker logs skill-hub-web     # Docker 方式
pm2 logs skill-hub-web        # PM2 方式
```

### Git clone 失败

```bash
# 检查 nginx 和 fcgiwrap
sudo systemctl status nginx fcgiwrap

# 检查 bare 仓库
ls /srv/git/claude-skill-hub.git/objects

# 手动测试
curl http://10.0.43.61:7789/claude-skill-hub.git/info/refs?service=git-upload-pack
# 应返回非空内容
```

### Claude Code 安装插件失败

```bash
# 确认 marketplace 已添加
claude plugin marketplace list

# 更新 marketplace 缓存
claude plugin marketplace update internal-skill-hub

# 设置离线环境变量（写入 ~/.bashrc）
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```
