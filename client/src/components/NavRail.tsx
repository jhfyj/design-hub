/**
 * NavRail — Floating pill sidebar
 * Design Hub · Frame 67 reference
 * Collapsed: ~52px wide pill, icons only
 * Hover-expanded: ~200px wide, icon + label inline
 * Separated from left edge by 12px gap, rounded pill shape, drop shadow
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Notification, Home, Folder, Bookmark, Settings, Add,
  Chat, Grid, Code, Edit
} from "@carbon/icons-react";

interface NavRailProps {
  mode?: "home" | "canvas";
  activeProject?: number;
}

const NAV_ITEMS = [
  { icon: Notification, label: "Notification", path: "/notifications" },
  { icon: Home, label: "Home", path: "/" },
  { icon: Folder, label: "Projects", path: "/projects" },
  { icon: Bookmark, label: "Saved", path: "/saved" },
];

const CANVAS_TOOLS = [
  { icon: Chat, label: "Comments" },
  { icon: Grid, label: "Board" },
  { icon: Code, label: "Code" },
  { icon: Edit, label: "Draw" },
];

const RECENT_PROJECTS = [
  { num: 1, name: "Untitled" },
  { num: 2, name: "Untitled Version" },
  { num: 3, name: "Untitled Version" },
  { num: 4, name: "Untitled Version" },
];

export default function NavRail({ mode = "home", activeProject }: NavRailProps) {
  const [location, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);

  const handleNav = (path: string) => {
    if (path === "/notifications" || path === "/projects" || path === "/saved") {
      toast("Feature coming soon", { description: "This section is not yet designed." });
      return;
    }
    navigate(path);
  };

  const pillWidth = expanded ? 200 : 52;

  return (
    <nav
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: "fixed",
        left: 12,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 50,
        width: pillWidth,
        background: "#1A1A1A",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
        padding: "16px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: expanded ? "flex-start" : "center",
        gap: 2,
        transition: "width 220ms cubic-bezier(0.23,1,0.32,1)",
        overflow: "hidden",
      }}
    >
      {/* New Project */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", padding: expanded ? "0 12px" : "0", justifyContent: expanded ? "flex-start" : "center", marginBottom: 10 }}>
        <button
          onClick={() => navigate("/canvas")}
          title="New Project"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--dh-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            flexShrink: 0,
            transition: "opacity 160ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Add size={18} color="#1A1A1A" />
        </button>
        {expanded && (
          <span style={{
            marginLeft: 10,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--dh-accent)",
            fontFamily: "'Figtree', sans-serif",
            whiteSpace: "nowrap",
            opacity: expanded ? 1 : 0,
            transition: "opacity 150ms 80ms",
          }}>
            New Project
          </span>
        )}
      </div>

      {/* Main nav items */}
      {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
        const isActive = location === path;
        return (
          <button
            key={label}
            onClick={() => handleNav(path)}
            title={label}
            style={{
              width: "100%",
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "0 14px" : "0",
              background: isActive ? "rgba(225,255,0,0.12)" : "transparent",
              border: "none",
              color: isActive ? "var(--dh-accent)" : "var(--dh-text-secondary)",
              transition: "background 150ms, color 150ms",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
              <Icon size={18} />
            </span>
            {expanded && (
              <span style={{
                marginLeft: 10,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                fontFamily: "'Figtree', sans-serif",
                whiteSpace: "nowrap",
                opacity: expanded ? 1 : 0,
                transition: "opacity 150ms 80ms",
              }}>
                {label}
              </span>
            )}
          </button>
        );
      })}

      {/* Canvas tools (only in canvas mode) */}
      {mode === "canvas" && (
        <>
          <div style={{ width: expanded ? "calc(100% - 28px)" : 24, height: 1, background: "var(--dh-border)", margin: "6px auto" }} />
          {CANVAS_TOOLS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              title={label}
              onClick={() => toast("Feature coming soon")}
              style={{
                width: "100%",
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: expanded ? "flex-start" : "center",
                padding: expanded ? "0 14px" : "0",
                background: "transparent",
                border: "none",
                color: "var(--dh-text-secondary)",
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                <Icon size={18} />
              </span>
              {expanded && (
                <span style={{
                  marginLeft: 10, fontSize: 14,
                  fontFamily: "'Figtree', sans-serif",
                  whiteSpace: "nowrap",
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 150ms 80ms",
                }}>
                  {label}
                </span>
              )}
            </button>
          ))}
        </>
      )}

      {/* Divider */}
      <div style={{ width: expanded ? "calc(100% - 28px)" : 24, height: 1, background: "var(--dh-border)", margin: "6px auto" }} />

      {/* Recent project slots */}
      {RECENT_PROJECTS.map(({ num, name }) => {
        const isActive = activeProject === num;
        return (
          <button
            key={num}
            onClick={() => navigate(`/canvas/${num}`)}
            title={`Project ${num}`}
            style={{
              width: "100%",
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "0 14px" : "0",
              background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
              border: "none",
              color: isActive ? "#fff" : "var(--dh-text-secondary)",
              fontFamily: "'Figtree', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              transition: "background 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent")}
          >
            <span style={{ flexShrink: 0, minWidth: 16, textAlign: "center" }}>{num}</span>
            {expanded && (
              <>
                <span style={{
                  width: 1, height: 14, background: "var(--dh-border)",
                  margin: "0 8px", flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 400,
                  color: "var(--dh-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 150ms 80ms",
                }}>
                  {name}
                </span>
              </>
            )}
          </button>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings */}
      <button
        onClick={() => toast("Settings coming soon")}
        title="Settings"
        style={{
          width: "100%",
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
          padding: expanded ? "0 14px" : "0",
          background: "transparent",
          border: "none",
          color: "var(--dh-text-secondary)",
          transition: "background 150ms",
          marginTop: 4,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          <Settings size={18} />
        </span>
        {expanded && (
          <span style={{
            marginLeft: 10, fontSize: 14,
            fontFamily: "'Figtree', sans-serif",
            whiteSpace: "nowrap",
            opacity: expanded ? 1 : 0,
            transition: "opacity 150ms 80ms",
          }}>
            Settings
          </span>
        )}
      </button>
    </nav>
  );
}
