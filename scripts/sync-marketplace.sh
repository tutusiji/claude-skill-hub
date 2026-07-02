#!/bin/bash
# sync-marketplace.sh — 将已发布插件同步到 Git marketplace 仓库
# 用法: sync-marketplace.sh
# 由 publishSubmission / deleteSubmission 调用

set -e

WORKTREE="/opt/skill-hub/marketplace-worktree"
BARE_REPO="/opt/skill-hub/repo/skill-hub.git"
PUBLISHED_JSON="/opt/skill-hub/data/published-plugins.json"
STATIC_PLUGINS_DIR="${STATIC_PLUGINS_DIR:-/root/projects/claude-skill-hub/plugins}"
REGISTRY_JSON="/root/projects/claude-skill-hub/web/src/lib/registry.json"

cd "$WORKTREE"

# 1. 清空现有 plugins 目录（保留 .claude-plugin）
rm -rf plugins
mkdir -p plugins

# 2. 复制静态插件（来自 registry.json）
if [ -d "$STATIC_PLUGINS_DIR" ]; then
  cp -r "$STATIC_PLUGINS_DIR"/* plugins/ 2>/dev/null || true
fi

# 3. 复制已发布的动态插件
if [ -f "$PUBLISHED_JSON" ]; then
  python3 << 'PYEOF'
import json, os, shutil

PUBLISHED = "/opt/skill-hub/data/published-plugins.json"
DEST = "/opt/skill-hub/marketplace-worktree/plugins"

with open(PUBLISHED) as f:
    plugins = json.load(f)

for p in plugins:
    name = p["name"]
    src = p.get("extractedPath", "")
    if src and os.path.isdir(src):
        dest = os.path.join(DEST, name)
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(src, dest)
        print(f"  synced: {name}")
    else:
        print(f"  skip (no files): {name}")
PYEOF
fi

# 4. 生成 marketplace.json
python3 << 'PYEOF'
import json, os

REGISTRY = "/root/projects/claude-skill-hub/web/src/lib/registry.json"
PUBLISHED = "/opt/skill-hub/data/published-plugins.json"
PLUGINS_DIR = "/opt/skill-hub/marketplace-worktree/plugins"
OUTPUT = "/opt/skill-hub/marketplace-worktree/.claude-plugin/marketplace.json"

# 静态插件
static_plugins = []
if os.path.exists(REGISTRY):
    with open(REGISTRY) as f:
        static_plugins = json.load(f)

# 已发布插件
published_plugins = []
if os.path.exists(PUBLISHED):
    with open(PUBLISHED) as f:
        published_plugins = json.load(f)

# 合并去重
seen = set()
marketplace_plugins = []

for p in static_plugins + published_plugins:
    name = p["name"]
    if name in seen:
        continue
    seen.add(name)

    # 只列出实际存在于 plugins/ 目录的插件
    plugin_dir = os.path.join(PLUGINS_DIR, name)
    if not os.path.isdir(plugin_dir):
        continue

    marketplace_plugins.append({
        "name": name,
        "description": p.get("description", ""),
        "category": p.get("category", "other"),
        "source": f"./plugins/{name}",
        "version": p.get("version", "1.0.0"),
    })

marketplace = {
    "name": "skill-hub",
    "description": "内部 Claude Code 技能市场 — 浏览、搜索并安装内部技能和插件",
    "owner": {"name": "Skill Hub"},
    "plugins": marketplace_plugins,
}

with open(OUTPUT, "w") as f:
    json.dump(marketplace, f, ensure_ascii=False, indent=2)

print(f"marketplace.json: {len(marketplace_plugins)} plugins")
PYEOF

# 5. Git commit + push
git add -A
if git diff --cached --quiet; then
    echo "no changes"
else
    git -c user.name="Skill Hub" -c user.email="bot@skill-hub" commit -m "sync: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
    echo "pushed to bare repo"
fi

# 6. 更新 server-info（dumb HTTP fallback）
cd "$BARE_REPO"
git update-server-info

echo "=== sync complete ==="
