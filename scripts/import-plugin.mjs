#!/usr/bin/env node
// import-plugin.mjs — Run on the INTERNAL machine.
// Imports a .tar.gz plugin package into the marketplace, registers it, and validates.

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function usage() {
  console.log(`
Usage:
  node import-plugin.mjs --package <tarball> [--category <cat>] [--keywords kw1,kw2]

Options:
  --package <tarball>     Path to the .tar.gz file (required)
  --category <cat>        Override category (default: from metadata or "utilities")
  --keywords <kw1,kw2>    Override keywords (comma-separated)
  --name <name>           Override plugin name

Examples:
  # Import a fetched plugin
  node import-plugin.mjs --package offline-packages/code-review-skill.tar.gz

  # Import with custom category
  node import-plugin.mjs --package offline-packages/my-plugin.tar.gz --category security
`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { package: null, category: null, keywords: null, name: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--package': opts.package = args[++i]; break;
      case '--category': opts.category = args[++i]; break;
      case '--keywords': opts.keywords = args[++i]; break;
      case '--name': opts.name = args[++i]; break;
      default: usage();
    }
  }
  if (!opts.package) usage();
  return opts;
}

const opts = parseArgs();
const tarballPath = resolve(opts.package);

if (!existsSync(tarballPath)) {
  console.error(`Error: tarball not found: ${tarballPath}`);
  process.exit(1);
}

const tmpDir = `/tmp/import-${Date.now()}`;
const pluginsDir = join(ROOT, 'plugins');

try {
  // Extract tarball to temp dir
  mkdirSync(tmpDir, { recursive: true });
  execSync(`tar xzf ${tarballPath} -C ${tmpDir}`, { stdio: 'pipe' });

  // Find the extracted directory
  const entries = readdirSync(tmpDir).filter(f => !f.startsWith('.'));
  let extractedDir;
  if (entries.length === 1 && statSync(join(tmpDir, entries[0])).isDirectory()) {
    extractedDir = join(tmpDir, entries[0]);
  } else {
    extractedDir = tmpDir;
  }

  // Read fetch metadata if available
  let metadata = {};
  const metaPath = join(extractedDir, '.fetch-metadata.json');
  if (existsSync(metaPath)) {
    metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  }

  // Determine plugin name
  let pluginName = opts.name || metadata.plugin?.name || basename(tarballPath, '.tar.gz');
  // Normalize: lowercase hyphen-case
  pluginName = pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Check if plugin already exists
  const destDir = join(pluginsDir, pluginName);
  if (existsSync(destDir)) {
    console.error(`Error: plugin "${pluginName}" already exists at plugins/${pluginName}/`);
    console.error(`  To update: remove the old directory first, or use --name to import under a different name.`);
    process.exit(1);
  }

  // Read plugin.json for metadata
  let pluginInfo = metadata.plugin || {};
  const manifestPath = join(extractedDir, '.claude-plugin', 'plugin.json');
  if (existsSync(manifestPath)) {
    try {
      pluginInfo = { ...pluginInfo, ...JSON.parse(readFileSync(manifestPath, 'utf-8')) };
    } catch (e) { /* ignore */ }
  }

  // Override with CLI args
  if (opts.category) pluginInfo.category = opts.category;
  if (opts.keywords) pluginInfo.keywords = opts.keywords.split(',').map(k => k.trim());
  if (opts.name) pluginInfo.name = pluginName;

  // Set defaults
  pluginInfo.name = pluginName;
  pluginInfo.version = pluginInfo.version || '1.0.0';
  pluginInfo.description = pluginInfo.description || `Imported from ${metadata.fetchedFrom || 'offline package'}`;
  pluginInfo.category = pluginInfo.category || 'utilities';

  // Remove fetch metadata before copying
  if (existsSync(metaPath)) {
    rmSync(metaPath);
  }

  console.log(`[1/4] Importing plugin: ${pluginName}`);
  console.log(`  Version: ${pluginInfo.version}`);
  console.log(`  Category: ${pluginInfo.category}`);
  console.log(`  Description: ${pluginInfo.description}`);

  // Copy to plugins directory
  mkdirSync(pluginsDir, { recursive: true });
  execSync(`cp -r ${extractedDir} ${destDir}`, { stdio: 'pipe' });

  // Ensure plugin.json exists
  const newManifestPath = join(destDir, '.claude-plugin', 'plugin.json');
  if (!existsSync(newManifestPath)) {
    mkdirSync(join(destDir, '.claude-plugin'), { recursive: true });
  }
  writeFileSync(newManifestPath, JSON.stringify({
    name: pluginInfo.name,
    version: pluginInfo.version,
    description: pluginInfo.description,
    category: pluginInfo.category,
    keywords: pluginInfo.keywords || [],
  }, null, 2) + '\n');

  console.log(`[2/4] Registering in marketplace.json...`);

  // Add to marketplace.json
  const mpPath = join(ROOT, '.claude-plugin', 'marketplace.json');
  const mp = JSON.parse(readFileSync(mpPath, 'utf-8'));

  // Check for duplicate
  if (mp.plugins.find(p => p.name === pluginName)) {
    console.error(`Warning: plugin "${pluginName}" already in marketplace.json, updating entry...`);
    mp.plugins = mp.plugins.filter(p => p.name !== pluginName);
  }

  mp.plugins.push({
    name: pluginName,
    description: pluginInfo.description,
    source: `./plugins/${pluginName}`,
    version: pluginInfo.version,
    category: pluginInfo.category,
    keywords: pluginInfo.keywords || [],
  });

  writeFileSync(mpPath, JSON.stringify(mp, null, 2) + '\n');

  console.log(`[3/4] Validating...`);

  // Run validation
  try {
    execSync(`node ${join(__dirname, 'validate-plugin.mjs')}`, { stdio: 'inherit', cwd: ROOT });
  } catch (e) {
    console.error(`Validation failed! Rolling back...`);
    rmSync(destDir, { recursive: true, force: true });
    // Restore marketplace.json
    execSync(`git -C ${ROOT} checkout -- .claude-plugin/marketplace.json`, { stdio: 'pipe' });
    process.exit(1);
  }

  console.log(`[4/4] Done!`);
  console.log(`  Plugin installed: plugins/${pluginName}/`);
  console.log(`  Registered in: .claude-plugin/marketplace.json`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the imported plugin: ls plugins/${pluginName}/`);
  console.log(`  2. Test locally: claude --plugin-dir plugins/${pluginName}`);
  console.log(`  3. Commit and push to internal git repo:`);
  console.log(`     git add . && git commit -m "Add ${pluginName} plugin" && git push`);

} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
