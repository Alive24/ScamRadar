# ScamRadar

ScamRadar is an agentic trust-and-safety CRM for suspicious outreach triage. It lets a user submit conversations, emails, posts, profile links, domains, wallets, repositories, or notes, then returns immediate risk indicators, links reports to reusable suspect records, and prepares evidence-backed reviewer workflows.

The hackathon demo includes a complete visual prototype with both a Chrome Extension-style user flow and an analyst Dashboard UI. It also includes a working n8n Web Due Diligence workflow connected to Attio and Tavily for a demo suspect record.

## Current Scope

- Chrome Extension-style popup for paste-and-check triage.
- Dashboard UI for reviewer queue, suspect records, linked reports, risk timeline, and case review.
- Content script to pull selected text and current page context.
- Local rules for immediate danger alerts.
- Seeded similar reports for demo clustering.
- In-app Q&A/chat surface over the current report and suspect context.
- Mock async investigation status in the background worker.
- Markdown report packet generation.

## Partner Technologies

The submission uses at least three partner technologies:

| Partner technology | Current demo usage |
| --- | --- |
| Attio | CRM/data availability layer. Stores the current mock suspect as a `people` record with ScamRadar fields and receives n8n write-back into `agent_findings`, `risk_level`, and `confidence`. |
| n8n | Subagent orchestration. Hosts `ScamRadar - Web Due Diligence Agent` with webhook and manual mock trigger paths. |
| Tavily | Web due diligence search. The n8n agent builds privacy-safe queries, calls Tavily Search, dedupes source URLs, and writes summarized evidence back to Attio. |

Additional integration boundaries are documented for Superlinked/vector similarity, Aikido/code-risk checks, and SLNG/voice intake. The visual prototype also shows a fast chat-model Q&A surface and vectorized similarity matching using seeded demo data.

## Current n8n/Attio Demo

- n8n workflow: `ScamRadar - Web Due Diligence Agent`
- n8n workflow ID: `qVjpOqdb9BgXEKLd`
- Repo workflow JSON: `n8n/scamradar-web-due-diligence-agent.workflow.json`
- Manual trigger: `Manual Trigger: Mock Chunteng Profile`
- Attio mock record: `people/6310b053-2e5d-472a-b82c-5c9945eeb65c`
- Current write-back fields: `agent_findings`, `risk_level`, `confidence`

The current workflow writes a compact Tavily-derived summary back to the Attio `people` record. It is not yet incremental evidence insertion; separate Sources, Evidence Items, and Agent Runs remain target architecture.

## Demo Assets

- Pitch deck: [ScamRadar Pitch Deck](https://docs.google.com/presentation/d/1tP3XFLIALLt41GGIDyv-LtUMuHUP4S-2OYmIVyV_zEc/edit?slide=id.p1#slide=id.p1)
- Submission readiness checklist: [docs/SUBMISSION_READINESS.md](docs/SUBMISSION_READINESS.md)
- 2-minute video demo script: [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md)

## Commands

```bash
pnpm install
pnpm self-check
pnpm build
pnpm dev
```

To load the demo reports from Attio during local development, start Vite with `ATTIO_API_KEY` set in your shell. If the key is not set, the UI falls back to the bundled mock data.

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
- [Web Due Diligence Agent Workflow](docs/N8N_WEB_DUE_DILIGENCE_AGENT.md)
- [Demo Plan](docs/DEMO_PLAN.md)
- [Submission Readiness](docs/SUBMISSION_READINESS.md)
- [Integration Notes](docs/INTEGRATIONS.md)

## Safety Language

ScamRadar reports risk indicators, not definitive accusations. Public warnings, coordinated reporting, or high-confidence labels require human review.
