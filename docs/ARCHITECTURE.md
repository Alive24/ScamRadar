# Architecture

```text
Chrome Extension / Web App
        |
        v
Intake + Privacy Redaction
        |
        +--> Fast Triage Rules / Fast Model
        |        |
        |        v
        |   Immediate Alerts + Q&A
        |
        v
Attio CRM Records
        |
        v
n8n Async Workflow
        |
        +--> Tavily Search/Extract
        +--> Conversation Pattern Agent
        +--> Domain/Profile Agent
        +--> Similarity/Clustering Agent
        +--> Risk Scoring Agent
        +--> Report Writing Agent
        |
        v
Reviewer Queue + Case Dashboard
        |
        v
Report Packet
```

## MVP Implementation

The repo currently implements the Chrome Extension layer and local analysis logic:

- `src/popup`: user-facing extension popup.
- `src/content`: selected text and page context extraction.
- `src/background`: local case storage and mock async status.
- `src/shared`: rules, types, seeded reports, and report generation.

## Integration Boundary

The first live integrations should be added in this order:

1. Attio case/entity writes.
2. Tavily search/extract.
3. n8n webhook for async investigation.
4. Superlinked similarity search.
5. SLNG voice intake.

## PonyTail Constraints

The prototype intentionally avoids backend boilerplate until an integration needs it. The extension can run locally with seeded reports, which keeps the demo resilient.
