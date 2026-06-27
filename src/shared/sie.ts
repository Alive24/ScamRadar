import { SIEClient } from "@superlinked/sie-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── In-memory vector store (swap for Qdrant / Chroma in production) ─────────

const vectorStore: VectorRecord[] = [];

// ─── Models ───────────────────────────────────────────────────────────────────

const RERANK_MODEL = "BAAI/bge-reranker-v2-m3";
const GEN_MODEL    = "Qwen/Qwen3-4B-Instruct-2507";

// ─── Client factory ───────────────────────────────────────────────────────────

function makeClient(): SIEClient {
  const endpoint = import.meta.env.VITE_SIE_URL as string | undefined;
  const apiKey   = import.meta.env.VITE_SIE_API_KEY as string | undefined;

  if (!endpoint) throw new Error("VITE_SIE_URL is not configured");

  return new SIEClient(endpoint, {
    ...(apiKey ? { apiKey } : {}),
    gpu: "l4",
    waitForCapacity: true,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse `text` using the Superlinked Inference Engine.
 *
 * Returns a 0-10 scam score, a label, a one-sentence reason, and (when the
 * in-memory store already has records) the most similar previously seen text.
 */
export async function analyzeWithSIE(text: string): Promise<SIEVerdict> {
  const client = makeClient();

  try {
    // ── Step 1: LLM verdict ──────────────────────────────────────────────────
    const prompt = `
You are a scam-detection expert. Analyse the message below and return ONLY
a valid JSON object — no markdown, no explanation — with exactly these fields:

  {
    "score": <integer 0-10>,
    "label": "<clean|suspicious|scam>",
    "reason": "<one sentence>"
  }

Score guide:
  0–2   Clearly legitimate
  3–4   Slightly unusual but probably fine
  5–6   Suspicious — proceed with caution
  7–8   Likely a scam
  9–10  Almost certainly a scam

Message to analyse:
"${text}"
`.trim();

    const out = await client.generate(GEN_MODEL, prompt, {
      maxNewTokens: 128,
      gpu: "rtx6000",
    });

    let verdict: { score: number; label: string; reason: string };
    try {
      verdict = JSON.parse(out.text.trim());
    } catch {
      // Strip accidental markdown fences before retrying
      const clean = out.text.replace(/```json|```/g, "").trim();
      verdict = JSON.parse(clean);
    }

    // ── Step 2: Cross-encoder rerank against stored records ──────────────────
    let topSimilarRecord: string | undefined;

    if (vectorStore.length > 0) {
      const reranked = await client.score(
        RERANK_MODEL,
        { text },
        vectorStore.map((r) => ({ text: r.text })),
      );

      if (reranked.scores.length > 0) {
        const topIdx = parseInt(reranked.scores[0].itemId.replace("item-", ""), 10);
        topSimilarRecord = vectorStore[topIdx]?.id;
      }
    }

    // ── Step 3: Store this message for future similarity lookups ─────────────
    vectorStore.push({
      id: `record-${Date.now()}`,
      text,
      metadata: { label: verdict.label, score: verdict.score },
    });

    return {
      input:           text,
      scamScore:       verdict.score,
      label:           verdict.label as SIEVerdict["label"],
      reason:          verdict.reason,
      topSimilarRecord,
    };
  } finally {
    await client.close();
  }
}

/** True when VITE_SIE_URL is present — lets the UI decide whether to call the live API. */
export function isSIEConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SIE_URL);
}
