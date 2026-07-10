/**
 * Job Watch List — Design Hub
 * Ref: frame_159.png
 * Config panel: company grid, ADD NEW card, Must Include / Relevant tag chips
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Search, Plus, X, ArrowLeft } from "lucide-react";
import NavRail from "@/components/NavRail";
import { useJobWatchStore, type Company } from "@/lib/jobWatchStore";
import { companyLogoUrl, domainLogoUrl } from "@/lib/companyLogo";
import { trpc } from "@/lib/trpc";

// Autocomplete pools for the tag inputs below — stand in for a real
// role-taxonomy/company-attribute source.
const MUST_SUGGESTIONS = [
  "Product Designer", "UX Designer", "UI Designer", "Design Engineer",
  "Visual Designer", "Interaction Designer", "UX Researcher", "Design Lead",
  "Design Manager", "Creative Director", "Brand Designer", "Motion Designer",
  "Design Systems Designer", "Front-end Designer",
];
const RELEVANT_SUGGESTIONS = [
  "Senior", "Lead", "Remote", "Full-time", "Startup", "Series B+",
  "Junior", "Mid-level", "Hybrid", "Contract", "Part-time", "Enterprise",
  "Series A", "Series C+", "Public Company", "Equity",
];

// A real company lookup (server/companySearch.ts, proxying Clearbit's public
// Autocomplete API) — covers essentially any registered company, not just a
// hand-picked list, so niche/less-common names are searchable too.
interface CompanySuggestion {
  name: string;
  domain: string;
}

// Small logo + first-letter-avatar fallback used in the Add Company
// suggestion dropdown — domain-based (via client/src/lib/companyLogo.ts'
// domainLogoUrl), which is an actual lookup rather than a name guess, with
// an onError swap to a plain letter avatar for the rare miss.
function SuggestionLogo({ name, domain }: { name: string; domain: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <div style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
      background: "var(--dh-surface-raised)", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {broken ? (
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dh-text-muted)" }}>{name[0]}</span>
      ) : (
        <img
          src={domainLogoUrl(domain)}
          alt=""
          style={{ width: 13, height: 13, objectFit: "contain" }}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

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

// "+" button that turns into a text input on click — typing filters the
// suggestion dropdown (startsWith priority, then contains, same ranking as
// the home screen's agent search and the Add Company autocomplete), and
// Enter (or picking a suggestion) commits it as a new chip. Stays open
// afterward so multiple tags can be added back-to-back; blur/Escape closes it.
function TagChipInput({ tags, onAdd, suggestions }: {
  tags: string[];
  onAdd: (tag: string) => void;
  suggestions: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputWidth, setInputWidth] = useState(72);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const PLACEHOLDER = "Type a tag...";
  // Hug the typed content — measure it off-screen in the same font, then
  // size the input to match (clamped to a minimum so it doesn't collapse).
  useLayoutEffect(() => {
    if (measureRef.current) {
      setInputWidth(Math.max(measureRef.current.offsetWidth + 26, 72));
    }
  }, [value]);

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const existingLower = new Set(tags.map(t => t.toLowerCase()));
  const startsWith = suggestions.filter(s => !existingLower.has(s.toLowerCase()) && s.toLowerCase().startsWith(lower));
  const contains = suggestions.filter(s =>
    !existingLower.has(s.toLowerCase()) && !s.toLowerCase().startsWith(lower) && s.toLowerCase().includes(lower)
  );
  const matches = trimmed.length >= 1 ? [...startsWith, ...contains].slice(0, 5) : [];

  const commit = (tag: string) => {
    const clean = tag.trim();
    if (!clean || existingLower.has(clean.toLowerCase())) return;
    onAdd(clean);
    setValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(value);
    } else if (e.key === "Escape") {
      setAdding(false);
      setValue("");
      setShowSuggestions(false);
    }
  };

  if (!adding) {
    return (
      <button
        onClick={() => { setAdding(true); setShowSuggestions(false); }}
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
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Off-screen twin of the input's text, same font — measured to size
          the real input to hug its content instead of a fixed width. */}
      <span
        ref={measureRef}
        style={{
          position: "absolute", top: 0, left: 0, visibility: "hidden",
          whiteSpace: "pre", fontSize: 12, fontFamily: "'Figtree', sans-serif",
        }}
      >
        {value || PLACEHOLDER}
      </span>
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => { setValue(e.target.value); setShowSuggestions(true); }}
        onFocus={() => trimmed.length >= 1 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => { setAdding(false); setValue(""); setShowSuggestions(false); }, 150)}
        placeholder={PLACEHOLDER}
        style={{
          background: "var(--dh-surface-input)",
          border: "1px solid var(--dh-border)",
          borderRadius: 999, padding: "4px 12px",
          fontSize: 12, color: "var(--dh-text-primary)",
          fontFamily: "'Figtree', sans-serif", outline: "none",
          width: inputWidth,
          transition: "width 100ms ease-out",
        }}
      />
      {showSuggestions && matches.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 4,
          background: "var(--dh-surface-input)", border: "1px solid var(--dh-border)",
          borderRadius: 8, overflow: "hidden", zIndex: 20, minWidth: 160,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        }}>
          {matches.map((s, i) => (
            <button
              key={s}
              onMouseDown={() => commit(s)}
              style={{
                width: "100%", background: "transparent", border: "none",
                padding: "8px 12px", textAlign: "left", fontSize: 12,
                color: "var(--dh-text-secondary)", fontFamily: "'Figtree', sans-serif",
                borderTop: i > 0 ? "1px solid var(--dh-border)" : "none",
                transition: "background 100ms, color 100ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ name, domain, onRemove, onEditLink }: {
  name: string; domain?: string; onRemove: () => void; onEditLink: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  return (
    <div
      style={{
        background: hovered ? "var(--dh-surface-raised)" : "var(--dh-surface)",
        borderRadius: 12, padding: "16px",
        display: "flex", flexDirection: "column", gap: 10,
        alignItems: "center",
        position: "relative",
        transition: "background 150ms",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEditLink}
    >
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "transparent", border: "none", padding: 0,
          display: "flex",
          color: "var(--dh-text-muted)",
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? "auto" : "none",
          transition: "opacity 150ms",
        }}
      >
        <X size={12} />
      </button>
      {/* Logo frame — real domain-based logo when known (from company-search),
          else a best-effort name guess, else a letter avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: "var(--dh-surface-input)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {logoBroken ? (
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--dh-text-muted)" }}>{name[0]}</span>
        ) : (
          <img
            src={domain ? domainLogoUrl(domain) : companyLogoUrl(name)}
            alt=""
            style={{ width: 28, height: 28, objectFit: "contain" }}
            onError={() => setLogoBroken(true)}
          />
        )}
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

// ── Edit Link modal ─────────────────────────────────────────────────────────
function EditLinkModal({ company, onClose, onSave }: {
  company: Company;
  onClose: () => void;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(company.url ?? "");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSave = () => onSave(url.trim());

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--dh-surface-card)",
          borderRadius: 16, padding: 28,
          width: 420, maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: "var(--dh-text-primary)",
            letterSpacing: "0.03em", textTransform: "uppercase", margin: 0,
          }}>
            Edit Link — {company.name}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--dh-text-muted)", display: "flex", padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--dh-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Link to Company Careers Page
          </label>
          <input
            autoFocus
            placeholder="https://company.com/careers"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            style={{
              width: "100%", background: "var(--dh-surface-input)",
              border: "1px solid var(--dh-border)", borderRadius: 8,
              padding: "10px 12px", fontSize: 13, color: "var(--dh-text-primary)",
              fontFamily: "'Figtree', sans-serif", outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none",
              color: "var(--dh-text-muted)", fontSize: 13, padding: "8px 4px",
              transition: "color 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "var(--dh-accent)", color: "#1A1A1A",
              border: "none", borderRadius: 8, padding: "8px 18px",
              fontSize: 13, fontWeight: 700, fontFamily: "'Figtree', sans-serif",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Company modal ───────────────────────────────────────────────────────
function AddCompanyModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (company: { name: string; url?: string; domain?: string }) => void;
}) {
  const [name, setName] = useState("");
  // Not user-facing — silently filled in when a suggestion is picked, purely
  // so its card can link out to the careers page and show a real logo. The
  // agent finds each company's actual job board itself (server/jobsFeed.ts
  // tries a pinned ATS slug, then guesses one from the name), so neither is
  // ever required to add a company.
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmed = name.trim();

  // Debounced live company lookup via tRPC (server/companySearch.ts, Clearbit)
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(id);
  }, [trimmed]);

  const { data: searchData } = trpc.companies.search.useQuery(
    { q: debouncedQuery },
    { enabled: debouncedQuery.length >= 1, retry: false, staleTime: 60_000 },
  );
  const suggestions: CompanySuggestion[] = (searchData?.results ?? []).slice(0, 5) as CompanySuggestion[];

  const handlePickSuggestion = (company: CompanySuggestion) => {
    setName(company.name);
    setUrl(`https://${company.domain}/careers`);
    setDomain(company.domain);
    setShowSuggestions(false);
  };

  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAdd({ name: trimmed, url: url.trim() || undefined, domain: domain || undefined });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--dh-surface-card)",
          borderRadius: 16, padding: 28,
          width: 420, maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: "var(--dh-text-primary)",
            letterSpacing: "0.03em", textTransform: "uppercase", margin: 0,
          }}>
            Add Company
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--dh-text-muted)", display: "flex", padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Company name + autocomplete */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--dh-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Company Name
          </label>
          <input
            autoFocus
            placeholder="e.g. Figma"
            value={name}
            onChange={e => { setName(e.target.value); setDomain(""); setUrl(""); setShowSuggestions(true); }}
            onFocus={() => name.trim().length >= 1 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            style={{
              width: "100%", background: "var(--dh-surface-input)",
              border: "1px solid var(--dh-border)", borderRadius: 8,
              padding: "10px 12px", fontSize: 13, color: "var(--dh-text-primary)",
              fontFamily: "'Figtree', sans-serif", outline: "none",
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
              background: "var(--dh-surface-input)", border: "1px solid var(--dh-border)",
              borderRadius: 8, overflow: "hidden", zIndex: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            }}>
              {suggestions.map((c, i) => (
                <button
                  key={c.domain}
                  onMouseDown={() => handlePickSuggestion(c)}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    padding: "9px 12px", textAlign: "left", fontSize: 13,
                    color: "var(--dh-text-secondary)", fontFamily: "'Figtree', sans-serif",
                    borderTop: i > 0 ? "1px solid var(--dh-border)" : "none",
                    transition: "background 100ms, color 100ms",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--dh-text-secondary)"; }}
                >
                  <SuggestionLogo name={c.name} domain={c.domain} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: "var(--dh-text-muted)", marginTop: -4, marginBottom: 24 }}>
          We'll find their job board automatically — no link needed.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none",
              color: "var(--dh-text-muted)", fontSize: 13, padding: "8px 4px",
              transition: "color 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--dh-text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--dh-text-muted)")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: "var(--dh-accent)", color: "#1A1A1A",
              border: "none", borderRadius: 8, padding: "8px 18px",
              fontSize: 13, fontWeight: 700, fontFamily: "'Figtree', sans-serif",
              opacity: canSubmit ? 1 : 0.4,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "opacity 150ms",
            }}
          >
            Add Company
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobWatchList() {
  const [, navigate] = useLocation();
  const {
    companies, mustTags, relevantTags,
    addCompany, removeCompany, updateCompanyUrl, addMustTag, removeMustTag, addRelevantTag, removeRelevantTag,
  } = useJobWatchStore();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCompany = ({ name, url, domain }: { name: string; url?: string; domain?: string }) => {
    addCompany({ name, url, domain });
    setShowAddModal(false);
    toast(`${name} added to your watch list`);
  };

  const handleSaveLink = (url: string) => {
    if (!editingCompany) return;
    updateCompanyUrl(editingCompany.id, url);
    setEditingCompany(null);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />

      {/* Main content — reserves a gutter for NavRail (same as Home) */}
      <div style={{ marginLeft: 72, flex: 1, padding: "40px 48px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

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
            onClick={() => setShowAddModal(true)}
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
              domain={c.domain}
              onRemove={() => removeCompany(c.id)}
              onEditLink={() => setEditingCompany(c)}
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
                  onRemove={() => removeMustTag(tag)}
                />
              ))}
              <TagChipInput
                tags={mustTags}
                suggestions={MUST_SUGGESTIONS}
                onAdd={addMustTag}
              />
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
                  onRemove={() => removeRelevantTag(tag)}
                />
              ))}
              <TagChipInput
                tags={relevantTags}
                suggestions={RELEVANT_SUGGESTIONS}
                onAdd={addRelevantTag}
              />
            </div>
          </div>
        </div>
      </div>
      </div>

      {showAddModal && (
        <AddCompanyModal onClose={() => setShowAddModal(false)} onAdd={handleAddCompany} />
      )}
      {editingCompany && (
        <EditLinkModal company={editingCompany} onClose={() => setEditingCompany(null)} onSave={handleSaveLink} />
      )}
    </div>
  );
}
