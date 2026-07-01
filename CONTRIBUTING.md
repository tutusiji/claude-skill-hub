# Contributing to Skill Hub

## Quick Start

1. Clone this repo
2. Create your plugin under `plugins/<plugin-name>/`
3. Run `node scripts/validate-plugin.mjs` to validate
4. Register your plugin in `.claude-plugin/marketplace.json`
5. Open a PR

## Plugin Structure

```
plugins/
  my-plugin/
    .claude-plugin/
      plugin.json          # required — name, version, description, category
    skills/
      my-skill/
        SKILL.md            # skill with YAML frontmatter (name, description)
    commands/               # optional
      my-command.md
```

## plugin.json Schema

```json
{
  "name": "my-plugin",           // lowercase, hyphen-case, max 64 chars
  "version": "1.0.0",            // semver
  "description": "...",          // min 10 chars
  "category": "developer-tools", // see categories below
  "keywords": ["automation"]     // optional
}
```

### Categories

- `developer-tools` — coding, debugging, linting
- `devops` — CI/CD, infrastructure, deployment
- `security` — auditing, scanning, compliance
- `testing` — test generation, coverage, QA
- `documentation` — docs generation, API specs
- `data` — data processing, ETL, analytics
- `productivity` — workflow automation, task management
- `utilities` — misc helpers

## SKILL.md Format

```markdown
---
name: my-skill
description: What this skill does and when to trigger it.
---

# Skill Title

Instructions for Claude Code...
```

The `description` in frontmatter is the primary trigger mechanism. Be specific about what the skill does and when to use it.

## Validation

Run before submitting a PR:

```bash
node scripts/validate-plugin.mjs
```

This checks:
- plugin.json schema compliance
- marketplace.json registration
- SKILL.md frontmatter
- Hardcoded secret detection
- Directory name matches manifest name

## PR Review Process

1. CI runs automatically on every PR
2. A platform team member reviews the PR
3. Review checks: security, quality, naming, categorization
4. Once approved and merged, the Web UI auto-deploys

## Security Rules

- No secrets, tokens, or API keys in plugin files
- No external network calls without documented justification
- No file system operations outside the project scope
- No eval() or dynamic code execution
