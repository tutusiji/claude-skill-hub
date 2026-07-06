# claude-skill-hub 内网离线部署指南

> 面向**无外网内网**（仅有内部 npm 镜像 + Docker Compose）的离线部署。
> 构建机：huoshan 云 `115.190.193.230`（SSH 端口 `7504`，有外网，本机已配好 ssh）。
> 部署机：内网 `10.0.43.61`（无外网；Web 端口 `7788`，Git marketplace 端口 `7789`）。
>
> 域名 `joox.cc:7504` 与 `115.190.193.230:7504` 是同一台 huoshan，**以后统一用 IP `115.190.193.230`**。

---

## 0. 现状对齐（先读这一节，避免踩旧文档的坑）

仓库里已有的部署材料与**当前代码**存在偏差，本指南以当前代码为准：

| 项 | 旧文档/产物状态 | 当前真实状态 | 本指南处理 |
|----|----------------|-------------|-----------|
| 服务拓扑 | `docs/deploy.md` 写的是 `web`(:7788) + `git-server`(:7789) 两个容器 | `git-server` 容器已在 `f8aa05b 架构重构` 中移除，现在只有 `web` 一个容器 | 只部署 `web` 容器；git marketplace 走宿主机 nginx（见 §5） |
| 离线镜像包 | `images/skill-hub-images.tar`（7/2 生成）含 `claude-skill-hub-git-server` 旧镜像 | **已过期**，含被删掉的 git-server 镜像 | **不要直接用**，按 §3 重新打包 |
| 内网 IP | `deploy/README.md` / `web/.env.internal` 写的是 `10.9.43.61` | 实际是 `10.0.43.61`（`10.9` 是笔误） | 全文用 `10.0.43.61` |
| 端口 | 部分文档用 `7504` | Web=`7788`、Git=`7789`；`7504` 是 huoshan 的 SSH 端口，不是业务端口 | Web=7788，Git=7789 |
| marketplace URL | README 用 `/git/claude-skill-hub.git`，代码默认 `/git/skill-hub.git` | 两处不一致（前者=静态插件仓库，后者=动态发布同步仓库） | 见 §5 说明，按需选择 |
| 环境变量 | `docker-compose.yml` 只设了 5 个 | 代码还读 `AUTH_SECRET`/`SYNC_SCRIPT_PATH`/`NEXT_PUBLIC_MARKETPLACE_URL` | 在离线 compose 中补齐 |
| `NEXT_PUBLIC_*` | 当作运行时变量 | **构建时**变量，运行时改不了 | 在构建机设置（§3/§4） |

---

## 1. 拓扑与角色

```
┌──────────────────────────┐         ┌─────────────────────────────────┐
│  huoshan 云（构建机）       │         │  内网 10.0.43.61（部署机）          │
│  115.190.193.230:7504 ssh │         │  无外网 / 有内部 npm / 有 compose  │
│  有外网 + Docker           │         │                                   │
│                            │  传 tar │  ┌─────────────────────────────┐  │
│  · docker build            │ ──────> │  │ web 容器  :7788 → :3000      │  │
│  · docker save → tar       │         │  │   (Next.js standalone)        │  │
│  ·（可选）save base image   │         │  └─────────────────────────────┘  │
└──────────────────────────┘         │  ┌─────────────────────────────┐  │
                                      │  │ git marketplace  :7789       │  │
                                      │  │   (宿主 nginx + fcgiwrap)     │  │
                                      │  │   Claude Code 由此 install   │  │
                                      │  └─────────────────────────────┘  │
                                      └─────────────────────────────────┘
```

- **构建机 huoshan**：有外网，负责 `docker build` + `docker save`，产出离线 tar。
- **部署机内网**：无外网，只做 `docker load` + `docker compose up`。两条路径：
  - **路径 A（推荐）**：huoshan 构建好镜像 → 导出 tar → 内网 `load` → `compose up`。内网**不需要 npm**。
  - **路径 B**：直接在内网用**内部 npm** 构建镜像（需先导入 `node:20-alpine` 基础镜像）。

---

## 2. 前置条件检查清单

**构建机 huoshan：**
```bash
ssh -p 7504 root@115.190.193.230          # 或你已配的别名，如 ssh huoshan
docker version && docker buildx version    # 需要 Docker（支持多阶段构建）
git --version
cd /root/projects/claude-skill-hub && git pull origin main   # 拉到最新
```

**部署机内网 10.0.43.61：**
```bash
docker version                             # Docker 引擎
docker compose version                     # Docker Compose v2
# 路径 B 才需要：确认内部 npm 镜像可达
curl -sI https://<内部npm镜像>/ 2>/dev/null || curl -sI http://<内部npm镜像>/
```

> 内网 SSH 登录方式按你们实际配置（端口/账号）。本指南命令默认你在内网机器上以 root 执行。

---

## 3. 路径 A：镜像离线导入（推荐）

内网无需 npm，全程不联网。

### A1. 在 huoshan 构建并导出镜像

```bash
# === 在 huoshan 上 ===
cd /root/projects/claude-skill-hub

# （可选）如果你的内网 marketplace URL 不是代码默认值，构建时注入。
# 注意：NEXT_PUBLIC_* 是构建时变量，必须在 build 阶段生效，运行时改无效。
# 代码默认: http://10.0.43.61:7789/git/skill-hub.git
# 如要改成 /git/claude-skill-hub.git，在 Dockerfile builder 阶段加一行 ENV，或：
#   docker build --build-arg MARKETPLACE_URL=... （需 Dockerfile 声明 ARG，当前未声明）
# 不改就用代码默认，跳过本注释。

docker build -t claude-skill-hub-web:latest .

# 导出为 tar（约 80~90MB）
docker save claude-skill-hub-web:latest -o skill-hub-web.tar
gzip skill-hub-web.tar                       # → skill-hub-web.tar.gz
ls -lh skill-hub-web.tar.gz
```

### A2. 传到内网

```bash
# 方式 1：huoshan 能直连内网时
scp -P <内网ssh端口> skill-hub-web.tar.gz root@10.0.43.61:/opt/claude-skill-hub/

# 方式 2：huoshan 无法直连内网时，用本机中转
#   本机:  scp -P 7504 root@115.190.193.230:/root/projects/claude-skill-hub/skill-hub-web.tar.gz .
#   本机:  scp -P <内网ssh端口> skill-hub-web.tar.gz root@10.0.43.61:/opt/claude-skill-hub/
```

### A3. 在内网导入镜像

```bash
# === 在内网 10.0.43.61 上 ===
cd /opt/claude-skill-hub
gunzip -c skill-hub-web.tar.gz | docker load
# 等价: docker load -i skill-hub-web.tar
docker images | grep claude-skill-hub-web    # 应看到 claude-skill-hub-web   latest   ...
```

### A4. 写离线 compose 文件

当前仓库的 `docker-compose.yml` 用的是 `build: .`（会在内网触发构建并联网拉依赖），离线场景要改用 `image:`。在 `/opt/claude-skill-hub/` 下新建 `docker-compose.offline.yml`：

```yaml
# docker-compose.offline.yml — 内网离线部署（镜像已 load，不构建）
services:
  web:
    image: claude-skill-hub-web:latest
    container_name: skill-hub-web
    ports:
      - "7788:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin@123456}
      # AUTH_SECRET 未设时回退到 ADMIN_PASSWORD；生产建议显式设置
      - AUTH_SECRET=${AUTH_SECRET:-please-change-me}
      - DATA_DIR=/app/data
      - UPLOAD_DIR=/app/uploads
      - STATIC_PLUGINS_DIR=/app/plugins
      # 注意：NEXT_PUBLIC_MARKETPLACE_URL 是构建时变量，写这里运行时不生效，
      # 仅作记录。实际值见 §3 A1 / §5。
      - NEXT_PUBLIC_MARKETPLACE_URL=http://10.0.43.61:7789/git/claude-skill-hub.git
      # 发布插件同步脚本（宿主路径）。容器内启用发布同步见 §5.3，否则留默认不会触发。
      - SYNC_SCRIPT_PATH=/app/scripts/sync-marketplace.sh
    volumes:
      - skill-hub-data:/app/data
      - skill-hub-uploads:/app/uploads

volumes:
  skill-hub-data:
  skill-hub-uploads:
```

建议再放一个 `.env`（与 compose 同目录）管敏感值：
```bash
cat > /opt/claude-skill-hub/.env <<'EOF'
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
AUTH_SECRET=请改成一段随机串
EOF
chmod 600 /opt/claude-skill-hub/.env
```

### A5. 启动 + 验证

```bash
cd /opt/claude-skill-hub
docker compose -f docker-compose.offline.yml up -d
docker compose -f docker-compose.offline.yml ps
curl -sS http://10.0.43.61:7788 | grep -o '插件市场\|Skill Hub' | head -1   # 有输出即 Web 起来了
docker compose -f docker-compose.offline.yml logs --tail=50 web
```

浏览器访问 `http://10.0.43.61:7788`，用 `admin` / 你设的密码登录。

---

## 4. 路径 B：内网直接构建（用内部 npm）

适用于「不想跨机传镜像、想在内网本地构建」的场景。需要先导入基础镜像 + 让构建容器走内部 npm。

### B1. 从 huoshan 导出基础镜像并导入内网

```bash
# === huoshan 上 ===
docker pull node:20-alpine
docker save node:20-alpine -o node-20-alpine.tar
gzip node-20-alpine.tar
# 传到内网（同 §3 A2）

# === 内网 10.0.43.61 上 ===
gunzip -c node-20-alpine.tar.gz | docker load
docker images | grep node                       # 确认 node   20-alpine
```

### B2. 让构建容器走内部 npm（关键：锁文件已锁定 npmmirror）

仓库的 `web/package-lock.json` 里**所有 `resolved` URL 都锁在 `https://registry.npmmirror.com`**（不是 npmjs.org）。`npm ci` 会**直接按锁定的 `resolved` URL 拉包**，所以光在 `.npmrc` 里改 `registry=` 没用——它会去访问 `registry.npmmirror.com`，内网无外网必失败。

> 不需要改 `Dockerfile`（它没有 COPY `.npmrc`，但这里也不靠 `.npmrc`）。二选一：

**方式 ①（推荐，最稳）：把锁文件里的 `resolved` 改写为内部镜像**

```bash
cd /opt/claude-skill-hub
# 把所有 npmmirror 的 resolved URL 替换成内部镜像（内部镜像需能按相同路径提供 tarball）
sed -i 's#https://registry.npmmirror.com#https://<内部npm镜像>#g' web/package-lock.json
# 校验：应只剩内部镜像
grep -o '"resolved": *"[^"]*"' web/package-lock.json | sed -E 's#"resolved": *"([^/]+//[^/]+).*#\1#' | sort -u
```

> 前提：内部镜像是 npmmirror 的同构代理（cnpm/verdaccio/nexus proxy 皆可），路径一致，tarball 内容一致 → `npm ci` 的 integrity 校验能过。改写只在构建机本地做，不必提交。

**方式 ②（若内网已把 `registry.npmmirror.com` 劫持到内部镜像）：什么都不用改**

如果内网 DNS/`/etc/hosts` 已把 `registry.npmmirror.com` 指向内部镜像，锁文件原样可用，跳过 sed。配合下方 `--network host` 让构建容器继承宿主解析即可。

### B3. 构建（走 host 网络，让构建容器能访问内部 npm）

```bash
cd /opt/claude-skill-hub
# --network host: 构建容器复用宿主网络，才能访问内网 npm 镜像
docker build --network host -t claude-skill-hub-web:latest .
docker images | grep claude-skill-hub-web
```

### B4. 启动

复用 §3 A4 的 `docker-compose.offline.yml`，然后：

```bash
docker compose -f docker-compose.offline.yml up -d
```

---

## 5. Git marketplace 服务（Claude Code `plugin install` 需要）

> Web 容器只负责**浏览/搜索/上传审核/下载 zip**。
> Claude Code 的 `claude plugin marketplace add ... && claude plugin install <name>` 走的是 **Git 仓库**，由**宿主机** nginx + fcgiwrap 提供（不在 docker compose 里）。
> 如果你暂时不需要 Claude Code 的 install 流程，可跳过本节，Web UI 本身能独立运行。

### 5.1 两个 marketplace 仓库的区别（先理清）

| 仓库 | 内容 | 来源 |
|------|------|------|
| `claude-skill-hub.git` | 项目源码 + 23 个**静态插件**（仓库 `plugins/`） | `git push internal main` 推上去；README 里让 Claude Code add 这个 |
| `skill-hub.git` | 管理员审核上架的**动态插件** | `scripts/sync-marketplace.sh` 同步生成 |

代码默认 `NEXT_PUBLIC_MARKETPLACE_URL = http://10.0.43.61:7789/git/skill-hub.git`（动态），README 示例用 `/git/claude-skill-hub.git`（静态）。**两者不一致**，请按你的需要二选一并统一（改代码默认 / 改 README / 构建时注入），本指南不替你拍板。

### 5.2 在内网宿主机搭 Git HTTP 服务

```bash
# === 内网 10.0.43.61 上 ===
apt-get install -y nginx fcgiwrap git
systemctl enable --now fcgiwrap.socket

# 建 bare 仓库
mkdir -p /opt/skill-hub/repo
git init --bare /opt/skill-hub/repo/claude-skill-hub.git
cd /opt/skill-hub/repo/claude-skill-hub.git
git symbolic-ref HEAD refs/heads/main

# 权限（nginx 以 www-data 跑 git-http-backend）
git config --global --add safe.directory /opt/skill-hub/repo/claude-skill-hub.git
chown -R www-data:www-data /opt/skill-hub/repo
chmod -R a+r /opt/skill-hub/repo
```

nginx 站点（监听 `7789`，把 `/git/` 交给 git-http-backend）：

```nginx
# /etc/nginx/conf.d/skill-hub-git.conf
server {
    listen 7789;
    server_name _;
    client_max_body_size 0;

    location ~ ^/git/(.*)$ {
        include            fastcgi_params;
        fastcgi_param      SCRIPT_FILENAME    /usr/lib/git-core/git-http-backend;
        fastcgi_param      GIT_HTTP_EXPORT_ALL "";
        fastcgi_param      GIT_PROJECT_ROOT   /opt/skill-hub/repo;
        fastcgi_param      PATH_INFO          /$1;
        fastcgi_pass       unix:/run/fcgiwrap.socket;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### 5.3 推送代码 + 验证

```bash
# 从任意能访问内网的机器把项目推上去（建立 internal remote）
cd <你的 claude-skill-hub 仓库>
git remote add internal http://10.0.43.61:7789/git/claude-skill-hub.git
git push internal main

# 验证 git smart HTTP 可用
curl -s "http://10.0.43.61:7789/git/claude-skill-hub.git/info/refs?service=git-upload-pack" | head -1
# 应输出: 001e# service=git-upload-pack

# 用户侧 Claude Code 接入
claude plugin marketplace add http://10.0.43.61:7789/git/claude-skill-hub.git
claude plugin install <plugin-name>@internal-skill-hub
```

### 5.4 发布插件 → 同步到 marketplace（重要限制）

`sync-marketplace.sh` 由 Web 应用在「发布/删除/编辑插件」时通过 `execSync(bash $SYNC_SCRIPT_PATH)` 调用。**问题**：该脚本用宿主路径（`/opt/skill-hub`、`/root/projects/...`）且依赖 `git`+`python`，而 `web` 容器是 `node:20-alpine`（没有 git/python），当前 `docker-compose.yml` 也没挂宿主目录。**所以容器内发布同步开箱即跑不通。**

三种处理方式，按需选一种：

1. **只做浏览/上传审核/下载 zip，不发布到 git marketplace**：忽略 `SYNC_SCRIPT_PATH`，发布按钮触发的同步会失败但不影响 Web UI 展示。最省事。
2. **宿主侧手动/定时同步**：在宿主机上跑 `bash /opt/claude-skill-hub/scripts/sync-marketplace.sh`（手动或 cron），把已发布插件同步到 `skill-hub.git`。
3. **容器内打通（较重）**：自定义 Dockerfile 在 runner 阶段 `apk add git python3`；把 `/opt/skill-hub` 和脚本挂进容器；把 `SYNC_SCRIPT_PATH` 指向挂载路径；并用环境变量覆盖脚本里的硬编码路径（`SKILL_HUB_ROOT`/`PROJECT_ROOT`/`STATIC_PLUGINS_DIR`，脚本已支持）。

> 若你要走方式 3，建议单独建一个 `Dockerfile.full`，别改坏默认 `Dockerfile`。

---

## 6. 日常运维

```bash
cd /opt/claude-skill-hub
export DC="docker compose -f docker-compose.offline.yml"

$DC ps                        # 状态
$DC logs --tail=100 web       # 日志
$DC restart web               # 重启
$DC down                      # 停止删容器（数据卷保留）
$DC down -v                   # ⚠️ 连数据卷一起删，慎用
```

### 离线更新到新版本

```bash
# 1. huoshan 重新构建导出
ssh -p 7504 root@115.190.193.230
cd /root/projects/claude-skill-hub && git pull origin main
docker build -t claude-skill-hub-web:latest .
docker save claude-skill-hub-web:latest -o skill-hub-web.tar && gzip skill-hub-web.tar

# 2. 传到内网 → load
#    （同 §3 A2 / A3）
gunzip -c skill-hub-web.tar.gz | docker load

# 3. 内网重启（镜像 tag 不变，重新拉起即用新镜像）
$DC up -d
```

### 数据备份/恢复

```bash
# 备份
docker run --rm -v claude-skill-hub_skill-hub-data:/d \
  -v "$(pwd)":/bk alpine tar czf /bk/data-backup.tar.gz -C /d .
# 恢复
docker run --rm -v claude-skill-hub_skill-hub-data:/d \
  -v "$(pwd)":/bk alpine tar xzf /bk/data-backup.tar.gz -C /d
```

> 卷名前缀取决于 compose 项目目录名，先 `docker volume ls | grep skill-hub` 确认。

---

## 7. 故障排查

| 现象 | 排查 |
|------|------|
| `docker load` 后 `docker images` 看不到 | 确认 tar 完整传输：`gunzip -t skill-hub-web.tar.gz`；旧版 Docker 不认 OCI 格式时，改用 `docker save` 默认格式（本指南命令即是） |
| `compose up` 报 `pull access denied` / 尝试联网 | compose 文件还在用 `build: .`，改用 `image: claude-skill-hub-web:latest`（见 §3 A4） |
| Web 起来但登录 401/签名失败 | `AUTH_SECRET` 没设且 `ADMIN_PASSWORD` 也空；至少设一个（代码回退逻辑见 `web/src/lib/auth.ts`） |
| `npm ci` 在内网构建失败 / 卡在拉包 | 锁文件 `resolved` 锁在 `registry.npmmirror.com`，内网访问不到。按 §4 B2 改写 resolved URL，或让内网 DNS 劫持 npmmirror；并加 `--network host` |
| `claude plugin install` 失败 | 先 `curl .../info/refs?service=git-upload-pack` 验证 git 服务；确认 marketplace URL 与实际仓库一致（§5.1） |
| 发布插件报 sync 错误 | 见 §5.4，容器内默认跑不了 sync-marketplace.sh |
| guide 页显示的 marketplace URL 不对 | `NEXT_PUBLIC_*` 是构建时变量，运行时 env 改不了；需在 huoshan 构建时设置（§3 A1） |

---

## 8. 环境变量速查

| 变量 | 作用 | 时机 | 默认/说明 |
|------|------|------|----------|
| `ADMIN_USERNAME` | 管理员账号 | 运行时 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | 运行时 | `admin@123456`（生产必改） |
| `AUTH_SECRET` | JWT 签名密钥 | 运行时 | 未设则回退 `ADMIN_PASSWORD` |
| `DATA_DIR` | 运行时数据（JSON） | 运行时 | `/app/data` |
| `UPLOAD_DIR` | 上传文件目录 | 运行时 | `/app/uploads` |
| `STATIC_PLUGINS_DIR` | 静态插件目录 | 运行时 | `plugins`（容器内即 `/app/plugins`） |
| `SYNC_SCRIPT_PATH` | 发布同步脚本 | 运行时 | `/root/projects/claude-skill-hub/scripts/sync-marketplace.sh`（容器内需调整，§5.4） |
| `NEXT_PUBLIC_MARKETPLACE_URL` | guide 页展示的 marketplace URL | **构建时** | `http://10.0.43.61:7789/git/skill-hub.git` |
| `PORT` / `HOSTNAME` | 容器监听 | 镜像内置 | `3000` / `0.0.0.0` |
