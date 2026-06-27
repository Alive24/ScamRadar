export interface SIEVerdict {
  input: string;
  scamScore: number;
  label: "clean" | "suspicious" | "scam";
  reason: string;
  topSimilarRecord?: string;
}

interface VectorRecord {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

const vectorStore: VectorRecord[] = [];

const RERANK_MODEL = "BAAI/bge-reranker-v2-m3";
const GEN_MODEL = "Qwen/Qwen3-4B-Instruct-2507";

function getEndpoint() {
  return process.env.SIE_URL ?? process.env.VITE_SIE_URL ?? process.env.SUPERLINKED_URL;
}

function getApiKey() {
  return process.env.SIE_API_KEY ?? process.env.VITE_SIE_API_KEY ?? process.env.SUPERLINKED_API_KEY;
}

function fallbackVerdict(text: string): { score: number; label: string; reason: string } {
  const lower = text.toLowerCase();
  const score =
    /\b(10|9|8|7)\b/.test(text) || lower.includes("high-risk") || lower.includes("scam") || lower.includes("do not")
      ? 8
      : lower.includes("suspicious") || lower.includes("caution") || lower.includes("verify")
        ? 5
        : 3;
  const label = score >= 7 ? "scam" : score >= 5 ? "suspicious" : "clean";

  return {
    score,
    label,
    reason: text.replace(/```json|```/g, "").trim() || "The fast model returned an empty response.",
  };
}

function parseVerdict(text: string): { score: number; label: string; reason: string } {
  try {
    return JSON.parse(text.trim());
  } catch {
    try {
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*"score"[\s\S]*"label"[\s\S]*"reason"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const prose = text.slice(0, jsonMatch.index).trim();

          return {
            score: Number(parsed.score),
            label: parsed.label,
            reason: prose || parsed.reason,
          };
        } catch {
          // Fall through to natural-language fallback.
        }
      }

      return fallbackVerdict(text);
    }
  }
}

export function isSIEConfigured(): boolean {
  return Boolean(getEndpoint());
}

export async function analyzeWithSIE(text: string, context?: string): Promise<SIEVerdict> {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error("SIE_URL is not configured");

  const { SIEClient } = await import("@superlinked/sie-sdk");
  const client = new SIEClient(endpoint, {
    ...(getApiKey() ? { apiKey: getApiKey() } : {}),
    gpu: "l4",
    waitForCapacity: true,
  });

  try {
    const prompt = `
You are ScamRadar's fast chat model for suspicious outreach triage.
Return ONLY a valid JSON object, with exactly:
{
  "score": <integer 0-10>,
  "label": "<clean|suspicious|scam>",
  "reason": "<one concise, user-facing answer>"
}

Use cautious language. Identify risk indicators, not definitive accusations.
If context is provided, answer from that context plus the user's question.

Score guide:
0-2: no clear risk indicators
3-4: slightly unusual, verify
5-6: suspicious, proceed with caution
7-8: likely scam pattern
9-10: immediate high-risk action

Context:
${context ?? "No structured context provided."}

User message:
${text}
`.trim();

    const out = await client.generate(GEN_MODEL, prompt, {
      maxNewTokens: 160,
      gpu: "rtx6000",
    });
    const verdict = parseVerdict(out.text);

    let topSimilarRecord: string | undefined;

    if (vectorStore.length > 0) {
      const reranked = await client.score(
        RERANK_MODEL,
        { text },
        vectorStore.map((record) => ({ text: record.text })),
      );

      if (reranked.scores.length > 0) {
        const rawId = reranked.scores[0].itemId ?? "";
        const topIdx = Number.parseInt(rawId.replace("item-", ""), 10);
        topSimilarRecord = Number.isFinite(topIdx) ? vectorStore[topIdx]?.id : undefined;
      }
    }

    vectorStore.push({
      id: `record-${Date.now()}`,
      text,
      metadata: { label: verdict.label, score: verdict.score },
    });

    return {
      input: text,
      scamScore: Number(verdict.score),
      label: verdict.label as SIEVerdict["label"],
      reason: verdict.reason,
      topSimilarRecord,
    };
  } finally {
    await client.close();
  }
}
