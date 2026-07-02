import { readFileSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';
import type { Plugin } from './types';

function resolveDir(envVar: string | undefined, fallback: string): string {
  if (!envVar) return join(process.cwd(), fallback);
  return isAbsolute(envVar) ? envVar : join(process.cwd(), envVar);
}

const PUBLISHED_FILE = join(resolveDir(process.env.DATA_DIR, 'data'), 'published-plugins.json');

export function getPublishedPlugins(): Plugin[] {
  if (!existsSync(PUBLISHED_FILE)) return [];
  try {
    return JSON.parse(readFileSync(PUBLISHED_FILE, 'utf-8'));
  } catch {
    return [];
  }
}
