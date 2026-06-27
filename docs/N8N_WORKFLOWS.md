# n8n Workflows

n8n orchestrates async investigation. The extension should call a webhook with `case_id`, `run_reason`, redacted material, entities, and current risk indicators.

## Workflow: ScamRadar Async Investigation

```yaml
trigger:
  type: webhook
  event: case.created_or_high_risk_detected

steps:
  - fetch_case
  - privacy_gate
  - route_agents
  - web_due_diligence_agent
  - conversation_pattern_agent
  - entity_aggregation_agent
  - similarity_agent
  - scoring_agent
  - update_attio
  - reviewer_gate
  - report_packet_draft
  - notify_user
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
  "findings": [],
  "evidence_items": [],
  "new_entities": [],
  "risk_indicator_updates": [],
  "confidence": "medium",
  "requires_review": true,
  "errors": []
}
```
