import Link from 'next/link';
import {
  FileCode, CheckCircle, AlertTriangle, Terminal, Upload, Rocket,
} from 'lucide-react';
import { TocNav } from '@/components/toc-nav';

const SECTIONS = [
  { id: 'create', title: '准备目录结构' },
  { id: 'plugin-json', title: '编写 plugin.json' },
  { id: 'skill-md', title: '编写 SKILL.md' },
  { id: 'package', title: '打包上传' },
  { id: 'review', title: '审核标准' },
  { id: 'submit', title: '发布插件' },
];

export default function ContributePage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-8">
        {/* 左侧章节锚点 */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <TocNav items={SECTIONS} />
          </div>
        </aside>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-2">贡献指南</h1>
          <p className="text-sm text-[var(--muted)] mb-8">
            按照以下规范开发你的插件，打包后前往发布页面提交，由管理员审核上架。
          </p>

          {/* Development Guidelines */}
          <div className="space-y-6 mb-8">
            <Step id="create" num={1} icon={Terminal} title="准备目录结构">
              <p className="text-sm text-[var(--muted)] mb-3">
                根据你要上传的类型，选择对应的目录结构：
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-xs font-semibold text-brand-500 mb-2">结构 A：标准插件</div>
                  <pre className="bg-[var(--background)] rounded p-3 text-xs overflow-x-auto"><code>{`my-plugin/
  .claude-plugin/
    plugin.json      # 必需 — 插件清单
  skills/
    my-skill/
      SKILL.md       # 技能定义
  commands/           # 可选
    my-command.md`}</code></pre>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-xs font-semibold text-brand-500 mb-2">结构 B：技能集合包</div>
                  <pre className="bg-[var(--background)] rounded p-3 text-xs overflow-x-auto"><code>{`my-skills/
  skills/
    skill-a/
      SKILL.md
    skill-b/
      SKILL.md
  README.md           # 可选`}</code></pre>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-xs font-semibold text-brand-500 mb-2">结构 C：单个技能（平铺）</div>
                  <pre className="bg-[var(--background)] rounded p-3 text-xs overflow-x-auto"><code>{`my-skill/
  SKILL.md           # 必需 — 带 YAML frontmatter
  assets/            # 可选
  references/        # 可选`}</code></pre>
                </div>
              </div>
            </Step>

            <Step id="plugin-json" num={2} icon={FileCode} title="编写 plugin.json（含 compatibility 字段）">
              <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述，至少 10 个字符。",
  "category": "developer-tools",
  "keywords": ["automation", "testing"],
  "compatibility": ["claude-code", "codex", "kimi-code", "opencode", "codewhale"],
  "author": { "name": "你的名字" },
  "homepage": "https://github.com/...",
  "license": "MIT"
}`}</code></pre>
              <p className="text-xs text-[var(--muted)] mt-2">
                name 必须是小写连字符格式，version 必须是 semver 格式。可选字段：author、homepage、license。
              </p>
            </Step>

            <Step id="skill-md" num={3} icon={CheckCircle} title="编写 SKILL.md">
              <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`---
name: my-skill
description: 技能描述 — 什么场景下使用
---

# 技能内容

在这里编写技能的具体指令和流程...`}</code></pre>
              <p className="text-xs text-[var(--muted)] mt-2">
                SKILL.md 必须包含 YAML frontmatter（name 和 description 字段）。
              </p>
            </Step>

            <Step id="package" num={4} icon={Upload} title="打包上传">
              <p className="text-sm text-[var(--muted)] mb-3">
                将整个目录打包为 <code className="text-brand-500">.zip</code> 文件后前往发布页面上传。
              </p>
              <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`# 在目录的上级执行
zip -r my-plugin.zip my-plugin/

# 或使用 tar.gz
tar -czf my-plugin.tar.gz my-plugin/

# 注意：ZIP 内需要有一层根目录（不能是文件直接平铺）
# 例如：my-skill.zip 解压后是 my-skill/SKILL.md`}</code></pre>
            </Step>

            <div id="review" className="card p-5 border-l-2 border-yellow-500 scroll-mt-20">
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

          {/* 发布引导 */}
          <div id="submit" className="card p-8 scroll-mt-20 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 mb-4">
              <Rocket className="w-7 h-7 text-brand-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">准备好发布你的插件了吗？</h2>
            <p className="text-sm text-[var(--muted)] mb-6 max-w-md mx-auto">
              按照上面的规范打包好插件后，前往发布页面提交，管理员审核通过后将上架到 Skillhub。
            </p>
            <Link
              href="/publish"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Rocket className="w-4 h-4" />
              立即发布
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Step({ id, num, icon: Icon, title, children }: {
  id?: string;
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="card p-5 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold shrink-0 text-white">
          {num}
        </div>
        <Icon className="w-4 h-4 text-brand-500" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
