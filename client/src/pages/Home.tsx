/**
 * Home Screen — Design Hub
 * Ref: home_macbook_2.png, Frame 67
 * Three-level bg: --dh-bg (page) → --dh-surface (section board) → --dh-surface-card (inner cards)
 * Hero cards: draggable, centered relative to viewport center, all 4 functional
 * Agent autocomplete: z-index 9999 so it floats above everything
 * Job cards: Apply button replaces badge on hover (not bottom overlay), date always visible
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Portfolio, Blog, Idea, ArrowRight, Checkmark,
  Add, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SendFilled,
  Bookmark, BookmarkFilled, Renew, Close
} from "@carbon/icons-react";
import { Sparkles } from "lucide-react";
import NavRail from "@/components/NavRail";
import TodoWidget from "@/components/TodoWidget";
import { useTldrStore, formatArticleTime, type TldrArticle } from "@/lib/tldrStore";
import { useInspoStore } from "@/lib/inspoStore";
import { useJobWatchStore } from "@/lib/jobWatchStore";
import { useJobStore, type LiveJob } from "@/lib/jobStore";
import { companyLogoUrl } from "@/lib/companyLogo";

// Enter/exit + layout-reflow curve — matches the removal animation these
// cards already used, see .claude/skills/motion/SKILL.md.
const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// Custom cursor for empty hero-canvas space — a lime plus inviting a click
// to spawn a recommendation card. #E1FF00 must stay in sync with --dh-accent
// (a CSS var can't be referenced inside a data-URI).
const PLUS_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <rect x="13" y="5" width="2" height="18" rx="1" fill="#E1FF00"/>
  <rect x="5" y="13" width="18" height="2" rx="1" fill="#E1FF00"/>
</svg>`;
const PLUS_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PLUS_CURSOR_SVG)}") 14 14, auto`;

// ── Agent autocomplete — phrase-completion bank ──────────────────────────────
// Each entry is a full prompt. Suggestions are filtered to those that START
// with (or contain) what the user has typed, so they feel like completions.
const SUGGESTION_BANK = [
  "Design a landing page for a SaaS product",
  "Design a dashboard for a fintech app",
  "Design a mobile onboarding flow",
  "Design a dark mode component library",
  "Create a color palette for a fintech brand",
  "Create a moodboard for a luxury fashion brand",
  "Create a type system for editorial design",
  "Create a motion language for a product",
  "Brainstorm navigation patterns for mobile apps",
  "Brainstorm names for a new design tool",
  "Brainstorm ways to improve user retention",
  "Find inspiration for dark mode UI components",
  "Find references for brutalist web design",
  "Find typography pairings for a tech brand",
  "Summarize the latest design trends for 2025",
  "Summarize this week's design news",
  "Suggest typography pairings for editorial design",
  "Suggest a visual direction for my project",
  "Research competitor apps in the health space",
  "Research design systems used by top tech companies",
  "Generate a moodboard for a luxury fashion brand",
  "Generate icon ideas for a productivity app",
];

// ── Job data ─────────────────────────────────────────────────────────────────
// Live postings pulled from each watch-listed company's real public job
// board (server/jobsFeed.ts via useJobStore) — no mock data. badgeType is
// derived, not stored — see getJobBadgeType below:
//   "new"    = posted < 8h ago
//   "urgent" = deadline < 24h from now (real postings have no deadline, so
//              this only ever applies if dueAt happens to be set)
//   null     = no badge (most jobs)
const JOB_HOUR = 60 * 60 * 1000;
const JOB_DAY = 24 * JOB_HOUR;
const JOB_NOW = Date.now();

interface JobData extends LiveJob {
  dueAt?: number;
  logo: string;
}

// getJobBadgeType/isJobExpired only need timing fields — this lets them
// take a plain LiveJob (before a logo has been attached) or a full JobData.
interface JobTiming {
  postedAt: number;
  dueAt?: number;
}

function formatPostedAgo(postedAt: number): string {
  const diff = JOB_NOW - postedAt;
  if (diff < JOB_HOUR) return `${Math.max(1, Math.round(diff / (60 * 1000)))}m ago`;
  if (diff < JOB_DAY) return `${Math.round(diff / JOB_HOUR)}h ago`;
  return `${Math.round(diff / JOB_DAY)}d ago`;
}

function formatDue(dueAt: number): string {
  return `Due ${new Date(dueAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

// Jobs per page (2 columns x 2 rows) — left/right arrows page through the rest.
const JOB_PAGE_SIZE = 4;

type JobBadgeType = "new" | "urgent" | null;

function getJobBadgeType(job: JobTiming): JobBadgeType {
  if (JOB_NOW - job.postedAt < 8 * JOB_HOUR) return "new";
  if (job.dueAt !== undefined && job.dueAt - JOB_NOW < 24 * JOB_HOUR) return "urgent";
  return null;
}

// A role stops being worth showing once its deadline has passed (if it even
// has one — real postings don't), or a month after it was posted (whichever
// comes first) even if the deadline is later.
function isJobExpired(job: JobTiming): boolean {
  if (job.dueAt !== undefined && job.dueAt < JOB_NOW) return true;
  return JOB_NOW - job.postedAt > 30 * JOB_DAY;
}

// Newest jobs first, then urgent ones, then everything else — each group
// internally sorted so the most-newest/most-urgent leads within its group.
function sortJobsForDisplay(list: JobData[]): JobData[] {
  const tagged = list.map(job => ({ job, badge: getJobBadgeType(job) }));
  const newest = tagged.filter(t => t.badge === "new").sort((a, b) => b.job.postedAt - a.job.postedAt);
  const urgent = tagged.filter(t => t.badge === "urgent").sort((a, b) => (a.job.dueAt ?? 0) - (b.job.dueAt ?? 0));
  const rest = tagged.filter(t => t.badge === null).sort((a, b) => b.job.postedAt - a.job.postedAt);
  return [...newest, ...urgent, ...rest].map(t => t.job);
}

// ── Hero Inspo Cards (draggable, positioned relative to hero center) ─────────
interface HeroCard {
  id: number;
  offsetX: number; // px from center (negative = left, positive = right)
  offsetY: number; // px from center
  rotate: number;
  loading?: boolean; // true only for a freshly spawned card still "loading"
  text: string; // "" while loading
  sub: string;
  url: string;
}

const HERO_CARDS: HeroCard[] = [
  {
    id: 1, offsetX: -430, offsetY: -100, rotate: -3,
    text: '"Design is not just what it looks like — it\'s how it works."',
    sub: "— Steve Jobs",
    url: "https://en.wikipedia.org/wiki/Steve_Jobs",
  },
  {
    id: 2, offsetX: 310, offsetY: -110, rotate: 2,
    text: "📖 The Design of Everyday Things",
    sub: "Don Norman · Recommended read",
    url: "https://www.goodreads.com/book/show/840.The_Design_of_Everyday_Things",
  },
  {
    id: 3, offsetX: -450, offsetY: 100, rotate: 2,
    text: "🎵 Lo-fi Beats for Focus",
    sub: "Listening now",
    url: "https://open.spotify.com",
  },
  {
    id: 4, offsetX: 320, offsetY: 90, rotate: -2,
    text: "🎬 Dieter Rams documentary",
    sub: "Watch on Apple TV+",
    url: "https://tv.apple.com",
  },
];

// Mock content pool for spawned cards — deliberately distinct from
// HERO_CARDS so a fresh spawn doesn't just duplicate what's already visible.
const RECOMMENDATION_POOL: Pick<HeroCard, "text" | "sub" | "url">[] = [
  {
    text: '"Simplicity is the ultimate sophistication."',
    sub: "— Leonardo da Vinci",
    url: "https://en.wikipedia.org/wiki/Leonardo_da_Vinci",
  },
  {
    text: "📖 Thinking, Fast and Slow",
    sub: "Daniel Kahneman · Recommended read",
    url: "https://www.goodreads.com/book/show/11468377",
  },
  {
    text: "🎵 Boards of Canada — Music Has the Right to Children",
    sub: "Listening now",
    url: "https://open.spotify.com",
  },
  {
    text: "🎬 Helvetica (2007)",
    sub: "Watch on Kanopy",
    url: "https://www.kanopy.com",
  },
  {
    text: "🎙️ Design Details Podcast",
    sub: "New episode this week",
    url: "https://spec.fm/podcasts/design-details",
  },
  {
    text: '"Good design is as little design as possible."',
    sub: "— Dieter Rams",
    url: "https://en.wikipedia.org/wiki/Dieter_Rams",
  },
];

function DraggableHeroCard({ card, spawned, onDismiss }: {
  card: HeroCard;
  spawned?: boolean;
  onDismiss?: (id: number) => void;
}) {
  const [drag, setDrag] = useState({ x: card.offsetX, y: card.offsetY });
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startDrag = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const [elevated, setElevated] = useState(false);
  const [hovered, setHovered] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    didDrag.current = false;
    setElevated(true);
    startMouse.current = { x: e.clientX, y: e.clientY };
    startDrag.current = { ...drag };
    e.preventDefault();
  }, [drag]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setDrag({ x: startDrag.current.x + dx, y: startDrag.current.y + dy });
    };
    const onUp = () => { dragging.current = false; setElevated(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleClick = () => {
    if (!didDrag.current && !card.loading) window.open(card.url, "_blank");
  };

  return (
    <div style={{
      position: "absolute",
      // Center the card relative to the hero center point
      left: "50%",
      top: "50%",
      transform: `translate(calc(-50% + ${drag.x}px), calc(-50% + ${drag.y}px)) rotate(${card.rotate}deg)`,
      zIndex: elevated ? 10 : 2,
    }}>
      <motion.div
        onMouseDown={onMouseDown}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        initial={spawned ? { opacity: 0, scale: 0.5 } : false}
        animate={{ opacity: 1, scale: 1 }}
        exit={spawned ? { opacity: 0, scale: 0.55 } : undefined}
        transition={{ duration: 0.28, ease: EASE_OUT }}
        style={{
          position: "relative",
          background: "var(--dh-surface)",
          borderRadius: 12,
          padding: "12px 14px",
          width: 190,
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          transition: dragging.current ? "none" : "box-shadow 150ms",
        }}
      >
        <AnimatePresence initial={false}>
          {card.loading ? (
            <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: EASE_OUT }}>
              <div className="dh-shimmer" style={{ width: "100%", height: 12 }} />
              <div className="dh-shimmer" style={{ width: "65%", height: 12, marginTop: 6 }} />
              <div className="dh-shimmer" style={{ width: "45%", height: 8, marginTop: 10 }} />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: EASE_OUT }}>
              <div style={{ fontSize: 12, color: "var(--dh-text-secondary)", lineHeight: 1.55 }}>{card.text}</div>
              {card.sub && <div style={{ fontSize: 10, color: "var(--dh-text-muted)", marginTop: 4 }}>{card.sub}</div>}
            </motion.div>
          )}
        </AnimatePresence>

        {onDismiss && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDismiss(card.id); }}
            style={{
              position: "absolute", top: 6, right: 6,
              width: 20, height: 20, borderRadius: "50%",
              background: "transparent", border: "none", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--dh-text-muted)",
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? "auto" : "none",
              transition: "opacity 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
          >
            <Close size={14} />
          </button>
        )}
      </motion.div>
    </div>
  );
}

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ card, onApply }: {
  card: JobData;
  onApply: (id: number) => void;
}) {
  const badgeType = getJobBadgeType(card);
  const [hovered, setHovered] = useState(false);
  const [applied, setApplied] = useState(false);
  const [appliedPop, setAppliedPop] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    setApplied(true);
  };

  useEffect(() => {
    if (!applied) return;
    // Pop the "Applied" confirmation in first so the state change reads
    // clearly, then hold briefly before the card shrink-fades out.
    const popFrame = requestAnimationFrame(() => setAppliedPop(true));
    const shrinkTimer = setTimeout(() => setRemoving(true), 320);
    const removeTimer = setTimeout(() => onApply(card.id), 700);
    return () => {
      cancelAnimationFrame(popFrame);
      clearTimeout(shrinkTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  // The badge or apply button shown top-right
  const topRight = () => {
    if (applied) {
      return (
        <span
          style={{
            background: "var(--dh-accent)",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: "#1A1A1A",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "'Figtree', sans-serif",
            flexShrink: 0,
            transform: appliedPop ? "scale(1)" : "scale(0.6)",
            opacity: appliedPop ? 1 : 0,
            transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1), opacity 180ms",
          }}
        >
          Applied <Checkmark size={12} />
        </span>
      );
    }
    if (hovered) {
      return (
        <button
          onClick={handleApply}
          style={{
            background: "var(--dh-accent)",
            border: "none",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: "#1A1A1A",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "'Figtree', sans-serif",
            transition: "opacity 150ms",
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Apply <Checkmark size={12} />
        </button>
      );
    }
    if (badgeType === "new") return (
      <span style={{ background: "var(--dh-accent)", color: "#1A1A1A", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>NEW!</span>
    );
    if (badgeType === "urgent") return (
      <span style={{ background: "#FF3B30", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>URGENT</span>
    );
    return null;
  };

  return (
    <motion.div
      layout
      animate={{ scale: removing ? 0.82 : 1, opacity: removing ? 0 : 1 }}
      transition={{ duration: 0.38, ease: EASE_OUT }}
      style={{
        // Third bg level: --dh-surface-card inside the --dh-surface section board
        background: hovered ? "var(--dh-surface-raised)" : "var(--dh-surface-card)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
        transition: "background 350ms var(--ease-out)",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(card.url, "_blank")}
    >
      {/* Top row: logo + company/role (horizontal) ...... badge/apply */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--dh-surface-input)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <img
              src={card.logo}
              alt={card.company}
              style={{ width: 22, height: 22, objectFit: "contain" }}
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLImageElement).parentElement!;
                parent.innerHTML = `<span style="font-size:14px;font-weight:700;color:var(--dh-text-muted)">${card.company[0]}</span>`;
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.08em", marginBottom: 3, textTransform: "uppercase" }}>
              {card.company}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--dh-text-primary)", lineHeight: 1.3 }}>
              {card.role}
            </div>
          </div>
        </div>
        {topRight()}
      </div>

      {/* Date row — always visible. Live postings have no deadline, so the
          due date only shows up when one happens to be set; the work
          format (Remote/Hybrid/In-person) always shows regardless. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace", display: "flex", alignItems: "center", gap: 5 }}>
          {card.dueAt !== undefined && (
            <>
              {formatDue(card.dueAt)}
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--dh-text-muted)", flexShrink: 0 }} />
            </>
          )}
          {card.workplaceType}
        </span>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace" }}>{formatPostedAgo(card.postedAt)}</span>
      </div>
    </motion.div>
  );
}

// ── TLDR Card ────────────────────────────────────────────────────────────────
function TldrCard({ card, onMarkRead }: {
  card: TldrArticle;
  onMarkRead: (id: number) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleMarkRead = () => {
    setRemoving(true);
    setTimeout(() => onMarkRead(card.id), 380);
  };

  return (
    <motion.div
      layout
      animate={{ scale: removing ? 0.82 : 1, opacity: removing ? 0 : 1 }}
      transition={{ duration: 0.38, ease: EASE_OUT }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--dh-surface-card)",
        borderRadius: 12,
        padding: "22px",
        display: "flex",
        flexDirection: "column",
        breakInside: "avoid",
        marginBottom: 10,
        overflow: "hidden",
      }}>
      {/* Title + bookmark — one flex line, title wraps, icon stays put */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 18, fontWeight: 600, color: "var(--dh-text-primary)",
            lineHeight: 1.35,
            textDecoration: "underline",
            textDecorationColor: "rgba(255,255,255,0.5)",
            textUnderlineOffset: 3,
            flex: 1,
            minWidth: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.textDecorationColor = "var(--dh-accent)")}
          onMouseLeave={e => (e.currentTarget.style.textDecorationColor = "rgba(255,255,255,0.5)")}
        >
          {card.title}
        </a>
        <button
          onClick={() => setSaved(v => !v)}
          style={{ background: "transparent", border: "none", color: saved ? "var(--dh-accent)" : "var(--dh-text-muted)", padding: 2, flexShrink: 0 }}
        >
          {saved ? <BookmarkFilled size={22} /> : <Bookmark size={22} />}
        </button>
      </div>

      {card.blurb && (
        <div style={{ fontSize: 14, color: "var(--dh-text-secondary)", lineHeight: 1.7, marginBottom: 22 }}>
          {card.blurb}
        </div>
      )}

      {/* What you need to know */}
      {card.need && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.07em", marginBottom: 8, textTransform: "uppercase", fontFamily: "'Fira Mono', monospace" }}>
            What you need to know
          </div>
          <div style={{ fontSize: 12, color: "var(--dh-text-secondary)", lineHeight: 1.7 }}>{card.need}</div>
        </div>
      )}

      {/* What it means to you */}
      {card.means && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.07em", marginBottom: 8, textTransform: "uppercase", fontFamily: "'Fira Mono', monospace" }}>
            What it means to you
          </div>
          <div style={{ fontSize: 12, color: "var(--dh-text-secondary)", lineHeight: 1.7 }}>{card.means}</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)" }}>{formatArticleTime(card.publishedAt)}</span>
        <button
          onClick={handleMarkRead}
          style={{
            background: "var(--dh-accent)", color: "#1A1A1A",
            border: "none", borderRadius: 6, padding: "5px 14px",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 5,
            fontFamily: "'Figtree', sans-serif",
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? "auto" : "none",
            transition: "opacity 150ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = hovered ? "1" : "0")}
        >
          Read <Checkmark size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Section Board ─────────────────────────────────────────────────────────────
function SectionBoard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="canvas-grid"
      style={{
        borderRadius: 16,
        padding: "22px",
        background: "var(--dh-surface)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon, label, action, onAction, onRefresh, refreshing
}: {
  icon: React.ElementType; label: string; action?: string; onAction?: () => void;
  onRefresh?: () => void; refreshing?: boolean;
}) {
  const isRefresh = action === "refresh";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Icon size={18} color="#FBFBFB" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dh-text-primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh"
            style={{
              background: "var(--dh-surface-input)",
              borderRadius: 8, padding: "5px 7px",
              color: "var(--dh-text-secondary)", display: "flex",
              border: "none",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface-input)"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
          >
            <Renew size={13} className={refreshing ? "dh-spin" : undefined} />
          </button>
        )}
        {action && (
          <button
            onClick={onAction}
            style={{
              background: "var(--dh-surface-input)",
              borderRadius: 8, padding: "5px 12px", fontSize: 12,
              color: "var(--dh-text-secondary)", display: "flex", alignItems: "center", gap: 6,
              border: "none",
              transition: "background 150ms, color 150ms",
              fontFamily: "'Figtree', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface-input)"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
          >
            {isRefresh ? "Refresh" : action}
            {isRefresh && <Renew size={13} className={refreshing ? "dh-spin" : undefined} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const [time, setTime] = useState("");
  const [tldrExpanded, setTldrExpanded] = useState(false);
  const { unread: tldrUnread, markAsRead: markTldrRead, refreshFeed: refreshTldrFeed, feedLoading: tldrLoading } = useTldrStore();
  const {
    items: inspoItems, loading: inspoLoading, loadingMore: inspoLoadingMore,
    reachedEnd: inspoReachedEnd, reshuffle: reshuffleInspo, loadMore: loadMoreInspo,
  } = useInspoStore();
  const { companies: watchedCompanies, mustTags, relevantTags } = useJobWatchStore();
  const {
    jobs: liveJobs, recommendedJobs: liveRecommendedJobs,
    loading: jobsLoading, refresh: refreshJobs,
  } = useJobStore(watchedCompanies, mustTags, relevantTags);
  const [jobPage, setJobPage] = useState(0);
  // "Applied" is a session-local dismissal, not a persisted job-board
  // action — the live jobs themselves come from useJobStore, not local state.
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<number>>(new Set());
  const toJobData = (j: LiveJob): JobData => ({ ...j, logo: companyLogoUrl(j.company) });
  const jobs = liveJobs.filter(j => !dismissedJobIds.has(j.id) && !isJobExpired(j)).map(toJobData);
  const recommendedJobs = liveRecommendedJobs.filter(j => !dismissedJobIds.has(j.id) && !isJobExpired(j)).map(toJobData);

  // Spawned hero recommendation cards — ephemeral, resets on reload
  const [spawnedCards, setSpawnedCards] = useState<HeroCard[]>([]);
  const nextSpawnId = useRef(1000); // clear of the static ids 1-4

  // Agent autocomplete
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, "0");
      const s = now.getSeconds().toString().padStart(2, "0");
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m}:${s} ${ampm}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lower = trimmed.toLowerCase();
    // Priority 1: completions that start with what the user typed
    const startsWith = SUGGESTION_BANK.filter(s => s.toLowerCase().startsWith(lower));
    // Priority 2: completions that contain the typed text anywhere
    const contains = SUGGESTION_BANK.filter(s =>
      !s.toLowerCase().startsWith(lower) && s.toLowerCase().includes(lower)
    );
    const combined = [...startsWith, ...contains].slice(0, 5);
    setSuggestions(combined.length > 0 ? combined : []);
    setShowSuggestions(combined.length > 0);
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRefreshInspo = () => {
    reshuffleInspo();
  };

  // Infinite scroll within the bounded Design Inspos grid — near the bottom
  // of its own scroll container (not the page), pull in the next batch.
  const handleInspoScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      loadMoreInspo();
    }
  };

  const handleApplyJob = (id: number) => {
    setTimeout(() => setDismissedJobIds(prev => new Set(prev).add(id)), 50);
    toast("Application saved!");
  };

  // Paging through not-yet-archived (i.e. still-open, not-applied, not-expired) jobs.
  const jobTotalPages = Math.max(1, Math.ceil(jobs.length / JOB_PAGE_SIZE));
  const currentJobPage = Math.min(jobPage, jobTotalPages - 1);
  const handlePrevJobPage = () => setJobPage(p => Math.max(0, p - 1));
  const handleNextJobPage = () => setJobPage(p => Math.min(jobTotalPages - 1, p + 1));

  // Pulls live postings from each watch-listed company's real job board
  // (server/jobsFeed.ts), filtered/ranked by the watch list's tags.
  const handleRefreshJobs = async () => {
    const ok = await refreshJobs();
    toast(ok ? "Job feed refreshed" : "Couldn't reach the job feed — showing last loaded postings");
  };

  // TLDR pulls the real TLDR Design newsletter RSS feed (tldr.tech/design).
  const handleRefreshTldr = async () => {
    const ok = await refreshTldrFeed();
    toast(ok ? "TLDR feed refreshed" : "Couldn't reach the TLDR feed — showing last loaded articles");
  };

  // Spawn a new recommendation card at the click point. Attached to
  // onMouseDown (not onClick) — a click's target resolves to the nearest
  // common ancestor of the mousedown/mouseup targets, so dragging a hero
  // card and releasing over bare canvas would otherwise spuriously spawn
  // a card too. mousedown's target has no such ambiguity.
  const handleHeroMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (spawnedCards.length >= 16) {
      toast("Canvas is full — dismiss a card to add more");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    const id = nextSpawnId.current++;
    setSpawnedCards(prev => [...prev, {
      id, offsetX, offsetY, rotate: Math.random() * 5 - 3,
      loading: true, text: "", sub: "", url: "",
    }]);
    setTimeout(() => {
      const picked = RECOMMENDATION_POOL[Math.floor(Math.random() * RECOMMENDATION_POOL.length)];
      setSpawnedCards(prev => prev.map(c => (c.id === id ? { ...c, loading: false, ...picked } : c)));
    }, 1100);
  };

  const handleDismissSpawned = (id: number) => {
    setSpawnedCards(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />
      <TodoWidget />

      {/* Main content — reserves a gutter for NavRail */}
      <div style={{ marginLeft: 72, flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* ── Hero Zone ── */}
        <section
          className="dot-grid"
          onMouseDown={handleHeroMouseDown}
          style={{
            position: "relative",
            minHeight: 520,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px 80px",
            overflow: "visible",
            cursor: PLUS_CURSOR,
          }}
        >
          {/* Draggable inspo cards — all 4, centered via transform */}
          {HERO_CARDS.map(card => (
            <DraggableHeroCard key={card.id} card={card} />
          ))}

          {/* Spawned recommendation cards — click empty canvas to add one */}
          <AnimatePresence>
            {spawnedCards.map(card => (
              <DraggableHeroCard key={card.id} card={card} spawned onDismiss={handleDismissSpawned} />
            ))}
          </AnimatePresence>

          {/* Center content */}
          <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 560, cursor: "default" }}>
            <div style={{
              fontFamily: "'Fira Mono', monospace",
              fontSize: 12,
              color: "var(--dh-text-muted)",
              marginBottom: 14,
              letterSpacing: "0.05em",
            }}>
              {time} | Santa Monica
            </div>

            {/* Single-line title — font size scales down to fit */}
            <h1 style={{
              fontFamily: "'Figtree', sans-serif",
              fontSize: "clamp(36px, 5.5vw, 72px)",
              fontWeight: 400,
              color: "var(--dh-text-primary)",
              lineHeight: 1.05,
              margin: "0 0 10px",
              whiteSpace: "nowrap",
            }}>
              Welcome back, Jen
            </h1>

            <p style={{
              fontSize: 16,
              color: "var(--dh-text-muted)",
              marginBottom: 28,
              fontWeight: 400,
            }}>
              What are we working on today?
            </p>

            {/* Agent search with autocomplete — z-index 9999 */}
            <div style={{ position: "relative", width: "100%", maxWidth: 500, margin: "0 auto", zIndex: 9999 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "var(--dh-surface)",
                borderRadius: showSuggestions ? "12px 12px 0 0" : 999,
                padding: "10px 14px 10px 20px",
                gap: 10,
                transition: "border-radius 150ms",
                position: "relative",
                zIndex: 9999,
                boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
              }}>
                <input
                  ref={inputRef}
                  placeholder="Ask your agent anything..."
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 14,
                    color: "var(--dh-text-primary)",
                    fontFamily: "'Figtree', sans-serif",
                  }}
                />
                <button
                  onClick={() => { toast("Agent coming soon"); setShowSuggestions(false); }}
                  style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "var(--dh-accent)", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transition: "opacity 150ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <SendFilled size={13} color="#1A1A1A" />
                </button>
              </div>

              {/* Suggestions dropdown — positioned absolutely, z-index above everything */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0, right: 0,
                  background: "var(--dh-surface)",
                  borderRadius: "0 0 12px 12px",
                  overflow: "hidden",
                  zIndex: 9999,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSuggestionClick(s)}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: "10px 20px",
                        textAlign: "left",
                        fontSize: 13,
                        color: "var(--dh-text-secondary)",
                        fontFamily: "'Figtree', sans-serif",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "background 100ms, color 100ms",
                        borderTop: i > 0 ? "1px solid var(--dh-border)" : "none",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--dh-surface-raised)";
                        e.currentTarget.style.color = "var(--dh-text-primary)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--dh-text-secondary)";
                      }}
                    >
                      <ArrowRight size={11} color="var(--dh-accent)" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Content sections ── */}
        <div style={{ padding: "28px 40px 80px 40px", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>

          {/* Job Board */}
          <SectionBoard>
            <SectionHeader
              icon={Portfolio}
              label="Job Board"
              action="watchlist ≡"
              onAction={() => navigate("/job-watchlist")}
              onRefresh={handleRefreshJobs}
              refreshing={jobsLoading}
            />
            {jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--dh-text-muted)", fontSize: 14 }}>
                {jobsLoading
                  ? "Pulling the latest postings from your watch-listed companies…"
                  : watchedCompanies.length === 0
                  ? "Add a company to your watch list to see live postings."
                  : "No open roles match your watch list right now. Check back later."}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {sortJobsForDisplay(jobs).slice(currentJobPage * JOB_PAGE_SIZE, (currentJobPage + 1) * JOB_PAGE_SIZE).map(c => (
                    <JobCard key={c.id} card={c} onApply={handleApplyJob} />
                  ))}
                </div>
                {jobTotalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 14 }}>
                    <button
                      onClick={handlePrevJobPage}
                      disabled={currentJobPage === 0}
                      title="Previous jobs"
                      style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: "var(--dh-surface-input)",
                        border: "none", color: "var(--dh-text-secondary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: currentJobPage === 0 ? 0.35 : 1,
                        cursor: currentJobPage === 0 ? "default" : "pointer",
                        transition: "background 150ms, color 150ms",
                      }}
                      onMouseEnter={e => { if (currentJobPage !== 0) { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface-input)"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace" }}>
                      {currentJobPage + 1} / {jobTotalPages}
                    </span>
                    <button
                      onClick={handleNextJobPage}
                      disabled={currentJobPage >= jobTotalPages - 1}
                      title="Next jobs"
                      style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: "var(--dh-surface-input)",
                        border: "none", color: "var(--dh-text-secondary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: currentJobPage >= jobTotalPages - 1 ? 0.35 : 1,
                        cursor: currentJobPage >= jobTotalPages - 1 ? "default" : "pointer",
                        transition: "background 150ms, color 150ms",
                      }}
                      onMouseEnter={e => { if (currentJobPage < jobTotalPages - 1) { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface-input)"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}

            {recommendedJobs.length > 0 && (
              <>
                <div style={{ height: 1, background: "var(--dh-border)", margin: "18px 0 14px" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Sparkles size={13} color="var(--dh-accent)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Agent Recommended
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {recommendedJobs.map(c => (
                    <JobCard key={c.id} card={c} onApply={handleApplyJob} />
                  ))}
                </div>
              </>
            )}
          </SectionBoard>

          {/* TLDR */}
          <SectionBoard>
            <SectionHeader
              icon={Blog}
              label="TLDR"
              action="view archive"
              onAction={() => navigate("/archive")}
              onRefresh={handleRefreshTldr}
              refreshing={tldrLoading}
            />
            {tldrUnread.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--dh-text-muted)", fontSize: 14 }}>
                All caught up. Check the archive for past articles.
              </div>
            ) : (
              <div style={{ columns: "2 320px", columnGap: 10 }}>
                {(tldrExpanded ? tldrUnread.slice(0, 8) : tldrUnread.slice(0, 2)).map(c => (
                  <TldrCard key={c.id} card={c} onMarkRead={markTldrRead} />
                ))}
              </div>
            )}
            {tldrUnread.length > 2 && (
              <button
                onClick={() => setTldrExpanded(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "transparent", border: "none",
                  color: "var(--dh-text-muted)", fontSize: 12,
                  marginTop: 12, padding: "6px 0",
                  transition: "color 150ms",
                  fontFamily: "'Figtree', sans-serif",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
              >
                {tldrExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {tldrExpanded ? "Show less" : "Expand"}
              </button>
            )}
          </SectionBoard>

          {/* Design Inspos */}
          <SectionBoard>
            <SectionHeader
              icon={Idea}
              label="Design Inspos"
              action="refresh"
              onAction={handleRefreshInspo}
              refreshing={inspoLoading}
            />
            <div
              onScroll={handleInspoScroll}
              style={{ maxHeight: 620, overflowY: "auto", overflowX: "hidden" }}
            >
            <div style={{ columns: "3 200px", columnGap: 10 }}>
              {inspoLoading && inspoItems.length === 0 ? (
                [140, 190, 110, 165, 125, 150].map((h, i) => (
                  <div key={i} className="dh-shimmer" style={{ breakInside: "avoid", marginBottom: 10, borderRadius: 10, height: h }} />
                ))
              ) : (
                inspoItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      breakInside: "avoid",
                      marginBottom: 10,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "var(--dh-surface-input)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "transform 200ms var(--ease-out)",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "scale(1.015)";
                      const btn = e.currentTarget.querySelector<HTMLElement>(".inspo-add");
                      if (btn) btn.style.opacity = "1";
                      const vid = e.currentTarget.querySelector<HTMLVideoElement>(".inspo-video");
                      if (vid) vid.play().catch(() => {});
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "scale(1)";
                      const btn = e.currentTarget.querySelector<HTMLElement>(".inspo-add");
                      if (btn) btn.style.opacity = "0";
                      const vid = e.currentTarget.querySelector<HTMLVideoElement>(".inspo-video");
                      if (vid) { vid.pause(); vid.currentTime = 0; }
                    }}
                    onClick={() => window.open(item.url, "_blank")}
                  >
                    {item.video ? (
                      <video
                        className="inspo-video"
                        src={item.video}
                        poster={item.image}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", display: "block" }}
                      />
                    ) : (
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        style={{ width: "100%", display: "block" }}
                        onError={e => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                      pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", bottom: 8, left: 10, right: 40,
                      fontSize: 10, color: "rgba(255,255,255,0.9)",
                      fontFamily: "'Fira Mono', monospace",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.title}
                    </div>
                    <button
                      className="inspo-add"
                      onClick={e => { e.stopPropagation(); toast("Added to canvas"); }}
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 26, height: 26, borderRadius: "50%",
                        background: "var(--dh-accent)", border: "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0, transition: "opacity 150ms",
                        padding: 0,
                      }}
                    >
                      <Add size={14} color="#1A1A1A" />
                    </button>
                  </div>
                ))
              )}

              {/* Trailing shimmer while the next scroll-triggered batch "loads" */}
              {inspoLoadingMore && (
                [130, 170, 150].map((h, i) => (
                  <div key={`more-${i}`} className="dh-shimmer" style={{ breakInside: "avoid", marginBottom: 10, borderRadius: 10, height: h }} />
                ))
              )}

              {/* Once the scroll-triggered batches are exhausted, stop offering more */}
              {inspoReachedEnd && !inspoLoadingMore && inspoItems.length > 0 && (
                <div style={{
                  WebkitColumnSpan: "all", columnSpan: "all",
                  breakInside: "avoid", textAlign: "center",
                  padding: "24px 12px", color: "var(--dh-text-muted)", fontSize: 12,
                }}>
                  You've reached the end for today — come back tomorrow for a fresh batch.
                </div>
              )}
            </div>
            </div>
          </SectionBoard>

        </div>
      </div>
    </div>
  );
}
