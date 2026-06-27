# Submission Readiness

This document maps ScamRadar to the hackathon final judging requirements and identifies the remaining demo risks.

## Judging Requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Submit by 19:00 | Team action required | Submit GitHub repo, 2-minute Loom, and pitch deck before the deadline. |
| Team of max 5 people | Team action required | Confirm final team count in the submission form. |
| Use at least 3 partner technologies | Ready | Attio, n8n, and Tavily are used in the current demo workflow. |
| Newly created at the hackathon | Team action required | Mention hackathon origin in submission copy and video. |
| 2-minute video demo | Script ready | Use `docs/DEMO_PLAN.md`. |
| Public GitHub repo | Needs final check | Ensure `https://github.com/Alive24/ScamRadar` is public before submission. |
| Comprehensive README | Improved | README includes setup, demo assets, partner tech, and docs links. |
| API/framework/tool documentation | Ready | See `docs/INTEGRATIONS.md`, `docs/ARCHITECTURE.md`, `docs/N8N_WORKFLOWS.md`, and `docs/N8N_WEB_DUE_DILIGENCE_AGENT.md`. |

## Current Demo Inventory

### Visual Prototype

Implemented in `src/popup/App.tsx`.

The visual prototype includes:

- Dashboard UI for reviewer overview and cases.
- Suspects view with risk timeline, linked reports, similar submissions, and subagent status.
- Extension UI for user-facing suspicious outreach intake.
- In-app Q&A/chat surface over report and suspect context.
- Seeded report clusters and similarity-style evidence.
- Cautious report packet generation.

### Pitch Deck

Deck:

`https://docs.google.com/presentation/d/1tP3XFLIALLt41GGIDyv-LtUMuHUP4S-2OYmIVyV_zEc/edit?slide=id.p1#slide=id.p1`

Recommended verbal framing:

- Treat slides 1-4 as context.
- Use slide 5 as the transition into the product walkthrough.
- Use slides 6-9 to explain partner technology and architecture.
- Keep privacy/safety guardrails from slide 10 for the closing.

### Partner Technologies

| Technology | How to describe it in judging |
| --- | --- |
| Attio | Data availability / CRM layer. Current dev stores a mock suspect in `people` and receives agent write-back into `agent_findings`, `risk_level`, and `confidence`. |
| n8n | Subagent orchestration. Current workflow has webhook + manual trigger paths and runs the Web Due Diligence Agent. |
| Tavily | Web due diligence. Current workflow builds privacy-safe queries, calls Tavily Search, dedupes source URLs, and writes summarized evidence to Attio. |
| Superlinked | Vectorized similarity direction. Current visual prototype shows seeded similarity clusters; production integration would move this to Superlinked. |
| Aikido | Code-risk direction. Deck explains how malicious repo/script checks can be handled; not part of the current live workflow. |
| SLNG | Voice intake direction. Deck explains optional voice-report intake; not part of the current live workflow. |

Use Attio, n8n, and Tavily as the three concrete partner technologies for qualification. Mention Superlinked/Aikido/SLNG as extension paths unless the team has a separate live integration.

## Current n8n Workflow

Workflow:

- Name: `ScamRadar - Web Due Diligence Agent`
- ID: `qVjpOqdb9BgXEKLd`
- Repo JSON: `n8n/scamradar-web-due-diligence-agent.workflow.json`

Manual demo path:

```text
Manual Trigger: Mock Chunteng Profile
-> Mock: Chunteng Attio Person Payload
-> Code: Run Web Due Diligence Agent
-> Respond: Agent Output
```

Current mock Attio record:

```text
people/6310b053-2e5d-472a-b82c-5c9945eeb65c
```

Current write-back fields:

```text
agent_findings
risk_level
confidence
```

Current limitation:

- Write-back is overwrite-based.
- It does not yet incrementally append evidence.
- It does not yet create separate Sources, Evidence Items, Risk Indicators, or Agent Runs.

## Last-Mile Checklist Before Submission

1. Confirm GitHub repo is public.
2. Run:

```bash
pnpm self-check
pnpm build
```

3. Paste demo-only Tavily and Attio keys into n8n UI constants:

```js
const HARDCODED_TAVILY_API_KEY = "";
const HARDCODED_ATTIO_API_KEY = "";
```

4. Execute `Manual Trigger: Mock Chunteng Profile` in n8n.
5. Confirm Attio `people/6310b053-2e5d-472a-b82c-5c9945eeb65c` has updated `agent_findings`.
6. Record the 2-minute Loom using `docs/DEMO_PLAN.md`.
7. Submit:

- Loom URL.
- Public GitHub repo URL.
- Pitch deck URL.
- Short description naming Attio, n8n, and Tavily.

## Recommended Submission Blurb

ScamRadar is an agentic trust-and-safety CRM for suspicious outreach. It helps users submit messages, profile links, domains, wallets, repositories, or notes, then converts them into reusable suspect records, immediate risk indicators, evidence-backed due diligence, and human-reviewable report packets. The demo includes a complete Extension UI and Dashboard UI, plus an n8n Web Due Diligence Agent that uses Tavily for privacy-safe public evidence search and writes summarized findings back to Attio.

Partner technologies used: Attio, n8n, Tavily.

## Highest-Value Additions If Time Remains

1. Record a clean n8n execution result and Attio write-back screen for the Loom.
2. Add one visible screenshot/GIF to README showing Extension UI and Dashboard UI.
3. Implement the next `Conversation Pattern Agent` as a deterministic code node.
4. Add real incremental evidence objects in Attio.
5. Wire Superlinked for true vector similarity instead of seeded demo similarity.
