# Attio Schema

Attio is the CRM system of record for suspects, user reports, submitted materials, evidence, risk indicators, ratings, reviewer decisions, and actions.

In the product UI, a **Suspect** is the aggregate intelligence target shown in the Suspects view. In Attio, Suspects do not need to be a single generic object. They can be represented by type-specific suspect objects with different fields and shapes, as long as they share a common investigation contract.

## Core Relationship Model

```text
Suspect-like Attio object
        |
        +--> Reports
        |       |
        |       +--> Materials
        |
        +--> Evidence Items
        +--> Sources
        +--> Risk Indicators
        +--> Agent Runs
        +--> Ratings
        +--> Reviewer Decisions
        +--> Actions
```

## Suspect Object Family

Use the product term **Suspect** for UI and workflow payloads. In Attio, implement this as one or more type-specific objects.

| Suspect Type | Purpose | Typical Identifiers | Type-Specific Fields |
| --- | --- | --- | --- |
| Profile Suspect | Person-like or account-like profile | LinkedIn URL, social profile URL, username | Claimed name, claimed role, claimed organization, profile platform, profile URL |
| Domain Suspect | Domain or website host | Domain, URL, host | Domain, registrar notes, claimed organization, lookalike target, observed URLs |
| Email Suspect | Email identity or sender domain | Email address, email domain | Sender domain, display name, claimed organization, source mailbox/platform |
| Repository Suspect | Code repo, package, script, or technical assessment | GitHub URL, package name, repo URL | Repository URL, package manager, detected script names, static-analysis status |
| Wallet Suspect | Crypto wallet or payment address | Wallet address, chain | Chain, address format, public references, recurrence count; no regulated AML claims |
| Marketplace Suspect | Marketplace account, buyer, seller, listing, or payment handle | Marketplace handle, listing URL, escrow/payment URL | Platform, listing URL, payment rail, escrow URL |
| Phone Suspect | Phone number or messaging handle | Phone, WhatsApp, Telegram, Signal handle | Messaging platform, region hint, linked reports |
| Message Template Suspect | Reused message pattern | Template hash, phrase fingerprint | Desensitized template, matched phrase set, cluster confidence |

## Current Dev Attio Shape

The connected dev Attio workspace currently exposes only the standard `people` and `companies` objects. Until dedicated suspect/report/evidence objects are created, the Web Due Diligence Agent demo stores a profile suspect as a `people` record.

Current mock record:

| Field | Value |
| --- | --- |
| Object | `people` |
| Record ID | `6310b053-2e5d-472a-b82c-5c9945eeb65c` |
| Name | `Chunteng Xiao` |
| LinkedIn | `https://www.linkedin.com/in/chunteng-xiao-b99763a4` |
| Suspect Type | `linkedin_profile` |
| Risk Level | `YELLOW` |
| Confidence | `35` before agent write-back |

Current custom fields on `people` used by the demo:

| Field | Purpose |
| --- | --- |
| `linkedin` | Public LinkedIn profile URL used as the primary identifier |
| `suspect_type` | ScamRadar category such as `linkedin_profile` |
| `risk_level` | Current risk label |
| `confidence` | Numeric risk/confidence score |
| `agent_findings` | Serialized JSON summary from the latest Web Due Diligence Agent run |

Current write-back is overwrite-based. The n8n workflow patches `agent_findings`, `risk_level`, and `confidence` on the `people` record. It does not yet append evidence or create separate `Sources`, `Evidence Items`, `Risk Indicators`, or `Agent Runs` records.

## Shared Suspect Fields

Every suspect-like object should expose enough shared fields for subagents and the UI:

| Field | Purpose |
| --- | --- |
| `suspect_id` | Stable Attio record ID for the suspect-like object |
| `suspect_type` | One of the suspect family types above |
| `primary_identifier` | Main identifier shown in the UI |
| `identifier_type` | `linkedin_url`, `domain`, `email`, `github_url`, `wallet`, `phone`, `marketplace_handle`, `message_template`, etc. |
| `display_label` | Human-readable label when available |
| `risk_level` | Current product risk label |
| `risk_score` | Current numeric score |
| `status` | Current review/investigation state |
| `corroboration_count` | Number of reports matched to this suspect |
| `last_activity_at` | Most recent report, evidence, agent, or reviewer activity |
| `summary` | Cautious aggregate summary |
| `web_due_diligence_status` | `not_started`, `queued`, `running`, `completed`, `failed`, or `needs_input` |
| `web_due_diligence_summary` | Latest Web Due Diligence Agent summary |
| `last_investigated_at` | Timestamp of latest agent investigation |

## Reports

Reports are user submissions about a Suspect. A report is not the same thing as a Suspect; it is one user's submitted material and context.

| Field | Purpose |
| --- | --- |
| `report_id` | Stable Attio report record ID |
| `suspect_id` | Linked suspect-like Attio record |
| `platform` | Source platform such as LinkedIn, email, GitHub, Telegram, eBay |
| `material_type` | Conversation log, email thread, screenshot, URL, repo, note, etc. |
| `raw_material` | Original material, visible only to the submitter/reviewer according to access policy |
| `redacted_material` | Privacy-safe material for agents and cross-user aggregate views |
| `desensitized_summary` | Cross-user shareable summary with personal details replaced by tokens |
| `detected_indicators` | Initial triage indicators from this report |
| `submitted_at` | Submission timestamp |
| `submitter` | Linked user record if available |

## Supporting Objects

| Object | Purpose | Key Relationships |
| --- | --- | --- |
| Materials | Submitted artifacts attached to reports | Report, Suspect, Evidence |
| Evidence Items | Source-backed fact or observation | Suspect, Report, Source, Risk Indicator, Agent Run |
| Sources | External source metadata | Evidence Items |
| Risk Indicators | Suspicious signal or verification gap | Suspect, Report, Evidence, Rating |
| Agent Runs | Subagent execution record | Suspect, Reports, Evidence, Errors |
| Ratings | Risk assessment | Suspect, Risk Indicators, Reviewer Decisions |
| Reviewer Decisions | Human decision and rationale | Suspect, Rating, Reports |
| Actions | Recommended or performed action | Suspect, User |
| Users | Submitter, reviewer, or admin | Reports, Decisions, Actions |

## Web Due Diligence Write-Back

The Web Due Diligence Agent reads a suspect-like record plus linked reports, calls Tavily using privacy-filtered identifiers and query phrases, then writes source-backed evidence back to Attio.

Required write-back records:

- `Agent Run`: status, started/finished timestamps, input suspect ID, linked report IDs, query count, error list.
- `Evidence Items`: one record per source-backed claim.
- `Sources`: title, URL, retrieved timestamp, source type, search query.
- `Risk Indicators`: only when the evidence supports a cautious indicator such as `unverified_affiliation`, `domain_mismatch`, `official_source_found`, `negative_public_reference`, or `no_reliable_result`.
- Suspect fields: `web_due_diligence_status`, `web_due_diligence_summary`, `last_investigated_at`.

## Suspect Statuses

- New
- Accepted
- Triage Complete
- Investigating
- Needs Review
- Reviewed
- Closed
- Archived

## Risk Levels

- Green: no meaningful suspicious indicators.
- Yellow: unusual or unverifiable elements.
- Orange: multiple suspicious indicators or one high-severity indicator.
- Red: immediate danger indicator or strongly corroborated suspicious pattern.
- Banned: external platform or reviewer action has confirmed a platform-level action. Use only when there is explicit source evidence.
