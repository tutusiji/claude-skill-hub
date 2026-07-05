import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'skill_hub_admin';
const MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

interface TokenPayload {
  username: string;
  exp: number;
}

// ─── Credentials ──────────────────────────────────────────
// 密码必须通过环境变量 ADMIN_PASSWORD 配置；未配置时禁用管理员登录。
function getCredentials() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  return { username, password };
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(username: string, password: string): boolean {
  const creds = getCredentials();
  if (!creds.password) {
    console.warn('[auth] ADMIN_PASSWORD 未配置，管理员登录已禁用');
    return false;
  }
  // 用户名非机密，用 === 比较；密码用常量时间比较防时序侧信道。
  if (username !== creds.username) return false;
  return constantTimeEqual(password, creds.password);
}

// ─── Token (HMAC 签名) ────────────────────────────────────
// 密钥优先取 AUTH_SECRET，回退到 ADMIN_PASSWORD —— 旧部署无需额外配置即获得签名保护。
// 修改 ADMIN_PASSWORD 会使所有已签发 token 失效（预期行为）。
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('AUTH_SECRET 或 ADMIN_PASSWORD 环境变量未配置，无法签发/校验 token');
  }
  return secret;
}

// token 格式：<base64url(payload)>.<base64url(hmac-sha256(payload))>
export function createToken(username: string): string {
  const payload: TokenPayload = {
    username,
    exp: Date.now() + MAX_AGE * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getAuthSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function setAuthCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict`;
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return false;

  // 旧格式（无符号的纯 base64）没有点分隔，直接拒绝 → 强制重新登录。
  const dot = token.value.lastIndexOf('.');
  if (dot <= 0) return false;
  const body = token.value.slice(0, dot);
  const sig = token.value.slice(dot + 1);

  let expected: string;
  try {
    expected = createHmac('sha256', getAuthSecret()).update(body).digest('base64url');
  } catch {
    // 未配置密钥 → 拒绝所有受保护请求。
    return false;
  }

  if (!constantTimeEqual(sig, expected)) return false;

  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    );
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

// ─── Login Rate Limiting (in-memory, per-key) ────────────
// 5 次失败后锁定 5 分钟。内存存储,进程重启即清空(内部系统可接受)。
// key 优先用客户端 IP(经反向代理时有 x-forwarded-for);
// 无代理时(Docker Compose 直连)回退到 username,仍能防护账号爆破。
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

interface LoginAttempt {
  count: number;
  lockedUntil: number; // 0 = 未锁定;>0 = 锁定到该时间戳
}
const loginAttempts = new Map<string, LoginAttempt>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  let count: number;
  if (!entry) {
    count = 0;
  } else if (entry.lockedUntil > now) {
    // 仍处于锁定期 — 调用方应已拦截,防御性跳过
    return;
  } else if (entry.lockedUntil > 0) {
    // 锁刚过期,重新计数
    count = 0;
  } else {
    // 未锁定,累加
    count = entry.count;
  }
  const newCount = count + 1;
  if (newCount >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.set(key, { count: newCount, lockedUntil: now + LOGIN_LOCKOUT_MS });
  } else {
    loginAttempts.set(key, { count: newCount, lockedUntil: 0 });
  }
}

export function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}
