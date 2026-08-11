'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench, LogOut, Download, CheckCircle, XCircle, Clock,
  Package, TrendingUp, Activity, EyeOff, Eye, ArrowLeft, RefreshCw,
  ShieldCheck, ShieldAlert, AlertTriangle, Loader2, ChevronDown, ChevronUp,
  Trash2, Rocket, Pencil, X, Zap, Settings, Plus, Save, RotateCcw,
  AlertOctagon, Bot, Plug,
} from 'lucide-react';
import type { Plugin } from '@/lib/types';
import type { LlmConfig, LlmProvider } from '@/lib/llm-config';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';
import registry from '@/lib/registry.json';
import { ErrorBoundary } from '@/components/error-boundary';

const plugins = registry as Plugin[];

interface Submission {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  description: string;
  filename: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  createdAt: string;
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    pluginName?: string;
    version?: string;
    skillsCount: number;
    commandsCount: number;
    filesScanned: number;
  };
}

interface StatsData {
  stats: Record<string, number>;
  topDownloads: Array<{ name: string; count: number }>;
  statusMap: Record<string, boolean>;
  recentDownloads: Array<{ pluginName: string; timestamp: string }>;
}

interface AiReviewRule {
  id: string;
  name: string;
  category: 'security' | 'privacy' | 'external-call' | 'dangerous-code' | 'data-exfiltration' | 'other';
  severity: 'high' | 'medium' | 'low';
  description: string;
  patterns?: string[];
  llmPrompt?: string;
  enabled?: boolean;
}

interface AiReviewResult {
  passed: boolean;
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  findings: Array<{
    ruleId: string;
    ruleName: string;
    category: string;
    severity: 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    snippet?: string;
    description: string;
  }>;
  filesScanned: number;
  regexChecked: boolean;
  llmChecked: boolean;
  llmError?: string;
  scannedAt: string;
}

type Tab = 'submissions' | 'plugins' | 'stats' | 'ai-review' | 'llm-config';

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('submissions');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [publishedPlugins, setPublishedPlugins] = useState<Plugin[]>([]);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, statsRes, pubRes, rulesRes] = await Promise.all([
        fetch('/api/admin/submissions'),
        fetch('/api/stats'),
        fetch('/api/published-plugins'),
        fetch('/api/admin/ai-review/rules'),
      ]);

      if (subRes.status === 401) {
        router.push('/admin');
        return;
      }

      const subData = await subRes.json();
      const statsJson = await statsRes.ok ? await statsRes.json() : null;
      const pubJson = await pubRes.ok ? await pubRes.json() : { plugins: [] };
      setSubmissions(subData.submissions || []);
      setStatsData(statsJson);
      setPublishedPlugins(pubJson.plugins || []);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setAiRules(rulesData.rules || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (id: string) => {
    window.open(`/api/admin/submissions/${id}/download`, '_blank');
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || '操作失败' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (id: string) => {
    setActionLoading(`publish_${id}`);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `插件「${data.plugin?.name || ''}」已上架成功` });
        await fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || '上架失败' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '网络错误' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条提交记录吗？上传的文件也会一并删除。')) return;
    setActionLoading(`delete_${id}`);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: '提交记录已删除' });
        await fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || '删除失败' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '网络错误' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePublish = async (name: string, currentPublished: boolean) => {
    setActionLoading(`plugin_${name}`);
    try {
      await fetch(`/api/admin/plugins/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !currentPublished }),
      });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  // ─── 编辑已上架插件 ──────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Plugin | null>(null);
  const [editForm, setEditForm] = useState({ description: '', category: '' });
  const [editSaving, setEditSaving] = useState(false);

  const handleEditClick = (plugin: Plugin) => {
    setEditTarget(plugin);
    setEditForm({ description: plugin.description, category: plugin.category });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/published-plugins/${editTarget.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `插件「${editTarget.name}」已更新` });
        setEditTarget(null);
        await fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || '更新失败' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '网络错误' });
    } finally {
      setEditSaving(false);
    }
  };

  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());
  const [expandedValidations, setExpandedValidations] = useState<Set<string>>(new Set());

  // ─── AI 审查相关 state ─────────────────────────────
  const [aiReviewResults, setAiReviewResults] = useState<Record<string, AiReviewResult>>({});
  const [aiReviewingIds, setAiReviewingIds] = useState<Set<string>>(new Set());
  const [expandedAiReviews, setExpandedAiReviews] = useState<Set<string>>(new Set());

  const [aiRules, setAiRules] = useState<AiReviewRule[]>([]);
  const [aiRulesLoading, setAiRulesLoading] = useState(false);
  const [aiRulesSaving, setAiRulesSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState<AiReviewRule | null>(null);

  const loadAiRules = useCallback(async () => {
    setAiRulesLoading(true);
    try {
      const res = await fetch('/api/admin/ai-review/rules');
      if (res.ok) {
        const data = await res.json();
        setAiRules(data.rules || []);
      }
    } finally {
      setAiRulesLoading(false);
    }
  }, []);

  const handleAiReview = async (id: string) => {
    setAiReviewingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/submissions/${id}/ai-review`);
      const data = await res.json();
      if (res.ok) {
        setAiReviewResults(prev => ({ ...prev, [id]: data }));
      } else {
        setAiReviewResults(prev => ({
          ...prev,
          [id]: {
            passed: false, riskLevel: 'none' as const, findings: [],
            filesScanned: 0, regexChecked: false, llmChecked: false,
            llmError: data.error || '审查失败', scannedAt: new Date().toISOString(),
          },
        }));
      }
    } catch {
      setAiReviewResults(prev => ({
        ...prev,
        [id]: {
          passed: false, riskLevel: 'none' as const, findings: [],
          filesScanned: 0, regexChecked: false, llmChecked: false,
          llmError: '网络错误', scannedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setAiReviewingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const toggleAiReviewExpand = (id: string) => {
    setExpandedAiReviews(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSaveRules = async () => {
    setAiRulesSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/ai-review/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: aiRules }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiRules(data.rules || []);
        setActionMessage({ type: 'success', text: '审查规则已保存' });
      } else {
        const data = await res.json();
        setActionMessage({ type: 'error', text: data.error || '保存失败' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '网络错误' });
    } finally {
      setAiRulesSaving(false);
    }
  };

  const handleResetRules = async () => {
    if (!window.confirm('确定要重置为默认规则吗？所有自定义修改将丢失。')) return;
    setAiRulesSaving(true);
    try {
      const res = await fetch('/api/admin/ai-review/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiRules(data.rules || []);
        setActionMessage({ type: 'success', text: '已重置为默认规则' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '网络错误' });
    } finally {
      setAiRulesSaving(false);
    }
  };

  const handleRuleToggle = (id: string) => {
    setAiRules(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: r.enabled === false } : r,
    ));
  };

  const handleEditRule = (rule: AiReviewRule) => {
    setEditingRuleId(rule.id);
    setDraftRule({ ...rule, patterns: rule.patterns ? [...rule.patterns] : [] });
  };

  const handleAddRule = () => {
    const newId = `custom-rule-${Date.now()}`;
    const newRule: AiReviewRule = {
      id: newId, name: '新规则', category: 'security',
      severity: 'medium', description: '', patterns: [], enabled: true,
    };
    setAiRules(prev => [...prev, newRule]);
    setEditingRuleId(newId);
    setDraftRule({ ...newRule });
  };

  // 表单字段更新（草稿规则）
  const handleDraftChange = (patch: Partial<AiReviewRule>) => {
    setDraftRule(prev => (prev ? { ...prev, ...patch } : prev));
  };

  // 正则模式：每行一条，保存时拆行
  const handleDraftPatternsChange = (text: string) => {
    const patterns = text.split('\n').map(s => s.trim()).filter(Boolean);
    setDraftRule(prev => (prev ? { ...prev, patterns } : prev));
  };

  const handleCancelEdit = () => {
    // 新增后取消：移除未保存的占位规则
    if (editingRuleId?.startsWith('custom-rule-')) {
      setAiRules(prev => prev.filter(r => r.id !== editingRuleId));
    }
    setEditingRuleId(null);
    setDraftRule(null);
  };

  const handleSaveEditedRule = () => {
    if (!draftRule || !editingRuleId) return;
    if (!draftRule.name.trim()) {
      setActionMessage({ type: 'error', text: '规则名称不能为空' });
      return;
    }
    if (!draftRule.description.trim()) {
      setActionMessage({ type: 'error', text: '规则描述不能为空' });
      return;
    }
    const noPatterns = !draftRule.patterns || draftRule.patterns.length === 0;
    const noLlm = !draftRule.llmPrompt || !draftRule.llmPrompt.trim();
    if (noPatterns && noLlm) {
      setActionMessage({ type: 'error', text: '正则模式与 LLM 提示词至少填一项' });
      return;
    }
    setAiRules(prev => prev.map(r => (r.id === editingRuleId ? draftRule : r)));
    setEditingRuleId(null);
    setDraftRule(null);
    setActionMessage({ type: 'success', text: '规则已更新' });
  };

  const handleDeleteRule = (id: string) => {
    if (!window.confirm('确定删除此规则？')) return;
    setAiRules(prev => prev.filter(r => r.id !== id));
    if (editingRuleId === id) setEditingRuleId(null);
  };

  // ─── 大模型配置相关 state ─────────────────────────────
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [llmConfigLoading, setLlmConfigLoading] = useState(false);
  const [llmConfigSaving, setLlmConfigSaving] = useState(false);
  const [llmConfigTesting, setLlmConfigTesting] = useState(false);
  const [llmConfigMessage, setLlmConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [llmConfigTestResult, setLlmConfigTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLlmConfig = useCallback(async () => {
    setLlmConfigLoading(true);
    setLlmConfigMessage(null);
    try {
      const res = await fetch('/api/admin/llm-config');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLlmConfigMessage({ type: 'error', text: data.error || '加载失败' });
        return;
      }
      const data = await res.json();
      setLlmConfig(data.config || null);
    } catch {
      setLlmConfigMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLlmConfigLoading(false);
    }
  }, []);

  const handleSaveLlmConfig = async (cfg: LlmConfig) => {
    setLlmConfigSaving(true);
    setLlmConfigMessage(null);
    try {
      const res = await fetch('/api/admin/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (res.ok) {
        setLlmConfig(data.config || cfg);
        setLlmConfigMessage({ type: 'success', text: '大模型配置已保存' });
      } else {
        setLlmConfigMessage({ type: 'error', text: data.error || '保存失败' });
      }
    } catch {
      setLlmConfigMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLlmConfigSaving(false);
    }
  };

  const handleResetLlmConfig = async () => {
    if (!window.confirm('确定要恢复默认配置吗？已保存的配置（含 API Key）将被删除，并回退到环境变量。')) return;
    setLlmConfigSaving(true);
    setLlmConfigMessage(null);
    setLlmConfigTestResult(null);
    try {
      const res = await fetch('/api/admin/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (res.ok) {
        setLlmConfig(data.config || null);
        setLlmConfigMessage({ type: 'success', text: '已恢复默认配置（回退到环境变量）' });
      } else {
        setLlmConfigMessage({ type: 'error', text: data.error || '重置失败' });
      }
    } catch {
      setLlmConfigMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLlmConfigSaving(false);
    }
  };

  const handleTestLlmConfig = async (cfg: LlmConfig) => {
    setLlmConfigTesting(true);
    setLlmConfigTestResult(null);
    setLlmConfigMessage(null);
    try {
      const res = await fetch('/api/admin/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', config: cfg }),
      });
      const data = await res.json();
      setLlmConfigTestResult({
        ok: data.ok === true,
        text: data.ok
          ? `连接成功${data.reply ? `：${data.reply}` : ''}`
          : (data.error || '测试失败'),
      });
    } catch {
      setLlmConfigTestResult({ ok: false, text: '网络错误' });
    } finally {
      setLlmConfigTesting(false);
    }
  };

  const handleValidate = async (id: string) => {
    setValidatingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/submissions/${id}/validate`);
      const data = await res.json();
      if (res.ok) {
        setValidationResults(prev => ({ ...prev, [id]: data }));
      } else {
        setValidationResults(prev => ({
          ...prev,
          [id]: { passed: false, errors: [data.error || '结构验证失败'], warnings: [], summary: { skillsCount: 0, commandsCount: 0, filesScanned: 0 } },
        }));
      }
    } catch {
      setValidationResults(prev => ({
        ...prev,
        [id]: { passed: false, errors: ['网络错误'], warnings: [], summary: { skillsCount: 0, commandsCount: 0, filesScanned: 0 } },
      }));
    } finally {
      setValidatingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const toggleValidationExpand = (id: string) => {
    setExpandedValidations(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  };

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <main className="min-h-screen">
      {/* Admin Header */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-5 h-5 text-brand-500" />
            <span className="font-semibold text-sm">管理后台</span>
            <Link href="/" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ml-2 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              返回前台
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
          <TabButton active={tab === 'submissions'} onClick={() => setTab('submissions')} icon={Clock}>
            提交审核
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-500">
                {pendingCount}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === 'plugins'} onClick={() => setTab('plugins')} icon={Package}>
            插件管理
          </TabButton>
          <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={TrendingUp}>
            统计数据
          </TabButton>
          <TabButton active={tab === 'ai-review'} onClick={() => { setTab('ai-review'); if (aiRules.length === 0) loadAiRules(); }} icon={Zap}>
            AI 审查规则
          </TabButton>
          <TabButton active={tab === 'llm-config'} onClick={() => { setTab('llm-config'); if (!llmConfig) loadLlmConfig(); }} icon={Bot}>
            大模型配置
          </TabButton>
          <button
            onClick={fetchData}
            className="ml-auto p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
            {actionMessage.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted)] text-sm">加载中...</div>
        ) : (
          <ErrorBoundary>
            {tab === 'submissions' ? (
              <SubmissionsTab
                submissions={submissions}
                onDownload={handleDownload}
                onStatusUpdate={handleStatusUpdate}
                onPublish={handlePublish}
                onDelete={handleDelete}
                actionLoading={actionLoading}
                onValidate={handleValidate}
                validationResults={validationResults}
                validatingIds={validatingIds}
                expandedValidations={expandedValidations}
                toggleValidationExpand={toggleValidationExpand}
                onAiReview={handleAiReview}
                aiReviewResults={aiReviewResults}
                aiReviewingIds={aiReviewingIds}
                expandedAiReviews={expandedAiReviews}
                toggleAiReviewExpand={toggleAiReviewExpand}
                aiRules={aiRules}
              />
            ) : tab === 'plugins' ? (
              <PluginsTab
                statsData={statsData}
                publishedPlugins={publishedPlugins}
                onTogglePublish={handleTogglePublish}
                onEdit={handleEditClick}
                actionLoading={actionLoading}
              />
            ) : tab === 'stats' ? (
              <StatsTab statsData={statsData} />
            ) : tab === 'ai-review' ? (
              <AiReviewTab
                rules={aiRules}
                loading={aiRulesLoading}
                saving={aiRulesSaving}
                editingRuleId={editingRuleId}
                draftRule={draftRule}
                onDraftChange={handleDraftChange}
                onDraftPatternsChange={handleDraftPatternsChange}
                onEditRule={handleEditRule}
                onSaveEditedRule={handleSaveEditedRule}
                onCancelEdit={handleCancelEdit}
                onToggleRule={handleRuleToggle}
                onAddRule={handleAddRule}
                onDeleteRule={handleDeleteRule}
                onSaveAll={handleSaveRules}
                onReset={handleResetRules}
              />
            ) : tab === 'llm-config' ? (
              <LlmConfigTab
                config={llmConfig}
                loading={llmConfigLoading}
                saving={llmConfigSaving}
                testing={llmConfigTesting}
                message={llmConfigMessage}
                testResult={llmConfigTestResult}
                onChange={setLlmConfig}
                onSave={handleSaveLlmConfig}
                onReset={handleResetLlmConfig}
                onTest={handleTestLlmConfig}
              />
            ) : null}
          </ErrorBoundary>
        )}
      </div>

      {/* ─── 编辑弹窗 ─── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditTarget(null)}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand-500" />
                编辑插件: {editTarget.name}
              </h3>
              <button onClick={() => setEditTarget(null)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">描述</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="form-input w-full resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">分类</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="form-input w-full"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                保存
              </button>
              <button
                onClick={() => setEditTarget(null)}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium bg-[var(--background)] border border-[var(--border)] rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TabButton({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-brand-500 text-brand-500'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ─── Submissions Tab ───────────────────────────────────────
function SubmissionsTab({
  submissions, onDownload, onStatusUpdate, onPublish, onDelete, actionLoading,
  onValidate, validationResults, validatingIds, expandedValidations, toggleValidationExpand,
  onAiReview, aiReviewResults, aiReviewingIds, expandedAiReviews, toggleAiReviewExpand, aiRules,
}: {
  submissions: Submission[];
  onDownload: (id: string) => void;
  onStatusUpdate: (id: string, status: 'approved' | 'rejected') => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  actionLoading: string | null;
  onValidate: (id: string) => void;
  validationResults: Record<string, ValidationResult>;
  validatingIds: Set<string>;
  expandedValidations: Set<string>;
  toggleValidationExpand: (id: string) => void;
  onAiReview: (id: string) => void;
  aiReviewResults: Record<string, AiReviewResult>;
  aiReviewingIds: Set<string>;
  expandedAiReviews: Set<string>;
  toggleAiReviewExpand: (id: string) => void;
  aiRules: AiReviewRule[];
}) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-20 text-[var(--muted)]">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">暂无提交记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((sub) => {
        const vr = validationResults[sub.id];
        const isValidating = validatingIds.has(sub.id);
        const isExpanded = expandedValidations.has(sub.id);
        const canPublish = vr?.passed && sub.status !== 'published';
        const aiR = aiReviewResults[sub.id];
        const isAiReviewing = aiReviewingIds.has(sub.id);
        const isAiExpanded = expandedAiReviews.has(sub.id);

        return (
          <div key={sub.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm">{sub.name}</h3>
                  <StatusBadge status={sub.status} />
                  {vr && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      vr.passed
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {vr.passed ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                      {vr.passed ? '结构验证通过' : `${vr.errors.length} 个错误`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                  <span>工号: {sub.employeeId}</span>
                  <span>邮箱: {sub.email}</span>
                  <span>部门: {sub.department}</span>
                  <span>{new Date(sub.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">{sub.description}</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  文件: <code className="text-brand-500">{sub.filename}</code>
                </p>
              </div>
            </div>

            {/* 验证结果详情 */}
            {vr && (
              <div className={`rounded-lg border p-3 mb-3 ${
                vr.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
              }`}>
                {vr.summary.pluginName && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                    <span className="text-[var(--muted)]">插件: <code className="text-brand-500">{vr.summary.pluginName}</code></span>
                    {vr.summary.version && <span className="text-[var(--muted)]">v{vr.summary.version}</span>}
                    <span className="text-[var(--muted)]">技能: {vr.summary.skillsCount}</span>
                    <span className="text-[var(--muted)]">命令: {vr.summary.commandsCount}</span>
                    <span className="text-[var(--muted)]">扫描: {vr.summary.filesScanned} 文件</span>
                  </div>
                )}
                {vr.errors.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-red-500 mb-1">错误 ({vr.errors.length})</div>
                    <ul className="space-y-0.5">
                      {vr.errors.map((err, i) => (
                        <li key={i} className="text-xs text-red-400 flex items-start gap-1.5">
                          <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {vr.warnings.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleValidationExpand(sub.id)}
                      className="text-xs font-medium text-yellow-500 mb-1 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      警告 ({vr.warnings.length})
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isExpanded && (
                      <ul className="space-y-0.5">
                        {vr.warnings.map((warn, i) => (
                          <li key={i} className="text-xs text-yellow-400/80 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{warn}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {vr.passed && vr.warnings.length === 0 && (
                  <div className="text-xs text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    插件结构完整，无安全风险。
                  </div>
                )}
              </div>
            )}

            {/* AI 审查结果 */}
            {aiR && (
              <div className={`rounded-lg border p-3 mb-3 ${
                aiR.riskLevel === 'high' ? 'bg-red-500/5 border-red-500/20' :
                aiR.riskLevel === 'medium' ? 'bg-orange-500/5 border-orange-500/20' :
                aiR.riskLevel === 'low' ? 'bg-yellow-500/5 border-yellow-500/20' :
                'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-3.5 h-3.5 ${
                      aiR.riskLevel === 'high' ? 'text-red-500' :
                      aiR.riskLevel === 'medium' ? 'text-orange-500' :
                      aiR.riskLevel === 'low' ? 'text-yellow-500' :
                      'text-emerald-500'
                    }`} />
                    <span className="text-xs font-semibold">
                      AI 安全审查：
                      {aiR.riskLevel === 'high' && <span className="text-red-500">高风险</span>}
                      {aiR.riskLevel === 'medium' && <span className="text-orange-500">中风险</span>}
                      {aiR.riskLevel === 'low' && <span className="text-yellow-500">低风险</span>}
                      {aiR.riskLevel === 'none' && <span className="text-emerald-500">无风险</span>}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      扫描 {aiR.filesScanned} 个文件
                      {aiR.llmChecked ? ' · LLM 深度' : ' · 仅正则'}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleAiReviewExpand(sub.id)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                  >
                    {aiR.findings.length > 0 ? `${aiR.findings.length} 项问题` : '查看详情'}
                    {isAiExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                {aiR.llmError && (
                  <div className="text-xs text-yellow-500 mb-2">
                    ⚠ LLM 深度审查不可用：{aiR.llmError}
                  </div>
                )}
                {isAiExpanded && (
                  <AiReviewDetail findings={aiR.findings} rules={aiRules} />
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onDownload(sub.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                下载审核
              </button>
              <button
                onClick={() => onValidate(sub.id)}
                disabled={isValidating}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--background)] border border-[var(--border)] hover:border-brand-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isValidating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 结构验证中...</>
                ) : (
                  <><ShieldCheck className="w-3.5 h-3.5" /> 结构验证</>
                )}
              </button>
              <button
                onClick={() => onAiReview(sub.id)}
                disabled={isAiReviewing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--background)] border border-[var(--border)] hover:border-purple-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isAiReviewing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 审查中...</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 text-purple-500" /> AI 审查</>
                )}
              </button>

              {/* 上架按钮：验证通过且未上架时显示 */}
              {canPublish && (
                <button
                  onClick={() => onPublish(sub.id)}
                  disabled={actionLoading === `publish_${sub.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading === `publish_${sub.id}` ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上架中...</>
                  ) : (
                    <><Rocket className="w-3.5 h-3.5" /> 上架</>
                  )}
                </button>
              )}

              {/* 已上架标记 */}
              {sub.status === 'published' && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5" />
                  已上架
                </span>
              )}

              {/* 通过/拒绝：pending 状态显示 */}
              {sub.status === 'pending' && (
                <>
                  <button
                    onClick={() => onStatusUpdate(sub.id, 'approved')}
                    disabled={actionLoading === sub.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    通过
                  </button>
                  <button
                    onClick={() => onStatusUpdate(sub.id, 'rejected')}
                    disabled={actionLoading === sub.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    拒绝
                  </button>
                </>
              )}

              {/* 删除按钮：始终显示，靠右 */}
              <button
                onClick={() => onDelete(sub.id)}
                disabled={actionLoading === `delete_${sub.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 ml-auto"
              >
                {actionLoading === `delete_${sub.id}` ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /></>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> 删除</>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plugins Tab ───────────────────────────────────────────
function PluginsTab({
  statsData, publishedPlugins, onTogglePublish, onEdit, actionLoading,
}: {
  statsData: StatsData | null;
  publishedPlugins: Plugin[];
  onTogglePublish: (name: string, published: boolean) => void;
  onEdit: (plugin: Plugin) => void;
  actionLoading: string | null;
}) {
  const statusMap = statsData?.statusMap || {};
  const stats = statsData?.stats || {};

  // 合并静态插件和已发布插件（去重）
  const staticNames = new Set(plugins.map(p => p.name));
  const dynamicPlugins = publishedPlugins.filter(p => !staticNames.has(p.name));
  const allPlugins = [...plugins, ...dynamicPlugins];

  return (
    <div className="space-y-2">
      {allPlugins.map((plugin) => {
        const isStatic = staticNames.has(plugin.name);
        const published = statusMap[plugin.name] !== false;
        const downloads = stats[plugin.name] || 0;
        return (
          <div key={plugin.name} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-sm">{plugin.name}</h3>
                <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
                {plugin.type === 'skills' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">纯技能</span>
                )}
                {!isStatic && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-500">动态上架</span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] mb-0.5 line-clamp-1">{plugin.description}</p>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span>{CATEGORY_LABELS[plugin.category] || plugin.category}</span>
                <span>{(plugin.skills?.length || 0)} 技能</span>
                <span>{downloads} 次下载</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* 编辑按钮：仅对已发布（非静态）插件显示 */}
              {!isStatic && (
                <button
                  onClick={() => onEdit(plugin)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${published ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--background)] text-[var(--muted)]'}`}>
                {published ? '已上架' : '已下架'}
              </span>
              {isStatic && (
                <button
                  onClick={() => onTogglePublish(plugin.name, published)}
                  disabled={actionLoading === `plugin_${plugin.name}`}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    published
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      : 'bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20'
                  }`}
                >
                  {published ? <><EyeOff className="w-3.5 h-3.5" />下架</> : <><Eye className="w-3.5 h-3.5" />上架</>}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stats Tab ─────────────────────────────────────────────
function StatsTab({ statsData }: { statsData: StatsData | null }) {
  if (!statsData) return null;

  const { topDownloads = [], recentDownloads = [] } = statsData;
  const totalDownloads = topDownloads.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)] mb-1">总下载次数</div>
          <div className="text-2xl font-bold">{totalDownloads}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)] mb-1">已上架插件</div>
          <div className="text-2xl font-bold">
            {Object.entries(statsData.statusMap || {}).filter(([, v]) => v !== false).length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)] mb-1">总插件数</div>
          <div className="text-2xl font-bold">{plugins.length}</div>
        </div>
      </div>

      {/* Top Downloads */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-500" />
          下载排行
        </h3>
        <div className="card divide-y divide-[var(--border)]">
          {topDownloads.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--muted)]">暂无下载数据</div>
          ) : (
            topDownloads.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 p-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < 3 ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--background)] text-[var(--muted)]'
                }`}>
                  {i + 1}
                </span>
                <span className="text-sm flex-1 truncate">{item.name}</span>
                <span className="text-xs text-[var(--muted)] font-mono">{item.count} 次</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" />
          最近下载活动
        </h3>
        <div className="card divide-y divide-[var(--border)]">
          {recentDownloads.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--muted)]">暂无活动</div>
          ) : (
            recentDownloads.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Download className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                <span className="text-sm flex-1 truncate">{item.pluginName}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(item.timestamp).toLocaleString('zh-CN')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI 审查结果详情（按规则全量展示）──────────────────────
function AiReviewDetail({ findings, rules }: { findings: AiReviewResult['findings']; rules: AiReviewRule[] }) {
  const categories: Array<{ id: AiReviewRule['category']; label: string; color: string }> = [
    { id: 'security', label: '安全漏洞', color: 'text-red-500' },
    { id: 'data-exfiltration', label: '数据外泄', color: 'text-orange-500' },
    { id: 'external-call', label: '外部调用', color: 'text-amber-500' },
    { id: 'dangerous-code', label: '危险代码', color: 'text-purple-500' },
    { id: 'privacy', label: '隐私收集', color: 'text-blue-500' },
    { id: 'other', label: '其他', color: 'text-[var(--muted)]' },
  ];

  const enabledRules = rules.filter(r => r.enabled !== false);

  const severityColor = {
    high: 'text-red-500',
    medium: 'text-orange-500',
    low: 'text-yellow-500',
  };

  return (
    <div className="space-y-3">
      {categories.map(cat => {
        const catRules = enabledRules.filter(r => r.category === cat.id);
        if (catRules.length === 0) return null;

        return (
          <div key={cat.id}>
            <div className={`text-xs font-semibold mb-1.5 ${cat.color}`}>
              {cat.label} ({catRules.length})
            </div>
            <div className="space-y-1.5">
              {catRules.map(rule => {
                const ruleFindings = findings.filter(f => f.ruleId === rule.id || f.ruleName === rule.name);
                const hasIssue = ruleFindings.length > 0;

                return (
                  <div key={rule.id} className="text-xs">
                    <div className="flex items-start gap-1.5">
                      {hasIssue ? (
                        <AlertOctagon className={`w-3 h-3 shrink-0 mt-0.5 ${severityColor[rule.severity]}`} />
                      ) : (
                        <CheckCircle className="w-3 h-3 shrink-0 mt-0.5 text-emerald-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{rule.name}</span>
                          {hasIssue ? (
                            <span className={`text-xs ${severityColor[rule.severity]}`}>
                              {ruleFindings.length} 处问题
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-500">未发现</span>
                          )}
                        </div>

                        {/* 有问题时展示详情 */}
                        {hasIssue && (
                          <ul className="mt-2 space-y-2">
                            {ruleFindings.map((f, i) => (
                              <li key={i} className="p-2.5 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                                <div className="text-xs text-[var(--muted)] break-all mb-1">
                                  📄 {f.file}{f.line ? `:${f.line}` : ''}
                                </div>
                                <div className="text-xs text-[var(--foreground)] break-words whitespace-pre-wrap">
                                  {f.description}
                                </div>
                                {f.snippet && (
                                  <pre className="mt-2 p-2 bg-black/20 rounded text-xs font-mono whitespace-pre-wrap break-all">
                                    {f.snippet}
                                  </pre>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI 审查规则管理 Tab ──────────────────────────────
function AiReviewTab({
  rules, loading, saving, editingRuleId, draftRule,
  onDraftChange, onDraftPatternsChange, onEditRule, onSaveEditedRule, onCancelEdit,
  onToggleRule, onAddRule, onDeleteRule, onSaveAll, onReset,
}: {
  rules: AiReviewRule[];
  loading: boolean;
  saving: boolean;
  editingRuleId: string | null;
  draftRule: AiReviewRule | null;
  onDraftChange: (patch: Partial<AiReviewRule>) => void;
  onDraftPatternsChange: (text: string) => void;
  onEditRule: (rule: AiReviewRule) => void;
  onSaveEditedRule: () => void;
  onCancelEdit: () => void;
  onToggleRule: (id: string) => void;
  onAddRule: () => void;
  onDeleteRule: (id: string) => void;
  onSaveAll: () => void;
  onReset: () => void;
}) {
  const categories: Array<{ id: AiReviewRule['category']; label: string; color: string }> = [
    { id: 'security', label: '安全漏洞', color: 'text-red-500' },
    { id: 'data-exfiltration', label: '数据外泄', color: 'text-orange-500' },
    { id: 'external-call', label: '外部调用', color: 'text-amber-500' },
    { id: 'dangerous-code', label: '危险代码', color: 'text-purple-500' },
    { id: 'privacy', label: '隐私收集', color: 'text-blue-500' },
    { id: 'other', label: '其他', color: 'text-[var(--muted)]' },
  ];

  const severityLabel = { high: '高', medium: '中', low: '低' };
  const severityColor = {
    high: 'bg-red-500/10 text-red-500 border-red-500/30',
    medium: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    low: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  };

  const grouped = categories.map(cat => ({
    ...cat,
    rules: rules.filter(r => r.category === cat.id),
  })).filter(g => g.rules.length > 0);

  const enabledCount = rules.filter(r => r.enabled !== false).length;

  if (loading) {
    return <div className="text-center py-20 text-[var(--muted)] text-sm">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 头部：统计 + 操作 */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-[var(--muted)]">审查规则总数</div>
            <div className="text-2xl font-bold">{rules.length} 条</div>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div>
            <div className="text-xs text-[var(--muted)]">已启用</div>
            <div className="text-2xl font-bold text-emerald-500">{enabledCount} 条</div>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div>
            <div className="text-xs text-[var(--muted)]">扫描方式</div>
            <div className="text-sm font-medium">
              <span className="text-emerald-500">正则扫描</span>
              <span className="text-[var(--muted)] text-xs ml-1">（本地）</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              LLM 深度审查需在「大模型配置」中配置模型与 API（未保存时回退到环境变量）
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddRule}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 新增规则
          </button>
          <button
            onClick={onReset}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--background)] border border-[var(--border)] hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 恢复默认
          </button>
          <button
            onClick={onSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> 保存全部</>
            )}
          </button>
        </div>
      </div>

      {/* 规则列表（按分类分组） */}
      {grouped.map(group => (
        <div key={group.id}>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${group.color}`}>
            <Settings className="w-4 h-4" />
            {group.label}
            <span className="text-xs text-[var(--muted)] font-normal">({group.rules.length})</span>
          </h3>
          <div className="space-y-2">
            {group.rules.map(rule => (
              <div key={rule.id} className="card p-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onToggleRule(rule.id)}
                    className={`mt-0.5 w-8 h-4 rounded-full transition-colors shrink-0 ${
                      rule.enabled === false ? 'bg-[var(--border)]' : 'bg-emerald-500'
                    }`}
                    title={rule.enabled === false ? '已禁用，点击启用' : '已启用，点击禁用'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      rule.enabled === false ? 'translate-x-0.5' : 'translate-x-4.5'
                    }`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{rule.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${severityColor[rule.severity]}`}>
                        {severityLabel[rule.severity]}风险
                      </span>
                      {rule.patterns && rule.patterns.length > 0 && (
                        <span className="text-xs text-[var(--muted)]">
                          {rule.patterns.length} 个正则
                        </span>
                      )}
                      {rule.llmPrompt && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/30">
                          LLM 规则
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditRule(rule)}
                      className="p-1.5 text-[var(--muted)] hover:text-brand-500 rounded transition-colors"
                      title="编辑规则"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 text-[var(--muted)] hover:text-red-500 rounded transition-colors"
                      title="删除规则"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 规则编辑器（展开时显示，表单形式） */}
                {editingRuleId === rule.id && draftRule && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">编辑规则</span>
                      <span className="text-xs text-[var(--muted)]">
                        正则模式与 LLM 提示词至少填一项
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-xs text-[var(--muted)]">规则名称</span>
                        <input
                          className="form-input mt-1"
                          value={draftRule.name}
                          onChange={e => onDraftChange({ name: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[var(--muted)]">严重程度</span>
                        <select
                          className="form-input mt-1"
                          value={draftRule.severity}
                          onChange={e => onDraftChange({ severity: e.target.value as AiReviewRule['severity'] })}
                        >
                          <option value="high">高</option>
                          <option value="medium">中</option>
                          <option value="low">低</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs text-[var(--muted)]">分类</span>
                        <select
                          className="form-input mt-1"
                          value={draftRule.category}
                          onChange={e => onDraftChange({ category: e.target.value as AiReviewRule['category'] })}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs text-[var(--muted)]">描述</span>
                      <textarea
                        className="form-input mt-1 resize-none"
                        rows={2}
                        value={draftRule.description}
                        onChange={e => onDraftChange({ description: e.target.value })}
                        placeholder="用一句话说明这条规则检测什么"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-[var(--muted)]">正则模式（每行一条，可选）</span>
                      <textarea
                        className="form-input mt-1 resize-none font-mono"
                        rows={3}
                        value={(draftRule.patterns || []).join('\n')}
                        onChange={e => onDraftPatternsChange(e.target.value)}
                        placeholder={'fetch\\s*\\(\npassword\\s*[:=]'}
                      />
                      <span className="text-xs text-[var(--muted)] block mt-1">
                        本地正则快速扫描，支持 JS 正则语法。
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-xs text-[var(--muted)]">LLM 提示词（自然语言，可选）</span>
                      <textarea
                        className="form-input mt-1 resize-none"
                        rows={3}
                        value={draftRule.llmPrompt || ''}
                        onChange={e => onDraftChange({ llmPrompt: e.target.value })}
                        placeholder="填写后该规则由大模型语义审查，可用自然语言描述要检测的风险"
                      />
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={draftRule.enabled !== false}
                        onChange={e => onDraftChange({ enabled: e.target.checked })}
                      />
                      启用此规则
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onSaveEditedRule}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> 应用修改
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--background)] border border-[var(--border)] rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> 取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 空状态 */}
      {rules.length === 0 && (
        <div className="text-center py-20 text-[var(--muted)]">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无审查规则</p>
          <button
            onClick={onReset}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 加载默认规则
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 大模型配置 Tab ────────────────────────────────────────
// 客户端 provider 预填（与 server 端 llm-config.ts 的 PROVIDER_PRESETS 保持一致，
// 但这里不能直接 import server 模块，避免把 node:fs 打进客户端 bundle）
const LLM_PROVIDER_PRESETS: Record<LlmProvider, { apiBaseUrl: string; model: string; label: string }> = {
  openai: { apiBaseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI（含兼容接口）' },
  anthropic: { apiBaseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', label: 'Anthropic' },
};

function LlmConfigTab({
  config, loading, saving, testing, message, testResult,
  onChange, onSave, onReset, onTest,
}: {
  config: LlmConfig | null;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
  testResult: { ok: boolean; text: string } | null;
  onChange: (c: LlmConfig) => void;
  onSave: (c: LlmConfig) => void;
  onReset: () => void;
  onTest: (c: LlmConfig) => void;
}) {
  const [showKey, setShowKey] = useState(false);

  if (loading) {
    return <div className="text-center py-20 text-[var(--muted)] text-sm">加载中...</div>;
  }

  if (!config) {
    return (
      <div className="text-center py-20 text-[var(--muted)]">
        <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">大模型配置加载失败</p>
        {message && <p className="text-xs text-red-500 mt-2">{message.text}</p>}
        <button
          onClick={() => onChange({ ...LLM_PROVIDER_PRESETS.openai, apiKey: '', temperature: 0.2, maxTokens: 2048, provider: 'openai' })}
          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          使用默认配置
        </button>
      </div>
    );
  }

  const setField = <K extends keyof LlmConfig>(key: K, value: LlmConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const handleProviderChange = (provider: LlmProvider) => {
    const preset = LLM_PROVIDER_PRESETS[provider];
    onChange({ ...config, provider, apiBaseUrl: preset.apiBaseUrl, model: preset.model });
  };

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <Plug className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--muted)] space-y-1">
            <p>
              配置 AI 审查使用的 LLM。支持 <span className="text-brand-500">OpenAI</span>（含所有 OpenAI 兼容端点）与 <span className="text-brand-500">Anthropic</span>。
            </p>
            <p>
              保存后写入 <code className="text-[var(--foreground)]">data/llm-config.json</code>（运行时数据目录，不会提交到 git）；未保存配置时回退到环境变量 <code className="text-[var(--foreground)]">AI_REVIEW_API_URL / AI_REVIEW_API_KEY / AI_REVIEW_MODEL</code>。
            </p>
          </div>
        </div>
      </div>

      {/* 配置表单 */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">服务商</label>
            <select
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
              className="form-input w-full"
            >
              <option value="openai">{LLM_PROVIDER_PRESETS.openai.label}</option>
              <option value="anthropic">{LLM_PROVIDER_PRESETS.anthropic.label}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">模型</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setField('model', e.target.value)}
              className="form-input w-full"
              placeholder={LLM_PROVIDER_PRESETS[config.provider].model}
              spellCheck={false}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">API Base URL</label>
            <input
              type="text"
              value={config.apiBaseUrl}
              onChange={(e) => setField('apiBaseUrl', e.target.value)}
              className="form-input w-full font-mono"
              placeholder={LLM_PROVIDER_PRESETS[config.provider].apiBaseUrl}
              spellCheck={false}
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              {config.provider === 'anthropic'
                ? 'Anthropic 自动补全 /v1/messages 路径；已含该路径时不会重复拼接。'
                : 'OpenAI 自动补全 /chat/completions 路径；已含该路径时不会重复拼接。'}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setField('apiKey', e.target.value)}
                className="form-input w-full pr-10 font-mono"
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                title={showKey ? '隐藏 Key' : '显示 Key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">明文保存在运行时数据目录，仅管理员可见，不会提交到 git。</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={config.temperature}
                onChange={(e) => setField('temperature', Math.min(2, Math.max(0, Number(e.target.value))))}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Max Tokens</label>
              <input
                type="number"
                min="1"
                value={config.maxTokens}
                onChange={(e) => setField('maxTokens', Math.max(1, Number(e.target.value)))}
                className="form-input w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onTest(config)}
          disabled={testing || saving || !config.apiBaseUrl.trim() || !config.apiKey.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
          title="使用当前表单值（尚未保存）发送一条测试消息"
        >
          {testing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 测试中...</> : <><Plug className="w-3.5 h-3.5" /> 测试连接</>}
        </button>
        <button
          onClick={() => onSave(config)}
          disabled={saving || testing}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...</> : <><Save className="w-3.5 h-3.5" /> 保存配置</>}
        </button>
        <button
          onClick={onReset}
          disabled={saving || testing}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium bg-[var(--background)] border border-[var(--border)] hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 恢复默认
        </button>
      </div>

      {/* 保存结果 */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div className={`flex items-start gap-2 px-4 py-2.5 rounded-lg text-sm ${
          testResult.ok
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {testResult.ok
            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="break-all">{testResult.text}</span>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }: { status: Submission['status'] }) {
  const config = {
    pending: { label: '待审核', cls: 'bg-amber-500/10 text-amber-500' },
    approved: { label: '已通过', cls: 'bg-emerald-500/10 text-emerald-500' },
    rejected: { label: '已拒绝', cls: 'bg-red-500/10 text-red-500' },
    published: { label: '已上架', cls: 'bg-brand-500/10 text-brand-500' },
  };
  const { label, cls } = config[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
