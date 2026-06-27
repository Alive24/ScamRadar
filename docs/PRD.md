# PRD: ScamRadar

Version: `v0.1 hackathon prototype`

ScamRadar is an agentic trust-and-safety CRM for suspicious outreach, entities, and interactions. Users submit conversations, emails, posts, screenshots, URLs, profile links, wallet addresses, payment handles, phone numbers, repositories, scripts, or notes. The system extracts entities, detects risk indicators, creates structured case records, searches for supporting evidence, aggregates related reports, clusters similar patterns, and generates cautious, evidence-backed risk ratings and safe next steps.

ScamRadar does not automatically label people or organizations as scammers. It surfaces risk indicators, suspicious patterns, verification gaps, and recommended safety actions.

## Primary Demo

The first vertical is suspicious recruiter or job-offer outreach:

1. User receives a suspicious recruiter message.
2. User submits the message, profile URL, email/domain, and notes.
3. ScamRadar detects immediate risk indicators.
4. ScamRadar creates a case in the CRM layer.
5. Tavily searches for evidence.
6. n8n launches async subagents.
7. Superlinked or seeded demo data finds similar reports.
8. Risk score updates.
9. Reviewer validates the case.
10. ScamRadar generates a cautious report packet.

## Broader Scope

- Phishing.
- Marketplace scams.
- Wallet/payment fraud.
- Fake startup, investor, grant, or partnership outreach.
- Malicious GitHub/script requests.
- Impersonation.
- Suspicious off-platform migration.

## Goals

- Fast triage within seconds for obvious high-risk asks.
- Structured case creation and entity extraction.
- Evidence-backed analysis with citations.
- Similarity aggregation across reports.
- Safe next-step recommendations.
- Human review before public-impact actions.
- Extensible CRM-backed entity graph.

## Non-Goals

- No automatic public accusations.
- No mass reporting.
- No full LinkedIn automation.
- No aggressive scraping.
- No compliance-grade KYC/AML claims.
- No malware execution.
- No public searchable blacklist.

## Personas

- Individual user checking suspicious outreach.
- Job seeker or student.
- Crypto/web3 user checking a wallet or payment request.
- Developer checking a suspicious GitHub/script request.
- Community moderator or reviewer.
- Trust-and-safety analyst/admin.

## Core Workflows

### Real-Time Triage

1. User submits text, URL, profile, repository, wallet, screenshot, or notes.
2. System redacts sensitive data where feasible.
3. Fast rules/model extract entities and high-risk asks.
4. System returns risk preview, alert copy, summary, and safe next steps.
5. Case is saved to the CRM layer.
6. Async investigation is queued if needed.

### Async Due Diligence

1. n8n receives case ID and scoped context.
2. Subagents run due diligence, entity aggregation, similarity search, scoring, and report drafting.
3. Outputs are written back to CRM records.
4. Reviewer queue updates if thresholds are met.

### Human Review

Human review is required for red cases, public warnings, coordinated reports, named individuals, similarity-heavy cases, sensitive PII, wallet/payment risk, and code-execution risk.

## Immediate Danger Alerts

Fire an alert when submitted material asks the user to:

- Send money, crypto, gift cards, or bank transfer.
- Buy equipment or pay fees.
- Share private keys, seed phrases, OTPs, passwords, banking data, or ID documents.
- Run commands, execute scripts, clone repos, install packages, or install remote-access software.
- Open suspicious links or attachments.
- Move off-platform under pressure.

## Success Metrics

- Detect all critical seeded indicators.
- Initial triage under 10 seconds.
- Case creation under 15 seconds.
- At least five entities extracted in demo case.
- At least two similar seeded reports found.
- Every external evidence item has source metadata.
- No definitive accusation language in generated reports.
