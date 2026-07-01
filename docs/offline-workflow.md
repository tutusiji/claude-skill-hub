# 离线导入工作流

## 背景

内部网络无外网访问。需要从外网机器下载 Claude Code 插件，通过物理介质（U盘、内网传输等）拷贝到内网，然后上架到内部 marketplace。

## 工具链

```
外网机器                      物理介质                    内网机器
┌──────────────────┐      ┌──────────┐      ┌──────────────────────────┐
│ fetch-plugin.mjs │      │  .tar.gz │      │ import-plugin.mjs        │
│ (下载+打包)       │ ───→ │  文件    │ ───→ │ (解包+注册+验证)          │
└──────────────────┘      └──────────┘      └──────────────────────────┘
```

## 第一步：外网机器下载

在外网机器上克隆本项目（或仅拷贝 `scripts/fetch-plugin.mjs`），然后执行：

```bash
# 示例 1：从 buildwithclaude 下载一个 agent 插件
node scripts/fetch-plugin.mjs \
  --repo davepoon/buildwithclaude \
  --path plugins/agents-python-expert

# 示例 2：从 daymade/claude-code-skills 下载一个技能
node scripts/fetch-plugin.mjs \
  --repo daymade/claude-code-skills \
  --path capture-screen

# 示例 3：从指定 tag 下载
node scripts/fetch-plugin.mjs \
  --repo daymade/claude-code-skills \
  --path deep-research \
  --ref v1.78.0

# 示例 4：下载整个 marketplace 仓库
node scripts/fetch-plugin.mjs \
  --repo daymade/claude-code-skills
```

脚本会：
1. `git clone --depth 1` 拉取仓库（sparse checkout 减少下载量）
2. 读取 `plugin.json` 和 `SKILL.md` 收集元数据
3. 打包为 `<plugin-name>.tar.gz`，写入 `.fetch-metadata.json` 记录来源

输出目录默认 `./offline-packages/`，可用 `--output` 指定。

## 第二步：物理传输

将 `offline-packages/` 目录下的 `.tar.gz` 文件拷贝到 U盘 或通过内网文件传输工具发送到内网机器。

## 第三步：内网机器上架

在内网机器的项目根目录执行：

```bash
# 基本导入
node scripts/import-plugin.mjs --package /path/to/agents-python-expert.tar.gz

# 指定分类和关键词
node scripts/import-plugin.mjs \
  --package /path/to/code-review-skill.tar.gz \
  --category developer-tools \
  --keywords "code-review,security,quality"

# 重命名插件
node scripts/import-plugin.mjs \
  --package /path/to/some-plugin.tar.gz \
  --name internal-code-reviewer
```

脚本会自动完成：
1. 解压 tarball 到 `plugins/<plugin-name>/`
2. 生成或补全 `.claude-plugin/plugin.json`
3. 注册到 `.claude-plugin/marketplace.json`
4. 运行 `validate-plugin.mjs` 校验结构和安全性
5. 校验失败自动回滚

## 第四步：验证和发布

```bash
# 本地验证插件可加载
claude --plugin-dir plugins/<plugin-name>

# 生成 registry 更新 Web UI 数据
node scripts/generate-registry.mjs

# 提交到内部 git 仓库
git add .
git commit -m "Add <plugin-name> plugin (imported from github:owner/repo)"
git push
```

推送后，内部服务器上的 Web UI 会自动重建（如果配置了 CI）或手动重建。所有用户的 Claude Code 执行 `claude plugin marketplace update` 后即可看到新插件。

## 批量导入

如果一次性导入多个插件：

```bash
# 外网机器：批量下载
for plugin in code-review-skill deep-research capture-screen; do
  node scripts/fetch-plugin.mjs --repo daymade/claude-code-skills --path $plugin
done

# 拷贝整个 offline-packages/ 目录到内网

# 内网机器：批量导入
for pkg in offline-packages/*.tar.gz; do
  node scripts/import-plugin.mjs --package "$pkg"
done
```

## 导入后审查清单

导入的插件虽然通过了自动验证，但建议人工审查以下内容：

- [ ] SKILL.md 的 description 是否清晰、无歧义
- [ ] 插件是否包含外部网络调用（检查脚本中的 curl/wget/fetch）
- [ ] 插件是否引用了内部不存在的文件路径
- [ ] 插件是否依赖了内网不可用的外部工具或服务
- [ ] 插件版本号是否与上游一致（便于后续追踪更新）
