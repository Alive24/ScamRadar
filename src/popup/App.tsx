import { useState, useRef, useEffect, type FormEvent, type ReactNode } from "react";
import {
  Shield, ShieldAlert, ShieldCheck,
  AlertTriangle, AlertCircle, Zap,
  Search, SlidersHorizontal,
  User, Users, Building2,
  Globe, Mail, Phone, Wallet,
  FileText, Clock,
  ChevronRight,
  MessageSquare, Send, Camera, Mic,
  Plus, Upload, Paperclip, X,
  CheckCircle, XCircle,
  Network, BarChart2,
  ExternalLink, Flag,
  Bell, Settings,
  Terminal, GitBranch, Link2,
  Activity, Eye,
  ChevronDown, ChevronUp,
  ArrowLeft, Layers,
  RefreshCw, Radio,
  Puzzle, Clipboard, Copy, TriangleAlert,
  ThumbsUp, ThumbsDown, Loader2,
  Package, Hash, Eraser, CornerDownRight
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type RiskLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "BANNED";
type View = "dashboard" | "report" | "suspects" | "extension";

interface Report {
  id: string;
  // identifier this user submitted — stored on the server, shown to the submitter
  reportedIdentifier: string;
  reportedIdentifierType: "linkedin_url" | "email" | "domain" | "github_url" | "wallet" | "phone" | "ebay_handle" | "x_post";
  // how many users reported the same suspect (fuzzy-matched server-side)
  corroborationCount: number;
  type: string;
  platform: string;
  risk: RiskLevel;
  score: number;
  status: string;
  lastActivity: string;
  indicators: string[];
  summary: string;
  subagentsActive?: boolean;
  // submissions from other reporters, desensitized server-side before sharing
  communitySubmissions?: CommunitySubmission[];
}

interface Alert {
  id: number;
  time: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  reportId: string;
  suspect: string;
  message: string;
  read: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CommunitySubmission {
  platform: string;
  materialType: string;
  // desensitized server-side before sharing — personal details replaced with [TOKENS]
  desensitized: string;
  indicators: string[];
  submittedAt: string;
  isMine?: boolean;
  myRaw?: string; // original text, shown only to the submitter
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; dot: string; bg: string; text: string; border: string }> = {
  GREEN:  { label: "LOW RISK",         color: "#22c55e", dot: "bg-green-500",  bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/25" },
  YELLOW: { label: "MONITOR",          color: "#eab308", dot: "bg-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/25" },
  ORANGE: { label: "ELEVATED RISK",    color: "#f97316", dot: "bg-orange-500", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25" },
  RED:    { label: "HIGH RISK SIGNAL", color: "#ef4444", dot: "bg-red-500",    bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/25" },
  BANNED: { label: "BANNED",           color: "#a78bfa", dot: "bg-violet-400", bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-400/30" },
};

const IDENTIFIER_TYPE_LABEL: Record<Report["reportedIdentifierType"], string> = {
  linkedin_url: "LinkedIn URL",
  email:        "Email address",
  domain:       "Domain",
  github_url:   "GitHub URL",
  wallet:       "Wallet address",
  phone:        "Phone number",
  ebay_handle:  "eBay handle",
  x_post:       "X post",
};

let REPORTS: Report[] = [
  {
    id: "SR-2024-0352",
    reportedIdentifier:     "linkedin.com/in/jordan-lee-recruiting",
    reportedIdentifierType: "linkedin_url",
    corroborationCount:     1,
    type: "Recruiter Check",
    platform: "LinkedIn",
    risk: "YELLOW",
    score: 38,
    status: "ACCEPTED",
    lastActivity: "Just now",
    indicators: ["Vague company context", "Unverified recruiter affiliation", "No payment request", "Agent due diligence queued"],
    summary: "Recruiter outreach is not enough to classify as high-risk. The message is plausible but light on company details, so the report was accepted for agent-side verification and aggregation.",
    subagentsActive: true,
    communitySubmissions: [
      {
        isMine: true,
        platform: "LinkedIn",
        materialType: "Conversation log",
        myRaw: "A recruiter named Jordan Lee reached out about a founding engineer role at a stealth AI startup. The message asked for my CV and availability for a quick call, but did not include a company website, official email, or job posting link.",
        desensitized: "Recruiter on [PLATFORM] reached out about a [ROLE] at a [COMPANY_STAGE] startup. Asked for CV and availability. No payment, credentials, or identity documents requested, but company identity is not yet verified.",
        indicators: ["Vague company details", "Affiliation unverified"],
        submittedAt: "Just now",
      },
    ],
  },
  {
    id: "SR-2024-0361",
    reportedIdentifier:     "x.com/market_sentinel/status/1805123409876543210",
    reportedIdentifierType: "x_post",
    corroborationCount:     9,
    type: "Fake News / Misinformation",
    platform: "X",
    risk: "ORANGE",
    score: 76,
    status: "ACCEPTED",
    lastActivity: "12m ago",
    indicators: ["No official source", "Manipulated screenshot pattern", "Reused breaking-news template", "External monetized link"],
    summary: "Viral X post claims an immediate UK student visa rule change and links to a paid guidance page. Agent checks found no matching GOV.UK update, the screenshot layout differs from official pages, and similar panic posts reuse the same wording.",
    subagentsActive: true,
    communitySubmissions: [
      {
        isMine: true,
        platform: "X",
        materialType: "Post URL + screenshot",
        myRaw: "X post claims: BREAKING: UK student visa sponsorship ends tomorrow for most international applicants. It links to visa-update-uk.example.com and tells students to pay for urgent document review.",
        desensitized: "[SOCIAL_POST] claims a sudden immigration-rule change, includes a screenshot styled like an official notice, and links to [EXTERNAL_DOMAIN] for urgent paid document review.",
        indicators: ["No official source", "External monetized link", "Urgency pressure"],
        submittedAt: "Today 15:45",
      },
    ],
  },
  {
    id: "SR-2024-0347",
    reportedIdentifier:     "linkedin.com/in/alex-morgan-recruiter",
    reportedIdentifierType: "linkedin_url",
    corroborationCount:     14,
    type: "Recruiter Fraud",
    platform: "LinkedIn",
    risk: "RED",
    score: 87,
    status: "ACCEPTED",
    lastActivity: "2h ago",
    indicators: ["Fake domain", "Equipment purchase request", "Off-platform redirect", "Zelle payment request"],
    summary: "Claims to be Senior Technical Recruiter at Meta. Uses non-Meta domain registered 43 days ago. Requested upfront equipment purchase of $2,400 via Zelle before \"onboarding.\"",
    subagentsActive: true,
    communitySubmissions: [
      {
        isMine: true,
        platform: "LinkedIn",
        materialType: "Conversation log",
        myRaw: "I was contacted via LinkedIn by someone claiming to be Alex Morgan, Senior Technical Recruiter at Meta. They offered a $8,000/week remote engineering position. Before my start date I was asked to purchase a MacBook Pro ($2,400 via Zelle to @alexjobs2024), with reimbursement promised on first paycheck. They then asked me to move to WhatsApp: +1 (415) 555-0182.",
        desensitized: "Contacted via [PLATFORM] by recruiter claiming to work at [MAJOR_TECH_CO]. Offered [SALARY]/week remote position. Requested upfront equipment purchase of $[AMOUNT] via [PAYMENT_METHOD]. Promised reimbursement on first paycheck. Redirected to [MESSAGING_APP].",
        indicators: ["Payment request", "Equipment purchase", "Off-platform redirect"],
        submittedAt: "Today 09:10",
      },
      {
        platform: "LinkedIn",
        materialType: "Conversation log",
        desensitized: "Recruiter at [TECH_CO] offered [SALARY]/week contract. Same equipment purchase script — $[AMOUNT] via [PAYMENT_METHOD] before onboarding. Profile created recently, few connections. Moved conversation to [MESSAGING_APP] within first 3 messages.",
        indicators: ["Payment request", "Off-platform redirect", "New/sparse profile"],
        submittedAt: "Today 07:22",
      },
      {
        platform: "Email",
        materialType: "Email thread",
        desensitized: "Email from [NAME] at domain [DOMAIN] (not official [TECH_CO] domain). Same job offer, same equipment purchase request. Amount: $[AMOUNT]. Requested wire transfer instead of [PAYMENT_METHOD]. Signature included fake HR contact at [DEPT].",
        indicators: ["Fake domain", "Payment request", "Suspicious signature"],
        submittedAt: "Yesterday 14:05",
      },
      {
        platform: "LinkedIn",
        materialType: "Screenshot",
        desensitized: "Screenshot of LinkedIn message. Different name, same profile photo and job title. Offered [SALARY_RANGE]/week. Equipment request: $[AMOUNT] via [PAYMENT_METHOD]. Identical script to other reports.",
        indicators: ["Recycled profile photo", "Payment request", "Script match"],
        submittedAt: "Yesterday 09:47",
      },
      {
        platform: "WhatsApp",
        materialType: "Conversation log",
        desensitized: "Continued conversation on [MESSAGING_APP] after initial LinkedIn contact. Sent fake [TECH_CO] offer letter (PDF). Increased equipment amount to $[AMOUNT_2]. Added urgency: \"start date is [DATE], must confirm payment today.\"",
        indicators: ["Fake document", "Urgency pressure", "Amount escalation"],
        submittedAt: "2 days ago",
      },
    ],
  },
  {
    id: "SR-2024-0341",
    reportedIdentifier:     "techventuresdao.io",
    reportedIdentifierType: "domain",
    corroborationCount:     8,
    type: "Investment Fraud",
    platform: "Telegram",
    risk: "RED",
    score: 91,
    status: "INVESTIGATING",
    lastActivity: "5h ago",
    indicators: ["Unregistered investment scheme", "Wallet address collection", "Guaranteed returns claimed", "Urgency pressure"],
    summary: "Unsolicited investment opportunity. Claims guaranteed 340% APY. Collecting wallet addresses for \"airdrop registration.\" AML pattern match on associated wallets.",
    subagentsActive: true,
  },
  {
    id: "SR-2024-0339",
    reportedIdentifier:     "github.com/northstar-labs/frontend-takehome",
    reportedIdentifierType: "github_url",
    corroborationCount:     4,
    type: "Malicious Code",
    platform: "GitHub",
    risk: "RED",
    score: 93,
    status: "ACCEPTED",
    lastActivity: "1d ago",
    indicators: ["Malicious postinstall script", "Environment variable exfiltration", "Remote payload download", "Cloud static analysis confirmed"],
    summary: "Cloud code-analysis agents found a malicious npm lifecycle script that attempts to collect environment variables and contact an external endpoint during install. Users should not run install or scripts from this repository.",
    subagentsActive: false,
  },
  {
    id: "SR-2024-0335",
    reportedIdentifier:     "marketplace_seller_99",
    reportedIdentifierType: "ebay_handle",
    corroborationCount:     6,
    type: "Payment Fraud",
    platform: "eBay",
    risk: "BANNED",
    score: 96,
    status: "CLOSED",
    lastActivity: "2d ago",
    indicators: ["Official platform action", "Off-platform payment", "Fake escrow service", "Urgency pressure"],
    summary: "Seller requesting Zelle/Venmo payment outside eBay buyer protection. Uses fake escrow site escrow-safe-pay.com to appear legitimate. The marketplace account is marked as banned after platform action.",
    subagentsActive: false,
  },
  {
    id: "SR-2024-0330",
    reportedIdentifier:     "sarah.chen@deloitte-consulting.net",
    reportedIdentifierType: "email",
    corroborationCount:     2,
    type: "Impersonation",
    platform: "Email",
    risk: "YELLOW",
    score: 41,
    status: "TRIAGING",
    lastActivity: "3d ago",
    indicators: ["Suspicious email domain", "Unverified identity claim"],
    summary: "Claims to be Deloitte partner offering consulting role. Email domain deloitte-consulting.net is not affiliated with Deloitte LLP (deloitte.com).",
    subagentsActive: false,
  },
];

async function loadAttioReports(): Promise<Report[]> {
  const response = await fetch("/api/attio/reports");
  if (!response.ok) {
    throw new Error(`Unable to load Attio reports: ${response.status}`);
  }

  const payload = await response.json() as { reports?: Report[] };
  return Array.isArray(payload.reports) && payload.reports.length > 0 ? payload.reports : REPORTS;
}

const ALERTS: Alert[] = [
  { id: 1, time: "09:42", severity: "CRITICAL", reportId: "SR-2024-0347", suspect: "linkedin.com/in/alex-morgan-recruiter", message: "Server update: payment request detected in the submitted material. Zelle amount: $2,400. Do not send funds.", read: false },
  { id: 2, time: "09:38", severity: "CRITICAL", reportId: "SR-2024-0341", suspect: "techventuresdao.io",                    message: "Server update: wallet address collection detected. Do not share crypto credentials.", read: false },
  { id: 3, time: "09:31", severity: "CRITICAL", reportId: "SR-2024-0339", suspect: "github.com/northstar-labs/frontend-takehome", message: "Cloud code agent found a malicious postinstall script. Do not run npm install or repo scripts.", read: false },
  { id: 7, time: "09:18", severity: "HIGH",     reportId: "SR-2024-0361", suspect: "x.com/market_sentinel/status/1805123409876543210", message: "Source-check agent found no official GOV.UK match for the viral visa-change claim. Do not repost or pay through linked pages.", read: false },
  { id: 4, time: "08:55", severity: "MEDIUM",   reportId: "SR-2024-0347", suspect: "linkedin.com/in/alex-morgan-recruiter", message: "Server update: 14 corroborating reports matched this suspect. Pattern confidence: 94%.", read: true },
  { id: 5, time: "08:12", severity: "MEDIUM",   reportId: "SR-2024-0335", suspect: "marketplace_seller_99",                 message: "Server update: fake escrow pattern matches 6 prior reports for this suspect.", read: true },
  { id: 6, time: "07:44", severity: "HIGH",     reportId: "SR-2024-0341", suspect: "techventuresdao.io",                    message: "Server update: associated wallet 0x7a3f…c82e flagged by external risk sources.", read: true },
];

const INITIAL_CHAT: ChatMessage[] = [
  { role: "user", content: "What are the biggest red flags in this report?" },
  {
    role: "assistant",
    content: "Three high-severity indicators detected:\n\n1. Domain meta-careers.io was registered 43 days ago. Meta's official recruiter domains are meta.com and fb.com exclusively — confirmed via WHOIS and Meta's published careers policy.\n\n2. Upfront equipment purchase of $2,400 via Zelle matches advance-fee fraud patterns documented across 14 similar reports. No legitimate employer requires candidates to purchase equipment pre-hire.\n\n3. Redirect to WhatsApp occurred within 2 messages — a documented tactic to exit platform monitoring.\n\nEvidence strength: Strong. Corroboration: 14 reports.",
  },
  { role: "user", content: "Could this be a legitimate recruiter?" },
  {
    role: "assistant",
    content: "Benign explanation is possible but assessed as low probability (confidence: 88%).\n\nLegitimate Meta recruiters use @meta.com or @fb.com addresses exclusively. Equipment purchases are handled internally after acceptance — candidates are never asked to buy and ship equipment.\n\nRecommended next steps:\n• Do not send funds\n• Request video verification via official Meta careers portal\n• Ask for callback via linkedin.com/company/meta verified page\n• Report to LinkedIn Trust & Safety if confirmed",
  },
];

const EVIDENCE_TIMELINE = [
  { time: "09:42", icon: "payment",  label: "Payment request detected",    detail: "Zelle payment for $2,400 requested in conversation",             risk: "RED"    as RiskLevel },
  { time: "09:38", icon: "redirect", label: "Off-platform redirect",        detail: "Recruiter asked to continue conversation on WhatsApp",           risk: "RED"    as RiskLevel },
  { time: "09:31", icon: "domain",   label: "Domain analysis complete",     detail: "meta-careers.io registered 43 days ago via GoDaddy. Not Meta.", risk: "RED"    as RiskLevel },
  { time: "09:20", icon: "cluster",  label: "14 similar reports clustered", detail: "Superlinked similarity match: recruiter persona pattern, 94%",  risk: "ORANGE" as RiskLevel },
  { time: "09:15", icon: "search",   label: "Web due diligence complete",   detail: "No meta.com affiliation found. Tavily: 0 results for suspect.", risk: "ORANGE" as RiskLevel },
  { time: "09:10", icon: "intake",   label: "Report submitted",             detail: "User submitted conversation log + LinkedIn URL",                 risk: "YELLOW" as RiskLevel },
];

// ─── Utility Components ───────────────────────────────────────────────────────

function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border ${cfg.bg} ${cfg.text} ${cfg.border} ${size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1"}`}
      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    TRIAGING:      "text-blue-400 bg-blue-500/10 border-blue-500/20",
    INVESTIGATING: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    ACCEPTED:      "text-green-400 bg-green-500/10 border-green-500/20",
    NEEDS_INFO:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
    CLOSED:        "text-muted-foreground bg-muted/40 border-border",
  };
  return (
    <span
      className={`inline-flex items-center border text-[10px] font-medium px-1.5 py-0.5 ${map[status] ?? "text-muted-foreground border-border"}`}
      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ScoreGauge({ score, risk, size = 80 }: { score: number; risk: RiskLevel; size?: number }) {
  const cfg = RISK_CONFIG[risk];
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={cfg.color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${cfg.text}`} style={{ fontFamily: "var(--font-display)", fontSize: size > 80 ? "1.75rem" : "1.25rem", lineHeight: 1 }}>{score}</span>
        <span className="text-muted-foreground" style={{ fontFamily: "var(--font-data)", fontSize: "9px" }}>/ 100</span>
      </div>
    </div>
  );
}

function Monospace({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span style={{ fontFamily: "var(--font-data)" }} className={`text-xs ${className}`}>{children}</span>;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground tracking-[0.1em] uppercase mb-3"
      style={{ fontFamily: "var(--font-display)" }}>
      {children}
    </h3>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

// ─── Suspect Graph (SVG) ──────────────────────────────────────────────────────

function SuspectGraph() {
  const nodes = [
    { x: 200, y: 140, label: "Alex Morgan",              sub: "Primary Suspect",    r: 28, color: "#ef4444", textColor: "#fca5a5" },
    { x: 80,  y: 60,  label: "LinkedIn Profile",          sub: "/in/alex-morgan-rec", r: 18, color: "#3b82f6", textColor: "#93c5fd" },
    { x: 200, y: 40,  label: "meta-careers.io",           sub: "Reg. 43 days ago",   r: 18, color: "#f97316", textColor: "#fdba74" },
    { x: 330, y: 60,  label: "alex.morgan@…careers.io",   sub: "Email",              r: 18, color: "#8b5cf6", textColor: "#c4b5fd" },
    { x: 340, y: 160, label: "Zelle @alexjobs2024",        sub: "Payment handle",     r: 18, color: "#ef4444", textColor: "#fca5a5" },
    { x: 310, y: 250, label: "+1 (415) 555-0182",          sub: "WhatsApp",           r: 18, color: "#6b7894", textColor: "#9ba8bf" },
    { x: 80,  y: 230, label: "14 Similar Reports",         sub: "Cluster · 94%",      r: 22, color: "#f59e0b", textColor: "#fcd34d" },
  ];
  const edges = [0,1,2,3,4,5,6].slice(1).map(i => ({ from: 0, to: i }));

  return (
    <svg viewBox="0 0 420 300" className="w-full h-full">
      <defs>
        {nodes.map((n, i) => (
          <radialGradient key={i} id={`ng${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={n.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={n.color} stopOpacity="0.05" />
          </radialGradient>
        ))}
      </defs>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={nodes[e.from].x} y1={nodes[e.from].y}
          x2={nodes[e.to].x}   y2={nodes[e.to].y}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"
          strokeDasharray={i === 5 ? "4 3" : "none"}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i} style={{ cursor: "pointer" }}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={`url(#ng${i})`} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity="0.12" stroke={n.color} strokeOpacity="0.5" strokeWidth="1.5" />
          {i === 0 && (
            <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke={n.color} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize={i === 0 ? "8" : "7"} fontWeight="600" fill={n.textColor} style={{ fontFamily: "var(--font-display)" }}>
            {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
          </text>
          <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,0.35)" style={{ fontFamily: "var(--font-data)" }}>
            {n.sub}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, onSubmit }: { view: View; setView: (v: View) => void; onSubmit: () => void }) {
  const navItems: { v: View | null; icon: ReactNode; label: string; action?: () => void }[] = [
    { v: "dashboard",  icon: <BarChart2 size={16} />, label: "Dashboard" },
    { v: "report",     icon: <Shield size={16} />,   label: "Reports" },
    { v: "suspects",   icon: <Network size={16} />,  label: "Suspects" },
    { v: "extension",  icon: <Puzzle size={16} />,   label: "Extension UI" },
  ];

  return (
    <aside className="flex flex-col border-r border-border" style={{ background: "var(--sidebar)", width: 200, flexShrink: 0 }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 flex items-center justify-center rounded" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <Radio size={14} className="text-red-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>SCAMRADAR</div>
          <div className="text-[9px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-data)", letterSpacing: "0.08em" }}>TRUST & SAFETY CRM</div>
        </div>
      </div>

      {/* Submit button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onSubmit}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all"
          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.22)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.15)")}
        >
          <Plus size={13} />
          SUBMIT REPORT
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ v, icon, label }) => {
          const active = view === v;
          return (
            <button
              key={label}
              onClick={() => v && setView(v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all text-left ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                borderLeft: active ? "2px solid #f59e0b" : "2px solid transparent",
                fontFamily: "var(--font-body)",
              }}
            >
              <span className={active ? "text-amber-400" : ""}>{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* Live status */}
      <div className="px-4 pb-4 border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-2">
          <LiveDot />
          <span className="text-[10px] text-green-400 font-medium" style={{ fontFamily: "var(--font-data)" }}>LIVE MONITORING</span>
        </div>
        <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
          3 subagents active<br />
          Last sync: 09:44:12
        </div>
      </div>

      {/* Bottom */}
      <div className="px-2 pb-3 border-t border-border pt-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <User size={12} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-foreground truncate" style={{ fontFamily: "var(--font-body)" }}>Analyst</div>
          <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>My submissions</div>
        </div>
        <Settings size={13} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
      </div>
    </aside>
  );
}

// ─── Alert Feed ───────────────────────────────────────────────────────────────

function AlertFeed({ alerts, onReportClick }: { alerts: Alert[]; onReportClick: (id: string) => void }) {
  const severityConfig = {
    CRITICAL: { icon: <ShieldAlert size={12} />, color: "text-red-400",    border: "border-l-red-500",    bg: "hover:bg-red-500/5" },
    HIGH:     { icon: <AlertTriangle size={12} />, color: "text-orange-400", border: "border-l-orange-500", bg: "hover:bg-orange-500/5" },
    MEDIUM:   { icon: <Activity size={12} />,      color: "text-amber-400",  border: "border-l-amber-500",  bg: "hover:bg-amber-500/5" },
  };
  const unreadCount = alerts.filter(alert => !alert.read).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <SectionHeader>Server Alert Feed</SectionHeader>
            <LiveDot />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-data)" }}>
            Updates pushed by ScamRadar server, not local-only state
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 border border-amber-500/25 text-[10px] text-amber-400 bg-amber-500/10" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
            {unreadCount} UNREAD
          </span>
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>{alerts.length} server updates</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border" style={{ scrollbarWidth: "none" }}>
        {alerts.map(alert => {
          const cfg = severityConfig[alert.severity];
          return (
            <button
              key={alert.id}
              onClick={() => onReportClick(alert.reportId)}
              className={`w-full text-left px-3 py-2.5 border-l-2 ${alert.read ? "opacity-65" : ""} ${cfg.border} ${cfg.bg} transition-colors`}
              style={{ background: alert.read ? "transparent" : "rgba(245,158,11,0.035)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                  {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {cfg.icon}
                  <span className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>{alert.severity}</span>
                  <span className={`ml-1 px-1.5 py-0.5 border text-[9px] ${alert.read ? "border-border text-muted-foreground" : "border-amber-500/30 text-amber-400 bg-amber-500/10"}`} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                    {alert.read ? "READ" : "UNREAD"}
                  </span>
                </div>
                <Monospace className="text-muted-foreground">{alert.time}</Monospace>
              </div>
              <div className="mb-0.5">
                <Monospace className="text-foreground/60">{alert.suspect}</Monospace>
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">{alert.message}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Reports Table ───────────────────────────────────────────────────────────


function ReportsTable({ reports, onSelect }: { reports: Report[]; onSelect: (id: string) => void }) {
  const [sortField, setSortField] = useState<"score" | "corroborationCount" | "lastActivity">("score");
  const sorted = [...reports].sort((a, b) => {
    if (sortField === "score") return b.score - a.score;
    if (sortField === "corroborationCount") return b.corroborationCount - a.corroborationCount;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <SectionHeader>My Reports</SectionHeader>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>{reports.length} submitted</span>
          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {["Report ID", "Reported Identifier", "Type", "Risk", "Score", "Others", "Status", ""].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="border-b border-border hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <td className="px-3 py-2.5">
                  <Monospace className="text-muted-foreground">{c.id}</Monospace>
                </td>
                <td className="px-3 py-2.5 max-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    {c.subagentsActive && (
                      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
                      </span>
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <Monospace className="text-foreground/80 truncate block">{c.reportedIdentifier}</Monospace>
                      <span className="text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>{IDENTIFIER_TYPE_LABEL[c.reportedIdentifierType]}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{c.type}</td>
                <td className="px-3 py-2.5"><RiskBadge level={c.risk} size="sm" /></td>
                <td className="px-3 py-2.5">
                  <span className={`font-bold text-sm ${RISK_CONFIG[c.risk].text}`} style={{ fontFamily: "var(--font-display)" }}>{c.score}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1" title={`${c.corroborationCount - 1} other users reported the same suspect. Their submissions are desensitized before being shared.`}>
                    <Monospace className={c.corroborationCount >= 10 ? "text-amber-400" : "text-muted-foreground"}>
                      {c.corroborationCount > 1 ? `+${c.corroborationCount - 1}` : "—"}
                    </Monospace>
                    {c.corroborationCount > 1 && (
                      <span className="text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>redacted</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5"><StatusPill status={c.status} /></td>
                <td className="px-3 py-2.5">
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-amber-400 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ onSelectReport }: { onSelectReport: (id: string) => void }) {
  const redCount      = REPORTS.filter(c => c.risk === "RED").length;
  const acceptedCount = REPORTS.filter(c => c.status === "ACCEPTED").length;
  // corroboration counts come from the aggregate — we show counts, never other users' data
  const totalCorroborations = REPORTS.reduce((a, c) => a + c.corroborationCount, 0);
  const recencyValue = (value: string) => {
    if (value.includes("h ago")) return Number(value.replace("h ago", "")) || 0;
    if (value.includes("d ago")) return (Number(value.replace("d ago", "")) || 0) * 24;
    return 999;
  };

  const stats = [
    { label: "My Reports",        value: REPORTS.length,        sub: "submissions you created",        color: "text-foreground",  icon: <Shield size={16} className="text-amber-400" /> },
    { label: "High Risk Signals", value: redCount,              sub: "require immediate action",        color: "text-red-400",     icon: <ShieldAlert size={16} className="text-red-400" /> },
    { label: "Accepted",          value: acceptedCount,         sub: "accepted by agent",               color: "text-green-400",   icon: <CheckCircle size={16} className="text-green-400" /> },
    { label: "Corroborations",    value: totalCorroborations,   sub: "independent reports (count only)", color: "text-purple-400",  icon: <Users size={16} className="text-purple-400" /> },
  ];

  const recentReports = [...REPORTS].sort((a, b) => recencyValue(a.lastActivity) - recencyValue(b.lastActivity)).slice(0, 3);
  const recentSuspects = [...REPORTS].sort((a, b) => recencyValue(a.lastActivity) - recencyValue(b.lastActivity)).slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>
            THREAT OVERVIEW
          </h1>
          <Monospace className="text-muted-foreground mt-0.5 block">Friday, June 27 · 09:44 UTC</Monospace>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Search size={13} className="text-muted-foreground" />
            <input placeholder="Search reports, suspects, IDs…" className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-48" style={{ fontFamily: "var(--font-body)" }} />
          </div>
          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-border flex-shrink-0">
        {stats.map((s, i) => (
          <div key={i} className={`px-6 py-4 flex items-start gap-3 ${i < 3 ? "border-r border-border" : ""}`}>
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              {s.icon}
            </div>
            <div>
              <div className={`text-2xl font-bold leading-none ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
              <div className="text-[11px] font-medium text-foreground mt-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-6 py-5 gap-5">
        <div className="flex-1 min-h-[180px] border border-border overflow-hidden" style={{ background: "var(--card)" }}>
          <AlertFeed alerts={ALERTS} onReportClick={onSelectReport} />
        </div>

        <div className="space-y-5 flex-shrink-0">
          <section className="min-w-0">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader>Recent Reports</SectionHeader>
              <Monospace className="text-muted-foreground">3 latest</Monospace>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {recentReports.map(report => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => onSelectReport(report.id)}
                  className="min-h-[104px] text-left p-3 border border-border hover:bg-white/5 transition-colors"
                  style={{ background: "var(--card)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Monospace className="text-amber-400">{report.id}</Monospace>
                    <RiskBadge level={report.risk} size="sm" />
                  </div>
                  <div className="text-xs text-foreground truncate" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>{report.type}</div>
                  <Monospace className="text-muted-foreground mt-1 block truncate">{report.reportedIdentifier}</Monospace>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <StatusPill status={report.status} />
                    <Monospace className="text-muted-foreground">{report.lastActivity}</Monospace>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader>Recent Suspects</SectionHeader>
              <Monospace className="text-muted-foreground">3 latest</Monospace>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {recentSuspects.map(suspect => (
                <button
                  key={suspect.id}
                  type="button"
                  onClick={() => onSelectReport(suspect.id)}
                  className="min-h-[104px] text-left p-3 border border-border hover:bg-white/5 transition-colors"
                  style={{ background: "var(--card)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                      {IDENTIFIER_TYPE_LABEL[suspect.reportedIdentifierType]}
                    </span>
                    <RiskBadge level={suspect.risk} size="sm" />
                  </div>
                  <Monospace className="text-foreground/80 block truncate">{suspect.reportedIdentifier}</Monospace>
                  <div className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{suspect.indicators.slice(0, 2).join(" · ")}</div>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users size={11} />
                      <Monospace>{suspect.corroborationCount} reports</Monospace>
                    </div>
                    <Monospace className="text-muted-foreground">{suspect.lastActivity}</Monospace>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Report Detail View ───────────────────────────────────────────────────────

function ReportDetailView({ reportId, onBack, onOpenSuspect }: { reportId: string; onBack: () => void; onOpenSuspect: (id: string) => void }) {
  const report = REPORTS.find(x => x.id === reportId) ?? REPORTS[0];
  const mine = report.communitySubmissions?.find(sub => sub.isMine);
  const submittedText = mine?.myRaw ?? report.summary;
  const materialType = mine?.materialType ?? "Submitted material";
  const submittedAt = mine?.submittedAt ?? report.lastActivity;
  const agentStatusCopy = report.status === "ACCEPTED"
    ? "Accepted for analysis"
    : report.status === "NEEDS_INFO"
      ? "Needs more context"
      : "Analysis in progress";

  const safeSteps = [
    "Do not send money, credentials, OTPs, seed phrases, or identity documents.",
    "Do not run scripts or install software from the submitted interaction.",
    "Verify through an official channel you find independently.",
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={14} />
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}>Report Submission</span>
            <StatusPill status={report.status} />
            <RiskBadge level={report.risk} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Monospace className="text-muted-foreground">{report.id}</Monospace>
            <span className="text-border">·</span>
            <Monospace className="text-muted-foreground">{report.platform}</Monospace>
            <span className="text-border">·</span>
            <span className="text-[10px] text-muted-foreground">{materialType}</span>
          </div>
        </div>
        <button
          onClick={() => onOpenSuspect(report.id)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
        >
          <Network size={12} />
          VIEW SUSPECT INTELLIGENCE
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-border overflow-y-auto flex-shrink-0 px-4 py-4 space-y-5" style={{ scrollbarWidth: "none" }}>
          <div>
            <SectionHeader>Submission Status</SectionHeader>
            <div className="p-3 border border-green-500/25" style={{ background: "rgba(34,197,94,0.07)" }}>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm text-green-400 font-medium" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>{agentStatusCopy}</div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">The agent accepted this submission because it contains enough material for triage and suspect matching.</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader>Submitted Suspect</SectionHeader>
            <div className="px-2 py-1.5 border border-border space-y-0.5" style={{ background: "rgba(255,255,255,0.03)" }}>
              <Monospace className="text-foreground/80 break-all block">{report.reportedIdentifier}</Monospace>
              <div className="text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>{IDENTIFIER_TYPE_LABEL[report.reportedIdentifierType]}</div>
            </div>
          </div>

          <div>
            <SectionHeader>Submission Metadata</SectionHeader>
            <div className="space-y-2 text-[11px]">
              {[
                ["Source", report.platform],
                ["Submitted", submittedAt],
                ["Material", materialType],
                ["Current status", report.status.replace("_", " ")],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader>Initial Score</SectionHeader>
            <div className="flex items-center gap-3">
              <ScoreGauge score={report.score} risk={report.risk} size={72} />
              <div>
                <RiskBadge level={report.risk} size="sm" />
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Score is based only on this submission and immediate matching signals.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 border border-border" style={{ background: "var(--card)" }}>
              <SectionHeader>Agent Intake</SectionHeader>
              <div className="text-2xl font-bold text-green-400" style={{ fontFamily: "var(--font-display)" }}>ACCEPTED</div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Submission is usable for automated due diligence.</p>
            </div>
            <div className="p-4 border border-border" style={{ background: "var(--card)" }}>
              <SectionHeader>Danger Check</SectionHeader>
              <div className={`text-2xl font-bold ${RISK_CONFIG[report.risk].text}`} style={{ fontFamily: "var(--font-display)" }}>{report.indicators.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Risk indicators found in this report.</p>
            </div>
            <div className="p-4 border border-border" style={{ background: "var(--card)" }}>
              <SectionHeader>Suspect Match</SectionHeader>
              <div className="text-2xl font-bold text-purple-400" style={{ fontFamily: "var(--font-display)" }}>{report.corroborationCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Aggregate reporters matched this suspect.</p>
            </div>
          </div>

          <div className="border border-border" style={{ background: "var(--card)" }}>
            <div className="px-5 py-3 border-b border-border">
              <SectionHeader>Your Submitted Material</SectionHeader>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{submittedText}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border" style={{ background: "var(--card)" }}>
              <div className="px-4 py-3 border-b border-border">
                <SectionHeader>Detected In This Report</SectionHeader>
              </div>
              <div className="px-4 py-3 space-y-2">
                {report.indicators.map((indicator, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{indicator}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border" style={{ background: "var(--card)" }}>
              <div className="px-4 py-3 border-b border-border">
                <SectionHeader>Recommended Next Steps</SectionHeader>
              </div>
              <div className="px-4 py-3 space-y-2">
                {safeSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <CheckCircle size={11} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-border" style={{ background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.22)" }}>
            <div className="px-4 py-3 flex items-start gap-2">
              <ShieldCheck size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-indigo-300/75 leading-relaxed">
                This report view is only about your submitted material. Broader suspect intelligence, corroborations, evidence timeline, graph, and matched submissions live under Suspects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Suspect Detail View ──────────────────────────────────────────────────────

function SuspectDetailView({ suspectId, onBack }: { suspectId: string; onBack: () => void }) {
  const c = REPORTS.find(x => x.id === suspectId) ?? REPORTS[0];
  const cfg = RISK_CONFIG[c.risk];

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"timeline" | "graph" | "community">("timeline");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim()) return;
    setMessages(prev => [
      ...prev,
      { role: "user", content: input },
      { role: "assistant", content: "Analyzing submitted materials and cross-referencing with available evidence… This is a demo response. In production, a fast LLM provides real-time answers based on report data, Tavily search results, and Attio CRM records." },
    ]);
    setInput("");
  }

  const timelineIcons: Record<string, ReactNode> = {
    payment:  <Wallet size={11} />,
    redirect: <ExternalLink size={11} />,
    domain:   <Globe size={11} />,
    cluster:  <Network size={11} />,
    search:   <Search size={11} />,
    intake:   <Upload size={11} />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={14} />
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <User size={14} className="text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}>{c.reportedIdentifier}</span>
              <RiskBadge level={c.risk} />
              <StatusPill status={c.status} />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Monospace className="text-muted-foreground">{c.id}</Monospace>
              <span className="text-border">·</span>
              <Monospace className="text-muted-foreground">{c.type}</Monospace>
              <span className="text-border">·</span>
              <span className="text-[10px] text-muted-foreground">{IDENTIFIER_TYPE_LABEL[c.reportedIdentifierType]}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
            <FileText size={12} />
            SUSPECT SUMMARY
          </button>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Suspect + Score + Indicators */}
        <div className="w-60 border-r border-border overflow-y-auto flex-shrink-0 px-4 py-4 space-y-5" style={{ scrollbarWidth: "none" }}>
          {/* Score */}
          <div>
            <SectionHeader>Risk Score</SectionHeader>
            <div className="flex flex-col items-center gap-2 py-2">
              <ScoreGauge score={c.score} risk={c.risk} size={96} />
              <RiskBadge level={c.risk} />
              <div className="text-[10px] text-muted-foreground text-center mt-1" style={{ fontFamily: "var(--font-data)" }}>
                Confidence: 88%<br />
                Evidence: Strong<br />
                Corroborations: {c.corroborationCount} (aggregate)
              </div>
            </div>
          </div>

          {/* Suspect identifiers */}
          <div>
            <SectionHeader>Reported Identifier</SectionHeader>
            <div className="space-y-2">
              <div className="px-2 py-1.5 border border-border space-y-0.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <Monospace className="text-foreground/80 break-all block">{c.reportedIdentifier}</Monospace>
                <div className="text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>{IDENTIFIER_TYPE_LABEL[c.reportedIdentifierType]}</div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Stored securely on the server. Shared with other reporters only after desensitization.
              </p>
            </div>
          </div>

          {/* Risk indicators */}
          <div>
            <SectionHeader>Risk Indicators ({c.indicators.length})</SectionHeader>
            <div className="space-y-1.5">
              {c.indicators.map((ind, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <AlertTriangle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{ind}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <SectionHeader>Summary</SectionHeader>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{c.summary}</p>
          </div>

          {/* Similar reports */}
          <div>
            <SectionHeader>Corroboration</SectionHeader>
            <div className="flex items-center gap-2 py-1.5 px-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Users size={12} className="text-amber-400" />
              <span className="text-xs text-amber-400 font-medium" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
                {c.corroborationCount} reporters matched this hash
              </span>
            </div>
            <div className="mt-2 px-2 py-1.5 border border-border" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[9px] text-muted-foreground leading-relaxed" style={{ fontFamily: "var(--font-data)" }}>
                {c.corroborationCount - 1} other submission{c.corroborationCount - 1 !== 1 ? "s" : ""} matched this suspect.<br />
                Their raw materials stay on the server.<br />
                See matched submissions for desensitized versions.
              </div>
            </div>
          </div>

          {/* Subagent status */}
          {c.subagentsActive && (
            <div>
              <SectionHeader>Subagents</SectionHeader>
              <div className="space-y-1.5">
                {["Web Due Diligence", "Domain / Infra", "Conversation Pattern"].map((ag, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
                    </span>
                    <span className="text-purple-400" style={{ fontFamily: "var(--font-data)" }}>{ag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Timeline / Graph */}
        <div className="flex-1 border-r border-border overflow-hidden flex flex-col">
          <div className="flex items-center border-b border-border flex-shrink-0">
            {(["timeline", "graph", "community"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === tab ? "border-amber-500 text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
              >
                {tab === "timeline" ? "EVIDENCE TIMELINE" : tab === "graph" ? "SUSPECT GRAPH" : (
                  <>MATCHED SUBMISSIONS {c.communitySubmissions && <span className="text-[9px] px-1 py-0.5 rounded-sm" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{c.communitySubmissions.length}</span>}</>
                )}
              </button>
            ))}
          </div>

          {activeTab === "timeline" && (
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
              <div className="relative">
                <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border" />
                <div className="space-y-4">
                  {EVIDENCE_TIMELINE.map((item, i) => {
                    const ecfg = RISK_CONFIG[item.risk];
                    return (
                      <div key={i} className="flex gap-4 relative">
                        <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 z-10 ${ecfg.bg}`} style={{ border: `1px solid ${ecfg.color}40` }}>
                          <span className={ecfg.text}>{timelineIcons[item.icon]}</span>
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                            <Monospace className="text-muted-foreground">{item.time}</Monospace>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "graph" && (
            <div className="flex-1 flex items-center justify-center px-4 py-4">
              <div className="w-full h-full max-h-72">
                <SuspectGraph />
              </div>
            </div>
          )}

          {activeTab === "community" && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
              {/* Desensitization notice */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 border border-indigo-500/25" style={{ background: "rgba(99,102,241,0.07)" }}>
                <Eraser size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-semibold text-indigo-400 mb-0.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>AUTOMATICALLY DESENSITIZED BEFORE SHARING</div>
                  <p className="text-[10px] text-indigo-300/70 leading-relaxed">
                    All submissions below were scrubbed of personal details, contact info, amounts, and identifiers by the server before being shared across reporters who flagged the same suspect. Names, URLs, payment handles, and dates are replaced with <code className="text-indigo-300">[TOKENS]</code>. Your raw submission is shown only to you.
                  </p>
                </div>
              </div>

              {/* Submissions */}
              {(c.communitySubmissions ?? []).map((sub, i) => (
                <div
                  key={i}
                  className="border overflow-hidden"
                  style={{
                    borderColor: sub.isMine ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)",
                    background: sub.isMine ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: sub.isMine ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                      {sub.isMine
                        ? <span className="text-[10px] font-semibold text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5" style={{ background: "rgba(99,102,241,0.1)", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>YOUR SUBMISSION</span>
                        : <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>ANONYMOUS REPORTER</span>
                      }
                      <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>{sub.platform} · {sub.materialType}</span>
                    </div>
                    <Monospace className="text-muted-foreground">{sub.submittedAt}</Monospace>
                  </div>

                  {/* Your raw submission (unredacted, only shown to you) */}
                  {sub.isMine && sub.myRaw && (
                    <div className="px-3 py-2.5 border-b" style={{ borderColor: "rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.04)" }}>
                      <div className="text-[9px] font-medium text-indigo-400 mb-1.5 flex items-center gap-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                        <Eye size={9} /> YOUR ORIGINAL — VISIBLE ONLY TO YOU
                      </div>
                      <p className="text-[11px] text-indigo-200/80 leading-relaxed">{sub.myRaw}</p>
                    </div>
                  )}

                  {/* Desensitized version */}
                  <div className="px-3 py-2.5">
                    {sub.isMine && (
                      <div className="text-[9px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                        <CornerDownRight size={9} /> DESENSITIZED VERSION (what others see)
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{sub.desensitized}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sub.indicators.map((ind, j) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 border border-amber-500/20 text-amber-500/70" style={{ background: "rgba(245,158,11,0.06)", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Remaining count */}
              {(c.corroborationCount - (c.communitySubmissions?.length ?? 0)) > 0 && (
                <div className="flex items-center justify-center py-3 border border-border text-[11px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.02)" }}>
                  + {c.corroborationCount - (c.communitySubmissions?.length ?? 0)} more desensitized submissions not shown in this preview
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Q&A Chat */}
        <div className="w-80 flex flex-col flex-shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border flex-shrink-0">
            <MessageSquare size={13} className="text-amber-400" />
              <SectionHeader>Suspect Q&amp;A</SectionHeader>
            <div className="ml-auto flex items-center gap-1.5">
              <LiveDot />
              <span className="text-[10px] text-green-400" style={{ fontFamily: "var(--font-data)" }}>REAL-TIME</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "text-amber-100"
                      : "text-foreground"
                  }`}
                  style={{
                    background: msg.role === "user" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                    border: msg.role === "user" ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-2 px-3 py-3 border-t border-border flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask about this suspect…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              style={{ fontFamily: "var(--font-body)" }}
            />
            <button
              onClick={sendMessage}
              className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30"
              disabled={!input.trim()}
            >
              <Send size={14} />
            </button>
          </div>

          <div className="px-3 pb-2.5">
            <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
              Powered by fast LLM · Attio + Tavily context<br />
              <span className="text-amber-600">Responses are risk indicators, not accusations.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Suspects View ────────────────────────────────────────────────────────────

function SuspectsView({ onSelectSuspect }: { onSelectSuspect: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<Report["reportedIdentifierType"][]>([]);
  const [riskFilters, setRiskFilters] = useState<RiskLevel[]>([]);
  const [sortBy, setSortBy] = useState<"risk" | "reporters" | "last_seen" | "identifier">("risk");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [openHeaderFilter, setOpenHeaderFilter] = useState<"type" | "risk" | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 4;

  const riskFilterOptions: Array<{ value: RiskLevel | "all"; label: string }> = [
    { value: "all", label: "All risk" },
    { value: "BANNED", label: "Banned" },
    { value: "RED", label: "High risk" },
    { value: "ORANGE", label: "Elevated" },
    { value: "YELLOW", label: "Monitor" },
    { value: "GREEN", label: "Low risk" },
  ];
  const riskHeaderOptions = riskFilterOptions.filter((option): option is { value: RiskLevel; label: string } => option.value !== "all");

  const typeFilterOptions: Array<{ value: Report["reportedIdentifierType"]; label: string }> = Object.entries(IDENTIFIER_TYPE_LABEL).map(([value, label]) => ({
    value: value as Report["reportedIdentifierType"],
    label,
  }));

  const riskRank: Record<RiskLevel, number> = {
    BANNED: 5,
    RED: 4,
    ORANGE: 3,
    YELLOW: 2,
    GREEN: 1,
  };

  function recencyRank(value: string) {
    if (value.includes("h ago")) return Number(value.replace("h ago", "")) || 0;
    if (value.includes("d ago")) return (Number(value.replace("d ago", "")) || 0) * 24;
    return 999;
  }

  const visibleSuspects = REPORTS
    .filter(row => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery = !query
        || row.reportedIdentifier.toLowerCase().includes(query)
        || row.type.toLowerCase().includes(query)
        || row.platform.toLowerCase().includes(query);
      const matchesType = typeFilters.length === 0 || typeFilters.includes(row.reportedIdentifierType);
      const matchesRisk = riskFilters.length === 0 || riskFilters.includes(row.risk);
      return matchesQuery && matchesType && matchesRisk;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "risk") comparison = riskRank[a.risk] - riskRank[b.risk] || a.score - b.score;
      if (sortBy === "reporters") comparison = a.corroborationCount - b.corroborationCount;
      if (sortBy === "last_seen") comparison = recencyRank(a.lastActivity) - recencyRank(b.lastActivity);
      if (sortBy === "identifier") comparison = a.reportedIdentifier.localeCompare(b.reportedIdentifier);
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const totalPages = Math.max(1, Math.ceil(visibleSuspects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedSuspects = visibleSuspects.slice(startIndex, startIndex + pageSize);
  const visibleStart = visibleSuspects.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = Math.min(startIndex + pageSize, visibleSuspects.length);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilters, riskFilters, sortBy, sortDirection]);

  function resetFilters() {
    setSearchQuery("");
    setTypeFilters([]);
    setRiskFilters([]);
    setSortBy("risk");
    setSortDirection("desc");
    setOpenHeaderFilter(null);
    setPage(1);
  }

  function toggleTypeFilter(value: Report["reportedIdentifierType"]) {
    setTypeFilters(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  }

  function toggleRiskFilter(value: RiskLevel) {
    setRiskFilters(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  }

  function handleSort(nextSort: typeof sortBy) {
    setOpenHeaderFilter(null);
    if (sortBy === nextSort) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortBy(nextSort);
    setSortDirection(nextSort === "identifier" || nextSort === "last_seen" ? "asc" : "desc");
  }

  function renderSortIcon(column: typeof sortBy) {
    if (sortBy !== column) return <ChevronDown size={10} className="opacity-40" />;
    return sortDirection === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>SUSPECTS</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">People, domains, wallets, repos, and identifiers extracted from your reports, with aggregate corroboration counts from other reporters.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
          <Search size={13} className="text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search suspects…"
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-44"
            style={{ fontFamily: "var(--font-body)" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "none" }}>
        <div className="border border-border mb-5" style={{ background: "var(--card)" }}>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
            <SectionHeader>Filters</SectionHeader>
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
                {visibleSuspects.length} of {REPORTS.length} suspects
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="h-7 flex items-center justify-center gap-1.5 px-2.5 text-[10px] text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
              >
                <RefreshCw size={11} />
                RESET
              </button>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>TYPE</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTypeFilters([])}
                  className={`h-8 px-3 border text-[11px] transition-colors ${typeFilters.length === 0 ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                >
                  All types
                </button>
                {typeFilterOptions.map(option => {
                  const active = typeFilters.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleTypeFilter(option.value)}
                      className={`h-8 px-3 border text-[11px] transition-colors ${active ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>RISK</span>
              <div className="flex flex-wrap gap-2">
                {riskFilterOptions.map(option => {
                  const active = option.value === "all" ? riskFilters.length === 0 : riskFilters.includes(option.value);
                  const riskStyle = option.value === "all" ? null : RISK_CONFIG[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => option.value === "all" ? setRiskFilters([]) : toggleRiskFilter(option.value)}
                      className={`h-8 px-3 border text-[11px] transition-colors ${active ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {riskStyle && <span className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />}
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border" style={{ background: "var(--card)" }}>
          <div className="px-5 py-3 border-b border-border">
            <SectionHeader>Recent Suspects</SectionHeader>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  <button type="button" onClick={() => handleSort("identifier")} className={`inline-flex items-center gap-1 hover:text-foreground ${sortBy === "identifier" ? "text-amber-400" : ""}`}>
                    Identifier
                    {renderSortIcon("identifier")}
                  </button>
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground relative" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  <button
                    type="button"
                    onClick={() => setOpenHeaderFilter(openHeaderFilter === "type" ? null : "type")}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${typeFilters.length > 0 ? "text-amber-400" : ""}`}
                  >
                    Type
                    <SlidersHorizontal size={10} />
                  </button>
                  {openHeaderFilter === "type" && (
                    <div className="absolute left-4 top-8 z-20 w-56 border border-border p-2 shadow-xl" style={{ background: "var(--card)" }}>
                      <button
                        type="button"
                        onClick={() => setTypeFilters([])}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-[10px] ${typeFilters.length === 0 ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                        style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                      >
                        All types
                        <span className="w-3">{typeFilters.length === 0 ? "✓" : ""}</span>
                      </button>
                      {typeFilterOptions.map(option => (
                        <label key={option.value} className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                          <input
                            type="checkbox"
                            checked={typeFilters.includes(option.value)}
                            onChange={() => toggleTypeFilter(option.value)}
                            className="accent-amber-500"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  <button type="button" onClick={() => handleSort("reporters")} className={`inline-flex items-center gap-1 hover:text-foreground ${sortBy === "reporters" ? "text-amber-400" : ""}`}>
                    Reporters
                    {renderSortIcon("reporters")}
                  </button>
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground relative" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  <button
                    type="button"
                    onClick={() => setOpenHeaderFilter(openHeaderFilter === "risk" ? null : "risk")}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${riskFilters.length > 0 ? "text-amber-400" : ""}`}
                  >
                    Risk
                    <SlidersHorizontal size={10} />
                  </button>
                  {openHeaderFilter === "risk" && (
                    <div className="absolute left-4 top-8 z-20 w-52 border border-border p-2 shadow-xl" style={{ background: "var(--card)" }}>
                      <button
                        type="button"
                        onClick={() => setRiskFilters([])}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-[10px] ${riskFilters.length === 0 ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                        style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                      >
                        All risk
                        <span className="w-3">{riskFilters.length === 0 ? "✓" : ""}</span>
                      </button>
                      {riskHeaderOptions.map(option => {
                        const riskStyle = RISK_CONFIG[option.value];
                        return (
                          <label key={option.value} className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                            <input
                              type="checkbox"
                              checked={riskFilters.includes(option.value)}
                              onChange={() => toggleRiskFilter(option.value)}
                              className="accent-amber-500"
                            />
                            <span className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                  <button type="button" onClick={() => handleSort("last_seen")} className={`inline-flex items-center gap-1 hover:text-foreground ${sortBy === "last_seen" ? "text-amber-400" : ""}`}>
                    Last Seen
                    {renderSortIcon("last_seen")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedSuspects.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onSelectSuspect(row.id)}
                  className="border-b border-border hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2.5"><Monospace className="text-foreground/70">{row.reportedIdentifier}</Monospace></td>
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{IDENTIFIER_TYPE_LABEL[row.reportedIdentifierType]}</td>
                  <td className="px-4 py-2.5"><Monospace className="text-muted-foreground">{row.corroborationCount}</Monospace></td>
                  <td className="px-4 py-2.5"><RiskBadge level={row.risk} size="sm" /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Monospace className="text-muted-foreground">{row.lastActivity}</Monospace>
                      <ChevronRight size={13} className="text-muted-foreground group-hover:text-amber-400 transition-colors" />
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSuspects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No suspects match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
            <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
              Showing {visibleStart}-{visibleEnd} of {visibleSuspects.length}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 border border-border text-[11px] text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground hover:bg-white/5 transition-colors"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
              >
                PREV
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-8 min-w-8 px-2 border text-[11px] transition-colors ${currentPage === pageNumber ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3 border border-border text-[11px] text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground hover:bg-white/5 transition-colors"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
              >
                NEXT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Extension View ───────────────────────────────────────────────────────────

type ExtStep = "home" | "scanning" | "alert" | "summary" | "chat" | "report" | "reportDetail" | "suspect" | "suspectDetail";
type BotMsgKind = "text" | "confirm" | "warning" | "safe" | "caution" | "report";
type DemoWorkflowId = "linkedin" | "ebay" | "github" | "xnews" | "gemini";
type PageVerdict = "suspect" | "trusted" | "caution" | null;

interface BotMessage {
  role: "bot" | "user";
  kind: BotMsgKind;
  content: string;
}

const IDENTIFIER_OPTIONS = [
  { label: "LinkedIn Profile",  type: "linkedin_url",  icon: <User size={12} />,       placeholder: "linkedin.com/in/username or paste URL" },
  { label: "Email Address",     type: "email",         icon: <Mail size={12} />,       placeholder: "name@domain.com" },
  { label: "eBay Shop / Item",  type: "ebay_handle",   icon: <Package size={12} />,    placeholder: "eBay username or item URL" },
  { label: "GitHub Profile",    type: "github_url",    icon: <GitBranch size={12} />,  placeholder: "github.com/username or paste URL" },
  { label: "X Post",            type: "x_post",        icon: <MessageSquare size={12} />, placeholder: "x.com/user/status/… or paste post URL" },
  { label: "Wallet / Crypto",   type: "wallet",        icon: <Wallet size={12} />,     placeholder: "0x… or wallet address" },
  { label: "Domain / URL",      type: "domain",        icon: <Globe size={12} />,      placeholder: "example.com or full URL" },
  { label: "Phone Number",      type: "phone",         icon: <Phone size={12} />,      placeholder: "+1 (555) 000-0000" },
  { label: "Other / Describe",  type: "other",         icon: <FileText size={12} />,   placeholder: "Describe what seems suspicious…" },
];

const GREETING: BotMessage[] = [
  { role: "bot", kind: "text", content: "What do you want me to check? Paste a message, link, wallet, repo, or email here, or use the screen check to analyze the visible page." },
];

const RESULT_INDICATORS = [
  { label: "Non-Meta email domain",            sev: "HIGH" },
  { label: "Equipment purchase requested",     sev: "HIGH" },
  { label: "Off-platform redirect (WhatsApp)", sev: "HIGH" },
  { label: "14 independent reports matched",   sev: "MED" },
  { label: "Domain registered 43 days ago",    sev: "MED" },
];

const SAFE_STEPS = [
  "Do not send money or purchase equipment",
  "Do not share passwords, keys, or OTPs",
  "Do not run scripts or install software",
  "Request a call via official company channel",
  "Report to LinkedIn Trust & Safety",
];

const DEMO_WORKFLOWS: Record<DemoWorkflowId, {
  label: string;
  shortLabel: string;
  url: string;
  identifierLabel: string;
  identifierValue: string;
  reportId: string;
  suspectId: string;
  risk: RiskLevel;
  score: number;
  confidence: string;
  status: "suspect" | "trusted" | "caution";
  confirmCopy: string;
  resultCopy: string;
  reportCopy: string;
  indicators: { label: string; sev: "HIGH" | "MED" | "LOW" }[];
  recommendations: string[];
}> = {
  linkedin: {
    label: "LinkedIn job message",
    shortLabel: "LinkedIn",
    url: "linkedin.com/in/jordan-lee-recruiting",
    identifierLabel: "LinkedIn Profile",
    identifierValue: "linkedin.com/in/jordan-lee-recruiting",
    reportId: "SR-2024-0352",
    suspectId: "SR-2024-0352",
    risk: "YELLOW",
    score: 38,
    confidence: "52%",
    status: "caution",
    confirmCopy: "Captured the LinkedIn profile and recent message. I’m checking whether the outreach contains enough context, official affiliation, and safe next steps.",
    resultCopy: "This looks plausible, but there is not enough verified context yet. No payment, credential, code-execution, or identity-document request is visible. Submit a report if you want the agent to run background due diligence and watch for matching submissions.",
    reportCopy: "Report SR-2024-0352 accepted. I attached the profile URL, message excerpt, claimed role, missing company details, and your note that the outreach felt vague.",
    indicators: [
      { label: "Professional outreach appears plausible", sev: "LOW" },
      { label: "Company identity is not yet verified", sev: "MED" },
      { label: "No payment or credential request visible", sev: "LOW" },
      { label: "Agent due diligence can monitor for matches", sev: "MED" },
    ],
    recommendations: [
      "Ask for company details through an official channel",
      "Submit a report for agent follow-up",
      "Do not share sensitive documents until the opportunity is verified",
      "Preserve the message thread and profile URL",
    ],
  },
  ebay: {
    label: "eBay off-platform payment",
    shortLabel: "eBay",
    url: "ebay.com/itm/385911024991",
    identifierLabel: "eBay Shop / Item",
    identifierValue: "marketplace_seller_99",
    reportId: "SR-2024-0335",
    suspectId: "SR-2024-0335",
    risk: "RED",
    score: 92,
    confidence: "94%",
    status: "suspect",
    confirmCopy: "Captured the eBay item, seller message, external checkout URL, and payment instructions. I’m checking buyer-protection bypass and known marketplace fraud patterns.",
    resultCopy: "Immediate STOP: the seller is asking you to leave eBay buyer protection and pay through a fake escrow/payment path. This is a direct financial-loss risk.",
    reportCopy: "Report SR-2024-0335 accepted. I attached the eBay item, seller handle, fake escrow URL, and off-platform payment request.",
    indicators: [
      { label: "Payment requested outside eBay", sev: "HIGH" },
      { label: "Fake escrow/payment page linked", sev: "HIGH" },
      { label: "Buyer protection bypassed", sev: "HIGH" },
      { label: "Urgent shipping pressure", sev: "MED" },
    ],
    recommendations: [
      "Do not pay outside eBay checkout",
      "Do not open or enter details on the escrow link",
      "Keep the conversation inside eBay",
      "Submit a report with the item URL and seller handle",
    ],
  },
  github: {
    label: "GitHub repo request",
    shortLabel: "GitHub",
    url: "github.com/northstar-labs/frontend-takehome",
    identifierLabel: "GitHub Profile",
    identifierValue: "github.com/northstar-labs/frontend-takehome",
    reportId: "SR-2024-0339",
    suspectId: "SR-2024-0339",
    risk: "RED",
    score: 93,
    confidence: "91%",
    status: "suspect",
    confirmCopy: "Captured the GitHub repository and visible setup instructions. I’m checking the saved cloud-agent analysis for package scripts, dependency behavior, and code-risk findings.",
    resultCopy: "STOP: cloud code-analysis agents found malicious behavior in this repository. The package install path includes a postinstall script that attempts to collect environment variables and contact an external endpoint. Do not run npm install, npm scripts, or cloned code from this repo.",
    reportCopy: "Report SR-2024-0339 accepted. I attached the repo URL, README excerpt, package script finding, suspicious file path, and cloud static-analysis evidence.",
    indicators: [
      { label: "Cloud agent found malicious postinstall behavior", sev: "HIGH" },
      { label: "Environment variable collection detected", sev: "HIGH" },
      { label: "External endpoint contacted during install", sev: "HIGH" },
      { label: "Install script runs before user code review", sev: "HIGH" },
    ],
    recommendations: [
      "Do not run npm install or any repo scripts",
      "Do not clone it into a machine with credentials",
      "Preserve the repo URL and cloud-agent findings",
      "Submit a report so the agent can aggregate related attempts",
    ],
  },
  xnews: {
    label: "X fake news post",
    shortLabel: "X News",
    url: "x.com/market_sentinel/status/1805123409876543210",
    identifierLabel: "X Post",
    identifierValue: "x.com/market_sentinel/status/1805123409876543210",
    reportId: "SR-2024-0361",
    suspectId: "SR-2024-0361",
    risk: "ORANGE",
    score: 76,
    confidence: "84%",
    status: "suspect",
    confirmCopy: "Captured the X post, screenshot-style image, linked domain, and viral claim. I’m checking official sources, image provenance, repost clusters, and monetized links.",
    resultCopy: "High-risk misinformation indicators are present. Source-check agents found no matching official GOV.UK update, the screenshot differs from official page structure, and similar posts reuse the same breaking-news wording while pushing users to an external paid guidance page. Do not repost, click the linked page, or pay for urgent review based on this post.",
    reportCopy: "Report SR-2024-0361 accepted. I attached the X post URL, screenshot claim, linked domain, source-check result, reused wording cluster, and safe next-step guidance.",
    indicators: [
      { label: "No matching official source found", sev: "HIGH" },
      { label: "Screenshot layout differs from official pages", sev: "MED" },
      { label: "Reused panic wording across similar posts", sev: "MED" },
      { label: "External paid guidance link attached", sev: "HIGH" },
    ],
    recommendations: [
      "Do not repost or amplify the claim",
      "Do not click or pay through the linked page",
      "Check GOV.UK or official channels directly",
      "Submit a report so the agent can track the spread pattern",
    ],
  },
  gemini: {
    label: "Gemini payment page",
    shortLabel: "Gemini",
    url: "payments.google.com/gp/w/u/0/buyflow?merchant=Google-Gemini",
    identifierLabel: "Domain / URL",
    identifierValue: "payments.google.com",
    reportId: "SR-TRUSTED-001",
    suspectId: "SR-2024-0347",
    risk: "GREEN",
    score: 8,
    confidence: "96%",
    status: "trusted",
    confirmCopy: "Captured the payment URL, visible merchant name, HTTPS context, and Google account payment frame. I’m checking domain ownership and impersonation signals.",
    resultCopy: "This page appears consistent with a trusted Google Payments checkout for Gemini. No immediate scam indicators were found in the visible page context.",
    reportCopy: "No report was submitted. The page is currently assessed as trusted, with no high-risk indicators in the visible context.",
    indicators: [
      { label: "Domain matches Google Payments", sev: "LOW" },
      { label: "HTTPS payment frame present", sev: "LOW" },
      { label: "Merchant shown as Google Gemini", sev: "LOW" },
      { label: "No off-platform payment request found", sev: "LOW" },
    ],
    recommendations: [
      "Continue only while the domain remains payments.google.com",
      "Do not approve unexpected popups or browser extensions",
      "Check the plan price and signed-in account before paying",
      "No report needed unless the URL or merchant changes",
    ],
  },
};

type ExtensionSessionKey = "current" | "previous";

interface ExtensionSessionSnapshot {
  botMessages: BotMessage[];
  selectedType: typeof IDENTIFIER_OPTIONS[number] | null;
  confirmedIdentifier: { label: string; value: string } | null;
  valueInput: string;
  promptInput: string;
  createdAt: string;
  activeWorkflow: DemoWorkflowId;
  pageVerdict: PageVerdict;
}

function formatSessionTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function createEmptyExtensionSession(): ExtensionSessionSnapshot {
  return {
    botMessages: GREETING,
    selectedType: null,
    confirmedIdentifier: null,
    valueInput: "",
    promptInput: "",
    createdAt: formatSessionTime(),
    activeWorkflow: "linkedin",
    pageVerdict: null,
  };
}

const PREVIOUS_EXTENSION_SESSION: ExtensionSessionSnapshot = {
  botMessages: [
    ...GREETING,
    { role: "bot", kind: "text", content: "Loaded the saved recruiter check. You can continue asking questions or open the matched suspect below." },
    {
      role: "bot",
      kind: "warning",
      content: "This saved investigation found high-risk indicators: upfront equipment payment, off-platform redirect, and repeated reports using the same outreach pattern.",
    },
  ],
  selectedType: null,
  confirmedIdentifier: { label: "LinkedIn Profile", value: "linkedin.com/in/alex-morgan-recruiter" },
  valueInput: "",
  promptInput: "",
  createdAt: "09:44",
  activeWorkflow: "linkedin",
  pageVerdict: "suspect",
};

function sessionDisplayName(snapshot: ExtensionSessionSnapshot) {
  const identifier = snapshot.confirmedIdentifier?.value ?? "Unidentified";
  return `${identifier} · ${snapshot.createdAt}`;
}

function ExtensionView() {
  const [step, setStep] = useState<ExtStep>("home");
  const [selectedExtensionReportId, setSelectedExtensionReportId] = useState(REPORTS[0].id);
  const [selectedExtensionSuspectId, setSelectedExtensionSuspectId] = useState(REPORTS[0].id);
  const [botMessages, setBotMessages] = useState<BotMessage[]>(GREETING);
  const [selectedType, setSelectedType] = useState<typeof IDENTIFIER_OPTIONS[number] | null>(null);
  const [confirmedIdentifier, setConfirmedIdentifier] = useState<{ label: string; value: string } | null>(null);
  const [activeSession, setActiveSession] = useState<ExtensionSessionKey>("current");
  const [activeWorkflow, setActiveWorkflow] = useState<DemoWorkflowId>("linkedin");
  const [pageVerdict, setPageVerdict] = useState<PageVerdict>(null);
  const [valueInput, setValueInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const sessionSnapshotsRef = useRef<Record<ExtensionSessionKey, ExtensionSessionSnapshot>>({
    current: createEmptyExtensionSession(),
    previous: PREVIOUS_EXTENSION_SESSION,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [botMessages, qaMessages]);

  function appendInlineInvestigationResult() {
    const analysis = DEMO_WORKFLOWS[activeWorkflow];
    setBotMessages(prev => [
      ...prev,
      {
        role: "bot",
        kind: analysis.status === "trusted" ? "safe" : analysis.status === "caution" ? "caution" : "warning",
        content: analysis.resultCopy,
      },
    ]);
  }

  function captureSessionSnapshot(): ExtensionSessionSnapshot {
    return {
      botMessages,
      selectedType,
      confirmedIdentifier,
      valueInput,
      promptInput,
      createdAt: sessionSnapshotsRef.current[activeSession].createdAt,
      activeWorkflow,
      pageVerdict,
    };
  }

  function applySessionSnapshot(snapshot: ExtensionSessionSnapshot) {
    setBotMessages(snapshot.botMessages);
    setSelectedType(snapshot.selectedType);
    setConfirmedIdentifier(snapshot.confirmedIdentifier);
    setValueInput(snapshot.valueInput);
    setPromptInput(snapshot.promptInput);
    setActiveWorkflow(snapshot.activeWorkflow);
    setPageVerdict(snapshot.pageVerdict);
    setQaMessages([]);
  }

  function applyCurrentWorkflowMatch(workflowId = activeWorkflow) {
    const analysis = DEMO_WORKFLOWS[workflowId];
    setSelectedExtensionReportId(analysis.reportId);
    setSelectedExtensionSuspectId(analysis.suspectId);
    setConfirmedIdentifier({ label: analysis.identifierLabel, value: analysis.identifierValue });
    setPageVerdict(analysis.status === "trusted" ? "trusted" : analysis.status === "caution" ? "caution" : "suspect");
  }

  function selectWorkflow(workflowId: DemoWorkflowId) {
    const analysis = DEMO_WORKFLOWS[workflowId];
    setActiveWorkflow(workflowId);
    setPageVerdict(null);
    setConfirmedIdentifier(null);
    setSelectedType(null);
    setValueInput("");
    setPromptInput("");
    setSelectedExtensionReportId(analysis.reportId);
    setSelectedExtensionSuspectId(analysis.suspectId);
    setStep("home");
    setBotMessages([
      ...GREETING,
      {
        role: "bot",
        kind: "text",
        content: `Demo loaded: ${analysis.label}. Use screen check or tell me what feels suspicious.`,
      },
    ]);
  }

  function runPrompt(value: string) {
    const val = value.trim();
    if (!val) return;
    const analysis = DEMO_WORKFLOWS[activeWorkflow];
    applyCurrentWorkflowMatch(activeWorkflow);
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: val },
      { role: "bot",  kind: "confirm", content: analysis.confirmCopy },
    ]);
    setPromptInput("");
    setTimeout(appendInlineInvestigationResult, 650);
  }

  function runScreenshotCheck() {
    const analysis = DEMO_WORKFLOWS[activeWorkflow];
    applyCurrentWorkflowMatch(activeWorkflow);
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: "Check what's on the screen" },
      {
        role: "bot",
        kind: "confirm",
        content: analysis.confirmCopy,
      },
    ]);
    setPromptInput("");
    setTimeout(appendInlineInvestigationResult, 650);
  }

  function submitCurrentWorkflowReport() {
    const analysis = DEMO_WORKFLOWS[activeWorkflow];
    applyCurrentWorkflowMatch(activeWorkflow);
    setBotMessages(prev => [
      ...prev,
      {
        role: "user",
        kind: "text",
        content: analysis.status === "trusted" ? "Submit report" : "Submit this report",
      },
      {
        role: "bot",
        kind: "report",
        content: analysis.reportCopy,
      },
    ]);
  }

  function runVoiceInput() {
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: "Talk" },
      {
        role: "bot",
        kind: "text",
        content: "Voice input is ready. Tell me what feels suspicious, or describe the message, link, wallet, repo, or request you want checked.",
      },
    ]);
  }

  function selectType(opt: typeof IDENTIFIER_OPTIONS[number]) {
    setSelectedType(opt);
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: opt.label },
      { role: "bot",  kind: "text", content: `Got it. Paste the ${opt.label.toLowerCase()} you want me to analyze, or describe what happened.` },
    ]);
    setTimeout(() => identifierInputRef.current?.focus(), 50);
  }

  function submitIdentifier() {
    if (!valueInput.trim() || !selectedType) return;
    const val = valueInput.trim();
    setConfirmedIdentifier({ label: selectedType.label, value: val });
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: val },
      { role: "bot",  kind: "confirm", content: `Analyzing ${selectedType.label.toLowerCase()}: ${val}` },
    ]);
    setSelectedType(null);
    setValueInput("");
    setTimeout(appendInlineInvestigationResult, 650);
  }

  function reset() {
    setStep("home");
    applySessionSnapshot(createEmptyExtensionSession());
    setSelectedExtensionReportId(REPORTS[0].id);
    setSelectedExtensionSuspectId(REPORTS[0].id);
  }

  function startNewSession() {
    sessionSnapshotsRef.current[activeSession] = captureSessionSnapshot();
    const fresh = createEmptyExtensionSession();
    sessionSnapshotsRef.current.current = fresh;
    setActiveSession("current");
    setStep("home");
    applySessionSnapshot(fresh);
    setSelectedExtensionReportId(REPORTS[0].id);
    setSelectedExtensionSuspectId(REPORTS[0].id);
  }

  function getSessionSnapshot(key: ExtensionSessionKey) {
    return key === activeSession ? captureSessionSnapshot() : sessionSnapshotsRef.current[key];
  }

  function switchToSession(target: ExtensionSessionKey) {
    if (target === activeSession) return;
    sessionSnapshotsRef.current[activeSession] = captureSessionSnapshot();
    const nextSession = sessionSnapshotsRef.current[target];
    setStep("home");
    setActiveSession(target);
    applySessionSnapshot(nextSession);
  }

  function openLinkedSession(target: ExtensionSessionKey) {
    sessionSnapshotsRef.current[activeSession] = captureSessionSnapshot();
    const nextSession = sessionSnapshotsRef.current[target];
    setActiveSession(target);
    applySessionSnapshot(nextSession);
    setStep("home");
  }

  function openQa() {
    setQaMessages([
      { role: "user",      content: "Is this recruiter legit?" },
      { role: "assistant", content: "Risk indicators detected. The domain meta-careers.io is not affiliated with Meta (meta.com). Upfront equipment payment requests are not standard at any major employer. Recommend: pause, do not send funds, verify via official channel." },
    ]);
    setStep("chat");
  }

  function sendQa() {
    if (!qaInput.trim()) return;
    setQaMessages(prev => [
      ...prev,
      { role: "user",      content: qaInput },
      { role: "assistant", content: "Based on current report data: this matches a documented recruiter fraud pattern (94% confidence). 14 independent reports describe identical equipment purchase requests for this suspect. Do not share payment details." },
    ]);
    setQaInput("");
  }

  const report = REPORTS.find(item => item.id === selectedExtensionReportId) ?? REPORTS[0];
  const suspect = REPORTS.find(item => item.id === selectedExtensionSuspectId) ?? REPORTS[0];
  const isResultStep = step === "alert" || step === "summary" || step === "chat";
  const activePanel = step === "reportDetail" ? "report" : step === "suspectDetail" ? "suspect" : step;
  const workflow = DEMO_WORKFLOWS[activeWorkflow];
  const workflowSignal = pageVerdict ?? (isResultStep ? "suspect" : null);
  const confirmedIdentifierIcon = confirmedIdentifier
    ? IDENTIFIER_OPTIONS.find(opt => opt.label === confirmedIdentifier.label)?.icon ?? <User size={12} />
    : null;
  const sessionOptions: { key: ExtensionSessionKey; snapshot: ExtensionSessionSnapshot }[] = [
    { key: "current", snapshot: getSessionSnapshot("current") },
    { key: "previous", snapshot: getSessionSnapshot("previous") },
  ];
  const linkedSuspectSessions = sessionOptions.filter(({ snapshot }) => snapshot.confirmedIdentifier?.value === suspect.reportedIdentifier);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Fake browser / page backdrop */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "#1a1e2b" }}>
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: "#0f1219", borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 mx-4 flex items-center gap-2 px-3 py-1 rounded-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Globe size={11} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
              {workflow.url}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 flex items-center justify-center rounded-sm relative"
              style={{
                background: workflowSignal === "trusted" ? "rgba(34,197,94,0.14)" : workflowSignal === "suspect" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)",
                border: workflowSignal === "trusted" ? "1px solid rgba(34,197,94,0.35)" : workflowSignal === "suspect" ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(245,158,11,0.3)",
              }}>
              <Radio size={13} className={workflowSignal === "trusted" ? "text-green-400" : workflowSignal === "suspect" ? "text-red-400" : "text-amber-400"} />
              {workflowSignal === "suspect" && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>!</span>
                </span>
              )}
              {workflowSignal === "caution" && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>?</span>
                </span>
              )}
              {workflowSignal === "trusted" && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={8} className="text-white" />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 pt-5 max-w-2xl mx-auto">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {(Object.keys(DEMO_WORKFLOWS) as DemoWorkflowId[]).map(id => {
              const item = DEMO_WORKFLOWS[id];
              return (
                <button
                  key={id}
                  onClick={() => selectWorkflow(id)}
                  className={`px-3 py-2 text-left border transition-colors ${activeWorkflow === id ? "border-amber-500/45 text-amber-300" : "border-white/10 text-white/45 hover:text-white/80 hover:bg-white/5"}`}
                  style={{ background: activeWorkflow === id ? "rgba(245,158,11,0.09)" : "rgba(255,255,255,0.03)" }}
                >
                  <div className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>{item.shortLabel}</div>
                  <div className="text-[9px] mt-0.5 text-white/35" style={{ fontFamily: "var(--font-data)" }}>
                    {id === "linkedin" ? "REPORT FLOW" : id === "xnews" ? "SOURCE CHECK" : item.status === "trusted" ? "TRUSTED FLOW" : item.status === "caution" ? "CAUTION FLOW" : "STOP FLOW"}
                  </div>
                </button>
              );
            })}
          </div>

          {activeWorkflow === "linkedin" && (
            <div className="p-5 rounded-lg mb-4" style={{ background: "#1e2435", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 border-2 border-blue-500/20">
                  <User size={28} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-white/90 mb-0.5" style={{ fontFamily: "var(--font-body)" }}>Jordan Lee</div>
                  <div className="text-sm text-white/50 mb-1">Talent Partner · Early-stage AI hiring</div>
                  <div className="text-xs text-white/35" style={{ fontFamily: "var(--font-data)" }}>London Area · 683 connections</div>
                </div>
                <button className="px-4 py-1.5 rounded-full text-xs font-medium" style={{ background: "#0a66c2", color: "#fff" }}>Connect</button>
              </div>
              <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="text-xs text-white/40 mb-2">Recent message:</div>
                <div className="text-sm text-white/70 leading-relaxed p-3 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                  "Hi, I’m helping an early-stage AI team hire founding engineers. Your background looks relevant. Would you be open to a 15-minute intro this week? I can share more company details after we confirm fit."
                </div>
                <button
                  onClick={() => runPrompt("This feels suspicious. Should I submit a report?")}
                  className="mt-3 px-3 py-2 text-xs text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                >
                  This feels suspicious
                </button>
              </div>
            </div>
          )}

          {activeWorkflow === "ebay" && (
            <div className="rounded-lg overflow-hidden mb-4" style={{ background: "#f7f7f7", color: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
                <div className="text-xl font-bold" style={{ color: "#e53238", fontFamily: "Arial, sans-serif" }}>e<span style={{ color: "#0064d2" }}>B</span><span style={{ color: "#f5af02" }}>a</span><span style={{ color: "#86b817" }}>y</span></div>
                <div className="text-xs text-gray-500">Item #385911024991</div>
              </div>
              <div className="p-5 grid grid-cols-[150px_1fr] gap-4">
                <div className="h-36 rounded bg-gray-200 flex items-center justify-center">
                  <Package size={44} className="text-gray-500" />
                </div>
                <div>
                  <div className="text-base font-semibold">Sony A7 IV Camera Body - Like New</div>
                  <div className="text-sm text-gray-500 mt-1">Seller: marketplace_seller_99 · 98.1% positive</div>
                  <div className="text-2xl font-semibold mt-3">$1,250.00</div>
                  <div className="mt-3 p-3 rounded border border-red-200 bg-red-50 text-sm leading-relaxed text-red-900">
                    Seller message: "I can ship today, but eBay fees are too high. Pay through escrow-safe-pay.com or Zelle and I’ll mark it shipped immediately. Offer expires in 30 minutes."
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === "github" && (
            <div className="rounded-lg overflow-hidden mb-4" style={{ background: "#0d1117", color: "#c9d1d9", border: "1px solid rgba(255,255,255,0.09)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #30363d" }}>
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-white/70" />
                  <div>
                    <div className="text-sm font-semibold">northstar-labs / frontend-takehome</div>
                    <div className="text-xs text-white/35">Public repository · maintained · 312 stars</div>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>Agent flagged</div>
              </div>
              <div className="p-5">
                <div className="text-xs text-white/45 mb-2" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>README.md</div>
                <div className="rounded border p-4 space-y-3" style={{ borderColor: "#30363d", background: "#161b22" }}>
                  <div className="text-base font-semibold text-white/90">Frontend engineer take-home</div>
                  <p className="text-sm leading-relaxed text-white/65">
                    Clone the repo, install dependencies, run tests, and open a pull request with your solution. No secrets or production credentials are required.
                  </p>
                  <div className="rounded p-3 text-xs leading-relaxed" style={{ background: "#0d1117", border: "1px solid #30363d", fontFamily: "var(--font-data)" }}>
                    git clone github.com/northstar-labs/frontend-takehome<br />
                    npm install<br />
                    npm test<br />
                    npm run dev
                  </div>
                  <div className="rounded border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200/90">
                    Cloud agent result: package.json contains a postinstall path that loads scripts/telemetry-check.js before tests run.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === "xnews" && (
            <div className="rounded-lg overflow-hidden mb-4" style={{ background: "#000", color: "#e7e9ea", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #2f3336" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">X</div>
                  <div>
                    <div className="text-sm font-semibold">Market Sentinel</div>
                    <div className="text-xs text-white/45">@market_sentinel · 18m</div>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>Source check</div>
              </div>
              <div className="p-5">
                <div className="text-base font-semibold text-white/90 mb-2">BREAKING: UK student visa sponsorship ends tomorrow for most international applicants</div>
                <p className="text-sm leading-relaxed text-white/70">
                  Students have less than 24 hours to prepare documents. We found the emergency update before most schools announced it. Use our urgent review link before applications close.
                </p>
                <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: "#2f3336", background: "#111" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#2f3336" }}>
                    <Globe size={13} className="text-white/55" />
                    <span className="text-xs text-white/55" style={{ fontFamily: "var(--font-data)" }}>GOV.UK screenshot</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-28 bg-white/20 rounded" />
                    <div className="h-3 w-full bg-white/10 rounded" />
                    <div className="h-3 w-4/5 bg-white/10 rounded" />
                    <div className="mt-3 rounded border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200/90">
                      Linked page: visa-update-uk.example.com/urgent-review
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/45">
                  <div>8.2K reposts</div>
                  <div>1.4K quotes</div>
                  <div>21K likes</div>
                </div>
              </div>
            </div>
          )}

          {activeWorkflow === "gemini" && (
            <div className="rounded-lg overflow-hidden mb-4" style={{ background: "#fff", color: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">G</div>
                  <div>
                    <div className="text-sm font-semibold">Google Payments</div>
                    <div className="text-xs text-gray-500">Secure checkout</div>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs">https://payments.google.com</div>
              </div>
              <div className="p-5">
                <div className="text-xs text-gray-500 mb-1">Merchant</div>
                <div className="text-lg font-semibold">Google Gemini</div>
                <div className="mt-4 p-4 rounded border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Gemini Advanced</div>
                      <div className="text-sm text-gray-500">Monthly subscription · Google account checkout</div>
                    </div>
                    <div className="text-xl font-semibold">$19.99</div>
                  </div>
                </div>
                <button className="mt-4 w-full py-2 rounded bg-blue-600 text-white text-sm font-medium">Confirm purchase</button>
                <div className="mt-3 text-xs text-gray-500">Protected by Google Payments. Manage subscriptions in your Google Account.</div>
              </div>
            </div>
          )}

          {step === "scanning" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 size={22} className="text-amber-400 animate-spin" />
              <div className="text-sm text-amber-400" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>ANALYZING…</div>
              <div className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>Extracting suspects · Checking domain · Searching similar reports</div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — extension surface */}
      <div className="flex-shrink-0 flex flex-col border-l border-border overflow-hidden" style={{ width: 360, background: "#0f1219" }}>

        {/* Header */}
        <div className="border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={reset} className="flex items-center gap-2 text-left">
              <Radio size={13} className={workflowSignal === "trusted" ? "text-green-400" : workflowSignal === "suspect" ? "text-red-400" : "text-amber-400"} />
              <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>SCAMRADAR</span>
            </button>
            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>Extension</span>
          </div>
          <div className="grid grid-cols-3 border-t border-border">
            {[
              { label: "Home", next: "home" as ExtStep },
              { label: "Reports", next: "report" as ExtStep },
              { label: "Suspects", next: "suspect" as ExtStep },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => setStep(item.next)}
                className={`py-2 text-[10px] border-r border-border last:border-r-0 transition-colors ${
                  activePanel === item.next ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
            <div className="relative flex-1">
              <select
                value={activeSession}
                onChange={e => switchToSession(e.currentTarget.value as ExtensionSessionKey)}
                className="w-full appearance-none px-2.5 py-1.5 pr-7 text-[10px] text-muted-foreground border border-border outline-none hover:text-foreground hover:bg-white/5 transition-colors"
                style={{ background: "rgba(255,255,255,0.02)", fontFamily: "var(--font-data)" }}
              >
                {sessionOptions.map(({ key, snapshot }) => (
                  <option key={key} value={key}>{sessionDisplayName(snapshot)}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <button
              onClick={startNewSession}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-amber-400 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
            >
              <Plus size={11} /> New
            </button>
          </div>
        </div>

        {/* ── NATURAL LANGUAGE HOME ── */}
        {step === "home" && (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
              {confirmedIdentifier && (
                <div
                  className={`sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 border ${pageVerdict === "trusted" ? "border-green-500/25" : "border-amber-500/25"}`}
                  style={{ background: pageVerdict === "trusted" ? "rgba(20,83,45,0.16)" : "#17140d" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 flex items-center justify-center border flex-shrink-0 ${pageVerdict === "trusted" ? "text-green-400 border-green-500/25" : "text-amber-400 border-amber-500/25"}`}
                      style={{ background: pageVerdict === "trusted" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)" }}
                    >
                      {confirmedIdentifierIcon}
                    </div>
                    <div className="min-w-0">
                    <div className={`text-[9px] font-medium mb-0.5 ${pageVerdict === "trusted" ? "text-green-400" : "text-amber-400"}`} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                      {pageVerdict === "trusted" ? "VERIFIED PAGE" : pageVerdict === "caution" ? "REVIEW TARGET" : "MATCHED SUSPECT"}
                    </div>
                      <Monospace className="text-foreground break-all">{confirmedIdentifier.value}</Monospace>
                    </div>
                  </div>
                  {pageVerdict === "trusted" ? (
                    <span className="flex items-center gap-1 px-2 py-1 text-[10px] text-green-300 border border-green-500/25 flex-shrink-0" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                      <CheckCircle size={10} /> Trusted
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedExtensionSuspectId(workflow.suspectId);
                        setStep("suspectDetail");
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors flex-shrink-0"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                    >
                      <User size={10} /> Open
                    </button>
                  )}
                </div>
              )}
              {botMessages.map((msg, i) => {
                const isConfirmPending = msg.kind === "confirm" && !botMessages.slice(i + 1).some(next => ["warning", "safe", "caution", "report"].includes(next.kind));
                return (
                <div key={i}>
                  {msg.role === "bot" && msg.kind === "text" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <Radio size={9} className="text-amber-400" />
                      </div>
                      <div className="px-3 py-2 text-[11px] leading-relaxed text-foreground max-w-[85%]"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "var(--font-body)" }}>
                        {msg.content}
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && msg.kind === "confirm" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <Radio size={9} className="text-amber-400" />
                      </div>
                      <div className="px-3 py-2 text-[11px] leading-relaxed max-w-[85%]"
                        style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "var(--font-body)" }}>
                        {isConfirmPending ? (
                          <Loader2 size={10} className="text-amber-400 animate-spin inline mr-1.5" />
                        ) : (
                          <CheckCircle size={10} className="text-green-400 inline mr-1.5" />
                        )}
                        <span className="text-amber-300">{msg.content}</span>
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && msg.kind === "warning" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)" }}>
                        <ShieldAlert size={10} className="text-red-400" />
                      </div>
                      <div className="max-w-[92%] border border-red-500/25" style={{ background: "rgba(239,68,68,0.08)" }}>
                        <div className="px-3 py-3 border-b border-red-500/15 flex items-center gap-3">
                          <div
                            className="w-12 h-12 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{
                              background: "#dc2626",
                              clipPath: "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)",
                              fontFamily: "var(--font-display)",
                              letterSpacing: "0.08em",
                            }}
                          >
                            STOP
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-red-300" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                              STOP BEFORE ACTING
                            </div>
                            <p className="text-[10px] text-red-200/85 leading-relaxed mt-1" style={{ fontFamily: "var(--font-body)" }}>
                              {activeWorkflow === "xnews" ? "Do not repost, click linked pages, or pay for urgent help until the claim is verified through official sources." : "Do not pay, run code, share credentials, or move off-platform until independently verified."}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-2 border-b border-red-500/15">
                          <div className="flex items-center gap-2 mb-1">
                            <TriangleAlert size={12} className="text-red-400 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-red-400" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>HIGH-RISK INDICATORS</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-red-200/90" style={{ fontFamily: "var(--font-body)" }}>
                            {msg.content}
                          </p>
                        </div>
                        <div className="px-3 py-2 space-y-1.5">
                          {workflow.indicators.map(ind => (
                            <div key={ind.label} className="flex items-start gap-2 text-[10px] text-foreground">
                              <span className={`mt-0.5 px-1 py-0.5 text-[9px] font-bold ${ind.sev === "HIGH" ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}
                                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                                {ind.sev}
                              </span>
                              <span>{ind.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-3 pb-3">
                          <div className="mb-2 text-[10px] text-green-300/90 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                            Recommended: {workflow.recommendations[0].toLowerCase()}, and preserve evidence before continuing.
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={submitCurrentWorkflowReport}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <Plus size={11} /> Submit report
                            </button>
                            <button
                              onClick={() => {
                                setSelectedExtensionReportId(workflow.reportId);
                                setStep("reportDetail");
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <FileText size={11} /> View report
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 mt-2">
                            <button
                              onClick={() => {
                                setSelectedExtensionSuspectId(workflow.suspectId);
                                setStep("suspectDetail");
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <User size={11} /> View suspect
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && msg.kind === "safe" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.32)" }}>
                        <CheckCircle size={10} className="text-green-400" />
                      </div>
                      <div className="max-w-[92%] border border-green-500/25" style={{ background: "rgba(34,197,94,0.07)" }}>
                        <div className="px-3 py-3 border-b border-green-500/15 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-green-300 flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" }}>
                            <CheckCircle size={22} />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-green-300" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                              TRUSTED PAGE SIGNALS
                            </div>
                            <p className="text-[10px] text-green-200/85 leading-relaxed mt-1" style={{ fontFamily: "var(--font-body)" }}>
                              No immediate danger indicators were found in the visible page context.
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-2 border-b border-green-500/15">
                          <p className="text-[11px] leading-relaxed text-green-100/90" style={{ fontFamily: "var(--font-body)" }}>
                            {msg.content}
                          </p>
                        </div>
                        <div className="px-3 py-2 space-y-1.5">
                          {workflow.indicators.map(ind => (
                            <div key={ind.label} className="flex items-start gap-2 text-[10px] text-foreground">
                              <span className="mt-0.5 px-1 py-0.5 text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/20"
                                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                                OK
                              </span>
                              <span>{ind.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-3 pb-3 text-[10px] text-green-300/90 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                          Recommended: {workflow.recommendations[0].toLowerCase()}.
                        </div>
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && msg.kind === "caution" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.32)" }}>
                        <AlertTriangle size={10} className="text-amber-400" />
                      </div>
                      <div className="max-w-[92%] border border-amber-500/25" style={{ background: "rgba(245,158,11,0.07)" }}>
                        <div className="px-3 py-3 border-b border-amber-500/15 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-amber-300 flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
                            <AlertTriangle size={22} />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-amber-300" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                              {activeWorkflow === "linkedin" ? "SUBMIT FOR AGENT CHECK" : "INSUFFICIENT EVIDENCE"}
                            </div>
                            <p className="text-[10px] text-amber-200/85 leading-relaxed mt-1" style={{ fontFamily: "var(--font-body)" }}>
                              {activeWorkflow === "linkedin" ? "Nothing clearly dangerous is visible, but the agent can verify and watch for related reports." : "Not enough to call this malicious, but the requested actions are risky."}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-2 border-b border-amber-500/15">
                          <p className="text-[11px] leading-relaxed text-amber-100/90" style={{ fontFamily: "var(--font-body)" }}>
                            {msg.content}
                          </p>
                        </div>
                        <div className="px-3 py-2 space-y-1.5">
                          {workflow.indicators.map(ind => (
                            <div key={ind.label} className="flex items-start gap-2 text-[10px] text-foreground">
                              <span className={`mt-0.5 px-1 py-0.5 text-[9px] font-bold ${ind.sev === "LOW" ? "bg-white/5 text-muted-foreground border border-border" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}
                                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                                {ind.sev}
                              </span>
                              <span>{ind.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-3 pb-3">
                          <div className="mb-2 text-[10px] text-amber-200/90 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                            Be careful: {workflow.recommendations[0].toLowerCase()}, and do not add credentials or personal files.
                          </div>
                          <button
                            onClick={submitCurrentWorkflowReport}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                          >
                            <Plus size={11} /> {activeWorkflow === "linkedin" ? "Submit report" : "Save for code review"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && msg.kind === "report" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.32)" }}>
                        <FileText size={10} className="text-green-400" />
                      </div>
                      <div className="max-w-[92%] border border-green-500/20" style={{ background: "rgba(34,197,94,0.06)" }}>
                        <div className="px-3 py-2 border-b border-green-500/15">
                          <div className="text-[10px] font-bold text-green-300 mb-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>REPORT STATUS</div>
                          <p className="text-[11px] leading-relaxed text-green-100/90" style={{ fontFamily: "var(--font-body)" }}>{msg.content}</p>
                        </div>
                        {workflow.status !== "trusted" && (
                          <div className="px-3 py-2 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setSelectedExtensionReportId(workflow.reportId);
                                setStep("reportDetail");
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <FileText size={11} /> Open report
                            </button>
                            <button
                              onClick={() => {
                                setSelectedExtensionSuspectId(workflow.suspectId);
                                setStep("suspectDetail");
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <User size={11} /> Open suspect
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.role === "user" && msg.kind === "text" && (
                    <div className="flex justify-end">
                      <div className="px-3 py-2 text-[11px] leading-relaxed text-amber-200 max-w-[85%]"
                        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", fontFamily: "var(--font-body)" }}>
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              {!confirmedIdentifier && (
                !selectedType ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      {IDENTIFIER_OPTIONS.map(opt => (
                        <button
                          key={opt.type}
                          onClick={() => selectType(opt)}
                          className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] text-left transition-all"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "var(--muted-foreground)",
                            fontFamily: "var(--font-body)",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        >
                          <span className="text-muted-foreground">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1">
                      <div className="text-[10px] text-muted-foreground mb-1.5" style={{ fontFamily: "var(--font-data)" }}>
                        Or you can...
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={runVoiceInput}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] text-left transition-all"
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.18)",
                            color: "var(--foreground)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          <Mic size={12} className="text-amber-400" />
                          Talk
                        </button>
                        <button
                          onClick={runScreenshotCheck}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] text-left transition-all"
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.18)",
                            color: "var(--foreground)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          <Camera size={12} className="text-amber-400" />
                          Check what's on the screen
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <input
                      ref={identifierInputRef}
                      value={valueInput}
                      onChange={e => setValueInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && submitIdentifier()}
                      placeholder={selectedType.placeholder}
                      className="flex-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border"
                      style={{ background: "rgba(255,255,255,0.04)", fontFamily: "var(--font-body)" }}
                    />
                    <button
                      onClick={submitIdentifier}
                      disabled={!valueInput.trim()}
                      className="px-3 py-2 text-xs font-medium disabled:opacity-30 transition-colors"
                      style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                    >
                      <Zap size={13} />
                    </button>
                  </div>
                )
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-3 py-3 border-t border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runPrompt(promptInput)}
                  placeholder="What do you want me to check?"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  style={{ fontFamily: "var(--font-body)" }}
                />
                <button
                  onClick={runVoiceInput}
                  aria-label="Talk"
                  title="Talk"
                  className="p-1.5 text-muted-foreground hover:text-foreground border border-border hover:bg-white/5 transition-colors"
                >
                  <Mic size={12} />
                </button>
                <button
                  onClick={runScreenshotCheck}
                  aria-label="Check what's on the screen"
                  title="Check what's on the screen"
                  className="p-1.5 text-muted-foreground hover:text-foreground border border-border hover:bg-white/5 transition-colors"
                >
                  <Camera size={12} />
                </button>
                <button
                  onClick={() => runPrompt(promptInput)}
                  disabled={!promptInput.trim()}
                  className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Scanning in-panel indicator */}
        {step === "scanning" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="text-amber-400 animate-spin" />
            <div className="text-sm text-amber-400" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>ANALYZING</div>
            <div className="text-[10px] text-muted-foreground text-center" style={{ fontFamily: "var(--font-data)" }}>
              Hashing identifier · Domain check<br />Matching against reports · Risk scoring
            </div>
          </div>
        )}

        {/* ── RESULTS PANEL ── */}
        {isResultStep && (
          <>
            {/* Immediate danger banner */}
            {step === "alert" && (
              <div className="px-4 py-3 border-b border-red-500/20 flex-shrink-0" style={{ background: "rgba(239,68,68,0.1)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldAlert size={14} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-red-400" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.1em" }}>IMMEDIATE DANGER DETECTED</span>
                </div>
                <p className="text-[11px] text-red-300/80 leading-relaxed">
                  This message requests a <strong className="text-red-300">$2,400 payment via Zelle</strong> before employment. This is a high-risk signal consistent with advance-fee fraud.
                </p>
              </div>
            )}

            {/* Score row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
              <ScoreGauge score={87} risk="RED" size={52} />
              <div>
                <RiskBadge level="RED" />
                <div className="text-[10px] text-muted-foreground mt-1.5" style={{ fontFamily: "var(--font-data)" }}>
                  14 corroborations · 94% match<br />Confidence: 88%
                </div>
              </div>
            </div>

            {/* Indicators + safe steps */}
            {(step === "alert" || step === "summary") && (
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="px-4 py-3 border-b border-border">
                  <SectionHeader>Risk Indicators</SectionHeader>
                  <div className="space-y-2">
                    {RESULT_INDICATORS.map((ind, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-[10px] font-bold px-1 py-0.5 flex-shrink-0 mt-0.5 ${ind.sev === "HIGH" ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}
                          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                          {ind.sev}
                        </span>
                        <span className="text-[11px] text-foreground">{ind.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <SectionHeader>Recommended Actions</SectionHeader>
                  <div className="space-y-1.5">
                    {SAFE_STEPS.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <CheckCircle size={11} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Q&A chat messages */}
            {step === "chat" && (
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ scrollbarWidth: "none" }}>
                {qaMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[88%] px-3 py-2 text-[11px] leading-relaxed"
                      style={{
                        background: msg.role === "user" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                        border: msg.role === "user" ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.07)",
                        fontFamily: "var(--font-body)",
                        color: msg.role === "user" ? "#fcd34d" : "var(--foreground)",
                      }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Bottom actions */}
            <div className="px-3 py-3 border-t border-border flex-shrink-0">
              {step !== "chat" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setStep("report")}
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition-colors"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                      <FileText size={12} /> REPORT
                    </button>
                    <button onClick={() => setStep("suspect")}
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition-colors"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                      <User size={12} /> SUSPECT
                    </button>
                  </div>
                  <button onClick={openQa}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.15)")}>
                    <MessageSquare size={12} /> ASK A QUESTION
                  </button>
                  {step === "alert" && (
                    <button onClick={() => setStep("summary")}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground border border-border hover:text-foreground transition-colors"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                      <Eye size={12} /> VIEW FULL SUMMARY
                    </button>
                  )}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>Helpful?</span>
                    <div className="flex gap-1.5">
                      <button className="p-1 text-muted-foreground hover:text-green-400 transition-colors"><ThumbsUp size={11} /></button>
                      <button className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><ThumbsDown size={11} /></button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input value={qaInput} onChange={e => setQaInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendQa()}
                    placeholder="Ask about this suspect…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    style={{ fontFamily: "var(--font-body)" }} />
                  <button onClick={sendQa} disabled={!qaInput.trim()}
                    className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30">
                    <Send size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-3 pb-2.5">
              <p className="text-[9px] text-muted-foreground leading-relaxed" style={{ fontFamily: "var(--font-data)" }}>
                Results are risk indicators, not accusations. ScamRadar does not publish or coordinate reports from user submissions.
              </p>
            </div>
          </>
        )}

        {/* ── EXTENSION REPORT LIST ── */}
        {step === "report" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
            <div className="flex items-center justify-between">
              <SectionHeader>Reports</SectionHeader>
              <Monospace className="text-muted-foreground">{REPORTS.length} submitted</Monospace>
            </div>
            {REPORTS.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedExtensionReportId(item.id);
                  setStep("reportDetail");
                }}
                className="w-full text-left p-3 border border-border hover:border-amber-500/30 hover:bg-white/5 transition-colors"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <Monospace className="text-foreground block">{item.id}</Monospace>
                    <Monospace className="text-muted-foreground break-all block mt-1">{item.reportedIdentifier}</Monospace>
                  </div>
                  <RiskBadge level={item.risk} size="sm" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{item.type}</span>
                  <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>{item.corroborationCount} matches</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── EXTENSION REPORT DETAIL ── */}
        {step === "reportDetail" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setStep("report")}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
            >
              <ArrowLeft size={11} /> BACK TO REPORTS
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionHeader>Report</SectionHeader>
                <Monospace className="text-foreground">{report.id}</Monospace>
              </div>
              <StatusPill status={report.status} />
            </div>
            <div className="p-3 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="text-[10px] text-muted-foreground mb-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>SUBMITTED IDENTIFIER</div>
              <Monospace className="text-foreground break-all">{report.reportedIdentifier}</Monospace>
            </div>
            <div className="flex items-center gap-3 p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.06)" }}>
              <ScoreGauge score={report.score} risk={report.risk} size={58} />
              <div>
                <RiskBadge level={report.risk} />
                <div className="text-[10px] text-muted-foreground mt-1.5" style={{ fontFamily: "var(--font-data)" }}>
                  {report.corroborationCount} matched submissions<br />Last activity: {report.lastActivity}
                </div>
              </div>
            </div>
            <div>
              <SectionHeader>Why It Was Accepted</SectionHeader>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The agent accepted this report because it contains enough concrete material: a suspicious identifier, message context, payment request, and off-platform migration.
              </p>
            </div>
            <div>
              <SectionHeader>Risk Indicators</SectionHeader>
              <div className="space-y-1.5">
                {report.indicators.map(ind => (
                  <div key={ind} className="flex items-start gap-2 text-[11px] text-foreground">
                    <AlertTriangle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    {ind}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EXTENSION SUSPECT LIST ── */}
        {step === "suspect" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
            <div className="flex items-center justify-between">
              <SectionHeader>Suspects</SectionHeader>
              <Monospace className="text-muted-foreground">{REPORTS.length} tracked</Monospace>
            </div>
            {REPORTS.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedExtensionSuspectId(item.id);
                  setStep("suspectDetail");
                }}
                className="w-full text-left p-3 border border-border hover:border-amber-500/30 hover:bg-white/5 transition-colors"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <Monospace className="text-foreground break-all block">{item.reportedIdentifier}</Monospace>
                    <span className="text-[10px] text-muted-foreground">{IDENTIFIER_TYPE_LABEL[item.reportedIdentifierType]}</span>
                  </div>
                  <span className={`text-lg font-bold ${RISK_CONFIG[item.risk].text}`} style={{ fontFamily: "var(--font-display)" }}>{item.score}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <RiskBadge level={item.risk} size="sm" />
                  <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>+{Math.max(item.corroborationCount - 1, 0)} other reports</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── EXTENSION SUSPECT DETAIL ── */}
        {step === "suspectDetail" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setStep("suspect")}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
            >
              <ArrowLeft size={11} /> BACK TO SUSPECTS
            </button>
            <div>
              <SectionHeader>Suspect</SectionHeader>
              <Monospace className="text-foreground break-all">{suspect.reportedIdentifier}</Monospace>
              <div className="text-[10px] text-muted-foreground mt-1">{IDENTIFIER_TYPE_LABEL[suspect.reportedIdentifierType]}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>{suspect.corroborationCount}</div>
                <div className="text-[10px] text-muted-foreground">matched reports</div>
              </div>
              <div className="p-3 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className={`text-xl font-bold ${RISK_CONFIG[suspect.risk].text}`} style={{ fontFamily: "var(--font-display)" }}>{suspect.score}</div>
                <div className="text-[10px] text-muted-foreground">risk score</div>
              </div>
            </div>
            <div>
              <SectionHeader>Connected Signals</SectionHeader>
              <div className="space-y-2">
                {[
                  "Uses non-Meta recruiting domain",
                  "Requests Zelle payment before onboarding",
                  "Moves conversation to WhatsApp",
                  "Shares message template with prior reports",
                ].map(signal => (
                  <div key={signal} className="px-3 py-2 border border-border text-[11px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.025)" }}>
                    {signal}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader>Linked Sessions</SectionHeader>
              <div className="space-y-2">
                {linkedSuspectSessions.map(({ key, snapshot }) => (
                  <button
                    key={key}
                    onClick={() => openLinkedSession(key)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-border text-left hover:border-amber-500/30 hover:bg-white/5 transition-colors"
                    style={{ background: "rgba(255,255,255,0.025)" }}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center text-amber-400 border border-amber-500/25 flex-shrink-0" style={{ background: "rgba(245,158,11,0.08)" }}>
                        {IDENTIFIER_OPTIONS.find(opt => opt.label === snapshot.confirmedIdentifier?.label)?.icon ?? <User size={12} />}
                      </div>
                      <div className="min-w-0">
                        <Monospace className="text-foreground break-all">{sessionDisplayName(snapshot)}</Monospace>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Open this session</div>
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
                {linkedSuspectSessions.length === 0 && (
                  <div className="px-3 py-2 border border-border text-[11px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.025)" }}>
                    No saved sessions are linked to this suspect yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [materialType, setMaterialType] = useState("conversation");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }}>
      <div className="w-full max-w-lg border border-border shadow-2xl" style={{ background: "var(--card)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Upload size={14} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>SUBMIT SUSPICIOUS MATERIAL</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="p-3 border border-amber-500/20" style={{ background: "rgba(245,158,11,0.06)" }}>
              <div className="flex items-start gap-2">
                <ShieldCheck size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-400/80 leading-relaxed">
                  Your submission is private by default. The agent will accept it if enough material is provided for analysis, or ask for more context if not.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>MATERIAL TYPE</label>
              <select
                value={materialType}
                onChange={e => setMaterialType(e.target.value)}
                className="w-full px-3 py-2 text-sm text-foreground border border-border outline-none appearance-none"
                style={{ background: "rgba(255,255,255,0.04)", fontFamily: "var(--font-body)" }}
              >
                <option value="conversation">Conversation Log</option>
                <option value="email">Email</option>
                <option value="screenshot">Screenshot Description</option>
                <option value="profile_url">Profile URL (LinkedIn, GitHub…)</option>
                <option value="domain">Domain or Email Address</option>
                <option value="wallet">Wallet / Payment Handle</option>
                <option value="repository">Repository or Script URL</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>PASTE CONTENT OR URL</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste conversation, email body, URL, identifier, or any suspicious content here…"
                rows={6}
                className="w-full px-3 py-2 text-sm text-foreground border border-border outline-none resize-none placeholder:text-muted-foreground"
                style={{ background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-body)" }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>NOTES — WHAT FELT SUSPICIOUS?</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe what seemed off — pressure tactics, unusual requests, mismatch between claimed identity and contact details, etc."
                rows={3}
                className="w-full px-3 py-2 text-sm text-foreground border border-border outline-none resize-none placeholder:text-muted-foreground"
                style={{ background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-body)" }}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-900 bg-amber-500 hover:bg-amber-400 transition-colors"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
              >
                <Zap size={13} />
                ANALYZE NOW
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border transition-colors"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
              >
                CANCEL
              </button>
              <button type="button" className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip size={14} />
              </button>
            </div>
          </form>
        ) : (
          <div className="px-5 py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <CheckCircle size={22} className="text-green-400" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>MATERIAL RECEIVED</h3>
            <p className="text-[11px] text-muted-foreground mb-1">Report SR-2024-0351 accepted. Real-time triage is running now.</p>
            <Monospace className="text-amber-400 mb-6">3 subagents scheduled · ETA 4–8 min</Monospace>
            <div className="w-full p-3 border border-border mb-5 text-left" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-start gap-2">
                <AlertCircle size={12} className="text-amber-500 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  No immediate danger indicators detected in initial scan. Full analysis pending. You will be notified when the risk assessment is complete.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="px-5 py-2 text-sm text-amber-900 bg-amber-500 hover:bg-amber-400 transition-colors" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
              VIEW DASHBOARD
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [, setReportsVersion] = useState(0);

  useEffect(() => {
    let mounted = true;

    loadAttioReports()
      .then((reports) => {
        if (!mounted) return;
        REPORTS = reports;
        setReportsVersion((version) => version + 1);
      })
      .catch((error) => {
        console.warn(error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleSelectReport(id: string) {
    setSelectedReportId(id);
    setView("report");
  }

  function handleSelectSuspect(id: string) {
    setSelectedSuspectId(id);
    setView("suspects");
  }

  function handleReportBack() {
    setSelectedReportId(null);
    setView("report");
  }

  function handleSuspectBack() {
    setSelectedSuspectId(null);
    setView("suspects");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar
        view={view}
        setView={v => {
          setSelectedReportId(null);
          setSelectedSuspectId(null);
          setView(v);
        }}
        onSubmit={() => setShowSubmit(true)}
      />

      <main className="flex-1 overflow-hidden">
        {view === "dashboard" && <DashboardView onSelectReport={handleSelectReport} />}
        {view === "report" && (
          selectedReportId
            ? <ReportDetailView reportId={selectedReportId} onBack={handleReportBack} onOpenSuspect={handleSelectSuspect} />
            : <ReportsTable reports={REPORTS} onSelect={handleSelectReport} />
        )}
        {view === "suspects" && (
          selectedSuspectId
            ? <SuspectDetailView suspectId={selectedSuspectId} onBack={handleSuspectBack} />
            : <SuspectsView onSelectSuspect={handleSelectSuspect} />
        )}
        {view === "extension" && <ExtensionView />}
      </main>

      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}
