/**
 * Job Watch List — Design Hub
 * Ref: frame_159.png
 * Config panel: company grid, ADD NEW card, Must Include / Relevant tag chips
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Search, Plus, X, ArrowLeft } from "lucide-react";
import NavRail from "@/components/NavRail";

const INITIAL_COMPANIES = [
  { id: 1, name: "FIGMA" },
  { id: 2, name: "NOTION" },
  { id: 3, name: "LINEAR" },
  { id: 4, name: "VERCEL" },
  { id: 5, name: "STRIPE" },
  { id: 6, name: "LOOM" },
  { id: 7, name: "MIRO" },
  { id: 8, name: "FRAMER" },
];

const INITIAL_MUST = ["Product Designer", "UX Designer", "Design Engineer", "UI Designer"];
const INITIAL_RELEVANT = ["Senior", "Lead", "Remote", "Full-time", "Startup", "Series B+"];

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "var(--dh-surface-input)",
      border: "1px solid var(--dh-border)",
      borderRadius: 999, padding: "4px 10px",
      fontSize: 12, color: "var(--dh-text-secondary)",
      fontFamily: "'Figtree', sans-serif",
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "transparent", border: "none", color: "var(--dh-text-muted)", padding: 0, display: "flex", lineHeight: 1 }}
      >
        <X size={10} />
      </button>
    </div>
  );
}

function CompanyCard({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div style={{
      background: "var(--dh-surface)",
      borderRadius: 12, padding: "16px",
      display: "flex", flexDirection: "column", gap: 10,
      alignItems: "center",
      position: "relative",
      transition: "background 150ms",
      cursor: "pointer",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface)")}
    >
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "transparent", border: "none",
          color: "var(--dh-text-disabled)", opacity: 0,
          transition: "opacity 150ms",
        }}
        className="remove-btn"
      >
        <X size={12} />
      </button>
      {/* Logo placeholder */}
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: "var(--dh-surface-input)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 700, color: "var(--dh-text-muted)",
      }}>
        {name[0]}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--dh-text-secondary)",
        letterSpacing: "0.08em", textAlign: "center",
      }}>
        {name}
      </div>
    </div>
  );
}

export default function JobWatchList() {
  const [, navigate] = useLocation();
  const [companies, setCompanies] = useState(INITIAL_COMPANIES);
  const [mustTags, setMustTags] = useState(INITIAL_MUST);
  const [relevantTags, setRelevantTags] = useState(INITIAL_RELEVANT);
  const [search, setSearch] = useState("");

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />

      <div style={{ marginLeft: 72, flex: 1, padding: "40px 48px", maxWidth: 960, margin: "0 auto 0 72px" }}>

        {/* Back */}
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "var(--dh-text-muted)", fontSize: 13,
            marginBottom: 32, padding: 0,
            transition: "color 150ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-secondary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
        >
          <ArrowLeft size={14} /> Back to Home
        </button>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: "var(--dh-text-primary)",
            letterSpacing: "0.04em", margin: 0, textTransform: "uppercase",
          }}>
            Job Watch List
          </h1>
          <p style={{ fontSize: 14, color: "var(--dh-text-muted)", marginTop: 8, maxWidth: 480 }}>
            Track companies you want to work at. We'll surface new openings from their job boards and alert you when roles match your tags.
          </p>
        </div>

        {/* Company section: header row with search bottom-aligned, then grid, then divider */}
        <div style={{ marginBottom: 32 }}>
          {/* Row: label left, search right — both bottom-aligned */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Companies
            </span>
            {/* Search — bottom-aligned to sit close to the grid */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--dh-surface-input)",
              border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "6px 12px",
              width: 200,
            }}>
              <Search size={13} color="var(--dh-text-muted)" />
              <input
                placeholder="Search companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 12, color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
                }}
              />
            </div>
          </div>

          {/* Company grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}>
          {/* ADD NEW card */}
          <button
            onClick={() => toast("Add company coming soon")}
            style={{
              background: "transparent",
              border: "1.5px dashed var(--dh-accent)",
              borderRadius: 12, padding: "16px",
              display: "flex", flexDirection: "column", gap: 10,
              alignItems: "center", justifyContent: "center",
              cursor: "pointer", minHeight: 100,
              transition: "background 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(225,255,0,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--dh-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Plus size={16} color="#1A1A1A" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dh-accent)", letterSpacing: "0.06em" }}>
              ADD NEW
            </span>
          </button>

          {filtered.map(c => (
            <CompanyCard
              key={c.id}
              name={c.name}
              onRemove={() => setCompanies(prev => prev.filter(x => x.id !== c.id))}
            />
          ))}
          </div>{/* end company grid */}

          {/* Divider below companies, separating from tags */}
          <div style={{ height: 1, background: "var(--dh-border)", marginTop: 8 }} />
        </div>{/* end company section */}

        {/* Tags section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Must Include */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dh-text-muted)", letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" }}>
              Must Include
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {mustTags.map(tag => (
                <TagChip
                  key={tag}
                  label={tag}
                  onRemove={() => setMustTags(prev => prev.filter(t => t !== tag))}
                />
              ))}
              <button
                onClick={() => toast("Add tag coming soon")}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--dh-accent)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <Plus size={14} color="#1A1A1A" />
              </button>
            </div>
          </div>

          {/* Relevant */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dh-text-muted)", letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" }}>
              Relevant
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {relevantTags.map(tag => (
                <TagChip
                  key={tag}
                  label={tag}
                  onRemove={() => setRelevantTags(prev => prev.filter(t => t !== tag))}
                />
              ))}
              <button
                onClick={() => toast("Add tag coming soon")}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--dh-accent)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <Plus size={14} color="#1A1A1A" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
