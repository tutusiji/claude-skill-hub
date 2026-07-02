import { cookies } from 'next/headers';

const COOKIE_NAME = 'skill_hub_admin';
const MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

interface TokenPayload {
  username: string;
  exp: number;
}

function getCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'byd@123456',
  };
}

export function verifyCredentials(username: string, password: string): boolean {
  const creds = getCredentials();
  return username === creds.username && password === creds.password;
}

export function createToken(username: string): string {
  const payload: TokenPayload = {
    username,
    exp: Date.now() + MAX_AGE * 1000,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
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
  if (!token) return false;

  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(token.value, 'base64').toString()
    );
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
