# Skill Hub — Internal Claude Code Marketplace

A self-hosted skill/plugin marketplace for Claude Code, designed for internal team use. Includes a Web UI for browsing, a CI-validated contribution workflow, and native Claude Code marketplace integration.

## Architecture

```
claude-skill-hub/
├── .claude-plugin/
│   └── marketplace.json        # Claude Code marketplace manifest
├── plugins/                     # All plugin directories
│   └── code-review-skill/      # Example plugin
├── scripts/
│   ├── validate-plugin.mjs     # CI validation (schema + secrets + structure)
│   ├── generate-registry.mjs   # Builds registry.json for Web UI
│   └── schemas/                # JSON schemas for marketplace + plugin
├── web/                        # Next.js Web UI
│   └── src/
│       ├── app/                # Pages: browse, plugin detail, contribute
│       ├── components/         # SearchBar, CategoryFilter, PluginCard
│       └── lib/                # Types, utils, generated registry
├── .github/workflows/
│   ├── validate-pr.yml         # PR validation CI
│   └── deploy-web.yml          # Web UI build + deploy
└── CONTRIBUTING.md             # Contribution guide
```

## Quick Start

### For users — install plugins

In Claude Code:

```bash
# Add the internal marketplace (one-time)
/plugin marketplace add <your-org>/claude-skill-hub

# Browse and install
/plugin install code-review-skill@internal-skill-hub
```

Or browse the Web UI at your internal deployment URL.

### For contributors — add a plugin

1. Create `plugins/<your-plugin>/` following the structure in [CONTRIBUTING.md](CONTRIBUTING.md)
2. Run `node scripts/validate-plugin.mjs`
3. Register in `.claude-plugin/marketplace.json`
4. Open a PR — CI validates automatically

### For admins — deploy

```bash
# Generate registry data
node scripts/generate-registry.mjs

# Run Web UI locally
cd web && npm install && npm run dev

# Production build
cd web && npm run build

# Docker
docker build -f web/Dockerfile -t skill-hub .
```

## Web UI

The Web UI is a Next.js app that reads from a generated `registry.json`. It provides:

- Browse all plugins with category filters
- Full-text search across names, descriptions, keywords, and skills
- Plugin detail pages with skill listings and one-click install command copy
- Contribution guide page with step-by-step instructions

The registry is regenerated on every merge to main, so the Web UI always reflects the latest marketplace state.

## CI Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `validate-pr.yml` | PR to main | Validate plugin structure, check secrets, verify marketplace registration |
| `deploy-web.yml` | Push to main | Generate registry, build Web UI, deploy to internal hosting |

## Customization

- **Marketplace name**: Change `name` in `.claude-plugin/marketplace.json`
- **Categories**: Edit `web/src/lib/types.ts` and `CONTRIBUTING.md`
- **Deploy target**: Modify `.github/workflows/deploy-web.yml` for your internal registry/server
- **Review team**: Update CODEOWNERS file (create one for auto-assign reviewers)
