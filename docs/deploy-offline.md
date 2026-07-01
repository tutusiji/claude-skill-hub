# 内网离线部署指南

## 适用场景

内网服务器无法访问外网，不能 git clone、不能 docker pull 基础镜像。
通过离线包（镜像 tar + 项目代码）完成部署。

## 前置条件

内网服务器上需要已安装：

| 工具 | 版本 | 检查命令 |
|------|------|----------|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Git | 2.30+ | `git --version` |

如果 Docker 也没装，需要先从外网下载 Docker 离线安装包。

## 离线包清单

从外网机器准备以下文件，拷贝到内网服务器：

```
downloads/
├── skill-hub-images.tar.gz     # Docker 镜像包（web + git-server）
└── claude-skill-hub/           # 项目代码（git 仓库或压缩包）
    ├── docker-compose.yml
    ├── Dockerfile
    ├── git-server/
    ├── plugins/
    ├── scripts/
    ├── web/
    └── ...
```

### 在外网机器上准备

```bash
# 1. 构建镜像（如果还没构建）
cd /path/to/claude-skill-hub
docker compose build

# 2. 导出镜像
mkdir -p images
docker save claude-skill-hub-web:latest claude-skill-hub-git-server:latest \
  -o images/skill-hub-images.tar

# 3. 打包项目代码
cd ..
tar czf claude-skill-hub-code.tar.gz \
  --exclude='claude-skill-hub/node_modules' \
  --exclude='claude-skill-hub/web/node_modules' \
  --exclude='claude-skill-hub/web/.next' \
  --exclude='claude-skill-hub/.git' \
  --exclude='claude-skill-hub/images' \
  claude-skill-hub/
```

### 传输到内网

通过 U 盘、内网文件传输工具等方式，将以下文件拷贝到内网服务器：

- `skill-hub-images.tar`（或 `.tar.gz`）
- `claude-skill-hub-code.tar.gz`

---

## 部署步骤

### 第一步：加载 Docker 镜像

```bash
# 将镜像包放到服务器上（假设在 /root/downloads/）
docker load -i /root/downloads/skill-hub-images.tar

# 验证镜像已加载
docker images | grep skill-hub
# 应看到：
# claude-skill-hub-web         latest   xxx   301MB
# claude-skill-hub-git-server  latest   xxx   36.7MB
```

### 第二步：解压项目代码

```bash
mkdir -p /opt
tar xzf /root/downloads/claude-skill-hub-code.tar.gz -C /opt/
cd /opt/claude-skill-hub
```

### 第三步：修改 docker-compose.yml 使用已有镜像

离线环境下不能用 `build`（会尝试拉基础镜像），改为直接用已加载的镜像：

```bash
cat > docker-compose.yml << 'YAML'
services:
  web:
    image: claude-skill-hub-web:latest
    container_name: skill-hub-web
    ports:
      - "7788:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production

  git-server:
    image: claude-skill-hub-git-server:latest
    container_name: skill-hub-git
    ports:
      - "7789:7789"
    volumes:
      - git-data:/srv/git
    restart: unless-stopped

volumes:
  git-data:
YAML
```

关键区别：`build` 替换为 `image`，直接引用已加载的镜像名。

### 第四步：启动服务

```bash
docker compose up -d
```

验证：

```bash
docker compose ps
# 两个容器都是 Up 状态

curl -sS http://localhost:7788 | grep '插件市场'
# 应输出: 插件市场
```

### 第五步：推送代码到内部 Git 仓库

git 容器的 bare 仓库初始为空，需要从项目代码推送一次：

```bash
cd /opt/claude-skill-hub
git init
git add -A
git commit -m "init: 内部技能市场"

git remote add internal http://localhost:7789/git/claude-skill-hub.git
git push internal main
```

验证 Git 仓库：

```bash
git clone http://localhost:7789/git/claude-skill-hub.git /tmp/verify
ls /tmp/verify/plugins/ | wc -l    # 应输出 23
rm -rf /tmp/verify
```

### 第六步：开放访问

确认防火墙放行端口：

```bash
# 如果用 firewalld
sudo firewall-cmd --permanent --add-port=7788/tcp
sudo firewall-cmd --permanent --add-port=7789/tcp
sudo firewall-cmd --reload

# 如果用 ufw
sudo ufw allow 7788/tcp
sudo ufw allow 7789/tcp
```

---

## 验证完整链路

### 1. Web UI 可访问

浏览器打开 `http://<服务器IP>:7788`，应看到 23 个插件、中文导航、主题切换。

### 2. Git 仓库可 clone

```bash
git clone http://<服务器IP>:7789/git/claude-skill-hub.git /tmp/test
ls /tmp/test/.claude-plugin/marketplace.json
```

### 3. Claude Code 可安装插件

在内网任意开发机器上：

```bash
claude plugin marketplace add http://<服务器IP>:7789/git/claude-skill-hub.git

# 安装一个插件测试
claude plugin install docker-pro@internal-skill-hub
```

---

## 后续更新

内网环境下新增或更新插件：

```bash
# 1. 在开发机器上修改插件代码
# 2. 推送到内部 git 仓库
git push internal main

# 3. 重新生成 registry 并重建 Web UI 镜像
#    （需要在有 Docker 的机器上操作）
cd /opt/claude-skill-hub
git pull internal main
node scripts/generate-registry.mjs
docker compose build web
docker compose up -d web
```

如果开发机器无法构建镜像，在外网机器构建后重新导出：
```bash
# 外网机器
docker save claude-skill-hub-web:latest -o skill-hub-web.tar

# 拷到内网后
docker load -i skill-hub-web.tar
docker compose up -d web
```

---

## 故障排查

### docker compose up 报错 "pull access denied"

说明 docker-compose.yml 里还在用 `build` 而不是 `image`。
按第三步修改为 `image: claude-skill-hub-web:latest`。

### Web UI 打不开

```bash
docker compose logs web
docker compose restart web
```

### Git push 报 403

```bash
# 检查 git 容器是否正常
docker compose logs git-server

# 重新推送
git push internal main --force
```

### Claude Code 安装失败

```bash
# 确认能访问 git 仓库
curl "http://<服务器IP>:7789/git/claude-skill-hub.git/info/refs?service=git-upload-pack"

# 设置离线环境变量（写入 ~/.bashrc）
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```
