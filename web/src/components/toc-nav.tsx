'use client';

import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  title: string;
}

/**
 * 左侧章节锚点导航:sticky 定位 + IntersectionObserver 滚动高亮当前章节。
 * 传入的 items 应为模块级常量(稳定引用),避免每次渲染重建 observer。
 */
export function TocNav({ items, title = '本页目录' }: { items: TocItem[]; title?: string }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 取当前进入视口、最靠上的 section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId((visible[0].target as HTMLElement).id);
        }
      },
      // 顶部留出 sticky header 高度,底部留 70% 让章节在进入上 30% 区域时即激活
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="本页目录">
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
        {title}
      </p>
      <ul className="space-y-0.5 border-l border-[var(--border)]">
        {items.map((it, i) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={`block pl-3 -ml-px py-1 text-xs leading-relaxed border-l-2 transition-colors ${
                activeId === it.id
                  ? 'text-brand-500 border-brand-500 font-medium'
                  : 'text-[var(--muted)] border-transparent hover:text-[var(--foreground)]'
              }`}
            >
              <span className="text-[var(--muted)]/60 mr-1.5">{i + 1}.</span>
              {it.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
