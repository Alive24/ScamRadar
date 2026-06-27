import type { SimilarReport } from "./types";

export const seededReports: SimilarReport[] = [
  {
    id: "seed-001",
    title: "Remote job offer with equipment vendor purchase",
    riskLevel: "red",
    reasons: ["equipment purchase", "reimbursement promise", "Telegram migration"]
  },
  {
    id: "seed-002",
    title: "Fake payroll setup before official offer",
    riskLevel: "orange",
    reasons: ["early bank details", "WhatsApp migration"]
  },
  {
    id: "seed-003",
    title: "Developer assessment asks candidate to run npm package",
    riskLevel: "red",
    reasons: ["run code request", "technical assessment"]
  },
  {
    id: "seed-004",
    title: "Wallet airdrop asks for seed phrase",
    riskLevel: "red",
    reasons: ["seed phrase request", "wallet compromise"]
  },
  {
    id: "seed-005",
    title: "Marketplace buyer requests off-platform payment",
    riskLevel: "orange",
    reasons: ["off-platform payment", "shipping label link"]
  }
];
