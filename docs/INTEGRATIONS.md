# Integrations

## Attio

Role: CRM layer for storage, suspect objects, report submissions, evidence, risk indicators, ratings, reviewer decisions, and simple automations.

MVP path:

- Create/update type-specific suspect records.
- Attach user reports and submitted materials to suspects.
- Store desensitized report summaries for aggregate views.
- Attach source-backed evidence and risk indicators to suspects and reports.
- Track subagent runs and reviewer decisions.
- Track reviewer decisions.

Important modeling note:

- Product language uses **Suspect** as the aggregate intelligence target.
- Attio implementation can use different suspect-like objects by type, such as Profile Suspects, Domain Suspects, Email Suspects, Repository Suspects, Wallet Suspects, Marketplace Suspects, Phone Suspects, and Message Template Suspects.
- Subagents should receive a normalized suspect context even when the underlying Attio object differs by type.

Current dev state:

- The connected Attio workspace currently exposes `people` and `companies`.
- The first mock Suspect is represented as a `people` record rather than a dedicated `profile_suspects` object.
- Mock record ID: `6310b053-2e5d-472a-b82c-5c9945eeb65c`.
- The `people` object includes ScamRadar fields such as `linkedin`, `suspect_type`, `risk_level`, `confidence`, and `agent_findings`.
- Current n8n write-back overwrites `agent_findings`, `risk_level`, and `confidence` on the `people` record. It does not yet create separate Sources, Evidence Items, Risk Indicators, or Agent Runs.

## Tavily

Role: real-time search, extraction, crawling, and evidence gathering.

MVP path:

- Search public identifiers and privacy-safe phrase fingerprints from a suspect and its linked reports.
- Extract 2-5 evidence snippets per suspect investigation.
- Store source title, URL, excerpt, retrieved timestamp, search query, linked suspect, linked reports, and rationale.
- Do not send raw user submissions, secrets, phone numbers, payment handles, or sensitive personal data unless explicitly approved by a reviewer.

## n8n

Role: async subagent orchestration.

MVP path:

- Webhook from suspect creation, new report attachment, or manual reviewer refresh.
- Fetch suspect-like Attio record and linked reports.
- Run Web Due Diligence Agent first.
- Visible workflow for due diligence, conversation analysis, similarity, scoring, reviewer prep, and cautious report drafting.
- Write outputs back to Attio.

First workflow:

- **Web Due Diligence Agent** reads `suspect_id`, `suspect_object`, linked reports, and normalized suspect fields from Attio.
- It builds privacy-safe Tavily queries from public identifiers, claimed organizations, domains, profile URLs, repository URLs, and short non-sensitive phrase fingerprints.
- It writes `Agent Run`, `Source`, `Evidence Item`, `Risk Indicator Update`, and suspect summary fields back to Attio.

Current dev workflow:

- n8n workflow: `ScamRadar - Web Due Diligence Agent`.
- n8n workflow ID: `qVjpOqdb9BgXEKLd`.
- Repo JSON: `n8n/scamradar-web-due-diligence-agent.workflow.json`.
- Contains a webhook trigger plus a manual mock trigger for the Chunteng Xiao LinkedIn profile.
- Uses hardcoded-key slots in the Code node for a self-contained demo:
  - `HARDCODED_TAVILY_API_KEY`
  - `HARDCODED_ATTIO_API_KEY`
- Calls Tavily Search with `Authorization: Bearer <TAVILY_API_KEY>`.
- Writes Tavily-derived summary results back to Attio `people.agent_findings`.

## Superlinked

Role: semantic and multi-attribute similarity.

MVP path:

- Start with seeded local matching.
- Add Superlinked when suspect identifiers, desensitized report summaries, message-template hashes, and structured features need real vector search.

## Aikido

Role: security coverage in CI/CD.

MVP path:

- Connect repo.
- Capture scan summary.
- Fix critical/high issues before demo.
- Show scan status in admin/demo docs.

## SLNG

Role: optional voice chat interface.

MVP path:

- Voice-to-text report submission.
- Text-to-speech cautious safety summary.
- Keep optional unless core flow is stable.
