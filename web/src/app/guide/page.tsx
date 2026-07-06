import { BookOpen, Download, Terminal, Zap, Layers, GitBranch, FileCode, Workflow, Cpu } from 'lucide-react';
import Link from 'next/link';
import { TocNav } from '@/components/toc-nav';

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://10.0.43.61:7789/git/skill-hub.git';

const SECTIONS = [
  { id: 'tools', title: '支持的工具' },
  { id: 'what-is', title: '什么是 AI 编程工具' },
  { id: 'install', title: '安装 AI 编程工具' },
  { id: 'basic', title: '基本用法' },
  { id: 'commands', title: '常用指令' },
  { id: 'scenarios', title: '高频场景与实战' },
  { id: 'plugins', title: '配合插件开发' },
  { id: 'tips', title: '高效使用小贴士' },
];

export default function GuidePage() {
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
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-brand-500" />
              <h1 className="text-2xl font-bold">使用指南</h1>
            </div>
            <p className="text-sm text-[var(--muted)]">
              本平台支持多种 AI 编程工具。从安装到进阶，掌握核心用法，配合插件和技能提升开发效率。
            </p>
          </div>

          {/* 支持的工具 */}
          <Section id="tools" icon={Cpu} title="支持的工具">
            <p className="text-sm text-[var(--muted)] mb-3">本平台的插件兼容以下 AI 编程工具：</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">工具</th>
                    <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">厂商</th>
                    <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">安装命令</th>
                    <th className="text-left py-2 font-medium text-[var(--muted)]">技能文件</th>
                  </tr>
                </thead>
                <tbody>
                  <ToolRow name="Claude Code" vendor="Anthropic" cmd="claude plugin install <name>@skill-hub" file="SKILL.md" />
                  <ToolRow name="Codex CLI" vendor="OpenAI" cmd="codex --plugin <name>" file="AGENTS.md" />
                  <ToolRow name="Kimi Code" vendor="Moonshot" cmd="kimi plugin install <name>@skill-hub" file="SKILL.md" />
                  <ToolRow name="OpenCode" vendor="Open Source" cmd="opencode plugin add <name>" file="AGENTS.md" />
                  <ToolRow name="CodeWhale" vendor="CodeWhale" cmd="codewhale plugin install <name>@skill-hub" file="SKILL.md" />
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              每个插件详情页会根据你使用的工具显示对应的安装命令。
            </p>
          </Section>

          {/* 什么是 AI 编程工具 */}
          <Section id="what-is" icon={Terminal} title="什么是 AI 编程工具">
            <p className="text-sm text-[var(--muted)] mb-3">
              AI 编程工具是运行在终端中的 AI Agent，能直接读写项目文件、执行命令、运行测试。不同厂商的产品各有特色，但核心能力一致：理解代码库、编写和修改代码、执行终端命令、创建 Git 提交、代码审查。
            </p>
            <p className="text-sm text-[var(--muted)]">
              它们不是聊天机器人，而是能直接动手干活的编程助手。通过安装插件和技能，可以扩展它们的能力，适配团队的开发规范和工作流程。
            </p>
          </Section>

          {/* 安装 */}
          <Section id="install" icon={Download} title="安装 AI 编程工具">
            <div className="space-y-4">
              <InstallBlock tool="Claude Code" cmd="npm install -g @anthropic-ai/claude-code" verify="claude --version" />
              <InstallBlock tool="Codex CLI" cmd="npm install -g @openai/codex" verify="codex --version" />
              <InstallBlock tool="Kimi Code" cmd="npm install -g @moonshot-ai/kimi-code" verify="kimi --version" />
              <InstallBlock tool="OpenCode" cmd="npm install -g opencode" verify="opencode --version" />
              <InstallBlock tool="CodeWhale" cmd="npm install -g @codewhale/cli" verify="codewhale --version" />
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              前提条件：Node.js 18+，已安装 npm。内网无法直连时需要配置代理或使用离线安装包。
            </p>
          </Section>

          {/* 基本用法 */}
          <Section id="basic" icon={Zap} title="基本用法">
            <p className="text-sm text-[var(--muted)] mb-3">在项目目录下启动工具，进入交互模式后用自然语言描述需求：</p>
            <CodeBlock>{`cd my-project
<tool-name>    # 启动工具（如 claude / codex / kimi）`}</CodeBlock>
            <div className="mt-4 space-y-2">
              <Example text='帮我看看 src/auth/login.ts 有没有安全问题' />
              <Example text='给 User 模型加上邮箱验证字段，生成数据库迁移脚本' />
              <Example text='运行测试，如果失败了帮我修复' />
              <Example text='把刚才的改动提交，commit message 用中文' />
            </div>
          </Section>

          {/* 常用指令 */}
          <Section id="commands" icon={Layers} title="常用指令">
            <p className="text-sm text-[var(--muted)] mb-4">
              各工具的 slash command 大同小异，以下是通用指令对照：
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-3 font-medium text-[var(--muted)]">指令</th>
                    <th className="text-left py-2 pr-3 font-medium text-[var(--muted)]">含义</th>
                    <th className="text-left py-2 font-medium text-[var(--muted)]">使用场景</th>
                  </tr>
                </thead>
                <tbody>
                  <CmdRow cmd="/help" desc="查看帮助" scene="忘记指令时查看完整列表" />
                  <CmdRow cmd="/init" desc="初始化项目配置" scene="首次使用，生成项目配置文件" />
                  <CmdRow cmd="/clear" desc="清空对话历史" scene="切换任务时清理上下文" />
                  <CmdRow cmd="/compact" desc="压缩对话历史" scene="对话太长时压缩上下文" />
                  <CmdRow cmd="/review" desc="代码审查" scene="提交前审查代码变更" />
                  <CmdRow cmd="/commit" desc="生成提交信息" scene="改动完成后自动生成 commit message" />
                  <CmdRow cmd="/bug" desc="排查 Bug" scene="遇到报错时启动调试" />
                  <CmdRow cmd="/model" desc="切换模型" scene="在不同模型间切换" />
                  <CmdRow cmd="/cost" desc="查看用量" scene="查看 token 消耗" />
                  <CmdRow cmd="/config" desc="查看修改配置" scene="调整模型、权限等设置" />
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              部分指令在不同工具中可能有差异，以实际工具文档为准。
            </p>
          </Section>

          {/* 高频场景 */}
          <Section id="scenarios" icon={GitBranch} title="高频场景与实战">
            <SubStep title="1. 项目初始化">
              <CodeBlock>{`cd my-project
<tool> --init    # 或在交互模式中输入 /init`}</CodeBlock>
              <p className="text-xs text-[var(--muted)] mt-2">
                生成项目配置文件，让 AI 理解项目规范、技术栈和约定。
              </p>
            </SubStep>

            <SubStep title="2. 开发新功能">
              <CodeBlock>{`> 帮我在 src/api/ 下新增一个用户导出接口，
  支持 CSV 和 JSON 格式，需要分页和权限校验`}</CodeBlock>
            </SubStep>

            <SubStep title="3. 代码审查">
              <CodeBlock>{`> /review`}</CodeBlock>
              <p className="text-xs text-[var(--muted)] mt-2">
                配合 <Link href="/plugins/code-review" className="text-brand-500">code-review</Link> 或 <Link href="/plugins/security-audit" className="text-brand-500">security-audit</Link> 技能效果更好。
              </p>
            </SubStep>

            <SubStep title="4. 提交代码">
              <CodeBlock>{`> /commit`}</CodeBlock>
              <p className="text-xs text-[var(--muted)] mt-2">
                配合 <Link href="/plugins/git-commit-pro" className="text-brand-500">git-commit-pro</Link> 技能可生成符合 Conventional Commits 规范的中文提交信息。
              </p>
            </SubStep>

            <SubStep title="5. 修复 Bug">
              <CodeBlock>{`> /bug
  登录接口返回 500，错误日志是 TypeError:
  Cannot read property 'name' of undefined`}</CodeBlock>
            </SubStep>
          </Section>

          {/* 配合插件开发 */}
          <Section id="plugins" icon={Workflow} title="配合插件开发">
            <p className="text-sm text-[var(--muted)] mb-4">
              插件和技能是 AI 编程工具的能力扩展包。安装后工具会自动在合适的场景调用技能，无需手动切换。
            </p>

            <SubStep title="安装插件">
              <p className="text-sm text-[var(--muted)] mb-2">先添加内部 marketplace，再安装插件：</p>
              <CodeBlock>{`# 添加 marketplace（所有工具通用）
# Claude Code
claude plugin marketplace add ${MARKETPLACE_URL}

# Codex CLI
codex config set marketplace ${MARKETPLACE_URL}

# Kimi Code
kimi plugin marketplace add ${MARKETPLACE_URL}

# 安装插件（按工具选择对应命令）
# 详见各插件详情页的安装命令`}</CodeBlock>
            </SubStep>

            <SubStep title="自动触发">
              <p className="text-sm text-[var(--muted)] mb-2">
                安装后无需手动调用，AI 会根据你的意图自动选择合适的技能：
              </p>
              <div className="space-y-2">
                <Example text='帮我写个 Dockerfile 部署这个项目  ->  调用 docker-pro 技能' />
                <Example text='审查一下这段代码有没有安全漏洞  ->  调用 security-audit 技能' />
                <Example text='给这些函数加上中文注释  ->  调用 cn-docstring 技能' />
                <Example text='这段文案太 AI 了，改自然一点  ->  调用 humanizer-zh 技能' />
              </div>
            </SubStep>

            <SubStep title="推荐技能组合">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">场景</th>
                      <th className="text-left py-2 font-medium text-[var(--muted)]">推荐技能</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ComboRow scene="后端 API 开发" skills={["cn-docstring", "code-review", "git-commit-pro"]} />
                    <ComboRow scene="容器化部署" skills={["docker-pro", "security-audit"]} />
                    <ComboRow scene="大项目管理" skills={["planning-with-files", "superpowers"]} />
                    <ComboRow scene="前端开发" skills={["frontend-design", "cn-docstring"]} />
                    <ComboRow scene="安全上线检查" skills={["security-audit", "code-review", "hol-guard"]} />
                    <ComboRow scene="团队协作规范化" skills={["git-commit-pro", "skill-creator"]} />
                  </tbody>
                </table>
              </div>
            </SubStep>

            <SubStep title="自定义技能">
              <p className="text-sm text-[var(--muted)] mb-2">
                用 <Link href="/plugins/skill-creator" className="text-brand-500">skill-creator</Link> 创建专属技能，将团队规范和重复性工作封装为可复用的能力。详见 <Link href="/contribute" className="text-brand-500">贡献指南</Link>。
              </p>
            </SubStep>
          </Section>

          {/* 小贴士 */}
          <Section id="tips" icon={FileCode} title="高效使用小贴士">
            <ul className="text-sm text-[var(--muted)] space-y-2">
              <li>- 用 <code className="text-brand-500">/init</code> 初始化项目配置，AI 会记住你的项目规范</li>
              <li>- 描述需求时给出上下文：技术栈、文件路径、约束条件，越具体效果越好</li>
              <li>- 复杂任务拆成小步骤，逐步确认，避免一次性改太多文件</li>
              <li>- 用 <code className="text-brand-500">/compact</code> 压缩长对话，保持上下文清晰</li>
              <li>- 提交前用 <code className="text-brand-500">/review</code> 做一轮自动审查</li>
              <li>- 遇到报错直接粘贴日志，AI 能精准定位问题</li>
              <li>- 安装相关插件后，AI 会自动在合适的场景应用，无需手动切换</li>
              <li>- 不同工具的技能文件格式不同（SKILL.md / AGENTS.md），平台会自动适配</li>
            </ul>
          </Section>

          <div className="mt-8 flex items-center justify-between">
            <Link href="/" className="text-sm text-brand-500 hover:underline">浏览插件市场 →</Link>
            <Link href="/contribute" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">贡献指南 →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ id, icon: Icon, title, children }: {
  id?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="card p-5 mb-4 scroll-mt-20">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-brand-500" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SubStep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{children}</code></pre>
  );
}

function Example({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-[var(--muted)]">
      <span className="text-brand-500 shrink-0">&gt;</span>
      <span>{text}</span>
    </div>
  );
}

function CmdRow({ cmd, desc, scene }: { cmd: string; desc: string; scene: string }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 pr-3"><code className="text-brand-500 text-xs">{cmd}</code></td>
      <td className="py-2 pr-3 text-[var(--muted)]">{desc}</td>
      <td className="py-2 text-[var(--muted)]">{scene}</td>
    </tr>
  );
}

function ToolRow({ name, vendor, cmd, file }: { name: string; vendor: string; cmd: string; file: string }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 pr-4 text-[var(--foreground)] font-medium text-xs">{name}</td>
      <td className="py-2 pr-4 text-[var(--muted)] text-xs">{vendor}</td>
      <td className="py-2 pr-4"><code className="text-brand-500 text-xs">{cmd}</code></td>
      <td className="py-2 text-[var(--muted)] text-xs">{file}</td>
    </tr>
  );
}

function InstallBlock({ tool, cmd, verify }: { tool: string; cmd: string; verify: string }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{tool}</p>
      <CodeBlock>{`# 安装\n${cmd}\n\n# 验证\n${verify}`}</CodeBlock>
    </div>
  );
}

function ComboRow({ scene, skills }: { scene: string; skills: string[] }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 pr-4 text-[var(--muted)] text-xs">{scene}</td>
      <td className="py-2 text-xs">
        {skills.map((s, i) => (
          <span key={s}>
            <Link href={`/plugins/${s}`} className="text-brand-500">{s}</Link>
            {i < skills.length - 1 && ' + '}
          </span>
        ))}
      </td>
    </tr>
  );
}
