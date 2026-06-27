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

type RiskLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED";
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
    risk: "ORANGE",
    score: 58,
    status: "INVESTIGATING",
    lastActivity: "2d ago",
    indicators: ["Off-platform payment", "Fake escrow service", "Urgency pressure"],
    summary: "Seller requesting Zelle/Venmo payment outside eBay buyer protection. Uses fake escrow site escrow-safe-pay.com to appear legitimate.",
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

function ReportDetailView({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const c = REPORTS.find(x => x.id === reportId) ?? REPORTS[0];
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
            REPORT SUMMARY
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
              <SectionHeader>Report Q&amp;A</SectionHeader>
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
              placeholder="Ask about this report…"
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

function SuspectsView() {
  const types = [
    { icon: <User size={14} />,      label: "Persons / Profiles", count: 23, color: "text-blue-400" },
    { icon: <Building2 size={14} />, label: "Organizations",      count: 8,  color: "text-purple-400" },
    { icon: <Globe size={14} />,     label: "Domains",            count: 31, color: "text-amber-400" },
    { icon: <Mail size={14} />,      label: "Email Addresses",    count: 47, color: "text-green-400" },
    { icon: <Wallet size={14} />,    label: "Wallet Addresses",   count: 12, color: "text-orange-400" },
    { icon: <Phone size={14} />,     label: "Phone Numbers",      count: 18, color: "text-red-400" },
    { icon: <GitBranch size={14} />, label: "Repositories",       count: 6,  color: "text-cyan-400" },
    { icon: <Terminal size={14} />,  label: "Scripts / Artifacts", count: 4, color: "text-pink-400" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>SUSPECTS</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">People, domains, wallets, repos, and identifiers extracted from your reports, with aggregate corroboration counts from other reporters.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
          <Search size={13} className="text-muted-foreground" />
          <input placeholder="Search suspects…" className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-44" style={{ fontFamily: "var(--font-body)" }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {types.map((t, i) => (
            <div key={i} className="px-4 py-4 border border-border hover:border-border/80 cursor-pointer transition-colors" style={{ background: "var(--card)" }}>
              <div className={`mb-2 ${t.color}`}>{t.icon}</div>
              <div className="text-2xl font-bold text-foreground mb-0.5" style={{ fontFamily: "var(--font-display)" }}>{t.count}</div>
              <div className="text-[11px] text-muted-foreground">{t.label}</div>
            </div>
          ))}
        </div>

        <div className="border border-border" style={{ background: "var(--card)" }}>
          <div className="px-5 py-3 border-b border-border">
            <SectionHeader>Recent Suspects</SectionHeader>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Identifier", "Type", "Reporters", "Risk", "Last Seen"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { identifier: "linkedin.com/in/alex-morgan-recruiter", type: "LinkedIn URL", reporters: 14, risk: "RED"    as RiskLevel, seen: "09:31" },
                { identifier: "techventuresdao.io",                    type: "Domain",       reporters: 8,  risk: "RED"    as RiskLevel, seen: "08:20" },
                { identifier: "alex.morgan@meta-careers.io",           type: "Email",        reporters: 9,  risk: "RED"    as RiskLevel, seen: "09:42" },
                { identifier: "0x7a3f…c82e",                           type: "Wallet",       reporters: 3,  risk: "RED"    as RiskLevel, seen: "07:44" },
                { identifier: "github.com/devhire-solutions",           type: "GitHub URL",   reporters: 3,  risk: "ORANGE" as RiskLevel, seen: "Yesterday" },
                { identifier: "sarah.chen@deloitte-consulting.net",     type: "Email",        reporters: 2,  risk: "YELLOW" as RiskLevel, seen: "3d ago" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-white/5 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5"><Monospace className="text-foreground/70">{row.identifier}</Monospace></td>
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{row.type}</td>
                  <td className="px-4 py-2.5"><Monospace className="text-muted-foreground">{row.reporters}</Monospace></td>
                  <td className="px-4 py-2.5"><RiskBadge level={row.risk} size="sm" /></td>
                  <td className="px-4 py-2.5"><Monospace className="text-muted-foreground">{row.seen}</Monospace></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Extension View ───────────────────────────────────────────────────────────

type ExtStep = "home" | "scanning" | "alert" | "summary" | "chat" | "report" | "reportDetail" | "suspect" | "suspectDetail";
type BotMsgKind = "text" | "confirm" | "warning";

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

type ExtensionSessionKey = "current" | "previous";

interface ExtensionSessionSnapshot {
  botMessages: BotMessage[];
  selectedType: typeof IDENTIFIER_OPTIONS[number] | null;
  confirmedIdentifier: { label: string; value: string } | null;
  valueInput: string;
  promptInput: string;
  createdAt: string;
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
    setBotMessages(prev => [
      ...prev,
      {
        role: "bot",
        kind: "warning",
        content: "High-risk indicators are present: the material includes an upfront payment/equipment request, an off-platform redirect, and similar prior reports. Pause before taking the requested action.",
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
    };
  }

  function applySessionSnapshot(snapshot: ExtensionSessionSnapshot) {
    setBotMessages(snapshot.botMessages);
    setSelectedType(snapshot.selectedType);
    setConfirmedIdentifier(snapshot.confirmedIdentifier);
    setValueInput(snapshot.valueInput);
    setPromptInput(snapshot.promptInput);
    setQaMessages([]);
  }

  function matchCurrentPageSuspect() {
    setSelectedExtensionSuspectId(REPORTS[0].id);
    setConfirmedIdentifier({ label: "LinkedIn Profile", value: "linkedin.com/in/alex-morgan-recruiter" });
  }

  function runPrompt(value: string) {
    const val = value.trim();
    if (!val) return;
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: val },
      { role: "bot",  kind: "confirm", content: "Got it. I’m checking the current page context, extracted identifiers, risky asks, and similar reports." },
    ]);
    setPromptInput("");
    setTimeout(appendInlineInvestigationResult, 650);
  }

  function runScreenshotCheck() {
    matchCurrentPageSuspect();
    setBotMessages(prev => [
      ...prev,
      { role: "user", kind: "text", content: "Check what's on the screen" },
      {
        role: "bot",
        kind: "confirm",
        content: "Captured the visible page and reading profile text, message content, URL, and visible DOM signals before checking risky asks and similar reports.",
      },
    ]);
    setPromptInput("");
    setTimeout(appendInlineInvestigationResult, 650);
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
              linkedin.com/in/alex-morgan-recruiter
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

      {/* Right panel — extension surface */}
      <div className="flex-shrink-0 flex flex-col border-l border-border overflow-hidden" style={{ width: 360, background: "#0f1219" }}>

        {/* Header */}
        <div className="border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={reset} className="flex items-center gap-2 text-left">
              <Radio size={13} className={isResultStep ? "text-red-400" : "text-amber-400"} />
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
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 border border-amber-500/25" style={{ background: "#17140d" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 flex items-center justify-center text-amber-400 border border-amber-500/25 flex-shrink-0" style={{ background: "rgba(245,158,11,0.08)" }}>
                      {confirmedIdentifierIcon}
                    </div>
                    <div className="min-w-0">
                    <div className="text-[9px] text-amber-400 font-medium mb-0.5" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>MATCHED SUSPECT</div>
                      <Monospace className="text-foreground break-all">{confirmedIdentifier.value}</Monospace>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedExtensionSuspectId(REPORTS[0].id);
                      setStep("suspectDetail");
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors flex-shrink-0"
                    style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                  >
                    <User size={10} /> Open
                  </button>
                </div>
              )}
              {botMessages.map((msg, i) => {
                const isConfirmPending = msg.kind === "confirm" && !botMessages.slice(i + 1).some(next => next.kind === "warning");
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
                              Do not pay, run code, share credentials, or move off-platform until independently verified.
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
                          {RESULT_INDICATORS.slice(1, 4).map(ind => (
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
                            Recommended: do not send money, do not run code, and verify through an official channel before continuing.
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setSelectedExtensionReportId(REPORTS[0].id);
                                setStep("reportDetail");
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-amber-300 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
                              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
                            >
                              <FileText size={11} /> View report
                            </button>
                            <button
                              onClick={() => {
                                setSelectedExtensionSuspectId(REPORTS[0].id);
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
  const [showSubmit, setShowSubmit] = useState(false);

  function handleSelectReport(id: string) {
    setSelectedReportId(id);
    setView("report");
  }

  function handleBack() {
    setSelectedReportId(null);
    setView("dashboard");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar
        view={view}
        setView={v => {
          if (v !== "report") setSelectedReportId(null);
          setView(v);
        }}
        onSubmit={() => setShowSubmit(true)}
      />

      <main className="flex-1 overflow-hidden">
        {view === "dashboard" && <DashboardView onSelectReport={handleSelectReport} />}
        {view === "report" && (
          selectedReportId
            ? <ReportDetailView reportId={selectedReportId} onBack={handleBack} />
            : <ReportsTable reports={REPORTS} onSelect={handleSelectReport} />
        )}
        {view === "suspects"  && <SuspectsView />}
        {view === "extension" && <ExtensionView />}
      </main>

      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}
