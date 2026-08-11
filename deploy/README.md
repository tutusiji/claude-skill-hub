# Skillhub 部署指南

## 环境概览

| 环境 | 地址 | 协议 | 用途 |
|------|------|------|------|
| 公网生产 | `https://your-public-host.com:7504` | HTTPS | 对外访问 |
| 内网生产 | `http://your-internal-host:7504` | HTTP | 内网团队使用 |
| 开发环境 | `http://your-dev-host:7504` | HTTP | 开发调试 |

## 前置条件

每台服务器需要安装：

```bash
# Node.js 18+
node --version

# nginx
nginx -v

# Git
git --version

# fcgiwrap（Git smart HTTP 协议支持）
apt-get install -y fcgiwrap
systemctl enable --now fcgiwrap.socket
```

## 部署步骤

### 1. 克隆代码

```bash
git clone git@github.com:tutusiji/claude-skill-hub.git /root/projects/claude-skill-hub
cd /root/projects/claude-skill-hub/web
npm install
```

### 2. 选择环境配置

仓库中的 `.env.development` / `.env.internal` / `.env.production` 仅含占位值（不包含真实密码/地址）。
真实配置存放在对应 gitignored 的 `.local` 文件（`.env.development.local` 等），需要运维在服务器上手动提供。

```bash
# 公网生产
cp .env.production.local .env.local

# 内网生产
cp .env.internal.local .env.local

# 开发环境
cp .env.development.local .env.local
```

> 若 `.env.<env>.local` 不存在，请向运维索取，或直接编辑 `.env.local` 填入真实的
> `ADMIN_PASSWORD`、`JWT_SECRET`、`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_MARKETPLACE_URL`。

### 3. 构建

```bash
npm run build
cp -r .next/static .next/standalone/.next/static
```

### 4. 配置 nginx

```bash
# 公网生产
cp deploy/nginx-public.conf /etc/nginx/conf.d/skill-hub-7504.conf

# 内网生产
cp deploy/nginx-internal.conf /etc/nginx/conf.d/skill-hub-7504.conf

# 开发环境
cp deploy/nginx-dev.conf /etc/nginx/conf.d/skill-hub-7504.conf

nginx -t && systemctl reload nginx
```

> 仓库中的 `deploy/nginx-*.conf` 已脱敏（`server_name`、证书路径、注释均为占位值）。
> 含真实地址与证书路径的原始版本保存在 gitignored 的 `secrets-backup/deploy/` 下，
> 部署时直接使用备份文件，或按需替换占位值为实际值。

### 5. 创建数据目录

```bash
mkdir -p /opt/skill-hub/{data,uploads,repo}
```

### 6. 初始化 Git marketplace 仓库

```bash
git init --bare /opt/skill-hub/repo/skill-hub.git
cd /opt/skill-hub/repo/skill-hub.git
git symbolic-ref HEAD refs/heads/main

# 创建工作树
mkdir -p /opt/skill-hub/marketplace-worktree
cd /opt/skill-hub/marketplace-worktree
git init && git checkout -b main
git remote add origin /opt/skill-hub/repo/skill-hub.git
mkdir -p .claude-plugin plugins
echo '{"name":"skill-hub","description":"内部 Claude Code 技能市场","owner":{"name":"Skillhub"},"plugins":[]}' > .claude-plugin/marketplace.json
git add -A && git -c user.name="Skillhub" -c user.email="bot@skill-hub" commit -m "init"
git push origin main
cd /opt/skill-hub/repo/skill-hub.git && git update-server-info
```

### 7. 修复 Git 权限

```bash
git config --global --add safe.directory /opt/skill-hub/repo/skill-hub.git
chown -R www-data:www-data /opt/skill-hub/repo/skill-hub.git
chmod -R a+r /opt/skill-hub/repo/skill-hub.git
```

### 8. 配置 systemd 服务

```bash
cat > /etc/systemd/system/skill-hub.service << 'EOF'
[Unit]
Description=Skillhub
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/projects/claude-skill-hub/web
EnvironmentFile=/root/projects/claude-skill-hub/web/.env.local
ExecStart=/root/projects/claude-skill-hub/web/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now skill-hub
```

### 9. 首次同步

```bash
bash /root/projects/claude-skill-hub/scripts/sync-marketplace.sh
```

### 10. 验证

```bash
# 检查 Web 服务
curl -o /dev/null -w "%{http_code}" http://localhost:7788

# 检查 Git clone
git clone http://localhost:7504/skill-hub.git /tmp/test-clone

# 检查 marketplace add
claude plugin marketplace add http://<server-ip>:7504/skill-hub.git
```

## 环境变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `change-me` |
| `JWT_SECRET` | JWT 签名密钥 | 随机字符串 |
| `DATA_DIR` | 数据目录 | `/opt/skill-hub/data` |
| `UPLOAD_DIR` | 上传目录 | `/opt/skill-hub/uploads` |
| `STATIC_PLUGINS_DIR` | 静态插件目录 | 项目 `plugins/` 目录 |
| `NEXT_PUBLIC_APP_URL` | 站点 URL | `https://your-public-host.com:7504` |
| `NEXT_PUBLIC_MARKETPLACE_URL` | marketplace Git URL | `https://your-public-host.com:7504/skill-hub.git` |

## 更新部署

```bash
cd /root/projects/claude-skill-hub
git pull
cd web
npm run build
cp -r .next/static .next/standalone/.next/static
sudo systemctl restart skill-hub.service
```
