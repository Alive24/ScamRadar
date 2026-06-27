# Integrations

## Attio

Role: CRM layer for storage, entity management, relationships, case state, and simple automations.

MVP path:

- Create/update cases.
- Upsert entities.
- Attach evidence and risk indicators.
- Track reviewer decisions.

## Tavily

Role: real-time search, extraction, crawling, and evidence gathering.

MVP path:

- Search company/domain/profile/repository/message phrases.
- Extract 2-3 evidence snippets per case.
- Store source title, URL, excerpt, retrieved timestamp, and rationale.

## n8n

Role: async subagent orchestration.

MVP path:

- Webhook from case creation.
- Visible workflow for due diligence, conversation analysis, similarity, scoring, and report drafting.
- Write outputs back to Attio.

## Superlinked

Role: semantic and multi-attribute similarity.

MVP path:

- Start with seeded local matching.
- Add Superlinked when case text + structured entity features need real vector search.

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
