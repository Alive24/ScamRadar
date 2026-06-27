import { seededReports } from "./seedReports";
import { makeReportMarkdown } from "./report";
import type {
  CaseRating,
  Confidence,
  Entity,
  EvidenceItem,
  RiskIndicator,
  RiskLevel,
  ScamCase,
  SimilarReport,
  Submission
} from "./types";

const indicatorRules: Array<{
  category: RiskIndicator["category"];
  severity: RiskIndicator["severity"];
  pattern: RegExp;
  description: string;
  recommendedAction: string;
}> = [
  {
    category: "payment",
    severity: "critical",
    pattern: /\b(send|pay|wire|transfer|deposit|gift card|crypto|bitcoin|buy|purchase|equipment|vendor|reimburse)\b/i,
    description: "The message appears to request money, a purchase, crypto, or reimbursement setup.",
    recommendedAction: "Do not send money or buy equipment until verified through an official channel."
  },
  {
    category: "credentials",
    severity: "critical",
    pattern: /\b(seed phrase|private key|recovery phrase|password|otp|one-time code|verification code|bank account|routing number)\b/i,
    description: "The message appears to request sensitive credentials, wallet secrets, OTPs, or banking data.",
    recommendedAction: "Do not share credentials, seed phrases, OTPs, passwords, or banking data."
  },
  {
    category: "code_execution",
    severity: "critical",
    pattern: /\b(npm install|curl\b|bash\b|powershell|clone this repo|run this command|install anydesk|teamviewer|disable antivirus)\b/i,
    description: "The message appears to ask the user to run code, install software, or weaken device security.",
    recommendedAction: "Do not run untrusted code on your personal machine; use a sandbox or trusted reviewer."
  },
  {
    category: "identity_document",
    severity: "high",
    pattern: /\b(passport|driver'?s license|national id|ssn|social security|upload your id|identity document)\b/i,
    description: "The message appears to request identity documents or sensitive personal information.",
    recommendedAction: "Do not share identity documents before verifying the requester through official channels."
  },
  {
    category: "off_platform",
    severity: "medium",
    pattern: /\b(telegram|whatsapp|discord|signal)\b/i,
    description: "The message asks to move to another platform, which can be risky when combined with other indicators.",
    recommendedAction: "Pause and verify through an official channel before continuing off-platform."
  },
  {
    category: "urgency",
    severity: "medium",
    pattern: /\b(immediately|urgent|act now|within \d+ (minutes|hours)|confidential|do not contact|do not tell)\b/i,
    description: "The message uses urgency, secrecy, or pressure language.",
    recommendedAction: "Slow down and verify independently before taking action."
  }
];

export function analyzeSubmission(submission: Submission): ScamCase {
  const now = new Date().toISOString();
  const redactedText = redactSensitiveText(submission.text);
  const entities = extractEntities(redactedText, submission.url);
  const indicators = extractIndicators(redactedText);
  const similarReports = findSimilarReports(redactedText, indicators);
  const evidence = makeEvidence(indicators, similarReports);
  const rating = rateCase(indicators, similarReports);
  const safeNextSteps = makeSafeNextSteps(indicators, rating.riskLevel);

  const scamCase: ScamCase = {
    id: `case-${Date.now()}`,
    title: makeTitle(indicators, entities),
    createdAt: now,
    status: rating.riskLevel === "orange" || rating.riskLevel === "red" ? "needs_review" : "triage_complete",
    submission,
    redactedText,
    entities,
    indicators,
    similarReports,
    evidence,
    rating,
    safeNextSteps,
    reportMarkdown: ""
  };

  scamCase.reportMarkdown = makeReportMarkdown(scamCase);
  return scamCase;
}

export function answerCaseQuestion(question: string, scamCase: ScamCase): string {
  const lower = question.toLowerCase();
  if (lower.includes("run") || lower.includes("command") || lower.includes("script")) {
    return "Do not run untrusted commands or scripts on your personal machine. Use a sandbox or a trusted security reviewer.";
  }
  if (lower.includes("money") || lower.includes("pay") || lower.includes("buy")) {
    return "Do not send money or buy equipment until the request is verified through an official channel you found independently.";
  }
  if (lower.includes("suspicious") || lower.includes("risk")) {
    return scamCase.indicators.length
      ? `Top risk indicators: ${scamCase.indicators.map((i) => i.description).join(" ")}`
      : "No clear high-risk indicators were detected in the submitted material.";
  }
  if (lower.includes("verify") || lower.includes("next")) {
    return scamCase.safeNextSteps.join(" ");
  }
  return "Based on the current case file, focus on verified channels, avoid payments or secrets, and wait for deeper review if the case is orange or red.";
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/\b\d{6}\b/g, "[REDACTED_OTP]")
    .replace(/\b(?:[a-z]+ ){11,23}[a-z]+\b/gi, "[REDACTED_POSSIBLE_SEED_PHRASE]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
}

function extractEntities(text: string, pageUrl?: string): Entity[] {
  const values = new Map<string, Entity>();

  addMatches(values, text, /\bhttps?:\/\/[^\s)]+/gi, "url");
  addMatches(values, text, /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "domain");
  addMatches(values, text, /\b0x[a-fA-F0-9]{40}\b/g, "wallet");
  addMatches(values, text, /\bgithub\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/gi, "repository");
  addMatches(values, text, /\blinkedin\.com\/in\/[A-Za-z0-9_.%-]+/gi, "profile");

  if (pageUrl) addEntity(values, "url", pageUrl, "medium");
  return [...values.values()];
}

function addMatches(values: Map<string, Entity>, text: string, pattern: RegExp, type: Entity["type"]) {
  for (const match of text.matchAll(pattern)) addEntity(values, type, match[0], "high");
}

function addEntity(values: Map<string, Entity>, type: Entity["type"], value: string, confidence: Confidence) {
  const key = `${type}:${value.toLowerCase()}`;
  if (!values.has(key)) values.set(key, { id: `entity-${values.size + 1}`, type, value, confidence });
}

function extractIndicators(text: string): RiskIndicator[] {
  return indicatorRules
    .filter((rule) => rule.pattern.test(text))
    .map((rule, index) => ({
      id: `indicator-${index + 1}`,
      category: rule.category,
      severity: rule.severity,
      confidence: "high",
      description: rule.description,
      evidence: snippetFor(text, rule.pattern),
      recommendedAction: rule.recommendedAction
    }));
}

function findSimilarReports(text: string, indicators: RiskIndicator[]): SimilarReport[] {
  const haystack = `${text} ${indicators.map((indicator) => indicator.category).join(" ")}`.toLowerCase();
  return seededReports.filter((report) =>
    report.reasons.some((reason) => haystack.includes(reason.split(" ")[0].toLowerCase()))
  );
}

function makeEvidence(indicators: RiskIndicator[], similarReports: SimilarReport[]): EvidenceItem[] {
  const userEvidence = indicators.map((indicator, index) => ({
    id: `evidence-${index + 1}`,
    type: "user_submitted" as const,
    claim: indicator.description,
    source: "Submitted material",
    confidence: indicator.confidence
  }));

  if (!similarReports.length) return userEvidence;

  return [
    ...userEvidence,
    {
      id: `evidence-${userEvidence.length + 1}`,
      type: "similarity_match",
      claim: `${similarReports.length} seeded similar report(s) matched this pattern.`,
      source: "Internal seeded demo reports",
      confidence: "medium"
    }
  ];
}

function rateCase(indicators: RiskIndicator[], similarReports: SimilarReport[]): CaseRating {
  const severityScore = indicators.reduce((score, indicator) => {
    const points = { low: 5, medium: 15, high: 30, critical: 50 }[indicator.severity];
    return score + points;
  }, 0);
  const score = Math.min(100, severityScore + Math.min(20, similarReports.length * 8));
  const riskLevel: RiskLevel = score >= 70 ? "red" : score >= 40 ? "orange" : score >= 20 ? "yellow" : "green";

  return {
    riskLevel,
    confidence: similarReports.length || indicators.some((item) => item.severity === "critical") ? "high" : "medium",
    score,
    evidenceStrength: similarReports.length ? "moderate" : indicators.length ? "weak" : "weak"
  };
}

function makeSafeNextSteps(indicators: RiskIndicator[], riskLevel: RiskLevel): string[] {
  const steps = new Set<string>();
  indicators.forEach((indicator) => steps.add(indicator.recommendedAction));
  if (riskLevel === "green") steps.add("No clear high-risk indicator was detected; still verify sensitive requests independently.");
  steps.add("Preserve the messages, links, and identifiers for review.");
  steps.add("Use official channels you find independently, not links supplied in the suspicious message.");
  return [...steps];
}

function makeTitle(indicators: RiskIndicator[], entities: Entity[]): string {
  const top = indicators[0]?.category.replace("_", " ") ?? "suspicious outreach";
  const entity = entities.find((item) => item.type === "domain" || item.type === "profile")?.value;
  return entity ? `${top} check for ${entity}` : `${top} check`;
}

function snippetFor(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match?.index) return match?.[0] ?? "";
  const start = Math.max(0, match.index - 60);
  const end = Math.min(text.length, match.index + match[0].length + 60);
  return text.slice(start, end).trim();
}
