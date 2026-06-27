# n8n Workflow: Web Due Diligence Agent

This workflow investigates one Attio Suspect using the suspect's normalized fields plus linked user reports. It calls Tavily with privacy-safe queries and writes source-backed intelligence back to Attio.

## Workflow Name

`ScamRadar - Web Due Diligence Agent`

## Current Dev Implementation

The current n8n workflow is checked into the repo at:

`n8n/scamradar-web-due-diligence-agent.workflow.json`

It is also installed in the shared n8n workspace as:

- Workflow name: `ScamRadar - Web Due Diligence Agent`
- Workflow ID: `qVjpOqdb9BgXEKLd`
- Current state: inactive until manually activated in n8n

The current workflow is a hackathon-ready implementation, not the full target object model yet.

Implemented:

- Webhook trigger: `POST /webhook/scamradar/web-due-diligence`
- Manual trigger: `Manual Trigger: Mock Chunteng Profile`
- Mock Attio read payload for a `people` record
- Privacy-safe Tavily query generation
- Tavily Search calls with `Authorization: Bearer <TAVILY_API_KEY>`
- URL-level Tavily result deduping
- Cautious findings and evidence item summaries
- Attio write-back through the Attio REST API

Current Attio write-back target:

- Object: `people`
- Mock record: `6310b053-2e5d-472a-b82c-5c9945eeb65c`
- Public LinkedIn identifier: `https://www.linkedin.com/in/chunteng-xiao-b99763a4`
- Updated fields: `agent_findings`, `risk_level`, `confidence`

Current write-back behavior is overwrite-based, not incremental. Each run writes a fresh JSON summary into `agent_findings`; it does not append to prior evidence and does not create separate `Sources`, `Evidence Items`, or `Agent Runs` records yet.

Secrets are intentionally not committed. For a self-contained n8n demo, paste keys directly into the two constants in `Code: Run Web Due Diligence Agent`:

```js
const HARDCODED_TAVILY_API_KEY = "";
const HARDCODED_ATTIO_API_KEY = "";
```

The code also accepts `body.tavily_api_key` and `body.attio_api_key` as fallbacks.

Do not use `process.env`, `$env`, or `$vars` inside the current n8n Cloud Code node. The current n8n environment denies Code node env-var access and can fail the run with `access to env vars denied`.

## Trigger

Webhook trigger:

- Method: `POST`
- Path: `/scamradar/web-due-diligence`
- Response: use explicit response node

Expected body:

```json
{
  "suspect_id": "attio_suspect_record_id",
  "suspect_object": "profile_suspects",
  "run_reason": "new_report",
  "linked_report_ids": ["attio_report_record_id"],
  "force_refresh": false
}
```

## Required Credentials and Variables

- Attio credential or API token with read/write access to suspect objects, reports, sources, evidence, risk indicators, and agent runs.
- Tavily API key.
- Current n8n Cloud plan notes:
  - n8n Variables may not be available on the current plan.
  - For the demo workflow, use the hardcoded constants in the Code node or pass keys in the webhook body.

## Node Plan

| Order | Node | Purpose |
| --- | --- | --- |
| 1 | Webhook: Suspect Due Diligence | Receives `suspect_id`, `suspect_object`, `run_reason`, and linked report IDs |
| 2 | Attio: Fetch Suspect | Reads the type-specific suspect record |
| 3 | Attio: Fetch Linked Reports | Reads reports linked to the suspect |
| 4 | Code: Normalize Suspect Context | Converts type-specific Attio records into the shared suspect context |
| 5 | Code: Privacy Gate | Drops unsafe fields and creates allowed query ingredients |
| 6 | Code: Build Tavily Queries | Generates suspect-type-specific Tavily queries |
| 7 | Split In Batches: Queries | Runs each Tavily query separately |
| 8 | HTTP Request: Tavily Search | Calls Tavily search |
| 9 | Code: Normalize Sources | Converts Tavily results into source/evidence candidates |
| 10 | Code: Dedupe Sources | Removes duplicate URLs across queries |
| 11 | Code: Classify Findings | Assigns cautious finding types |
| 12 | Attio: Create Sources | Creates source records |
| 13 | Attio: Create Evidence Items | Creates evidence records linked to suspect and reports |
| 14 | Attio: Upsert Risk Indicators | Writes cautious risk indicator updates when supported |
| 15 | Attio: Update Suspect | Updates due diligence status, summary, and timestamp |
| 16 | Attio: Create Agent Run | Stores run metadata and errors |
| 17 | Respond to Webhook | Returns the shared agent output contract |

## Normalize Suspect Context

The normalize step must hide Attio's underlying object differences from downstream agent logic.

Output shape:

```json
{
  "suspect_id": "attio_suspect_record_id",
  "suspect_object": "profile_suspects",
  "suspect_type": "profile_suspect",
  "primary_identifier": "linkedin.com/in/alex-morgan-recruiter",
  "identifier_type": "linkedin_url",
  "display_label": "Alex Morgan",
  "claimed_name": "Alex Morgan",
  "claimed_role": "Senior Technical Recruiter",
  "claimed_organization": "Meta",
  "known_domains": ["meta-careers.io"],
  "known_urls": [],
  "known_repositories": [],
  "known_wallets": [],
  "known_marketplace_handles": [],
  "risk_level": "red",
  "risk_score": 87,
  "corroboration_count": 14,
  "reports": [
    {
      "report_id": "attio_report_record_id",
      "platform": "LinkedIn",
      "material_type": "conversation_log",
      "redacted_material": "Recruiter claiming to work at [MAJOR_TECH_CO] requested equipment purchase and off-platform messaging.",
      "desensitized_summary": "Recruiter on [PLATFORM] offered [ROLE], requested equipment purchase, and moved to [MESSAGING_APP].",
      "detected_indicators": ["equipment_purchase", "off_platform_redirect"]
    }
  ]
}
```

## Privacy Gate Rules

Allowed Tavily query ingredients:

- Public profile URLs and public handles.
- Domains, hosts, website URLs, repository URLs, package names.
- Claimed organizations and roles.
- Short generic phrase fingerprints from desensitized reports.

Blocked query ingredients:

- Full raw report text.
- OTPs, passwords, seed phrases, private keys, bank details, identity documents, credentials.
- Full phone numbers and payment handles unless reviewer-approved.
- Full personal email addresses when the local part identifies a person; use only the domain.

## Build Tavily Queries

Baseline query generation:

```js
const queries = new Set();

if (context.primary_identifier) queries.add(`"${context.primary_identifier}"`);
if (context.claimed_name && context.claimed_organization) {
  queries.add(`"${context.claimed_name}" "${context.claimed_organization}"`);
}
if (context.claimed_organization && context.claimed_role) {
  queries.add(`"${context.claimed_organization}" "${context.claimed_role}" recruiter`);
}

for (const domain of context.known_domains ?? []) {
  queries.add(`"${domain}" scam`);
  queries.add(`"${domain}" phishing`);
  if (context.claimed_organization) queries.add(`"${domain}" "${context.claimed_organization}"`);
}

for (const repo of context.known_repositories ?? []) {
  queries.add(`"${repo}" malware`);
  queries.add(`"${repo}" npm install security`);
}

for (const report of context.reports ?? []) {
  if (report.desensitized_summary?.includes("approved vendor")) {
    queries.add(`"approved vendor" "reimburse after first paycheck"`);
  }
  if (report.desensitized_summary?.includes("off-platform")) {
    queries.add(`"off-platform" "equipment purchase" job scam`);
  }
}

return [...queries].slice(0, 8);
```

## Tavily Request

Use Tavily Search with:

```json
{
  "query": "{{ query }}",
  "search_depth": "basic",
  "max_results": 3,
  "include_answer": false,
  "include_raw_content": false
}
```

Send the Tavily API key as a bearer token:

```http
Authorization: Bearer <TAVILY_API_KEY>
```

## Finding Classification

Use cautious labels:

- `official_source_found`
- `verification_gap`
- `domain_mismatch`
- `profile_mismatch`
- `negative_public_reference`
- `source_corrobates_report`
- `no_reliable_result`
- `benign_possible`
- `needs_human_review`

Do not output definitive accusations. The agent can say an affiliation was not verified, a domain appears separate from an official domain, or review is recommended.

## Shared Agent Output

```json
{
  "agent_name": "Web Due Diligence Agent",
  "status": "completed",
  "suspect_id": "attio_suspect_record_id",
  "suspect_object": "profile_suspects",
  "linked_report_ids": ["attio_report_record_id"],
  "summary": "Available web evidence did not verify the claimed affiliation. Review is recommended before any public-impact action.",
  "findings": [],
  "evidence_items": [],
  "risk_indicator_updates": [],
  "requires_review": true,
  "errors": []
}
```

## Current Attio Write-Back Payload

The current dev workflow writes a compact JSON string into `people.agent_findings`:

```json
{
  "agent_name": "Web Due Diligence Agent",
  "status": "completed",
  "summary": "Web due diligence completed with source-backed results queued for review.",
  "queries": ["\"https://www.linkedin.com/in/example\""],
  "findings": [
    {
      "type": "needs_human_review",
      "summary": "Public sources were found and should be reviewed before any user-facing conclusion is made.",
      "linked_identifier": "https://www.linkedin.com/in/example",
      "confidence": "medium"
    }
  ],
  "evidence_items": [
    {
      "claim": "Public web source returned for privacy-safe suspect due diligence query.",
      "source_title": "Search result title",
      "source_url": "https://example.com/source",
      "excerpt": "Short excerpt only.",
      "retrieved_at": "2026-06-27T16:30:00.000Z",
      "search_query": "\"https://www.linkedin.com/in/example\"",
      "linked_suspect_id": "attio_record_id",
      "confidence": "low"
    }
  ],
  "errors": [],
  "updated_at": "2026-06-27T16:30:00.000Z"
}
```

`risk_level` and `confidence` are also overwritten for the same `people` record. This is sufficient for the demo loop, but the production model should evolve to append or upsert separate source-backed evidence records.

## Failure Behavior

- If Attio read fails, write an Agent Run with `failed` status if possible and return an error response.
- If Tavily fails, return `status: "partial"` and write the agent run error list.
- If no useful public evidence is found, write `no_reliable_result` or `verification_gap`; do not treat absence of evidence as proof of fraud.
