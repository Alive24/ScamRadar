import { analyzeSubmission } from "../shared/analysis";
import type { ScamCase, Submission } from "../shared/types";

const CASES_KEY = "scamradar_cases";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCAMRADAR_CREATE_CASE") {
    createCase(message.submission).then(sendResponse);
    return true;
  }

  if (message?.type === "SCAMRADAR_LIST_CASES") {
    listCases().then(sendResponse);
    return true;
  }

  if (message?.type === "SCAMRADAR_RUN_ASYNC") {
    runMockAsyncInvestigation(message.caseId).then(sendResponse);
    return true;
  }

  return false;
});

async function createCase(submission: Submission): Promise<ScamCase> {
  const scamCase = analyzeSubmission(submission);
  const cases = await listCases();
  await chrome.storage.local.set({ [CASES_KEY]: [scamCase, ...cases].slice(0, 50) });
  return scamCase;
}

async function listCases(): Promise<ScamCase[]> {
  const result = await chrome.storage.local.get(CASES_KEY);
  return Array.isArray(result[CASES_KEY]) ? result[CASES_KEY] : [];
}

async function runMockAsyncInvestigation(caseId: string): Promise<ScamCase | undefined> {
  const cases = await listCases();
  const next = cases.map((item) =>
    item.id === caseId
      ? {
          ...item,
          status: "report_ready" as const,
          evidence: [
            ...item.evidence,
            {
              id: `evidence-${item.evidence.length + 1}`,
              type: "web_source" as const,
              claim: "Async due diligence placeholder: Tavily/n8n will replace this with cited source evidence.",
              source: "Mock async investigation",
              confidence: "medium" as const
            }
          ]
        }
      : item
  );

  await chrome.storage.local.set({ [CASES_KEY]: next });
  return next.find((item) => item.id === caseId);
}
