'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Upload, User, Mail, Building2, Hash, FileText, Loader2, Check, X,
  ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, AlertTriangle,
  Rocket, ArrowLeft, FileCode,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    pluginName?: string;
    version?: string;
    description?: string;
    category?: string;
    skillsCount: number;
    commandsCount: number;
    filesScanned: number;
  };
}

type UploadType = 'plugin' | 'skills' | 'skill';

export default function PublishPage() {
  const [form, setForm] = useState({
    name: '', employeeId: '', email: '', department: '', description: '', category: '',
    uploadType: 'plugin' as UploadType,
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationDetail, setShowValidationDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setValidationResult(null);
    }
  };

  // ─── 上传前验证 ───────────────────────────────────
  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidationResult(null);
    setShowValidationDetail(false);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setValidationResult(data);
      } else {
        setValidationResult({
          passed: false,
          errors: [data.error || '验证失败'],
          warnings: [],
          summary: { skillsCount: 0, commandsCount: 0, filesScanned: 0 },
        });
      }
    } catch {
      setValidationResult({
        passed: false,
        errors: ['网络错误，请重试'],
        warnings: [],
        summary: { skillsCount: 0, commandsCount: 0, filesScanned: 0 },
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!form.name.trim() || !form.employeeId.trim() || !form.email.trim() ||
        !form.department.trim() || !form.description.trim() || !form.category.trim() || !file) {
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
      formData.append('category', form.category);
      formData.append('file', file);

      const res = await fetch('/api/contribute', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || '提交成功！管理员将在审核后处理您的插件。审核通过后会上架到 Skillhub，请持续关注！' });
        setForm({ name: '', employeeId: '', email: '', department: '', description: '', category: '', uploadType: 'plugin' });
        setFile(null);
        setValidationResult(null);
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

  const uploadTypeOptions: Array<{ value: UploadType; label: string; desc: string; icon: typeof FileCode }> = [
    { value: 'plugin', label: '标准插件', desc: '含 .claude-plugin/plugin.json', icon: Rocket },
    { value: 'skills', label: '技能集合', desc: 'skills/ 目录下多个技能', icon: FileCode },
    { value: 'skill', label: '单个技能', desc: '直接含 SKILL.md 平铺文件', icon: FileText },
  ];

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* 返回链接 */}
      <Link href="/" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6">
        <ArrowLeft className="w-3 h-3" />
        返回插件市场
      </Link>

      {/* 标题区 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 mb-4">
          <Rocket className="w-7 h-7 text-brand-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">发布你的插件</h1>
        <p className="text-sm text-[var(--muted)]">
          上传你的插件或技能包，管理员审核后将上架到 Skillhub
        </p>
      </div>

      {/* 成功弹窗 */}
      {result && result.success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">提交成功</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
              {result.message}
            </p>
            <button
              onClick={() => setResult(null)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 上传表单卡片 */}
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 上传类型选择 */}
          <div>
            <label className="text-xs font-medium mb-2 block">上传类型</label>
            <div className="grid grid-cols-3 gap-2">
              {uploadTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { handleChange('uploadType', opt.value); setValidationResult(null); }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.uploadType === opt.value
                      ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500'
                      : 'border-[var(--border)] hover:border-[var(--muted)]/50'
                  }`}
                >
                  <opt.icon className={`w-4 h-4 mb-1.5 ${form.uploadType === opt.value ? 'text-brand-500' : 'text-[var(--muted)]'}`} />
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 文件上传 */}
          <div>
            <label className="text-xs font-medium mb-2 block">上传文件</label>
            <label className="block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tar.gz,.tgz"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-brand-500/50 bg-brand-500/5' : 'border-[var(--border)] hover:border-brand-500/50'
              }`}>
                <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--muted)]" />
                {file ? (
                  <div>
                    <div className="text-xs font-medium">{file.name}</div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB · 点击重新选择
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-[var(--foreground)]">点击选择文件</div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">支持 .zip / .tar.gz</div>
                  </div>
                )}
              </div>
            </label>

            {/* 验证按钮和结果 */}
            {file && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--background)] border border-[var(--border)] hover:border-brand-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  {validating ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 验证中...</>
                  ) : validationResult ? (
                    <>重新验证</>
                  ) : (
                    <><ShieldCheck className="w-3.5 h-3.5" /> 上传前验证</>
                  )}
                </button>

                {/* 验证结果 */}
                {validationResult && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    validationResult.passed
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${
                      validationResult.passed ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {validationResult.passed
                        ? <><ShieldCheck className="w-4 h-4" /> 验证通过</>
                        : <><ShieldAlert className="w-4 h-4" /> 验证未通过</>}
                    </div>

                    {/* 错误列表 */}
                    {validationResult.errors.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {validationResult.errors.map((err, i) => (
                          <li key={i} className="text-xs text-red-500 flex items-start gap-1.5">
                            <X className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* 警告列表 */}
                    {validationResult.warnings.length > 0 && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowValidationDetail(!showValidationDetail)}
                          className="text-xs font-medium text-yellow-500 mb-1 flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          警告 ({validationResult.warnings.length})
                          {showValidationDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showValidationDetail && (
                          <ul className="space-y-1">
                            {validationResult.warnings.map((warn, i) => (
                              <li key={i} className="text-xs text-yellow-500 flex items-start gap-1.5">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{warn}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* 基本信息 */}
                    {validationResult.passed && validationResult.summary && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)]/50 grid grid-cols-2 gap-2 text-[10px] text-[var(--muted)]">
                        {validationResult.summary.pluginName && (
                          <div>名称：<span className="text-[var(--foreground)]">{validationResult.summary.pluginName}</span></div>
                        )}
                        {validationResult.summary.version && (
                          <div>版本：<span className="text-[var(--foreground)]">{validationResult.summary.version}</span></div>
                        )}
                        <div>技能数：<span className="text-[var(--foreground)]">{validationResult.summary.skillsCount}</span></div>
                        <div>命令数：<span className="text-[var(--foreground)]">{validationResult.summary.commandsCount}</span></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="border-t border-[var(--border)] pt-2">
            <div className="text-xs text-[var(--muted)] mb-3">填写发布者信息</div>
          </div>

          {/* 姓名 / 工号 */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* 邮箱 / 部门 */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* 插件描述 */}
          <FormField label="插件描述" icon={FileText} required>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-input min-h-[80px] resize-y"
              placeholder="简要描述插件功能、适用场景和技术栈..."
            />
          </FormField>

          {/* 插件分类 */}
          <FormField label="插件分类" required>
            <select
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="form-input"
            >
              <option value="">请选择分类</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
              ))}
            </select>
          </FormField>

          {/* 失败提示：行内显示 */}
          {result && !result.success && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm bg-red-500/10 text-red-500 border border-red-500/20">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{result.message}</span>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</>
            ) : (
              <><Rocket className="w-4 h-4" /> 提交发布</>
            )}
          </button>
        </form>
      </div>

      {/* 底部说明 */}
      <div className="mt-6 text-center">
        <p className="text-xs text-[var(--muted)]">
          不知道怎么打包？查看 <Link href="/contribute" className="text-brand-500 hover:underline">贡献指南</Link>
        </p>
      </div>
    </main>
  );
}

// ─── 辅助组件 ──────────────────────────────────────────
function FormField({
  label, icon: Icon, required, children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block">
        {Icon && <Icon className="w-3 h-3 inline mr-1 -mt-0.5 text-[var(--muted)]" />}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
