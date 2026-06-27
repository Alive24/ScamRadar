# Demo Plan

## 3-Minute Script

### 0:00-0:20 Setup

ScamRadar is an agentic trust-and-safety CRM for suspicious outreach. The demo starts with recruiter scams, but the same workflow applies to wallet fraud, phishing, marketplace scams, fake investor outreach, and malicious GitHub/script requests.

### 0:20-0:45 Submit Material

Paste a suspicious recruiter message:

> Congratulations, you are selected. Please continue on Telegram with our hiring manager. You will need to purchase your work laptop from our approved vendor. We reimburse after your first paycheck.

Add claimed company, profile URL, email/domain, and note: "This felt rushed."

### 0:45-1:10 Immediate Alert

Show:

- Equipment purchase request.
- Off-platform migration.
- Reimbursement promise.
- Urgency/pressure.

Recommendation: do not send money; verify through official company channels.

### 1:10-1:30 CRM Case

Show case record with extracted entities:

- Person/profile.
- Organization.
- Domain.
- Telegram handle.
- Vendor URL.
- Message template.

### 1:30-2:20 Async Investigation

Show n8n workflow:

- Tavily evidence search.
- Conversation Pattern Agent.
- Similarity/Clustering Agent.
- Risk Scoring Agent.

### 2:20-2:50 Reviewer Queue

Show similar reports, risk update, and reviewer decision:

- Risk: red.
- Confidence: medium/high.
- Reviewer required: yes.
- Public warning not automatic.

### 2:50-3:00 Report Packet

Generate report with facts, indicators, evidence, uncertainty, benign explanations, safe next steps, and reviewer decision.

## Seeded Demo Cases

- Remote job equipment purchase + Telegram.
- Fake payroll setup + early bank details.
- Developer assessment + run npm package.
- Wallet airdrop + seed phrase request.
- Marketplace buyer + off-platform payment.
