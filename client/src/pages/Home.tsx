/**
 * Home Screen — Design Hub
 * Ref: home_macbook_2.png
 * Layout: dot-grid bg, hero zone (time/greeting/search), Job Board, TLDR, Design Inspos
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Briefcase, Newspaper, Sparkles, RefreshCw,
  ArrowRight, Check, Plus, ChevronDown, ChevronUp,
  Send, AlignJustify
} from "lucide-react";
import NavRail from "@/components/NavRail";

// ── Mock data ────────────────────────────────────────────────────────────────

const JOB_CARDS = [
  { id: 1, company: "FIGMA", role: "Senior Product Designer", due: "Due Jul 15", posted: "2h ago", badge: "NEW!", badgeType: "new" },
  { id: 2, company: "NOTION", role: "UX Designer, Growth", due: "Due Jul 20", posted: "5h ago", badge: "RECOMMENDED", badgeType: "recommended" },
  { id: 3, company: "LINEAR", role: "Product Designer", due: "Due Aug 1", posted: "1d ago", badge: "APPLIED", badgeType: "applied" },
  { id: 4, company: "VERCEL", role: "Design Engineer", due: "Due Jul 18", posted: "3h ago", badge: "URGENT", badgeType: "urgent" },
];

const TLDR_CARDS = [
  {
    id: 1,
    title: "Apple Announces Redesigned System Fonts for visionOS 3",
    blurb: "Apple's latest spatial computing update ships with a new variable font system optimised for depth and legibility at distance.",
    need: "Apple is pushing spatial typography as a new design discipline — expect client briefs around visionOS within 6 months.",
    means: "Start learning visionOS layout constraints now. The early movers will own this niche.",
    time: "Today, 9:41 AM",
    source: "Design Milk",
  },
  {
    id: 2,
    title: "Figma Launches AI-Powered Component Suggestions in Dev Mode",
    blurb: "Dev Mode now surfaces AI-generated component alternatives and usage examples inline with inspect panels.",
    need: "Figma is tightening the design-to-dev handoff loop with AI, reducing back-and-forth on component selection.",
    means: "Update your component documentation — AI will surface it to devs automatically.",
    time: "Today, 7:15 AM",
    source: "Figma Blog",
  },
];

const INSPO_ITEMS = [
  { id: 1, h: 220, color: "#2a2a2a", label: "Mobbin — iOS Onboarding" },
  { id: 2, h: 160, color: "#1e2a1e", label: "Are.na — Typography" },
  { id: 3, h: 280, color: "#1a1a2e", label: "Pinterest — Dashboard UI" },
  { id: 4, h: 190, color: "#2a1a1a", label: "Mobbin — Settings Screen" },
  { id: 5, h: 240, color: "#1e1e2a", label: "Are.na — Color Systems" },
  { id: 6, h: 170, color: "#1a2a1a", label: "Pinterest — Motion Design" },
  { id: 7, h: 200, color: "#2a2a1a", label: "Mobbin — Navigation Patterns" },
  { id: 8, h: 260, color: "#1a2a2a", label: "Are.na — Grid Systems" },
  { id: 9, h: 180, color: "#2a1a2a", label: "Pinterest — Brand Identity" },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function JobCard({ card }: { card: typeof JOB_CARDS[0] }) {
  const badgeEl = () => {
    if (card.badgeType === "new") return <span className="badge-lime">{card.badge}</span>;
    if (card.badgeType === "urgent") return <span className="badge-urgent">{card.badge}</span>;
    if (card.badgeType === "applied") return (
      <span className="badge-lime" style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Check size={9} strokeWidth={3} /> {card.badge}
      </span>
    );
    if (card.badgeType === "recommended") return (
      <span style={{
        border: "1.5px dashed var(--dh-accent)", color: "var(--dh-accent)",
        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
        letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 3
      }}>
        <Sparkles size={9} /> {card.badge}
      </span>
    );
    return null;
  };

  return (
    <div
      className={card.badgeType === "recommended" ? "card-recommended" : ""}
      style={{
        background: "var(--dh-surface)",
        borderRadius: 14,
        padding: "16px",
        border: card.badgeType !== "recommended" ? "1px solid var(--dh-border)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "background 150ms",
        cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface)")}
      onClick={() => toast("Job detail coming soon")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Logo placeholder */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "var(--dh-surface-input)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "var(--dh-text-muted)",
          letterSpacing: "0.05em"
        }}>
          {card.company[0]}
        </div>
        {badgeEl()}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.08em", marginBottom: 3 }}>
          {card.company}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--dh-text-primary)", lineHeight: 1.3 }}>
          {card.role}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)" }}>{card.due}</span>
        <span style={{ fontSize: 11, color: "var(--dh-text-disabled)" }}>{card.posted}</span>
      </div>
    </div>
  );
}

function TldrCard({ card }: { card: typeof TLDR_CARDS[0] }) {
  return (
    <div style={{
      background: "var(--dh-surface)",
      borderRadius: 14,
      padding: "20px",
      border: "1px solid var(--dh-border)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--dh-text-disabled)", marginBottom: 6 }}>{card.source}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--dh-text-primary)", lineHeight: 1.35 }}>{card.title}</div>
      </div>
      <div style={{ fontSize: 14, color: "var(--dh-text-secondary)", lineHeight: 1.6 }}>{card.blurb}</div>
      <div style={{ borderTop: "1px solid var(--dh-border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.06em", marginBottom: 4 }}>WHAT YOU NEED TO KNOW</div>
          <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.55 }}>{card.need}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.06em", marginBottom: 4 }}>WHAT IT MEANS TO YOU</div>
          <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.55 }}>{card.means}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--dh-text-disabled)" }}>{card.time}</span>
        <button
          onClick={() => toast("Archive coming soon")}
          style={{
            background: "var(--dh-accent)", color: "#1A1A1A",
            border: "none", borderRadius: 6, padding: "5px 12px",
            fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
            transition: "opacity 150ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Check size={12} strokeWidth={3} /> Read
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon, label, action, onAction
}: { icon: React.ElementType; label: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={20} color="var(--dh-accent)" strokeWidth={2} />
        <span style={{ fontSize: 20, fontWeight: 600, color: "var(--dh-text-primary)" }}>{label}</span>
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: "var(--dh-surface)", border: "1px solid var(--dh-border)",
            borderRadius: 8, padding: "5px 12px", fontSize: 12,
            color: "var(--dh-text-secondary)", display: "flex", alignItems: "center", gap: 5,
            transition: "background 150ms, color 150ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface)"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ── Floating hero inspiration cards ─────────────────────────────────────────

const HERO_CARDS = [
  { top: "8%", left: "3%", rotate: "-4deg", text: '"Design is not just what it looks like — it\'s how it works."', author: "— Steve Jobs" },
  { top: "12%", right: "4%", rotate: "3deg", text: "📖 Recommended: The Design of Everyday Things", author: "Don Norman" },
  { top: "58%", left: "2%", rotate: "2deg", text: "🎬 Watch: Dieter Rams documentary on Apple TV+", author: "" },
  { top: "55%", right: "3%", rotate: "-3deg", text: "🎵 Listening: Lo-fi Beats for Focus", author: "" },
];

function HeroInspoCard({ card }: { card: typeof HERO_CARDS[0] }) {
  return (
    <div style={{
      position: "absolute",
      top: card.top,
      left: (card as any).left,
      right: (card as any).right,
      transform: `rotate(${card.rotate})`,
      background: "var(--dh-surface)",
      border: "1px solid var(--dh-border)",
      borderRadius: 12,
      padding: "12px 14px",
      maxWidth: 200,
      zIndex: 1,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{ fontSize: 12, color: "var(--dh-text-secondary)", lineHeight: 1.5 }}>{card.text}</div>
      {card.author && <div style={{ fontSize: 10, color: "var(--dh-text-muted)", marginTop: 4 }}>{card.author}</div>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  const [, navigate] = useLocation();
  const [time, setTime] = useState("");
  const [tldrExpanded, setTldrExpanded] = useState(false);
  const [inspoKey, setInspoKey] = useState(0);

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />

      {/* Main content */}
      <div style={{ marginLeft: 72, flex: 1, overflowY: "auto" }}>

        {/* ── Hero Zone ── */}
        <section
          className="dot-grid"
          style={{
            position: "relative",
            minHeight: 480,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px 80px",
            overflow: "hidden",
          }}
        >
          {HERO_CARDS.map((c, i) => <HeroInspoCard key={i} card={c} />)}

          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 640 }}>
            <div style={{
              fontFamily: "'Fira Mono', monospace",
              fontSize: 12,
              color: "var(--dh-text-muted)",
              marginBottom: 16,
              letterSpacing: "0.05em",
            }}>
              {time} | Santa Monica
            </div>
            <h1 style={{
              fontFamily: "'Figtree', sans-serif",
              fontSize: "clamp(48px, 7vw, 96px)",
              fontWeight: 400,
              color: "var(--dh-text-primary)",
              lineHeight: 1.05,
              margin: "0 0 12px",
            }}>
              Welcome back, Jen
            </h1>
            <p style={{
              fontSize: 20,
              color: "var(--dh-text-muted)",
              marginBottom: 32,
              fontWeight: 400,
            }}>
              What are we working on today?
            </p>

            {/* Search bar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "var(--dh-surface)",
              border: "1px solid var(--dh-border)",
              borderRadius: 999,
              padding: "10px 16px 10px 20px",
              gap: 10,
              width: "100%",
              maxWidth: 520,
              margin: "0 auto",
            }}>
              <input
                placeholder="Ask your agent anything..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 16,
                  color: "var(--dh-text-primary)",
                  fontFamily: "'Figtree', sans-serif",
                }}
              />
              <button
                onClick={() => toast("Agent coming soon")}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--dh-accent)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={14} color="#1A1A1A" />
              </button>
            </div>
          </div>
        </section>

        {/* ── Content sections ── */}
        <div style={{ padding: "40px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>

          {/* Job Board */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader
              icon={Briefcase}
              label="Job Board"
              action="watchlist ≡"
              onAction={() => navigate("/job-watchlist")}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {JOB_CARDS.map(c => <JobCard key={c.id} card={c} />)}
            </div>
          </section>

          {/* TLDR */}
          <section style={{ marginBottom: 48 }}>
            <SectionHeader
              icon={Newspaper}
              label="TLDR"
              action="view archive"
              onAction={() => toast("Archive coming soon")}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {TLDR_CARDS.map(c => <TldrCard key={c.id} card={c} />)}
            </div>
            <button
              onClick={() => setTldrExpanded(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none",
                color: "var(--dh-text-muted)", fontSize: 13,
                marginTop: 12, padding: "6px 0",
                transition: "color 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
            >
              {tldrExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {tldrExpanded ? "Show less" : "Show more"}
            </button>
          </section>

          {/* Design Inspos */}
          <section>
            <SectionHeader
              icon={Sparkles}
              label="Design Inspos"
              action="Refresh ↺"
              onAction={() => setInspoKey(k => k + 1)}
            />
            {/* Masonry grid */}
            <div
              key={inspoKey}
              style={{
                columns: "3 240px",
                columnGap: 12,
              }}
            >
              {INSPO_ITEMS.map(item => (
                <div
                  key={item.id}
                  style={{
                    breakInside: "avoid",
                    marginBottom: 12,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: item.color,
                    height: item.h,
                    border: "1px solid var(--dh-border)",
                    position: "relative",
                    cursor: "pointer",
                    transition: "transform 200ms var(--ease-out)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.01)";
                    (e.currentTarget.querySelector(".inspo-add") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".inspo-add") as HTMLElement).style.opacity = "1");
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    (e.currentTarget.querySelector(".inspo-add") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".inspo-add") as HTMLElement).style.opacity = "0");
                  }}
                  onClick={() => toast("Added to canvas")}
                >
                  <div style={{
                    position: "absolute", bottom: 10, left: 10,
                    fontSize: 11, color: "rgba(255,255,255,0.5)",
                    fontFamily: "'Fira Mono', monospace",
                  }}>
                    {item.label}
                  </div>
                  <button
                    className="inspo-add"
                    style={{
                      position: "absolute", top: 10, right: 10,
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--dh-accent)", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: 0, transition: "opacity 150ms",
                    }}
                  >
                    <Plus size={14} color="#1A1A1A" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
