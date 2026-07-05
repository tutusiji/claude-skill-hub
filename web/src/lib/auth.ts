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
