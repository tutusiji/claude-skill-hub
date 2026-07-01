#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let errors = [];
let warnings = [];

function loadSchema(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function validateAgainstSchema(obj, schema, label) {
  const errs = [];
  for (const field of schema.required || []) {
    if (!(field in obj)) {
      errs.push(`${label}: missing required field "${field}"`);
    }
  }
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in obj) {
        const val = obj[key];
        if (prop.type === 'string' && typeof val !== 'string') {
          errs.push(`${label}: field "${key}" must be a string`);
        } else if (prop.type === 'array' && !Array.isArray(val)) {
          errs.push(`${label}: field "${key}" must be an array`);
        } else if (prop.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
          errs.push(`${label}: field "${key}" must be an object`);
        } else if (prop.pattern && typeof val === 'string' && !new RegExp(prop.pattern).test(val)) {
          errs.push(`${label}: field "${key}" does not match pattern ${prop.pattern}`);
        } else if (prop.minLength && typeof val === 'string' && val.length < prop.minLength) {
          errs.push(`${label}: field "${key}" must be at least ${prop.minLength} characters`);
        }
      }
    }
  }
  return errs;
}

function validatePluginDir(pluginPath, pluginName) {
  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    errors.push(`Plugin "${pluginName}": missing .claude-plugin/plugin.json`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    errors.push(`Plugin "${pluginName}": invalid JSON in plugin.json — ${e.message}`);
    return;
  }

  const schema = loadSchema(join(__dirname, 'schemas', 'plugin.schema.json'));
  errors.push(...validateAgainstSchema(manifest, schema, `Plugin "${pluginName}"`));

  // Check manifest name matches directory name
  if (manifest.name && manifest.name !== pluginName) {
    errors.push(`Plugin "${pluginName}": manifest name "${manifest.name}" does not match directory name`);
  }

  // Check for skills directory
  const skillsDir = join(pluginPath, 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory());
    for (const skill of skills) {
      const skillMd = join(skillsDir, skill, 'SKILL.md');
      if (!existsSync(skillMd)) {
        warnings.push(`Plugin "${pluginName}": skill "${skill}" missing SKILL.md`);
      } else {
        const content = readFileSync(skillMd, 'utf-8');
        if (!content.startsWith('---')) {
          warnings.push(`Plugin "${pluginName}": skill "${skill}" SKILL.md missing YAML frontmatter`);
        }
      }
    }
  }

  // Security check: no hardcoded secrets
  checkSecrets(pluginPath, pluginName);
}

function checkSecrets(dir, pluginName) {
  const secretPatterns = [
    /(?:sk-|AKIA|ghp_|gho_|ghs_)[A-Za-z0-9]{20,}/,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /[a-zA-Z0-9+/]{40,}={0,2}.*password/i,
  ];
  function scanDir(d) {
    for (const entry of readdirSync(d)) {
      const fullPath = join(d, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        scanDir(fullPath);
      } else if (stat.isFile() && /\.(md|json|js|ts|py|sh|yaml|yml|txt)$/.test(entry)) {
        const content = readFileSync(fullPath, 'utf-8');
        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            errors.push(`Plugin "${pluginName}": potential secret detected in ${entry}`);
          }
        }
      }
    }
  }
  scanDir(dir);
}

function validateMarketplace() {
  const mpPath = join(ROOT, '.claude-plugin', 'marketplace.json');
  if (!existsSync(mpPath)) {
    errors.push('Missing .claude-plugin/marketplace.json');
    return;
  }

  let mp;
  try {
    mp = JSON.parse(readFileSync(mpPath, 'utf-8'));
  } catch (e) {
    errors.push(`Invalid JSON in marketplace.json — ${e.message}`);
    return;
  }

  const schema = loadSchema(join(__dirname, 'schemas', 'marketplace.schema.json'));
  errors.push(...validateAgainstSchema(mp, schema, 'marketplace.json'));

  // Validate each plugin entry references an existing directory
  const pluginsDir = join(ROOT, 'plugins');
  const existingPlugins = existsSync(pluginsDir)
    ? readdirSync(pluginsDir).filter(f => statSync(join(pluginsDir, f)).isDirectory())
    : [];

  for (const entry of mp.plugins || []) {
    const sourcePath = entry.source.replace(/^\.\//, '');
    const fullSourcePath = join(ROOT, sourcePath);
    if (!existsSync(fullSourcePath)) {
      errors.push(`marketplace.json: plugin "${entry.name}" source "${entry.source}" does not exist`);
    } else {
      validatePluginDir(fullSourcePath, entry.name);
    }
  }

  // Check for plugins on disk not in marketplace.json
  const registeredNames = (mp.plugins || []).map(p => p.name);
  for (const dir of existingPlugins) {
    if (!registeredNames.includes(dir)) {
      warnings.push(`Plugin directory "${dir}" exists but is not registered in marketplace.json`);
    }
  }
}

validateMarketplace();

console.log('\n=== Validation Report ===\n');
if (warnings.length > 0) {
  console.log('Warnings:');
  for (const w of warnings) console.log(`  [WARN] ${w}`);
  console.log();
}
if (errors.length > 0) {
  console.log('Errors:');
  for (const e of errors) console.log(`  [FAIL] ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
} else {
  console.log(`OK — 0 errors, ${warnings.length} warning(s)`);
  process.exit(0);
}
