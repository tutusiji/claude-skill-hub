'use client';

import { useState, useRef } from 'react';
import {
  GitPullRequest, FileCode, CheckCircle, AlertTriangle, Terminal,
  Upload, User, Mail, Building2, Hash, FileText, Loader2, Check, X,
} from 'lucide-react';

export default function ContributePage() {
  const [form, setForm] = useState({
    name: '', employeeId: '', email: '', department: '', description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    // Client-side validation
    if (!form.name.trim() || !form.employeeId.trim() || !form.email.trim() ||
        !form.department.trim() || !form.description.trim() || !file) {
      setResult({ success: false, message: '所有字段均为必填项，请完整填写。' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('employeeId', form.employeeId);
      formData.append('email', form.email);
      formData.append('department', form.department);
      formData.append('description', form.description);
      formData.append('file', file);

      const res = await fetch('/api/contribute', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || '提交成功！' });
        setForm({ name: '', employeeId: '', email: '', department: '', description: '' });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setResult({ success: false, message: data.error || '提交失败，请重试。' });
      }
    } catch {
      setResult({ success: false, message: '网络错误，请重试。' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">贡献插件</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        按照以下规范开发你的插件，打包上传后由管理员审核上架。
      </p>

      {/* Development Guidelines */}
      <div className="space-y-6 mb-8">
        <Step num={1} icon={Terminal} title="创建插件目录">
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

        <Step num={2} icon={FileCode} title="编写 plugin.json">
          <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto"><code>{`{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述，至少 10 个字符。",
  "category": "developer-tools",
  "keywords": ["automation", "testing"],
  "author": { "name": "你的名字" },
  "homepage": "https://github.com/...",
  "license": "MIT"
}`}</code></pre>
          <p className="text-xs text-[var(--muted)] mt-2">
            name 必须是小写连字符格式，version 必须是 semver 格式。可选字段：author、homepage、license。
          </p>
        </Step>

        <Step num={3} icon={CheckCircle} title="编写 SKILL.md">
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

        <Step num={4} icon={Upload} title="打包上传">
          <p className="text-sm text-[var(--muted)]">
            将整个插件目录打包为 <code className="text-brand-500">.zip</code> 文件，通过下方表单上传提交。
            管理员审核通过后会将插件添加到市场。
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

      {/* Upload Form */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-brand-500" />
          提交插件
        </h2>

        {result && (
          <div className={`mb-4 flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
            result.success
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
            {result.success ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <X className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{result.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="姓名" icon={User} required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="form-input"
                placeholder="张三"
              />
            </FormField>

            <FormField label="工号" icon={Hash} required>
              <input
                type="text"
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                className="form-input"
                placeholder="BYD00001"
              />
            </FormField>

            <FormField label="邮箱" icon={Mail} required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                placeholder="zhangsan@byd.com"
              />
            </FormField>

            <FormField label="部门" icon={Building2} required>
              <input
                type="text"
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="form-input"
                placeholder="平台研发部"
              />
            </FormField>
          </div>

          <FormField label="文件描述" icon={FileText} required>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-input min-h-[80px] resize-y"
              placeholder="简要描述插件功能、适用场景和技术栈..."
            />
          </FormField>

          <FormField label="上传插件包" icon={Upload} required>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".zip,.tar.gz,.tgz"
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-[var(--muted)] text-xs">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  <Upload className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  点击选择文件 · 支持 .zip / .tar.gz
                </div>
              )}
            </div>
          </FormField>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</>
            ) : (
              <><Upload className="w-4 h-4" /> 提交审核</>
            )}
          </button>
        </form>
      </div>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 0.625rem 0.75rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.form-input:focus) {
          border-color: var(--brand-500, #6366f1);
        }
        :global(.form-input::placeholder) {
          color: var(--muted);
        }
      `}</style>
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

function FormField({
  label, icon: Icon, required, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
