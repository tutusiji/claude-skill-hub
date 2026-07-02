'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench, LogOut, Download, CheckCircle, XCircle, Clock,
  Package, TrendingUp, Activity, EyeOff, Eye, ArrowLeft, RefreshCw,
  ShieldCheck, ShieldAlert, AlertTriangle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Plugin } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
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
  status: 'pending' | 'approved' | 'rejected';
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

type Tab = 'submissions' | 'plugins' | 'stats';

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('submissions');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, statsRes] = await Promise.all([
        fetch('/api/admin/submissions'),
        fetch('/api/stats'),
      ]);

      if (subRes.status === 401) {
        router.push('/admin');
        return;
      }

      const subData = await subRes.json();
      const statsJson = await statsRes.ok ? await statsRes.json() : null;
      setSubmissions(subData.submissions || []);
      setStatsData(statsJson);
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
    try {
      await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchData();
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

  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());
  const [expandedValidations, setExpandedValidations] = useState<Set<string>>(new Set());

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
          [id]: { passed: false, errors: [data.error || '验证失败'], warnings: [], summary: { skillsCount: 0, commandsCount: 0, filesScanned: 0 } },
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
          <button
            onClick={fetchData}
            className="ml-auto p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

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
                actionLoading={actionLoading}
                onValidate={handleValidate}
                validationResults={validationResults}
                validatingIds={validatingIds}
                expandedValidations={expandedValidations}
                toggleValidationExpand={toggleValidationExpand}
              />
            ) : tab === 'plugins' ? (
              <PluginsTab
                statsData={statsData}
                onTogglePublish={handleTogglePublish}
                actionLoading={actionLoading}
              />
            ) : (
              <StatsTab statsData={statsData} />
            )}
          </ErrorBoundary>
        )}
      </div>
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
  submissions, onDownload, onStatusUpdate, actionLoading,
  onValidate, validationResults, validatingIds, expandedValidations, toggleValidationExpand,
}: {
  submissions: Submission[];
  onDownload: (id: string) => void;
  onStatusUpdate: (id: string, status: 'approved' | 'rejected') => void;
  actionLoading: string | null;
  onValidate: (id: string) => void;
  validationResults: Record<string, ValidationResult>;
  validatingIds: Set<string>;
  expandedValidations: Set<string>;
  toggleValidationExpand: (id: string) => void;
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

        return (
          <div key={sub.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">{sub.name}</h3>
                  <StatusBadge status={sub.status} />
                  {vr && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      vr.passed
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {vr.passed ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                      {vr.passed ? '验证通过' : `${vr.errors.length} 个错误`}
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

            <div className="flex items-center gap-2">
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
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 验证中...</>
                ) : (
                  <><ShieldCheck className="w-3.5 h-3.5" /> 验证</>
                )}
              </button>
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
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plugins Tab ───────────────────────────────────────────
function PluginsTab({
  statsData, onTogglePublish, actionLoading,
}: {
  statsData: StatsData | null;
  onTogglePublish: (name: string, published: boolean) => void;
  actionLoading: string | null;
}) {
  const statusMap = statsData?.statusMap || {};
  const stats = statsData?.stats || {};

  return (
    <div className="space-y-2">
      {plugins.map((plugin) => {
        const published = statusMap[plugin.name] !== false;
        const downloads = stats[plugin.name] || 0;
        return (
          <div key={plugin.name} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-sm">{plugin.name}</h3>
                <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span>{CATEGORY_LABELS[plugin.category] || plugin.category}</span>
                <span>{(plugin.skills?.length || 0)} 技能</span>
                <span>{downloads} 次下载</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full ${published ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--background)] text-[var(--muted)]'}`}>
                {published ? '已上架' : '已下架'}
              </span>
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

// ─── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }: { status: Submission['status'] }) {
  const config = {
    pending: { label: '待审核', cls: 'bg-amber-500/10 text-amber-500' },
    approved: { label: '已通过', cls: 'bg-emerald-500/10 text-emerald-500' },
    rejected: { label: '已拒绝', cls: 'bg-red-500/10 text-red-500' },
  };
  const { label, cls } = config[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
