/**
 * NavRail — Floating pill sidebar
 * Design Hub · Frame 67 reference
 * Collapsed: ~52px wide pill, icons only, active = square highlight with padding
 * Hover-expanded: ~200px wide, radius decreases, icon + label inline
 * Active highlight never touches left/right edge in either state
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Notification, Home, Folder, Bookmark, Settings, Add,
} from "@carbon/icons-react";
import { EASE_OUT, T_NAVRAIL } from "@/lib/pageLoadTiming";

interface NavRailProps {
  mode?: "home" | "canvas";
  activeProject?: number;
  // Only Home passes this — true for the entrance animation on an actual
  // page load, omitted (no animation) on every other route/mount.
  playIntro?: boolean;
}

const NAV_ITEMS = [
  { icon: Notification, label: "Notification", path: "/notifications" },
  { icon: Home, label: "Home", path: "/" },
  { icon: Folder, label: "Projects", path: "/projects" },
  { icon: Bookmark, label: "Saved", path: "/saved" },
];

const RECENT_PROJECTS = [
  { num: 1, name: "Untitled" },
  { num: 2, name: "Untitled Version" },
  { num: 3, name: "Untitled Version" },
  { num: 4, name: "Untitled Version" },
];

// Highlight box for nav items — square in collapsed, rounded rect in expanded
// Never touches left/right edge (6px inset on each side)
function NavItem({
  icon: Icon, label, isActive, expanded, onClick
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // In collapsed mode: 36×36 square highlight centred in the 52px pill
  // In expanded mode: full-width highlight with 6px horizontal inset, 6px radius
  // Active = light grey (same as project slot active), no yellow anywhere
  const activeBg = "rgba(255,255,255,0.10)";
  const hoverBg  = "rgba(255,255,255,0.06)";

  const highlightStyle: React.CSSProperties = expanded
    ? {
        position: "absolute",
        inset: "0 6px",
        borderRadius: 6,
        background: isActive ? activeBg : hovered ? hoverBg : "transparent",
        transition: "background 200ms",
        zIndex: 0,
      }
    : {
        position: "absolute",
        width: 36,
        height: 36,
        borderRadius: 6,
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        background: isActive ? activeBg : hovered ? hoverBg : "transparent",
        transition: "background 200ms",
        zIndex: 0,
      };

  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: expanded ? "flex-start" : "center",
        padding: expanded ? "0 18px" : "0",
        background: "transparent",
        border: "none",
        color: "var(--dh-text-secondary)",
        flexShrink: 0,
        transition: "color 150ms",
      }}
    >
      <div style={highlightStyle} />
      <span style={{ flexShrink: 0, display: "flex", alignItems: "center", position: "relative", zIndex: 1 }}>
        <Icon size={18} />
      </span>
      {expanded && (
        <span style={{
          marginLeft: expanded ? 10 : 0,
          fontSize: 14,
          fontWeight: isActive ? 600 : 400,
          fontFamily: "'Figtree', sans-serif",
          whiteSpace: "nowrap",
          position: "relative",
          zIndex: 1,
          maxWidth: expanded ? 140 : 0,
          overflow: "hidden",
          opacity: expanded ? 1 : 0,
          transition: "max-width 260ms cubic-bezier(0.23,1,0.32,1), opacity 180ms 60ms, margin-left 260ms cubic-bezier(0.23,1,0.32,1)",
        }}>
          {label}
        </span>
      )}
    </button>
  );
}

export default function NavRail({ mode = "home", activeProject, playIntro = false }: NavRailProps) {
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
  // Radius stays at 16 in both states — same shape, just wider
  const pillRadius = 16;

  return (
    <motion.nav
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      initial={playIntro ? { x: -40, y: "-50%", opacity: 0, scale: 0.92 } : false}
      animate={{ x: 0, y: "-50%", opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: T_NAVRAIL }}
      style={{
        position: "fixed",
        left: 24,
        top: "50%",
        zIndex: 50,
        width: pillWidth,
        background: "#1A1A1A",
        borderRadius: pillRadius,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
        padding: "14px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minHeight: 480,
        transition: "width 260ms cubic-bezier(0.23,1,0.32,1)",
        overflow: "hidden",
      }}
    >
      {/* New Project button */}
      <div style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        padding: expanded ? "0 14px" : "0",
        justifyContent: expanded ? "flex-start" : "center",
        marginBottom: 10,
      }}>
        <button
          onClick={() => navigate("/canvas")}
          title="New Project"
          style={{
            width: 32, height: 32,
            borderRadius: "50%",
            background: "var(--dh-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", flexShrink: 0,
            transition: "opacity 160ms",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Add size={18} color="#1A1A1A" />
        </button>
        {expanded && (
          <span style={{
            marginLeft: 10, fontSize: 14, fontWeight: 700,
            color: "var(--dh-accent)", fontFamily: "'Figtree', sans-serif",
            whiteSpace: "nowrap",
          }}>
            New Project
          </span>
        )}
      </div>

      {/* Main nav items */}
      {NAV_ITEMS.map(({ icon, label, path }) => (
        <NavItem
          key={label}
          icon={icon}
          label={label}
          isActive={location === path}
          expanded={expanded}
          onClick={() => handleNav(path)}
        />
      ))}

      {/* Divider */}
      <div style={{
        width: expanded ? "calc(100% - 28px)" : 24,
        height: 1, background: "var(--dh-border)", margin: "6px auto",
      }} />

      {/* Recent project slots */}
      {RECENT_PROJECTS.map(({ num, name }) => {
        const isActive = activeProject === num;
        return (
          <button
            key={num}
            onClick={() => navigate(`/canvas/${num}`)}
            title={`Project ${num}`}
            style={{
              position: "relative",
              width: "100%",
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "0 18px" : "0",
              background: "transparent",
              border: "none",
              color: isActive ? "#fff" : "var(--dh-text-secondary)",
              fontFamily: "'Figtree', sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
            onMouseEnter={e => {
              const bg = e.currentTarget.querySelector<HTMLElement>(".proj-bg");
              if (bg) bg.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={e => {
              const bg = e.currentTarget.querySelector<HTMLElement>(".proj-bg");
              if (bg) bg.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent";
            }}
          >
            {/* Highlight bg — same inset rules */}
            <div
              className="proj-bg"
              style={expanded ? {
                position: "absolute", inset: "0 6px", borderRadius: 6,
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                transition: "background 200ms", zIndex: 0,
              } : {
                position: "absolute", width: 36, height: 36, borderRadius: 6,
                left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                transition: "background 200ms", zIndex: 0,
              }}
            />
            <span style={{ flexShrink: 0, minWidth: 16, textAlign: "center", position: "relative", zIndex: 1 }}>{num}</span>
            {expanded && (
              <>
                <span style={{
                  width: 1, height: 14, background: "var(--dh-border)",
                  margin: "0 8px", flexShrink: 0, position: "relative", zIndex: 1,
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 400, color: "var(--dh-text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  position: "relative", zIndex: 1,
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
      <NavItem
        icon={Settings}
        label="Settings"
        isActive={false}
        expanded={expanded}
        onClick={() => toast("Settings coming soon")}
      />
    </motion.nav>
  );
}
