import type { ScamCase } from "./types";

export function makeReportMarkdown(scamCase: ScamCase): string {
  const indicatorLines = scamCase.indicators
    .map((indicator, index) => `${index + 1}. ${indicator.description} (${indicator.severity})`)
    .join("\n");

  const entityLines = scamCase.entities.map((entity) => `- ${entity.type}: ${entity.value}`).join("\n");
  const evidenceLines = scamCase.evidence.map((item) => `- ${item.claim} Source: ${item.source}`).join("\n");
  const nextSteps = scamCase.safeNextSteps.map((step) => `- ${step}`).join("\n");

  return `# ScamRadar Case Report

## Case Summary

The submitted material contains ${scamCase.indicators.length} risk indicator(s). ScamRadar does not prove intent or legal wrongdoing; it identifies risk indicators and recommends safer next steps.

## Current Rating

- Risk level: ${scamCase.rating.riskLevel}
- Confidence: ${scamCase.rating.confidence}
- Evidence strength: ${scamCase.rating.evidenceStrength}
- Human review: ${scamCase.rating.riskLevel === "red" || scamCase.rating.riskLevel === "orange" ? "Required" : "Optional"}

## Extracted Entities

${entityLines || "- None detected"}

## Risk Indicators

${indicatorLines || "No clear indicators detected."}

## Evidence

${evidenceLines || "- User-submitted material only."}

## Safe Next Steps

${nextSteps}

## Required Disclaimer

ScamRadar identifies risk indicators from submitted materials, related reports, and available sources. It does not by itself prove intent, identity, or legal wrongdoing. Public warnings or coordinated reports require human review and approval.
`;
}
