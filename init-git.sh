#!/bin/bash
# 初始化内部 Git 仓库 — docker compose 首次启动后执行一次
set -e

GIT_URL="http://10.0.43.61:7789/git/claude-skill-hub.git"
REMOTE_NAME="internal"

echo "=== 初始化内部 Git 仓库 ==="
echo "Git 地址: $GIT_URL"
echo ""

if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "[$REMOTE_NAME] remote 已存在，更新 URL..."
  git remote set-url "$REMOTE_NAME" "$GIT_URL"
else
  git remote add "$REMOTE_NAME" "$GIT_URL"
fi

echo "推送代码到内部仓库..."
git push "$REMOTE_NAME" main

echo ""
echo "=== 验证 ==="
git clone "$GIT_URL" /tmp/skill-hub-verify 2>/dev/null
if [ -f /tmp/skill-hub-verify/.claude-plugin/marketplace.json ]; then
  echo "✓ Git 仓库正常，marketplace.json 可访问"
  echo "✓ 插件目录: $(ls /tmp/skill-hub-verify/plugins/ | wc -l) 个插件"
else
  echo "✗ 验证失败，请检查 git-server 容器状态"
fi
rm -rf /tmp/skill-hub-verify

echo ""
echo "=== 完成 ==="
echo "Web UI:    http://10.0.43.61:7788"
echo "Git 仓库:  $GIT_URL"
echo ""
echo "用户配置 Claude Code:"
echo "  claude plugin marketplace add $GIT_URL"
