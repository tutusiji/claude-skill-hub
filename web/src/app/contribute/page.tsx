import { GitPullRequest, FileCode, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';

export default function ContributePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">贡献插件</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        每个插件在上架前都会经过审核。请按以下步骤操作。
      </p>

      <div className="space-y-6">
        <Step
          num={1}
          icon={Terminal}
          title="创建插件目录"
        >
          <p className="text-sm text-[var(--muted)] mb-3">
            在 <code className="text-brand-500">plugins/</code> 下创建目录，结构如下：
          </p>
          <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`plugins/
  my-plugin/
    .claude-plugin/
      plugin.json        # 必需 — 插件清单
    skills/
      my-skill/
        SKILL.md          # 技能定义
    commands/             # 可选
      my-command.md`}</code></pre>
        </Step>

        <Step
          num={2}
          icon={FileCode}
          title="编写 plugin.json"
        >
          <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述，至少 10 个字符。",
  "category": "developer-tools",
  "keywords": ["automation", "testing"]
}`}</code></pre>
          <p className="text-xs text-[var(--muted)] mt-2">
            name 必须是小写连字符格式，version 必须是 semver 格式。
          </p>
        </Step>

        <Step
          num={3}
          icon={CheckCircle}
          title="本地验证"
        >
          <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs"><code>{`node scripts/validate-plugin.mjs`}</code></pre>
          <p className="text-xs text-[var(--muted)] mt-2">
            提交前修复所有 error。warning 可接受但建议处理。
          </p>
        </Step>

        <Step
          num={4}
          icon={GitPullRequest}
          title="注册并提交 PR"
        >
          <p className="text-sm text-[var(--muted)] mb-2">
            将插件添加到 <code className="text-brand-500">.claude-plugin/marketplace.json</code>：
          </p>
          <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`{
  "name": "my-plugin",
  "description": "...",
  "source": "./plugins/my-plugin",
  "version": "1.0.0",
  "category": "developer-tools",
  "keywords": ["automation"]
}`}</code></pre>
          <p className="text-sm text-[var(--muted)] mt-3">
            然后提交 PR。CI 会自动验证插件结构、扫描密钥、检查注册状态。
          </p>
        </Step>

        <div className="card p-5 border-l-2 border-yellow-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold">审核标准</h3>
          </div>
          <ul className="text-xs text-[var(--muted)] space-y-1">
            <li>- 不得包含硬编码的密钥、令牌或凭证</li>
            <li>- 描述需清晰说明技能的用途</li>
            <li>- SKILL.md 必须包含 YAML frontmatter</li>
            <li>- 分类和关键词需准确</li>
            <li>- 未经说明不得调用外部网络服务</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Step({ num, icon: Icon, title, children }: {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold shrink-0">
          {num}
        </div>
        <Icon className="w-4 h-4 text-brand-500" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
