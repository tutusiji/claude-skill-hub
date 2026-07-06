> ⚠️ **本文档已过时**：描述的 `web` + `git-server` 双容器拓扑中，`git-server` 容器已在 `f8aa05b` 架构重构中移除；marketplace URL 也已统一为 `http://10.9.43.61:7789/skill-hub.git`（去掉 `/git/`）。当前为单 `web` 容器 + 宿主机 git marketplace。最新部署指南见 [`offline-deploy.md`](./offline-deploy.md)。

# 部署指南

## 架构概览

使用 Docker Compose 一键启动两个服务：

```
docker compose up -d
        │
        ├── web         :7788 → 容器:3000   Web UI（Next.js）
        └── git-server  :7789 → 容器:7789   Git HTTP Server（lighttpd + git-http-backend）
```

- **Web UI (:7788)** — 给人看的，浏览器访问，浏览搜索插件
- **Git Server (:7789)** — 给 Claude Code 用的，`/plugin install` 时 git clone 这个仓库

两个服务都要有。Web UI 只负责展示，Claude Code 安装插件时实际拉取的是 git 仓库。

---

## 快速部署

### 1. 克隆项目到服务器

```bash
git clone <仓库地址> /opt/claude-skill-hub
cd /opt/claude-skill-hub
```

### 2. 启动服务

```bash
docker compose up -d
```

首次启动会构建两个镜像（约 1-2 分钟）。

### 3. 推送代码到内部 Git 仓库

首次启动后，git 容器里的 bare 仓库是空的，需要推送一次代码：

```bash
git remote add internal http://10.9.43.61:7789/claude-skill-hub.git
git push internal main
```

### 4. 验证

```bash
# Web UI
curl -sS http://10.9.43.61:7788 | grep '插件市场'

# Git 仓库
git clone http://10.9.43.61:7789/claude-skill-hub.git /tmp/verify
ls /tmp/verify/plugins/ | wc -l    # 应输出 23
```

### 5. 用户配置 Claude Code

```bash
claude plugin marketplace add http://10.9.43.61:7789/claude-skill-hub.git
/plugin install docker-pro@internal-skill-hub
```

---

## docker-compose.yml 说明

```yaml
services:
  web:                     # Next.js Web UI
    build: .
    ports: ["7788:3000"]
    restart: unless-stopped

  git-server:              # Git HTTP Server
    build: ./git-server
    ports: ["7789:7789"]
    volumes: [git-data:/srv/git]   # 仓库数据持久化
    restart: unless-stopped

volumes:
  git-data:                # Docker 管理的卷，重建容器不丢数据
```

---

## 日常运维

### 查看服务状态

```bash
docker compose ps
```

### 查看日志

```bash
docker compose logs web         # Web UI 日志
docker compose logs git-server  # Git 仓库日志
```

### 更新插件后重新部署

```bash
# 1. 推送代码到内部 git 仓库
git push internal main

# 2. 重建 Web UI（插件展示更新）
docker compose up -d --build web
```

### 重启服务

```bash
docker compose restart          # 重启所有服务
docker compose restart web      # 只重启 Web UI
```

### 停止服务

```bash
docker compose down             # 停止并删除容器（数据保留）
docker compose down -v          # 停止并删除容器和数据（谨慎！）
```

---

## 端口修改

修改 `docker-compose.yml` 中的端口映射：

```yaml
services:
  web:
    ports: ["8080:3000"]         # 改为 8080
  git-server:
    ports: ["8081:7789"]         # 改为 8081
```

然后 `docker compose up -d` 重建容器。

用户的 Claude Code 配置也要同步更新：
```bash
claude plugin marketplace add http://10.9.43.61:8081/git/claude-skill-hub.git
```

---

## 数据持久化

Git 仓库数据存储在 Docker volume `git-data` 中：

```bash
# 查看卷位置
docker volume inspect claude-skill-hub_git-data

# 备份
docker run --rm -v claude-skill-hub_git-data:/data -v $(pwd):/backup alpine tar czf /backup/git-data-backup.tar.gz -C /data .

# 恢复
docker run --rm -v claude-skill-hub_git-data:/data -v $(pwd):/backup alpine tar xzf /backup/git-data-backup.tar.gz -C /data
```

---

## 故障排查

### Web UI 打不开

```bash
docker compose logs web         # 查看错误日志
docker compose restart web      # 重启
```

### Git clone/push 失败

```bash
docker compose logs git-server  # 查看错误日志
docker compose restart git-server

# 测试 git 仓库是否响应
curl "http://10.9.43.61:7789/claude-skill-hub.git/info/refs?service=git-upload-pack"
# 应返回以 001e# service=git-upload-pack 开头的内容
```

### Claude Code 安装插件失败

```bash
# 确认 marketplace 已添加
claude plugin marketplace list

# 更新缓存
claude plugin marketplace update internal-skill-hub

# 设置离线环境变量（写入 ~/.bashrc）
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```

### 容器重建后 Git 仓库数据丢失

用了 volume 挂载就不会丢。如果用了 `docker compose down -v` 会删除数据，需要重新 push：

```bash
git push internal main
```
