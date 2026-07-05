import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCredentials,
  createToken,
  setAuthCookie,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
} from '@/lib/auth';

// 限流 key:优先取反向代理设置的客户端 IP,无代理时回退到 username。
// Docker Compose 直连(无 nginx)时 x-forwarded-for 缺失,用 username 兜底。
function getLoginKey(request: NextRequest, username: string): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return `user:${username}`;
}

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: '请输入用户名和密码' },
      { status: 400 }
    );
  }

  const key = getLoginKey(request, username);
  const limit = checkLoginRateLimit(key);
  if (!limit.allowed) {
    const minutes = Math.ceil((limit.retryAfterSec ?? 0) / 60);
    return NextResponse.json(
      { error: `尝试次数过多,请 ${minutes} 分钟后再试` },
      { status: 429 }
    );
  }

  if (!verifyCredentials(username, password)) {
    recordLoginFailure(key);
    return NextResponse.json(
      { error: '用户名或密码错误' },
      { status: 401 }
    );
  }

  // 登录成功,清空该 key 的失败记录
  clearLoginAttempts(key);
  const token = createToken(username);
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', setAuthCookie(token));

  return response;
}
