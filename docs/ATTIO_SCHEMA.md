# Attio Schema

Attio is the CRM system of record for cases, reports, materials, entities, evidence, ratings, reviewer decisions, and actions.

## Objects

| Object | Purpose | Key Relationships |
| --- | --- | --- |
| Cases | Investigation container | Reports, Materials, Entities, Evidence, Ratings, Reviewer Decisions |
| Reports | User submission | Case, Materials, User |
| Materials | Submitted artifact | Report, Case, Evidence |
| Entities | Generic extracted object | Cases, Reports, Evidence, Risk Indicators |
| People / Profiles | Person-like/profile-like entity | Organizations, Emails, Phones, Cases |
| Organizations | Company, vendor, project | Domains, Profiles, Cases |
| Domains | Domain or URL host | Organizations, Emails, Evidence |
| Emails | Email address | Domain, Profile, Case |
| Wallets | Crypto wallet/address | Cases, Evidence, Risk Indicators |
| Phone Numbers | Contact identifier | Profile, Cases |
| Repositories | Repo/package/script | Cases, Evidence, Risk Indicators |
| Message Templates | Reused text pattern | Reports, Clusters |
| Evidence Items | Source-backed fact/observation | Source, Entity, Risk Indicator |
| Risk Indicators | Suspicious signal | Case, Evidence, Rating |
| Ratings | Risk assessment | Case, Risk Indicators |
| Reviewer Decisions | Human decision | Case, Rating |
| Actions | Recommended/performed action | Case, User |
| Sources | Source metadata | Evidence |
| Users | Submitter/reviewer/admin | Reports, Decisions, Actions |

## Case Statuses

- New
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
