import { BookOpen, Download, Terminal, Zap, Layers, GitBranch, FileCode, Workflow } from 'lucide-react';
import Link from 'next/link';

export default function GuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-brand-500" />
          <h1 className="text-2xl font-bold">Claude Code 使用指南</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">
          从安装到进阶，掌握 Claude Code 的核心用法，配合 Skill 提升开发效率。
        </p>
      </div>

      {/* 什么是 Claude Code */}
      <Section icon={Terminal} title="什么是 Claude Code">
        <p className="text-sm text-[var(--muted)] mb-3">
          Claude Code 是 Anthropic 推出的 AI 命令行编程助手。它运行在终端中，能直接读写你的项目文件、执行命令、运行测试，像一个随时待命的高级工程师。
        </p>
        <p className="text-sm text-[var(--muted)]">
          核心能力包括：理解整个代码库、编写和修改代码、执行终端命令、运行测试、创建 Git 提交、代码审查。它不是聊天机器人，而是能直接动手干活的 AI Agent。
        </p>
      </Section>

      {/* 安装 */}
      <Section icon={Download} title="安装">
        <p className="text-sm text-[var(--muted)] mb-3">在终端执行以下命令安装：</p>
        <CodeBlock>{`# 安装 Claude Code
npm install -g @anthropic-ai/claude-code

# 验证安装
claude --version`}</CodeBlock>
        <p className="text-sm text-[var(--muted)] mt-3 mb-2">首次使用需要登录：</p>
        <CodeBlock>{`# 启动并登录（会打开浏览器认证）
claude`}</CodeBlock>
        <p className="text-xs text-[var(--muted)] mt-3">
          前提条件：Node.js 18+，已安装 npm。如果内网无法直连，需要配置代理或使用离线安装包。
        </p>
      </Section>

      {/* 基本用法 */}
      <Section icon={Zap} title="基本用法">
        <p className="text-sm text-[var(--muted)] mb-3">在项目目录下启动 Claude Code：</p>
        <CodeBlock>{`cd my-project
claude`}</CodeBlock>
        <p className="text-sm text-[var(--muted)] mt-3 mb-3">
          进入交互模式后，直接用自然语言描述你想做的事情：
        </p>
        <div className="space-y-2">
          <Example text='帮我看看 src/auth/login.ts 有没有安全问题' />
          <Example text='给 User 模型加上邮箱验证字段，生成数据库迁移脚本' />
          <Example text='运行测试，如果失败了帮我修复' />
          <Example text='把刚才的改动提交，commit message 用中文' />
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          Claude 会自动读取文件、分析代码、给出方案或直接修改代码。你可以在每一步确认或调整。
        </p>
      </Section>

      {/* 常用指令 */}
      <Section icon={Layers} title="常用指令（Slash Commands）">
        <p className="text-sm text-[var(--muted)] mb-4">
          在交互模式中输入 <code className="text-brand-500">/</code> 开头的指令可以快速触发特定功能：
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">指令</th>
                <th className="text-left py-2 pr-4 font-medium text-[var(--muted)]">含义</th>
                <th className="text-left py-2 font-medium text-[var(--muted)]">使用场景</th>
              </tr>
            </thead>
            <tbody>
              <CmdRow cmd="/help" desc="查看帮助" scene="忘记指令时查看完整列表" />
              <CmdRow cmd="/init" desc="初始化项目配置" scene="首次在项目中使用，生成 CLAUDE.md" />
              <CmdRow cmd="/clear" desc="清空对话历史" scene="切换任务时清理上下文，避免干扰" />
              <CmdRow cmd="/compact" desc="压缩对话历史" scene="对话太长时压缩上下文，保留关键信息" />
              <CmdRow cmd="/review" desc="代码审查" scene="提交前让 Claude 审查代码变更" />
              <CmdRow cmd="/commit" desc="生成提交信息" scene="改动完成后自动生成 commit message" />
              <CmdRow cmd="/bug" desc="排查 Bug" scene="遇到报错或异常行为时启动调试流程" />
              <CmdRow cmd="/login" desc="切换账号" scene="更换 API Key 或重新登录" />
              <CmdRow cmd="/config" desc="查看修改配置" scene="调整模型、温度、权限等设置" />
              <CmdRow cmd="/cost" desc="查看用量" scene="查看当前会话的 token 消耗" />
              <CmdRow cmd="/model" desc="切换模型" scene="在不同模型间切换（如 Sonnet / Opus）" />
              <CmdRow cmd="/vim" desc="Vim 模式" scene="习惯 Vim 键位的用户开启 Vim 编辑" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* 高频指令 */}
      <Section icon={GitBranch} title="高频指令与实战场景">
        <p className="text-sm text-[var(--muted)] mb-4">
          以下是项目开发中最常用的指令组合，按开发流程排列：
        </p>

        <SubStep title="1. 项目初始化">
          <CodeBlock>{`cd my-project
claude
> /init`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            <code className="text-brand-500">/init</code> 会扫描项目结构，生成 <code className="text-brand-500">CLAUDE.md</code> 配置文件，让 Claude 理解项目的规范、技术栈和约定。
          </p>
        </SubStep>

        <SubStep title="2. 开发新功能">
          <CodeBlock>{`> 帮我在 src/api/ 下新增一个用户导出接口，
  支持 CSV 和 JSON 格式，需要分页和权限校验`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            描述需求，Claude 会自动创建文件、编写代码、添加类型定义。你可以在每一步确认或修改。
          </p>
        </SubStep>

        <SubStep title="3. 代码审查">
          <CodeBlock>{`> /review`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            自动审查当前未提交的变更，找出 Bug、安全问题和代码规范问题。
          </p>
        </SubStep>

        <SubStep title="4. 提交代码">
          <CodeBlock>{`> /commit`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            分析 diff 自动生成规范的 commit message，确认后直接提交。配合 <Link href="/plugins/git-commit-pro" className="text-brand-500 hover:underline">git-commit-pro</Link> 技能可以生成符合 Conventional Commits 规范的中文提交信息。
          </p>
        </SubStep>

        <SubStep title="5. 修复 Bug">
          <CodeBlock>{`> /bug
  登录接口返回 500，错误日志是 TypeError: Cannot read
  property 'name' of undefined`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            粘贴错误信息，Claude 会定位问题代码、分析根因并给出修复方案。
          </p>
        </SubStep>

        <SubStep title="6. 补充测试">
          <CodeBlock>{`> 给 src/utils/date.test.ts 补充边界条件测试，
  覆盖闰年、月末、时区切换场景`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            Claude 会分析函数逻辑，自动生成覆盖各种边界条件的测试用例。
          </p>
        </SubStep>
      </Section>

      {/* 配合 Skill 开发 */}
      <Section icon={Workflow} title="配合 Skill 开发">
        <p className="text-sm text-[var(--muted)] mb-4">
          Skill 是 Claude Code 的能力扩展包。安装后 Claude 会自动在合适的场景调用技能，你也可以手动触发。
        </p>

        <SubStep title="安装 Skill">
          <CodeBlock>{`# 查看市场中的可用插件
/plugin browse

# 安装指定插件
/plugin install docker-pro@internal-skill-hub

# 查看已安装的插件
/plugin list`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            内网环境下，将 Claude Code 的 marketplace 指向内部服务器即可：
          </p>
          <CodeBlock>{`claude plugin marketplace add http://10.0.43.61:7789/git/claude-skill-hub.git`}</CodeBlock>
        </SubStep>

        <SubStep title="自动触发">
          <p className="text-sm text-[var(--muted)] mb-2">
            安装后无需手动调用，Claude 会根据你的意图自动选择合适的技能：
          </p>
          <div className="space-y-2">
            <Example text='帮我写个 Dockerfile 部署这个 Node 项目  ->  自动调用 docker-pro 技能' />
            <Example text='审查一下这段代码有没有安全漏洞  ->  自动调用 security-audit 技能' />
            <Example text='给这些函数加上中文注释  ->  自动调用 cn-docstring 技能' />
            <Example text='这段文案太 AI 了，改自然一点  ->  自动调用 humanizer-zh 技能' />
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
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">后端 API 开发</td>
                  <td className="py-2">
                    <Link href="/plugins/cn-docstring" className="text-brand-500">cn-docstring</Link>
                    {' + '}
                    <Link href="/plugins/code-review" className="text-brand-500">code-review</Link>
                    {' + '}
                    <Link href="/plugins/git-commit-pro" className="text-brand-500">git-commit-pro</Link>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">容器化部署</td>
                  <td className="py-2">
                    <Link href="/plugins/docker-pro" className="text-brand-500">docker-pro</Link>
                    {' + '}
                    <Link href="/plugins/security-audit" className="text-brand-500">security-audit</Link>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">大项目管理</td>
                  <td className="py-2">
                    <Link href="/plugins/planning-with-files" className="text-brand-500">planning-with-files</Link>
                    {' + '}
                    <Link href="/plugins/superpowers" className="text-brand-500">superpowers</Link>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">前端开发</td>
                  <td className="py-2">
                    <Link href="/plugins/frontend-design" className="text-brand-500">frontend-design</Link>
                    {' + '}
                    <Link href="/plugins/cn-docstring" className="text-brand-500">cn-docstring</Link>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">安全上线检查</td>
                  <td className="py-2">
                    <Link href="/plugins/security-audit" className="text-brand-500">security-audit</Link>
                    {' + '}
                    <Link href="/plugins/code-review" className="text-brand-500">code-review</Link>
                    {' + '}
                    <Link href="/plugins/hol-guard" className="text-brand-500">hol-guard</Link>
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">团队协作规范化</td>
                  <td className="py-2">
                    <Link href="/plugins/git-commit-pro" className="text-brand-500">git-commit-pro</Link>
                    {' + '}
                    <Link href="/plugins/skill-creator" className="text-brand-500">skill-creator</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SubStep>

        <SubStep title="自定义 Skill">
          <p className="text-sm text-[var(--muted)] mb-2">
            团队有特定的开发规范或重复性工作？用 <Link href="/plugins/skill-creator" className="text-brand-500">skill-creator</Link> 创建专属技能：
          </p>
          <CodeBlock>{`> 帮我创建一个 skill，把我们公司的 API 响应格式
  规范封装进去，所有接口都要按这个格式返回`}</CodeBlock>
          <p className="text-xs text-[var(--muted)] mt-2">
            Claude 会引导你编写 SKILL.md，生成插件结构，验证后注册到市场。详见 <Link href="/contribute" className="text-brand-500">贡献指南</Link>。
          </p>
        </SubStep>
      </Section>

      {/* 小贴士 */}
      <Section icon={FileCode} title="高效使用小贴士">
        <ul className="text-sm text-[var(--muted)] space-y-2">
          <li>- 用 <code className="text-brand-500">/init</code> 初始化项目配置，Claude 会记住你的项目规范</li>
          <li>- 描述需求时给出上下文：技术栈、文件路径、约束条件，越具体效果越好</li>
          <li>- 复杂任务拆成小步骤，逐步确认，避免一次性改太多文件</li>
          <li>- 用 <code className="text-brand-500">/compact</code> 压缩长对话，保持上下文清晰</li>
          <li>- 提交前用 <code className="text-brand-500">/review</code> 做一轮自动审查</li>
          <li>- 遇到报错直接粘贴日志，Claude 能精准定位问题</li>
          <li>- 安装相关 Skill 后，Claude 会自动在合适的场景应用，无需手动切换</li>
        </ul>
      </Section>

      <div className="mt-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-brand-500 hover:underline">浏览插件市场 →</Link>
        <Link href="/contribute" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">贡献指南 →</Link>
      </div>
    </main>
  );
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 mb-4">
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
      <td className="py-2 pr-4">
        <code className="text-brand-500 text-xs">{cmd}</code>
      </td>
      <td className="py-2 pr-4 text-[var(--muted)]">{desc}</td>
      <td className="py-2 text-[var(--muted)]">{scene}</td>
    </tr>
  );
}
