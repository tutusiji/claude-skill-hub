'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export function LikeButton({ pluginName, initialCount = 0 }: { pluginName: string; initialCount?: number }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const key = `skill-hub-liked:${pluginName}`;
      if (localStorage.getItem(key)) setLiked(true);
    } catch { /* ignore */ }
  }, [pluginName]);

  const handleLike = async () => {
    if (loading || liked) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/like`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setCount(data.likes);
        setLiked(true);
        // 记录到 localStorage，防止重复点赞（刷新后保持已赞状态）
        try {
          const key = `skill-hub-liked:${pluginName}`;
          localStorage.setItem(key, '1');
        } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading || liked}
      title={liked ? '已点赞' : '点赞'}
      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:cursor-default ${
        liked
          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
          : 'bg-[var(--background)] border border-[var(--border)] hover:border-rose-500 hover:text-rose-500'
      }`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
      )}
      {liked ? '已点赞' : '点赞'}
      <span className="tabular-nums">{count > 0 ? count : ''}</span>
    </button>
  );
}
