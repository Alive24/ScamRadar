import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const REPORT_ORDER = [
  "SR-2024-0352",
  "SR-2024-0347",
  "SR-2024-0341",
  "SR-2024-0339",
  "SR-2024-0335",
  "SR-2024-0330",
];

function getFirstAttributeValue(record: any, slug: string) {
  const value = record?.values?.[slug]?.[0];

  if (!value) return undefined;
  if ("value" in value) return value.value;
  if ("full_name" in value) return value.full_name;
  if ("email_address" in value) return value.email_address;
  if ("domain" in value) return value.domain;

  return undefined;
}

function splitIndicators(value?: string) {
  return value
    ? value.split(";").map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeRiskLevel(value?: string) {
  return ["GREEN", "YELLOW", "ORANGE", "RED", "BANNED"].includes(value ?? "") ? value : "YELLOW";
}

function inferIdentifierType(record: any) {
  const suspectType = getFirstAttributeValue(record, "suspect_type");
  const linkedin = getFirstAttributeValue(record, "linkedin");
  const email = getFirstAttributeValue(record, "email_addresses");
  const domain = getFirstAttributeValue(record, "domains");

  if (suspectType === "marketplace_seller") return "ebay_handle";
  if (suspectType === "github_repository") return "github_url";
  if (suspectType === "email_identity" || email) return "email";
  if (suspectType === "domain" || domain) return "domain";
  if (suspectType === "wallet") return "wallet";
  if (suspectType === "phone_number") return "phone";
  if (suspectType === "linkedin_profile" || linkedin) return "linkedin_url";

  return "domain";
}

function inferPlatform(record: any) {
  const explicit = getFirstAttributeValue(record, "source_platform");
  const type = inferIdentifierType(record);

  if (explicit) return explicit;
  if (type === "linkedin_url") return "LinkedIn";
  if (type === "github_url") return "GitHub";
  if (type === "ebay_handle") return "eBay";
  if (type === "email") return "Email";

  return "Unknown";
}

function inferIdentifier(record: any) {
  return (
    getFirstAttributeValue(record, "primary_identifier") ??
    getFirstAttributeValue(record, "linkedin") ??
    getFirstAttributeValue(record, "email_addresses") ??
    getFirstAttributeValue(record, "domains") ??
    getFirstAttributeValue(record, "phone_numbers") ??
    getFirstAttributeValue(record, "name") ??
    record?.id?.record_id
  );
}

function inferReportType(record: any) {
  const suspectType = getFirstAttributeValue(record, "suspect_type");

  if (suspectType === "linkedin_profile") return "Recruiter Check";
  if (suspectType === "github_repository") return "Malicious Code";
  if (suspectType === "marketplace_seller") return "Payment Fraud";
  if (suspectType === "email_identity") return "Impersonation";
  if (suspectType === "domain") return "Domain Check";
  if (suspectType === "wallet") return "Wallet Check";

  return "Suspect Check";
}

function mapAttioRecordToReport(record: any) {
  const payload = getFirstAttributeValue(record, "ui_payload");
  if (payload) return JSON.parse(payload);

  const identifier = inferIdentifier(record);
  const riskLevel = normalizeRiskLevel(getFirstAttributeValue(record, "risk_level"));
  const score = Number(getFirstAttributeValue(record, "confidence") ?? 0);
  const indicators = splitIndicators(getFirstAttributeValue(record, "top_indicators"));
  const summary =
    getFirstAttributeValue(record, "latest_report_summary") ??
    getFirstAttributeValue(record, "description") ??
    getFirstAttributeValue(record, "agent_findings") ??
    "Attio suspect record is missing a UI payload, so ScamRadar generated this report card from structured Attio fields.";

  return {
    id: `ATTIO-${record.id.record_id.slice(0, 8)}`,
    reportedIdentifier: identifier,
    reportedIdentifierType: inferIdentifierType(record),
    corroborationCount: Number(getFirstAttributeValue(record, "report_count") ?? 1),
    type: inferReportType(record),
    platform: inferPlatform(record),
    risk: riskLevel,
    score,
    status: (getFirstAttributeValue(record, "submission_status") ?? "ACCEPTED").toUpperCase(),
    lastActivity: "From Attio",
    indicators: indicators.length ? indicators : [getFirstAttributeValue(record, "agent_findings") ?? "Manual Attio suspect record"],
    summary,
    subagentsActive: Boolean(getFirstAttributeValue(record, "agent_findings")?.toLowerCase().includes("pending")),
  };
}

function attioReportsPlugin() {
  return {
    name: "scamradar-attio-reports",
    configureServer(server: any) {
      server.middlewares.use("/api/attio/reports", async (_req: any, res: any) => {
        const apiKey = process.env.ATTIO_API_KEY;

        res.setHeader("Content-Type", "application/json");

        if (!apiKey) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "ATTIO_API_KEY is not configured" }));
          return;
        }

        try {
          const records = await Promise.all(["people", "companies"].map(async (object) => {
            const response = await fetch(`https://api.attio.com/v2/objects/${object}/records/query`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ data: { limit: 50 } }),
            });

            if (!response.ok) {
              const body = await response.text();
              throw new Error(`Attio ${object} query failed: ${response.status} ${body}`);
            }

            const payload = await response.json();
            return payload.data ?? [];
          }));

          const reports = records
            .flat()
            .filter((record: any) => getFirstAttributeValue(record, "ui_payload") || getFirstAttributeValue(record, "suspect_type") || getFirstAttributeValue(record, "risk_level"))
            .map((record: any) => mapAttioRecordToReport(record))
            .sort((a: any, b: any) => {
              const left = REPORT_ORDER.indexOf(a.id);
              const right = REPORT_ORDER.indexOf(b.id);
              return (left === -1 ? Number.MAX_SAFE_INTEGER : left) - (right === -1 ? Number.MAX_SAFE_INTEGER : right);
            });

          res.end(JSON.stringify({ reports }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to load Attio reports" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), attioReportsPlugin()],
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        popup: "popup.html",
        background: "src/background/index.ts",
        content: "src/content/index.ts"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});
