'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Wrench } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    fetch('/api/stats').then(() => {
      // If we can access admin APIs, check auth
      fetch('/api/admin/submissions').then((res) => {
        if (res.ok) router.push('/admin/dashboard');
      });
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      router.push('/admin/dashboard');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 mb-3">
            <Wrench className="w-7 h-7 text-brand-500" />
          </div>
          <h1 className="text-xl font-bold mb-1">管理后台</h1>
          <p className="text-sm text-[var(--muted)]">Skill Hub 管理员登录</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="admin"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--muted)] mt-4">
          仅限管理员访问 · 内网 10.0.43.61:7788/admin
        </p>
      </div>
    </main>
  );
}
