#!/usr/bin/env node
// fetch-plugin.mjs — Run on an INTERNET-CONNECTED machine.
// Downloads a plugin from GitHub and packages it as a .tar.gz for offline transfer.

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`
Usage:
  node fetch-plugin.mjs --repo <owner/repo> [--path <plugin-path>] [--ref <ref>] [--output <dir>]

Options:
  --repo <owner/repo>    GitHub repo, e.g. davepoon/buildwithclaude
  --path <plugin-path>   Path to plugin within the repo (default: root)
                         e.g. plugins/code-review-skill
  --ref <ref>            Git ref: branch, tag, or commit SHA (default: main)
  --output <dir>         Output directory for .tar.gz (default: ./offline-packages)

Examples:
  # Fetch a specific plugin from a marketplace repo
  node fetch-plugin.mjs --repo davepoon/buildwithclaude --path plugins/agents-python-expert

  # Fetch an entire marketplace repo
  node fetch-plugin.mjs --repo daymade/claude-code-skills

  # Fetch from a specific tag
  node fetch-plugin.mjs --repo daymade/claude-code-skills --ref v1.78.0
`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { repo: null, path: null, ref: 'main', output: './offline-packages' };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--repo': opts.repo = args[++i]; break;
      case '--path': opts.path = args[++i]; break;
      case '--ref': opts.ref = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
      default: usage();
    }
  }
  if (!opts.repo) usage();
  return opts;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

function collectPluginInfo(pluginPath, pluginName) {
  const info = { name: pluginName, version: '1.0.0', description: '', category: 'utilities', keywords: [], skills: [] };

  // Read plugin.json if exists
  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      Object.assign(info, manifest);
    } catch (e) { /* ignore */ }
  }

  // Collect skills
  const skillsDir = join(pluginPath, 'skills');
  if (existsSync(skillsDir)) {
    for (const skillDir of readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory())) {
      const skillMd = join(skillsDir, skillDir, 'SKILL.md');
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, 'utf-8');
        const fm = parseFrontmatter(content);
        info.skills.push({
          name: fm.name || skillDir,
          description: fm.description || '',
          path: `skills/${skillDir}/SKILL.md`
        });
      }
    }
  }

  return info;
}

const opts = parseArgs();
const tmpDir = `/tmp/fetch-${Date.now()}`;
const outputDir = resolve(opts.output);

console.log(`[1/4] Cloning ${opts.repo}@${opts.ref}...`);

// Sparse checkout to save time/space
mkdirSync(tmpDir, { recursive: true });
const sparseFlag = opts.path ? `--sparse` : '';
const checkoutPath = opts.path || '';

try {
  execSync(`git clone --depth 1 --branch ${opts.ref} ${sparseFlag} https://github.com/${opts.repo}.git ${tmpDir}/repo`, {
    stdio: 'pipe',
  });

  if (opts.path) {
    execSync(`git -C ${tmpDir}/repo sparse-checkout set ${checkoutPath}`, { stdio: 'pipe' });
  }

  const repoDir = join(tmpDir, 'repo');
  const pluginPath = opts.path ? join(repoDir, opts.path) : repoDir;

  if (!existsSync(pluginPath)) {
    console.error(`Error: path "${opts.path}" not found in repo ${opts.repo}`);
    process.exit(1);
  }

  // Determine plugin name
  let pluginName;
  if (opts.path) {
    pluginName = basename(opts.path);
  } else {
    // Try to read marketplace.json for the name
    const mpPath = join(repoDir, '.claude-plugin', 'marketplace.json');
    if (existsSync(mpPath)) {
      pluginName = 'marketplace-' + opts.repo.split('/')[1];
    } else {
      pluginName = opts.repo.split('/')[1];
    }
  }

  console.log(`[2/4] Collecting plugin info: ${pluginName}`);

  const info = collectPluginInfo(pluginPath, pluginName);

  // Write metadata file
  const metadata = {
    fetchedFrom: `github:${opts.repo}`,
    ref: opts.ref,
    path: opts.path || '/',
    fetchedAt: new Date().toISOString(),
    plugin: info,
  };
  writeFileSync(join(pluginPath, '.fetch-metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(`[3/4] Creating tarball...`);

  mkdirSync(outputDir, { recursive: true });
  const tarballName = `${pluginName}.tar.gz`;
  const tarballPath = join(outputDir, tarballName);

  // Create tarball from the plugin directory
  const cwd = opts.path ? join(repoDir, opts.path, '..') : repoDir;
  const dirToTar = opts.path ? basename(opts.path) : '.';
  execSync(`tar czf ${tarballPath} -C ${cwd} ${dirToTar}`, { stdio: 'pipe' });

  console.log(`[4/4] Done!`);
  console.log(`  Plugin: ${info.name} v${info.version}`);
  console.log(`  Description: ${info.description || '(none)'}`);
  console.log(`  Skills: ${info.skills.length}`);
  console.log(`  Tarball: ${tarballPath}`);
  console.log(`  Size: ${(execSync(`du -h ${tarballPath}`).toString().split('\t')[0])}`);
  console.log(`\nTransfer ${tarballName} to the internal machine, then run:`);
  console.log(`  node scripts/import-plugin.mjs --package ${tarballName}`);

} catch (e) {
  console.error('Error:', e.message);
  if (e.stderr) console.error(e.stderr.toString());
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
