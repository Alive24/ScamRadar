# n8n Workflows

n8n orchestrates async investigation for Suspects. The extension or Attio automation should call a webhook with `suspect_id`, `run_reason`, the suspect type, safe identifiers, linked report IDs, and redacted report context.

## Workflow: ScamRadar Async Investigation

```yaml
trigger:
  type: webhook
  event: suspect.created_or_report_attached

steps:
  - fetch_suspect
  - fetch_linked_reports
  - privacy_gate
  - route_agents
  - web_due_diligence_agent
  - conversation_pattern_agent
  - suspect_aggregation_agent
  - similarity_agent
  - scoring_agent
  - update_attio
  - reviewer_gate
  - report_packet_draft
  - notify_user
```

## Workflow: Web Due Diligence Agent

This should be the first live subagent. It reads one suspect-like Attio record and its linked reports, creates privacy-safe Tavily queries, gathers external evidence, and writes cautious source-backed intelligence back to Attio.

### Current Dev Status

The current dev workflow exists in n8n as `ScamRadar - Web Due Diligence Agent` with workflow ID `qVjpOqdb9BgXEKLd`. The repo copy is `n8n/scamradar-web-due-diligence-agent.workflow.json`.

Current implementation:

- Webhook trigger for external calls.
- Manual trigger for a mock Chunteng Xiao LinkedIn profile run.
- Mock Attio read payload for Attio `people` record `6310b053-2e5d-472a-b82c-5c9945eeb65c`.
- Tavily search with privacy-safe queries and no raw page content.
- Attio REST write-back to the same `people` record.
- External API calls run through n8n HTTP Request nodes. Code nodes do not call `fetch` because the n8n Cloud Code sandbox has no network access.

Current write-back is intentionally compact:

- `agent_findings`: overwritten with a JSON string containing queries, findings, up to 6 evidence item summaries, errors, and update time.
- `risk_level`: overwritten with the current agent risk label.
- `confidence`: overwritten with the current numeric confidence/risk score.

This is not yet incremental insertion. The target version should upsert source/evidence/agent-run records by URL or run ID, then roll up the latest summary to the suspect record.

### Trigger

```json
{
  "suspect_id": "attio_suspect_record_id",
  "suspect_object": "profile_suspects",
  "run_reason": "new_report",
  "linked_report_ids": ["attio_report_record_id"],
  "force_refresh": false
}
```

### Steps

```yaml
steps:
  - webhook_trigger
  - fetch_suspect_from_attio
  - fetch_linked_reports_from_attio
  - normalize_suspect_context
  - privacy_gate
  - build_tavily_queries
  - tavily_search
  - tavily_extract_optional
  - dedupe_sources
  - classify_findings
  - create_sources_in_attio
  - create_evidence_items_in_attio
  - create_or_update_risk_indicators_in_attio
  - update_suspect_due_diligence_summary
  - create_agent_run_record
  - return_agent_output
```

The current dev workflow collapses these target steps into a smaller n8n graph:

```yaml
nodes:
  - Webhook: Suspect Due Diligence
  - Manual Trigger: Mock Chunteng Profile
  - Mock: Chunteng Attio Person Payload
  - Code: Run Web Due Diligence Agent
  - HTTP: Tavily Search
  - Code: Build Agent Output
  - HTTP: Attio Writeback
  - Code: Finalize Agent Output
  - Respond: Agent Output
```

### Suspect Context Contract

```json
{
  "suspect_id": "attio_suspect_record_id",
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
      "submitted_at": "2026-06-27T10:10:00Z",
      "redacted_material": "Recruiter claiming to work at [MAJOR_TECH_CO] requested equipment purchase and off-platform messaging.",
      "desensitized_summary": "Recruiter on [PLATFORM] offered [ROLE], requested equipment purchase, and moved to [MESSAGING_APP].",
      "detected_indicators": ["equipment_purchase", "off_platform_redirect"]
    }
  ]
}
```

### Privacy Gate

Do not send raw user submissions to Tavily by default. Build search queries from identifiers, claimed organizations, domains, URLs, repositories, and short non-sensitive phrase fingerprints.

Allowed:

- Public profile URLs and handles.
- Domains, hosts, website URLs, repository URLs, package names.
- Claimed organizations and roles.
- Short generic phrase fingerprints such as `"approved vendor" "reimburse after first paycheck"`.

Avoid:

- Full private email addresses when the local part identifies a person; use the domain instead.
- Full phone numbers and payment handles unless the user/reviewer explicitly allows it.
- Full raw conversation logs.
- OTPs, secrets, bank details, identity documents, seed phrases, private keys, or credentials.

### Tavily Query Strategy

Generate queries from the suspect type.

| Suspect Type | Query Examples |
| --- | --- |
| Profile Suspect | `"{profile_url}"`, `"{claimed_name}" "{claimed_organization}" recruiter`, `"{claimed_organization}" official recruiter email domain` |
| Domain Suspect | `"{domain}" scam`, `"{domain}" phishing`, `"{domain}" official`, `"{domain}" "{claimed_organization}"` |
| Email Suspect | `"{email_domain}" scam`, `"{email_domain}" "{claimed_organization}"`, `"{claimed_organization}" official email domain` |
| Repository Suspect | `"{repo_url}" malware`, `"{repo_url}" npm install security`, `"{package_name}" postinstall` |
| Wallet Suspect | `"{wallet_address}"`, `"{wallet_address}" scam`, `"{chain}" "{wallet_address}"` |
| Marketplace Suspect | `"{marketplace_handle}" scam`, `"{escrow_url}" fake escrow`, `"{listing_url}"` |
| Message Template Suspect | `"{short_phrase_1}" "{short_phrase_2}" scam`, `"{template_phrase}" job scam` |

### Finding Types

- `official_source_found`
- `verification_gap`
- `domain_mismatch`
- `profile_mismatch`
- `negative_public_reference`
- `source_corrobates_report`
- `no_reliable_result`
- `benign_possible`
- `needs_human_review`

### Attio Write-Back Contract

```json
{
  "agent_name": "Web Due Diligence Agent",
  "status": "completed",
  "suspect_id": "attio_suspect_record_id",
  "suspect_object": "profile_suspects",
  "linked_report_ids": ["attio_report_record_id"],
  "summary": "Available web evidence did not verify the claimed affiliation. Review is recommended before any public-impact action.",
  "findings": [
    {
      "type": "verification_gap",
      "summary": "No reliable source tied the submitted recruiting domain to the claimed organization.",
      "linked_identifier": "meta-careers.io",
      "confidence": "medium"
    }
  ],
  "evidence_items": [
    {
      "claim": "Submitted domain could not be verified as an official recruiting domain for the claimed organization.",
      "source_title": "Search result title",
      "source_url": "https://example.com/source",
      "excerpt": "Short excerpt only.",
      "retrieved_at": "2026-06-27T10:15:00Z",
      "search_query": "\"meta-careers.io\" \"Meta\"",
      "linked_suspect_id": "attio_suspect_record_id",
      "linked_report_ids": ["attio_report_record_id"],
      "confidence": "medium"
    }
  ],
  "risk_indicator_updates": [
    {
      "category": "unverified_affiliation",
      "severity": "medium",
      "description": "Claimed affiliation remains unverified through available web evidence."
    }
  ],
  "requires_review": true,
  "errors": []
}
```

### Current Dev Attio Write-Back

For the current demo, Attio only exposes `people` and `companies`. The mock suspect is stored as a `people` record with ScamRadar custom attributes:

```json
{
  "object": "people",
  "record_id": "6310b053-2e5d-472a-b82c-5c9945eeb65c",
  "linkedin": "https://www.linkedin.com/in/chunteng-xiao-b99763a4",
  "suspect_type": "linkedin_profile",
  "risk_level": "YELLOW",
  "confidence": 35,
  "agent_findings": "JSON summary string"
}
```

The n8n workflow writes back using:

```text
PATCH https://api.attio.com/v2/objects/{object}/records/{record_id}
```

and sends:

```json
{
  "data": {
    "values": {
      "agent_findings": "serialized agent summary",
      "risk_level": "YELLOW",
      "confidence": 55
    }
  }
}
```

## Subagents

- Web Due Diligence Agent: Tavily search/extract for orgs, domains, profiles, and message phrases.
- Domain/Infrastructure Agent: normalize domains and detect lookalikes or mismatches.
- Profile/Identity Consistency Agent: compare claimed identity and affiliation.
- Wallet/AML-style Agent: wallet format, recurrence, and public risk references; no regulated claims.
- Code/Repository Risk Agent: static inspection for dangerous commands and credential access.
- Conversation Pattern Agent: social-engineering pattern extraction.
- Entity Aggregation Agent: dedupe and link entities.
- Similarity/Clustering Agent: exact, fuzzy, and semantic matches.
- Report Writing Agent: cautious report packet.
- Reviewer Prep Agent: decision checklist and false-positive risks.

## Shared Output Contract

```json
{
  "agent_name": "Web Due Diligence Agent",
  "status": "completed",
  "suspect_id": "attio_suspect_record_id",
  "linked_report_ids": [],
  "summary": "",
  "findings": [],
  "evidence_items": [],
  "new_suspect_links": [],
  "risk_indicator_updates": [],
  "confidence": "medium",
  "requires_review": true,
  "errors": []
}
```
