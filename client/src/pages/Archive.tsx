/**
 * TLDR Archive — Design Hub
 * Not Figma-sourced — built from docs/skill/SKILL.md design tokens (dark-first,
 * three-level surface hierarchy, Figtree/Fira Mono, lime accent) and the
 * Job Watch List panel's full-page conventions (back button, header, search).
 * Shows every TLDR article marked as read, grouped Today / Yesterday / All
 * past articles, searchable by title/source, sortable newest/oldest first.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, SortAscending, SortDescending, Checkmark } from "@carbon/icons-react";
import NavRail from "@/components/NavRail";
import { useTldrStore, formatArticleTime, dayBucket, type TldrArticle } from "@/lib/tldrStore";

const BUCKET_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  past: "All Past Articles",
};

function ArchiveCard({ article }: { article: TldrArticle }) {
  return (
    <div style={{
      background: "var(--dh-surface-card)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      breakInside: "avoid",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 16, fontWeight: 600, color: "var(--dh-text-primary)",
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
          {article.title}
        </a>
        <span style={{
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          fontSize: 11, fontWeight: 700, color: "var(--dh-text-muted)",
          fontFamily: "'Figtree', sans-serif",
        }}>
          Read <Checkmark size={12} />
        </span>
      </div>

      {article.blurb && (
        <div style={{ fontSize: 13, color: "var(--dh-text-secondary)", lineHeight: 1.6 }}>
          {article.blurb}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace", letterSpacing: "0.05em" }}>
          {article.source}
        </span>
        <span style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace" }}>
          {formatArticleTime(article.publishedAt)}
        </span>
      </div>
    </div>
  );
}

export default function Archive() {
  const [, navigate] = useLocation();
  const { archived } = useTldrStore();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");

  const filtered = archived.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.source.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) =>
    sortDir === "newest" ? b.publishedAt - a.publishedAt : a.publishedAt - b.publishedAt
  );

  const buckets: ("today" | "yesterday" | "past")[] = ["today", "yesterday", "past"];
  const grouped = buckets.map(bucket => ({
    bucket,
    articles: sorted.filter(a => dayBucket(a.publishedAt) === bucket),
  })).filter(g => g.articles.length > 0);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--dh-bg)" }}>
      <NavRail mode="home" />

      {/* Main content — reserves a gutter for NavRail (same as Home) */}
      <div style={{ marginLeft: 72, flex: 1, padding: "48px 56px" }}>
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
            Archive
          </h1>
          <p style={{ fontSize: 14, color: "var(--dh-text-muted)", marginTop: 8, maxWidth: 480 }}>
            TLDR articles you've marked as read, sorted chronologically by default.
          </p>
        </div>

        {/* Controls: search + sort — bottom-aligned, same pattern as Job Watch List */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dh-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            {sorted.length} article{sorted.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSortDir(d => (d === "newest" ? "oldest" : "newest"))}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--dh-surface-input)",
                border: "1px solid var(--dh-border)",
                borderRadius: 8, padding: "6px 12px",
                fontSize: 12, color: "var(--dh-text-secondary)",
                fontFamily: "'Figtree', sans-serif",
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface-input)")}
            >
              {sortDir === "newest" ? <SortDescending size={14} /> : <SortAscending size={14} />}
              {sortDir === "newest" ? "Newest first" : "Oldest first"}
            </button>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--dh-surface-input)",
              border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "6px 12px",
              width: 220,
            }}>
              <Search size={13} color="var(--dh-text-muted)" />
              <input
                placeholder="Search archive..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 12, color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
                }}
              />
            </div>
          </div>
        </div>

        {/* Divider between controls and results */}
        <div style={{ height: 1, background: "var(--dh-border)", marginBottom: 24 }} />

        {/* Grouped results */}
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--dh-text-muted)", fontSize: 14 }}>
            {archived.length === 0
              ? "No archived articles yet — mark a TLDR article as read to see it here."
              : "No articles match your search."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {grouped.map(({ bucket, articles }) => (
              <div key={bucket}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "var(--dh-text-muted)",
                  letterSpacing: "0.07em", marginBottom: 12, textTransform: "uppercase",
                  fontFamily: "'Fira Mono', monospace",
                }}>
                  {BUCKET_LABELS[bucket]}
                </div>
                <div style={{ columns: "2 320px", columnGap: 10 }}>
                  {articles.map(a => <ArchiveCard key={a.id} article={a} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
