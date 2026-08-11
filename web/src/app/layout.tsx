import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Wrench } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skill Hub — 内部 AI 编程工具插件市场',
  description: '浏览、搜索并安装 Claude Code 插件与技能。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('skill-hub-theme');
            if (t) document.documentElement.setAttribute('data-theme', t);
          })();
        `}} />
      </head>
      <body className="min-h-screen antialiased">
        <header className="border-b border-[var(--border)] sticky top-0 z-50 backdrop-blur-md bg-[var(--background)]/80">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span className="text-brand-500">Skill</span>Hub
            </Link>
            <nav className="flex items-center gap-6 text-sm text-[var(--muted)]">
              <Link href="/" className="hover:text-[var(--foreground)] transition-colors">首页</Link>
              <Link href="/guide" className="hover:text-[var(--foreground)] transition-colors">使用指南</Link>
              <Link href="/contribute" className="hover:text-[var(--foreground)] transition-colors">贡献指南</Link>
              <Link href="/publish" className="hover:text-[var(--foreground)] transition-colors">发布</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-[var(--border)] mt-16">
          <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-[var(--muted)]">
            内部 AI 编程工具插件市场 — Platform Team
          </div>
        </footer>
      </body>
    </html>
  );
}
