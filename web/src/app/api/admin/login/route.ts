import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: '请输入用户名和密码' },
      { status: 400 }
    );
  }

  if (!verifyCredentials(username, password)) {
    return NextResponse.json(
      { error: '用户名或密码错误' },
      { status: 401 }
    );
  }

  const token = createToken(username);
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', setAuthCookie(token));

  return response;
}
