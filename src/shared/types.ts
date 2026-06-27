export type RiskLevel = "green" | "yellow" | "orange" | "red";
export type Confidence = "low" | "medium" | "high";

export type EntityType =
  | "url"
  | "domain"
  | "email"
  | "wallet"
  | "phone"
  | "repository"
  | "profile"
  | "message_template";

export type IndicatorCategory =
  | "payment"
  | "credentials"
  | "code_execution"
  | "suspicious_link"
  | "identity_document"
  | "off_platform"
  | "urgency"
  | "impersonation"
  | "template_reuse";

export interface Submission {
  text: string;
  url?: string;
  notes?: string;
  sourcePlatform?: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  value: string;
  confidence: Confidence;
}

export interface RiskIndicator {
  id: string;
  category: IndicatorCategory;
  severity: "low" | "medium" | "high" | "critical";
  confidence: Confidence;
  description: string;
  evidence: string;
  recommendedAction: string;
}

export interface SimilarReport {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface EvidenceItem {
  id: string;
  type: "user_submitted" | "web_source" | "similarity_match" | "model_inference";
  claim: string;
  source: string;
  confidence: Confidence;
}

export interface CaseRating {
  riskLevel: RiskLevel;
  confidence: Confidence;
  score: number;
  evidenceStrength: "weak" | "moderate" | "strong";
}

export interface ScamCase {
  id: string;
  title: string;
  createdAt: string;
  status: "triage_complete" | "investigating" | "needs_review" | "report_ready";
  submission: Submission;
  redactedText: string;
  entities: Entity[];
  indicators: RiskIndicator[];
  similarReports: SimilarReport[];
  evidence: EvidenceItem[];
  rating: CaseRating;
  safeNextSteps: string[];
  reportMarkdown: string;
}
