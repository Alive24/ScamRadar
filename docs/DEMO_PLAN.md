# Demo Plan

The judging video must be 2 minutes. The goal is to show a coherent live walkthrough, not every implementation detail.

## 2-Minute Loom Script

### 0:00-0:12 Product Frame

ScamRadar is an agentic trust-and-safety CRM for suspicious outreach.

The demo starts with recruiter scams, but the same system generalizes to phishing, marketplace scams, wallet fraud, fake investor outreach, and malicious code-test requests.

Show:

- Pitch deck title or app dashboard.
- One-sentence promise: before users send money, share IDs, or run code, ScamRadar turns suspicious outreach into structured, reviewable evidence.

### 0:12-0:38 Extension Intake

Open the Extension UI.

Paste the seeded suspicious recruiter message:

```text
Congratulations, you are selected. Please continue on Telegram with our hiring manager. You will need to purchase your work laptop from our approved vendor. We reimburse after your first paycheck.
```

Mention that the visual prototype accepts conversations, profile links, domains, wallets, repos, screenshots, and notes.

Show immediate indicators:

- Equipment purchase request.
- Off-platform migration.
- Reimbursement promise.
- Urgency / pressure.

### 0:38-0:58 Suspect + Report Model

Switch to the Dashboard / Suspects view.

Explain:

- A **Report** is one user submission.
- A **Suspect** is the reusable intelligence target.
- Suspects may be different shapes: profile, domain, email, repo, wallet, marketplace handle, phone, or message template.

Show linked reports, risk timeline, similar submissions, and reviewer-safe language.

### 0:58-1:25 Partner Tech Walkthrough

Show the integration story clearly:

- **Attio** is the CRM/data availability layer. In the current dev workspace, the mock suspect is an Attio `people` record with ScamRadar fields.
- **n8n** orchestrates subagents. The implemented workflow is `ScamRadar - Web Due Diligence Agent`.
- **Tavily** performs privacy-safe web due diligence. It searches public identifiers and safe phrase fingerprints, dedupes URLs, and produces source-backed evidence summaries.
- **Superlinked** powers the vectorized similarity/retrieval layer for report and document context used by the chat/model experience.

Show n8n briefly:

- `Manual Trigger: Mock Chunteng Profile`
- `Mock: Chunteng Attio Person Payload`
- `Code: Run Web Due Diligence Agent`
- `Respond: Agent Output`

### 1:25-1:45 Agent Output + Attio Write-Back

Run or show the Web Due Diligence Agent output.

Explain current write-back:

- Tavily results become `evidence_items` with title, URL, excerpt, query, retrieved time, and confidence.
- n8n writes a compact JSON summary to Attio `people.agent_findings`.
- It also updates `risk_level` and `confidence`.

Be explicit: this is currently overwrite-based for the demo; incremental Evidence/Sources/Agent Runs are the next object-model step.

### 1:45-2:00 Close

End on the value:

ScamRadar turns isolated suspicious messages into a shared, privacy-aware, evidence-backed trust layer with human review before public-impact action.

Mention the repo contains setup instructions, architecture, Attio schema, n8n workflow JSON, and partner-tech documentation.

## Live Demo Checklist

- `pnpm build` succeeds.
- Chrome extension can be loaded from `dist`.
- Dashboard and Extension UI are visible in the visual prototype.
- n8n workflow exists as `ScamRadar - Web Due Diligence Agent`.
- Attio mock record exists: `people/6310b053-2e5d-472a-b82c-5c9945eeb65c`.
- Hardcoded demo keys are pasted in n8n UI only, not committed.
- Manual n8n trigger can run or be shown with recent output.
- README links to the pitch deck, demo plan, and integration docs.

## Avoid In The Video

- Do not over-explain implementation internals.
- Do not claim public scam confirmation.
- Do not claim incremental evidence insertion is already implemented.
- Do not show API keys.
- Do not spend more than 10 seconds on setup.
