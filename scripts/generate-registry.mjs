#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

const mp = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf-8'));
const registry = [];

for (const entry of mp.plugins || []) {
  const sourcePath = entry.source.replace(/^\.\//, '');
  const pluginPath = join(ROOT, sourcePath);
  const plugin = { ...entry };

  // Read manifest if exists
  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    Object.assign(plugin, manifest);
  }

  // Collect skills
  const skillsDir = join(pluginPath, 'skills');
  plugin.skills = [];
  if (existsSync(skillsDir)) {
    for (const skillDir of readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory())) {
      const skillMd = join(skillsDir, skillDir, 'SKILL.md');
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, 'utf-8');
        const fm = parseFrontmatter(content);
        plugin.skills.push({
          name: fm.name || skillDir,
          description: fm.description || '',
          path: `${sourcePath}/skills/${skillDir}/SKILL.md`
        });
      }
    }
  }

  // Collect commands
  const commandsDir = join(pluginPath, 'commands');
  plugin.commands = [];
  if (existsSync(commandsDir)) {
    for (const f of readdirSync(commandsDir).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join(commandsDir, f), 'utf-8');
      const fm = parseFrontmatter(content);
      plugin.commands.push({
        name: f.replace(/\.md$/, ''),
        description: fm.description || ''
      });
    }
  }

  registry.push(plugin);
}

const outputPath = join(ROOT, 'web', 'src', 'lib', 'registry.json');
writeFileSync(outputPath, JSON.stringify(registry, null, 2));
console.log(`Registry generated: ${registry.length} plugins -> ${outputPath}`);
