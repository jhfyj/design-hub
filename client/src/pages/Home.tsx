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
import {
  Portfolio, Blog, Idea, ArrowRight, CheckmarkFilled,
  Add, ChevronDown, ChevronUp, SendFilled,
  Bookmark, BookmarkFilled, Renew
} from "@carbon/icons-react";
import NavRail from "@/components/NavRail";

// ── Agent autocomplete suggestions ──────────────────────────────────────────
const SUGGESTIONS = [
  "Design a landing page for a SaaS product",
  "Create a color palette for a fintech brand",
  "Brainstorm navigation patterns for mobile apps",
  "Find inspiration for dark mode UI components",
  "Summarize the latest design trends for 2025",
  "Generate a moodboard for a luxury fashion brand",
  "Suggest typography pairings for editorial design",
  "Research competitor apps in the health space",
];

// ── Job data ─────────────────────────────────────────────────────────────────
const JOB_CARDS_DATA = [
  {
    id: 1, company: "Figma", role: "Senior Product Designer",
    due: "Due Jul 15", posted: "2h ago", badge: "NEW!", badgeType: "new",
    url: "https://www.figma.com/careers",
    logo: "https://cdn.simpleicons.org/figma/F24E1E",
  },
  {
    id: 2, company: "Notion", role: "UX Designer, Growth",
    due: "Due Jul 20", posted: "5h ago", badge: "RECOMMENDED", badgeType: "recommended",
    url: "https://www.notion.so/careers",
    logo: "https://cdn.simpleicons.org/notion/ffffff",
  },
  {
    id: 3, company: "Linear", role: "Product Designer",
    due: "Due Aug 1", posted: "1d ago", badge: "NEW!", badgeType: "new",
    url: "https://linear.app/careers",
    logo: "https://cdn.simpleicons.org/linear/5E6AD2",
  },
  {
    id: 4, company: "Vercel", role: "Design Engineer",
    due: "Due Jul 18", posted: "3h ago", badge: "URGENT", badgeType: "urgent",
    url: "https://vercel.com/careers",
    logo: "https://cdn.simpleicons.org/vercel/ffffff",
  },
];

// ── TLDR data ────────────────────────────────────────────────────────────────
const TLDR_CARDS_DATA = [
  {
    id: 1,
    title: "Apple Announces Redesigned System Fonts for visionOS 3",
    blurb: "Apple's latest spatial computing update ships with a new variable font system optimised for depth and legibility at distance.",
    need: "Apple is pushing spatial typography as a new design discipline — expect client briefs around visionOS within 6 months.",
    means: "Start learning visionOS layout constraints now. The early movers will own this niche.",
    time: "Today, 9:41 AM",
    source: "Design Milk",
    url: "https://designmilk.com",
  },
  {
    id: 2,
    title: "Figma Launches AI-Powered Component Suggestions in Dev Mode",
    blurb: "Dev Mode now surfaces AI-generated component alternatives and usage examples inline with inspect panels.",
    need: "Figma is tightening the design-to-dev handoff loop with AI, reducing back-and-forth on component selection.",
    means: "Update your component documentation — AI will surface it to devs automatically.",
    time: "Today, 7:15 AM",
    source: "Figma Blog",
    url: "https://figma.com/blog",
  },
];

// ── Design Inspos data ───────────────────────────────────────────────────────
const ALL_INSPO_ITEMS = [
  { id: 1, h: 220, color: "#1c2a1c", label: "Mobbin — iOS Onboarding", url: "https://mobbin.com" },
  { id: 2, h: 160, color: "#1a1a2e", label: "Are.na — Typography", url: "https://are.na" },
  { id: 3, h: 280, color: "#1a1a1a", label: "Pinterest — Dashboard UI", url: "https://pinterest.com" },
  { id: 4, h: 190, color: "#2a1a1a", label: "Mobbin — Settings Screen", url: "https://mobbin.com" },
  { id: 5, h: 240, color: "#1e1e2a", label: "Are.na — Color Systems", url: "https://are.na" },
  { id: 6, h: 170, color: "#1a2a1a", label: "Pinterest — Motion Design", url: "https://pinterest.com" },
  { id: 7, h: 200, color: "#2a2a1a", label: "Mobbin — Navigation Patterns", url: "https://mobbin.com" },
  { id: 8, h: 260, color: "#1a2a2a", label: "Are.na — Grid Systems", url: "https://are.na" },
  { id: 9, h: 180, color: "#2a1a2a", label: "Pinterest — Brand Identity", url: "https://pinterest.com" },
  { id: 10, h: 210, color: "#1c1c2e", label: "Dribbble — UI Kits", url: "https://dribbble.com" },
  { id: 11, h: 150, color: "#2e1c1c", label: "Behance — Branding", url: "https://behance.net" },
  { id: 12, h: 230, color: "#1c2e1c", label: "Awwwards — Interactions", url: "https://awwwards.com" },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Hero Inspo Cards (draggable, positioned relative to hero center) ─────────
interface HeroCard {
  id: number;
  offsetX: number; // px from center (negative = left, positive = right)
  offsetY: number; // px from center
  rotate: number;
  text: string;
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

function DraggableHeroCard({ card }: { card: HeroCard }) {
  const [drag, setDrag] = useState({ x: card.offsetX, y: card.offsetY });
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startDrag = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    didDrag.current = false;
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
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleClick = () => {
    if (!didDrag.current) window.open(card.url, "_blank");
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={handleClick}
      style={{
        position: "absolute",
        // Center the card relative to the hero center point
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${drag.x}px), calc(-50% + ${drag.y}px)) rotate(${card.rotate}deg)`,
        background: "var(--dh-surface)",
        borderRadius: 12,
        padding: "12px 14px",
        width: 190,
        zIndex: 2,
        cursor: dragging.current ? "grabbing" : "grab",
        userSelect: "none",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        transition: dragging.current ? "none" : "box-shadow 150ms",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--dh-text-secondary)", lineHeight: 1.55 }}>{card.text}</div>
      {card.sub && <div style={{ fontSize: 10, color: "var(--dh-text-muted)", marginTop: 4 }}>{card.sub}</div>}
    </div>
  );
}

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ card, onApply }: {
  card: typeof JOB_CARDS_DATA[0];
  onApply: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    setTimeout(() => onApply(card.id), 380);
  };

  // The badge or apply button shown top-right
  const topRight = () => {
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
          <CheckmarkFilled size={12} /> Apply
        </button>
      );
    }
    if (card.badgeType === "new") return (
      <span style={{ background: "var(--dh-accent)", color: "#1A1A1A", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>NEW!</span>
    );
    if (card.badgeType === "urgent") return (
      <span style={{ background: "#FF3B30", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>URGENT</span>
    );
    if (card.badgeType === "recommended") return (
      <span style={{ border: "1.5px dashed var(--dh-accent)", color: "var(--dh-accent)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>✦ RECOMMENDED</span>
    );
    return null;
  };

  return (
    <div
      style={{
        // Third bg level: --dh-surface-card inside the --dh-surface section board
        background: hovered ? "var(--dh-surface-raised)" : "var(--dh-surface-card)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
        transition: "background 350ms var(--ease-out), transform 380ms cubic-bezier(0.4,0,0.2,1), opacity 380ms",
        transform: removing ? "scale(0.82)" : "scale(1)",
        opacity: removing ? 0 : 1,
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(card.url, "_blank")}
    >
      {/* Top row: logo + badge/apply */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
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
        {topRight()}
      </div>

      {/* Company + role */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.08em", marginBottom: 3, textTransform: "uppercase" }}>
          {card.company}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--dh-text-primary)", lineHeight: 1.3 }}>
          {card.role}
        </div>
      </div>

      {/* Date row — always visible */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)" }}>{card.due}</span>
        <span style={{ fontSize: 11, color: "var(--dh-text-disabled)" }}>{card.posted}</span>
      </div>
    </div>
  );
}

// ── TLDR Card ────────────────────────────────────────────────────────────────
function TldrCard({ card }: { card: typeof TLDR_CARDS_DATA[0] }) {
  const [saved, setSaved] = useState(false);
  return (
    <div style={{
      background: "var(--dh-surface-card)",
      borderRadius: 12,
      padding: "22px",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "var(--dh-text-disabled)", fontFamily: "'Fira Mono', monospace", letterSpacing: "0.05em" }}>{card.source}</div>
        <button
          onClick={() => setSaved(v => !v)}
          style={{ background: "transparent", border: "none", color: saved ? "var(--dh-accent)" : "var(--dh-text-muted)", padding: 2, flexShrink: 0 }}
        >
          {saved ? <BookmarkFilled size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      {/* Title — underlined, clickable */}
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 17, fontWeight: 600, color: "var(--dh-text-primary)",
          lineHeight: 1.35, marginBottom: 10,
          textDecoration: "underline",
          textDecorationColor: "rgba(255,255,255,0.5)",
          textUnderlineOffset: 3,
          display: "block",
        }}
        onMouseEnter={e => (e.currentTarget.style.textDecorationColor = "var(--dh-accent)")}
        onMouseLeave={e => (e.currentTarget.style.textDecorationColor = "rgba(255,255,255,0.5)")}
      >
        {card.title}
      </a>

      <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.7, marginBottom: 22 }}>
        {card.blurb}
      </div>

      {/* What you need to know */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.07em", marginBottom: 8, textTransform: "uppercase" }}>
          What you need to know
        </div>
        <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.7 }}>{card.need}</div>
      </div>

      {/* What it means to you */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.07em", marginBottom: 8, textTransform: "uppercase" }}>
          What it means to you
        </div>
        <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.7 }}>{card.means}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-disabled)" }}>{card.time}</span>
        <button
          onClick={() => toast("Marked as read")}
          style={{
            background: "var(--dh-accent)", color: "#1A1A1A",
            border: "none", borderRadius: 6, padding: "5px 14px",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 5,
            fontFamily: "'Figtree', sans-serif",
            transition: "opacity 150ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Read <CheckmarkFilled size={12} />
        </button>
      </div>
    </div>
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
  icon: Icon, label, action, onAction
}: { icon: React.ElementType; label: string; action?: string; onAction?: () => void }) {
  const isRefresh = action === "refresh";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Icon size={18} color="#FBFBFB" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dh-text-primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
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
          {isRefresh && <Renew size={13} />}
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const [time, setTime] = useState("");
  const [tldrExpanded, setTldrExpanded] = useState(false);
  const [inspoItems, setInspoItems] = useState(() => shuffleArray(ALL_INSPO_ITEMS).slice(0, 9));
  const [jobs, setJobs] = useState(JOB_CARDS_DATA);

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
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = SUGGESTIONS.filter(s => s.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(filtered.length > 0 ? filtered : SUGGESTIONS.slice(0, 4));
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRefreshInspo = () => {
    setInspoItems(shuffleArray(ALL_INSPO_ITEMS).slice(0, 9));
  };

  const handleApplyJob = (id: number) => {
    setTimeout(() => setJobs(prev => prev.filter(j => j.id !== id)), 50);
    toast("Application saved!");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />

      {/* Main content — no left margin, NavRail floats over */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* ── Hero Zone ── */}
        <section
          className="dot-grid"
          style={{
            position: "relative",
            minHeight: 520,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px 80px",
            overflow: "visible",
          }}
        >
          {/* Draggable inspo cards — all 4, centered via transform */}
          {HERO_CARDS.map(card => (
            <DraggableHeroCard key={card.id} card={card} />
          ))}

          {/* Center content */}
          <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 560 }}>
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
        <div style={{ padding: "28px 40px 80px 40px", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Job Board */}
          <SectionBoard>
            <SectionHeader
              icon={Portfolio}
              label="Job Board"
              action="watchlist ≡"
              onAction={() => navigate("/job-watchlist")}
            />
            {jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--dh-text-muted)", fontSize: 14 }}>
                No more jobs to review. Check back later.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {jobs.map(c => (
                  <JobCard key={c.id} card={c} onApply={handleApplyJob} />
                ))}
              </div>
            )}
          </SectionBoard>

          {/* TLDR */}
          <SectionBoard>
            <SectionHeader
              icon={Blog}
              label="TLDR"
              action="view archive"
              onAction={() => toast("Archive coming soon")}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {TLDR_CARDS_DATA.map(c => <TldrCard key={c.id} card={c} />)}
            </div>
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
          </SectionBoard>

          {/* Design Inspos */}
          <SectionBoard>
            <SectionHeader
              icon={Idea}
              label="Design Inspos"
              action="refresh"
              onAction={handleRefreshInspo}
            />
            <div style={{ columns: "3 200px", columnGap: 10 }}>
              {inspoItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    breakInside: "avoid",
                    marginBottom: 10,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: item.color,
                    height: item.h,
                    position: "relative",
                    cursor: "pointer",
                    transition: "transform 200ms var(--ease-out)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.015)";
                    const btn = e.currentTarget.querySelector<HTMLElement>(".inspo-add");
                    if (btn) btn.style.opacity = "1";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    const btn = e.currentTarget.querySelector<HTMLElement>(".inspo-add");
                    if (btn) btn.style.opacity = "0";
                  }}
                  onClick={() => window.open(item.url, "_blank")}
                >
                  <div style={{
                    position: "absolute", bottom: 8, left: 10,
                    fontSize: 9, color: "rgba(255,255,255,0.35)",
                    fontFamily: "'Fira Mono', monospace",
                  }}>
                    {item.label}
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
              ))}
            </div>
          </SectionBoard>

        </div>
      </div>
    </div>
  );
}
