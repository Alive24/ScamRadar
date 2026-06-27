# ScamRadar

ScamRadar is a Chrome Extension prototype for suspicious outreach triage. It lets a user submit conversations, emails, posts, profile links, domains, wallets, repositories, or notes, then returns immediate risk indicators and creates a local case record.

The hackathon version keeps the core workflow runnable without external services. Attio, Tavily, n8n, Superlinked, Aikido, and SLNG are integration boundaries documented in `docs/` and can be wired in incrementally.

## Current Scope

- Chrome Extension popup for paste-and-check triage.
- Content script to pull selected text and current page context.
- Local rules for immediate danger alerts.
- Seeded similar reports for demo clustering.
- Mock async investigation status in the background worker.
- Markdown report packet generation.

## Commands

```bash
pnpm install
pnpm self-check
pnpm build
pnpm dev
```

## Load Extension

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Click **Load unpacked**.
5. Select `/Users/chuntengxiao/Documents/ScamRadar/dist`.

## Docs

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Attio Schema](docs/ATTIO_SCHEMA.md)
- [n8n Workflows](docs/N8N_WORKFLOWS.md)
- [Demo Plan](docs/DEMO_PLAN.md)
- [Integration Notes](docs/INTEGRATIONS.md)

## Safety Language

ScamRadar reports risk indicators, not definitive accusations. Public warnings, coordinated reporting, or high-confidence labels require human review.
