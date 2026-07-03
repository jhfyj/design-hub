/**
 * NavRail — Left sidebar navigation
 * Design Hub design system: ~72px wide, dark bg, lime accent for active state
 * New Project button always lime. Settings at bottom.
 */
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Home, Bell, FolderOpen, Bookmark, Settings, Plus,
  MessageSquare, LayoutGrid, Code2, Pencil
} from "lucide-react";

interface NavRailProps {
  mode?: "home" | "canvas";
  activeProject?: number;
}

const NAV_ITEMS = [
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Home, label: "Home", path: "/" },
  { icon: FolderOpen, label: "Projects", path: "/projects" },
  { icon: Bookmark, label: "Saved", path: "/saved" },
];

const CANVAS_TOOLS = [
  { icon: MessageSquare, label: "Comments" },
  { icon: LayoutGrid, label: "Board" },
  { icon: Code2, label: "Code" },
  { icon: Pencil, label: "Draw" },
];

const RECENT_PROJECTS = [
  { num: 1, name: "Untitled" },
  { num: 2, name: "Untitled Version" },
  { num: 3, name: "Untitled Version" },
  { num: 4, name: "Untitled Version" },
];

export default function NavRail({ mode = "home", activeProject }: NavRailProps) {
  const [location, navigate] = useLocation();

  const handleNav = (path: string) => {
    if (path === "/notifications" || path === "/projects" || path === "/saved") {
      toast("Feature coming soon", { description: "This section is not yet designed." });
      return;
    }
    navigate(path);
  };

  return (
    <nav
      className="flex flex-col items-center py-4 gap-1 flex-shrink-0"
      style={{
        width: 72,
        minHeight: "100vh",
        background: "var(--dh-bg)",
        borderRight: "1px solid var(--dh-border)",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
      }}
    >
      {/* New Project */}
      <button
        onClick={() => navigate("/canvas")}
        title="New Project"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--dh-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          marginBottom: 12,
          flexShrink: 0,
          transition: "transform 160ms var(--ease-out), opacity 160ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        <Plus size={20} color="#1A1A1A" strokeWidth={2.5} />
      </button>

      {/* Main nav items */}
      {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
        const isActive = location === path;
        return (
          <button
            key={label}
            onClick={() => handleNav(path)}
            title={label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive ? "rgba(225,255,0,0.12)" : "transparent",
              border: "none",
              color: isActive ? "var(--dh-accent)" : "var(--dh-text-secondary)",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon size={20} strokeWidth={1.8} />
          </button>
        );
      })}

      {/* Canvas tools (only in canvas mode) */}
      {mode === "canvas" && (
        <>
          <div style={{ width: 32, height: 1, background: "var(--dh-border)", margin: "8px 0" }} />
          {CANVAS_TOOLS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              title={label}
              onClick={() => toast("Feature coming soon")}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--dh-text-secondary)",
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Icon size={18} strokeWidth={1.8} />
            </button>
          ))}
        </>
      )}

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: "var(--dh-border)", margin: "8px 0" }} />

      {/* Recent project slots */}
      {RECENT_PROJECTS.map(({ num }) => {
        const isActive = activeProject === num;
        return (
          <button
            key={num}
            onClick={() => navigate(`/canvas/${num}`)}
            title={`Project ${num}`}
            style={{
              width: 40,
              height: 36,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive ? "var(--dh-surface-raised)" : "var(--dh-surface)",
              border: "none",
              color: "#fff",
              fontFamily: "'Figtree', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              transition: "background 150ms",
              marginBottom: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
            onMouseLeave={e => (e.currentTarget.style.background = isActive ? "var(--dh-surface-raised)" : "var(--dh-surface)")}
          >
            {num}
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
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: "var(--dh-text-secondary)",
          transition: "background 150ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <Settings size={20} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
