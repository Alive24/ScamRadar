import { useState, useRef, useEffect, type FormEvent, type ReactNode } from "react";
import {
  Shield, ShieldAlert, ShieldCheck,
  AlertTriangle, AlertCircle, Zap,
  Search, SlidersHorizontal,
  User, Users, Building2,
  Globe, Mail, Phone, Wallet,
  FileText, Clock,
  ChevronRight,
  MessageSquare, Send,
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
  reportedIdentifierType: "linkedin_url" | "email" | "domain" | "github_url" | "wallet" | "phone" | "ebay_handle";
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
};

const REPORTS: Report[] = [
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
    reportedIdentifier:     "github.com/devhire-solutions",
    reportedIdentifierType: "github_url",
    corroborationCount:     3,
    type: "Malicious Script",
    platform: "GitHub",
    risk: "ORANGE",
    score: 64,
    status: "TRIAGING",
    lastActivity: "1d ago",
    indicators: ["Account created 2 days ago", "Suspicious install script", "Remote payload execution"],
    summary: "GitHub account created 2 days ago. Submitted PR with install.sh that fetches and executes a remote payload from an unregistered domain.",
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

const ALERTS: Alert[] = [
  { id: 1, time: "09:42", severity: "CRITICAL", reportId: "SR-2024-0347", suspect: "linkedin.com/in/alex-morgan-recruiter", message: "Payment request detected: Zelle ($2,400). Do not send funds." },
  { id: 2, time: "09:38", severity: "CRITICAL", reportId: "SR-2024-0341", suspect: "techventuresdao.io",                    message: "Wallet address collection detected. Do not share crypto credentials." },
  { id: 3, time: "09:31", severity: "HIGH",     reportId: "SR-2024-0339", suspect: "github.com/devhire-solutions",          message: "Script execution request in submitted PR. Do not run code." },
  { id: 4, time: "08:55", severity: "MEDIUM",   reportId: "SR-2024-0347", suspect: "linkedin.com/in/alex-morgan-recruiter", message: "14 corroborating reports matched this suspect. Pattern confidence: 94%." },
  { id: 5, time: "08:12", severity: "MEDIUM",   reportId: "SR-2024-0335", suspect: "marketplace_seller_99",                 message: "Fake escrow pattern matches 6 prior reports for this suspect." },
  { id: 6, time: "07:44", severity: "HIGH",     reportId: "SR-2024-0341", suspect: "techventuresdao.io",                    message: "Associated wallet 0x7a3f…c82e flagged in 3 AML databases." },
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <SectionHeader>Alert Feed</SectionHeader>
          <LiveDot />
        </div>
        <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>{alerts.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border" style={{ scrollbarWidth: "none" }}>
        {alerts.map(alert => {
          const cfg = severityConfig[alert.severity];
          return (
            <button
              key={alert.id}
              onClick={() => onReportClick(alert.reportId)}
              className={`w-full text-left px-3 py-2.5 border-l-2 ${cfg.border} ${cfg.bg} transition-colors`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                  {cfg.icon}
                  <span className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>{alert.severity}</span>
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

  const stats = [
    { label: "My Reports",        value: REPORTS.length,        sub: "submissions you created",        color: "text-foreground",  icon: <Shield size={16} className="text-amber-400" /> },
    { label: "High Risk Signals", value: redCount,              sub: "require immediate action",        color: "text-red-400",     icon: <ShieldAlert size={16} className="text-red-400" /> },
    { label: "Accepted",          value: acceptedCount,         sub: "accepted by agent",               color: "text-green-400",   icon: <CheckCircle size={16} className="text-green-400" /> },
    { label: "Corroborations",    value: totalCorroborations,   sub: "independent reports (count only)", color: "text-purple-400",  icon: <Users size={16} className="text-purple-400" /> },
  ];

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

      {/* Privacy notice */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border flex-shrink-0" style={{ background: "rgba(99,102,241,0.06)" }}>
        <ShieldCheck size={13} className="text-indigo-400 flex-shrink-0" />
        <p className="text-[11px] text-indigo-300/70 leading-snug">
          <strong className="text-indigo-300">Private by default.</strong> You manage your own reports and the suspects you submitted. Raw submissions are stored securely on the server and never shared directly. When other reporters have flagged the same suspect, their materials are desensitized before being shared with you — and yours with them.
        </p>
      </div>

      {/* Content grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Alert feed */}
        <div className="w-72 border-r border-border overflow-hidden flex-shrink-0">
          <AlertFeed alerts={ALERTS} onReportClick={onSelectReport} />
        </div>
        {/* Reports table */}
        <div className="flex-1 overflow-hidden">
          <ReportsTable reports={REPORTS} onSelect={onSelectReport} />
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

type ExtStep = "chatbot" | "scanning" | "alert" | "summary" | "chat";
type BotMsgKind = "text" | "type_buttons" | "value_input" | "confirm" | "scanning";

interface BotMessage {
  role: "bot" | "user";
  kind: BotMsgKind;
  content: string;
  selectedType?: string;
}

const IDENTIFIER_OPTIONS = [
  { label: "LinkedIn Profile",  type: "linkedin_url",  icon: <User size={12} />,       placeholder: "linkedin.com/in/username or paste URL" },
  { label: "Email Address",     type: "email",         icon: <Mail size={12} />,       placeholder: "name@domain.com" },
  { label: "eBay Shop / Item",  type: "ebay_handle",   icon: <Package size={12} />,    placeholder: "eBay username or item URL" },
  { label: "GitHub Profile",    type: "github_url",    icon: <GitBranch size={12} />,  placeholder: "github.com/username or paste URL" },
  { label: "Wallet / Crypto",   type: "wallet",        icon: <Wallet size={12} />,     placeholder: "0x… or wallet address" },
  { label: "Domain / URL",      type: "domain",        icon: <Globe size={12} />,      placeholder: "example.com or full URL" },
  { label: "Phone Number",      type: "phone",         icon: <Phone size={12} />,      placeholder: "+1 (555) 000-0000" },
  { label: "Other / Describe",  type: "other",         icon: <FileText size={12} />,   placeholder: "Describe what seems suspicious…" },
];

const GREETING: BotMessage[] = [
  { role: "bot", kind: "text", content: "Hi! I'm ScamRadar. What would you like me to check?" },
  { role: "bot", kind: "type_buttons", content: "" },
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

function ExtensionView() {
  const [step, setStep] = useState<ExtStep>("chatbot");
  const [botMessages, setBotMessages] = useState<BotMessage[]>(GREETING);
  const [selectedType, setSelectedType] = useState<typeof IDENTIFIER_OPTIONS[number] | null>(null);
  const [valueInput, setValueInput] = useState("");
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [botMessages, qaMessages]);

  function selectType(opt: typeof IDENTIFIER_OPTIONS[number]) {
    setSelectedType(opt);
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: opt.label },
      { role: "bot",  kind: "text", content: `Got it. Paste the ${opt.label.toLowerCase()} you want me to analyze, or describe what happened.` },
      { role: "bot",  kind: "value_input", content: "" },
    ]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submitValue() {
    if (!valueInput.trim() || !selectedType) return;
    const val = valueInput.trim();
    setBotMessages(prev => [
      ...prev.filter(m => m.kind !== "value_input"),
      { role: "user", kind: "text", content: val },
      { role: "bot",  kind: "confirm", content: `Analyzing ${selectedType.label.toLowerCase()}: **${val}**` },
    ]);
    setValueInput("");
    setTimeout(() => {
      setStep("scanning");
      setTimeout(() => setStep("alert"), 1800);
    }, 600);
  }

  function reset() {
    setStep("chatbot");
    setBotMessages(GREETING);
    setSelectedType(null);
    setValueInput("");
    setQaMessages([]);
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

  const isResultStep = step === "alert" || step === "summary" || step === "chat";

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
              {selectedType ? `Checking: ${valueInput || selectedType.type}` : "linkedin.com/in/alex-morgan-recruiter"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 flex items-center justify-center rounded-sm relative"
              style={{ background: isResultStep ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)", border: isResultStep ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(245,158,11,0.3)" }}>
              <Radio size={13} className={isResultStep ? "text-red-400" : "text-amber-400"} />
              {isResultStep && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>!</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Fake LinkedIn page */}
        <div className="p-8 max-w-2xl mx-auto mt-4">
          <div className="p-5 rounded-lg mb-4" style={{ background: "#1e2435", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 border-2 border-blue-500/20">
                <User size={28} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-white/90 mb-0.5" style={{ fontFamily: "var(--font-body)" }}>Alex Morgan</div>
                <div className="text-sm text-white/50 mb-1">Senior Technical Recruiter at Meta</div>
                <div className="text-xs text-white/35" style={{ fontFamily: "var(--font-data)" }}>San Francisco Bay Area · 312 connections</div>
              </div>
              <button className="px-4 py-1.5 rounded-full text-xs font-medium" style={{ background: "#0a66c2", color: "#fff" }}>Connect</button>
            </div>
            <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="text-xs text-white/40 mb-2">Recent message:</div>
              <div className="text-sm text-white/70 leading-relaxed p-3 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                "Hi! I came across your profile and think you'd be a great fit for a remote senior engineer role at Meta. The compensation is $8,000/week. To get started with onboarding, we'll need you to purchase your equipment upfront ($2,400 via Zelle) and we'll reimburse on your first paycheck. Let's move to WhatsApp to discuss further: +1 (415) 555-0182"
              </div>
            </div>
          </div>
          {step === "scanning" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 size={22} className="text-amber-400 animate-spin" />
              <div className="text-sm text-amber-400" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>ANALYZING…</div>
              <div className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>Extracting suspects · Checking domain · Searching similar reports</div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — always visible, switches between chatbot and results */}
      <div className="flex-shrink-0 flex flex-col border-l border-border overflow-hidden" style={{ width: 340, background: "#0f1219" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Radio size={13} className={isResultStep ? "text-red-400" : "text-amber-400"} />
            <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>SCAMRADAR</span>
          </div>
          {isResultStep
            ? <div className="flex items-center gap-1.5">
                <Monospace className="text-muted-foreground text-[10px]">SR-2024-0347</Monospace>
                <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors ml-1"><X size={13} /></button>
              </div>
            : <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>Browser extension</span>
          }
        </div>

        {/* ── CHATBOT INIT PANEL ── */}
        {!isResultStep && step !== "scanning" && (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
              {botMessages.map((msg, i) => (
                <div key={i}>
                  {/* Bot text bubble */}
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
                  {/* Confirm bubble */}
                  {msg.role === "bot" && msg.kind === "confirm" && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <Radio size={9} className="text-amber-400" />
                      </div>
                      <div className="px-3 py-2 text-[11px] leading-relaxed max-w-[85%]"
                        style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "var(--font-body)" }}>
                        <Loader2 size={10} className="text-amber-400 animate-spin inline mr-1.5" />
                        <span className="text-amber-300">{msg.content}</span>
                      </div>
                    </div>
                  )}
                  {/* User text bubble */}
                  {msg.role === "user" && msg.kind === "text" && (
                    <div className="flex justify-end">
                      <div className="px-3 py-2 text-[11px] leading-relaxed text-amber-200 max-w-[85%]"
                        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", fontFamily: "var(--font-body)" }}>
                        {msg.content}
                      </div>
                    </div>
                  )}
                  {/* Type selector buttons */}
                  {msg.role === "bot" && msg.kind === "type_buttons" && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {IDENTIFIER_OPTIONS.map(opt => (
                        <button
                          key={opt.type}
                          onClick={() => selectType(opt)}
                          disabled={!!selectedType}
                          className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] text-left transition-all disabled:opacity-40 disabled:cursor-default"
                          style={{
                            background: selectedType?.type === opt.type ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                            border: selectedType?.type === opt.type ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.08)",
                            color: selectedType?.type === opt.type ? "#f59e0b" : "var(--muted-foreground)",
                            fontFamily: "var(--font-body)",
                          }}
                          onMouseEnter={e => { if (!selectedType) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={e => { if (!selectedType) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                        >
                          <span className={selectedType?.type === opt.type ? "text-amber-400" : "text-muted-foreground"}>{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Value input inline */}
                  {msg.role === "bot" && msg.kind === "value_input" && selectedType && (
                    <div className="flex gap-2 mt-1 ml-7">
                      <input
                        ref={inputRef}
                        value={valueInput}
                        onChange={e => setValueInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && submitValue()}
                        placeholder={selectedType.placeholder}
                        className="flex-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border"
                        style={{ background: "rgba(255,255,255,0.04)", fontFamily: "var(--font-body)" }}
                      />
                      <button
                        onClick={submitValue}
                        disabled={!valueInput.trim()}
                        className="px-3 py-2 text-xs font-medium disabled:opacity-30 transition-colors"
                        style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                      >
                        <Zap size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="px-3 pb-3 border-t border-border pt-2.5 flex-shrink-0">
              <p className="text-[9px] text-muted-foreground leading-relaxed" style={{ fontFamily: "var(--font-data)" }}>
                Your submission is private by default. Raw data stays on the server — shared only after desensitization.
              </p>
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
