/**
 * Project Canvas — Design Hub
 * Refs: macbook_3.png through macbook_9.png
 * Freeform infinite canvas with floating toolbar, node types, agent mode,
 * media search overlay, context radial menu, export modal.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  MousePointer2, Image, Type, Link2, Code2, Pen, Sparkles,
  Copy, Search, X, Download, ChevronDown, ZoomIn, ZoomOut,
  AlignLeft, Bold, Italic, Star, HelpCircle, AlertCircle, Circle,
  LayoutGrid, FileText, Video, Music, Zap
} from "lucide-react";
import NavRail from "@/components/NavRail";

// ── Types ────────────────────────────────────────────────────────────────────

type NodeType = "text" | "link" | "image" | "code" | "shape";
type CanvasMode = "default" | "editing" | "agent";
type Overlay = "none" | "media-search" | "export" | "context-menu";

interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  content: string;
  isAgent?: boolean;
  width?: number;
}

interface Connection {
  from: string;
  to: string;
  isAgent?: boolean;
}

// ── Mock canvas state ────────────────────────────────────────────────────────

const INITIAL_NODES: CanvasNode[] = [
  { id: "n1", type: "text", x: 180, y: 120, content: "brand identity", isAgent: false },
  { id: "n2", type: "text", x: 420, y: 80, content: "visual language", isAgent: false },
  { id: "n3", type: "text", x: 650, y: 160, content: "motion design", isAgent: false },
  { id: "n4", type: "text", x: 300, y: 260, content: "typography", isAgent: false },
  { id: "n5", type: "link", x: 540, y: 300, content: "figma.com/community", isAgent: false },
  { id: "n6", type: "image", x: 160, y: 320, content: "Moodboard reference", isAgent: false },
  { id: "a1", type: "text", x: 480, y: 200, content: "sensory experience", isAgent: true },
  { id: "a2", type: "text", x: 700, y: 280, content: "anti-design", isAgent: true },
];

const INITIAL_CONNECTIONS: Connection[] = [
  { from: "n1", to: "n2", isAgent: false },
  { from: "n2", to: "n3", isAgent: false },
  { from: "n1", to: "n4", isAgent: false },
  { from: "n4", to: "n5", isAgent: false },
  { from: "n2", to: "a1", isAgent: true },
  { from: "n3", to: "a2", isAgent: true },
];

const MEDIA_TABS = ["Image", "UI", "UX", "Text", "Video", "Sound", "Animation"];
const MEDIA_RESULTS = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  h: [160, 120, 180, 140, 200, 130, 170, 150, 190][i],
  color: ["#1e2a1e", "#1a1a2e", "#2a1a1a", "#1e1e2a", "#2a2a1a", "#1a2a2a", "#2a1a2a", "#1e2a2a", "#2a2a2e"][i],
  label: ["Mobbin", "Are.na", "Pinterest", "Dribbble", "Behance", "Awwwards", "Mobbin", "Are.na", "Pinterest"][i],
}));

// ── Canvas Node rendering ────────────────────────────────────────────────────

function CanvasNodeEl({ node, selected, onSelect }: {
  node: CanvasNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    cursor: "pointer",
    userSelect: "none",
    transition: "box-shadow 150ms",
  };

  if (node.type === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          fontFamily: "'Mynerve', cursive",
          fontSize: 20,
          color: node.isAgent ? "var(--dh-agent)" : "var(--dh-text-primary)",
          padding: "4px 8px",
          borderRadius: 6,
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.5)" : "none",
          background: selected ? "rgba(225,255,0,0.06)" : "transparent",
          whiteSpace: "nowrap",
        }}
        onClick={() => onSelect(node.id)}
      >
        {node.content}
      </div>
    );
  }

  if (node.type === "link") {
    return (
      <div
        style={{
          ...baseStyle,
          background: "var(--dh-surface)",
          border: `1px solid ${selected ? "var(--dh-accent)" : "var(--dh-border)"}`,
          borderRadius: 10,
          padding: "10px 14px",
          width: 200,
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.2)" : "none",
        }}
        onClick={() => onSelect(node.id)}
      >
        <div style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace", marginBottom: 4 }}>🔗 link</div>
        <div style={{ fontSize: 13, color: "var(--dh-text-primary)", fontWeight: 500 }}>{node.content}</div>
      </div>
    );
  }

  if (node.type === "image") {
    return (
      <div
        style={{
          ...baseStyle,
          background: "var(--dh-surface)",
          border: `1px solid ${selected ? "var(--dh-accent)" : "var(--dh-border)"}`,
          borderRadius: 10,
          overflow: "hidden",
          width: 180,
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.2)" : "none",
        }}
        onClick={() => onSelect(node.id)}
      >
        <div style={{ height: 100, background: "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image size={28} color="var(--dh-text-disabled)" />
        </div>
        <div style={{ padding: "8px 10px" }}>
          <div style={{ fontSize: 12, color: "var(--dh-text-secondary)" }}>{node.content}</div>
        </div>
      </div>
    );
  }

  return null;
}

// ── SVG Connections ──────────────────────────────────────────────────────────

function ConnectionLines({ nodes, connections }: { nodes: CanvasNode[]; connections: Connection[] }) {
  const getCenter = (id: string) => {
    const n = nodes.find(n => n.id === id);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + 60, y: n.y + 14 };
  };

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      {connections.map((c, i) => {
        const from = getCenter(c.from);
        const to = getCenter(c.to);
        return (
          <line
            key={i}
            x1={from.x} y1={from.y}
            x2={to.x} y2={to.y}
            stroke={c.isAgent ? "var(--dh-accent)" : "var(--dh-graph)"}
            strokeWidth={1.5}
            strokeDasharray={c.isAgent ? "5 4" : "none"}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function CanvasToolbar({
  mode, onModeChange, onOverlay, onAddNode
}: {
  mode: CanvasMode;
  onModeChange: (m: CanvasMode) => void;
  onOverlay: (o: Overlay) => void;
  onAddNode: (type: NodeType) => void;
}) {
  const tools = [
    { icon: MousePointer2, label: "Select", action: () => {} },
    { icon: Image, label: "Image", action: () => onAddNode("image") },
    { icon: Type, label: "Text", action: () => onAddNode("text") },
    { icon: Link2, label: "Link", action: () => onAddNode("link") },
    { icon: Code2, label: "Code", action: () => onAddNode("code") },
    { icon: Pen, label: "Draw", action: () => toast("Draw tool coming soon") },
    { icon: Sparkles, label: "Agent", action: () => onModeChange(mode === "agent" ? "editing" : "agent") },
    { icon: Copy, label: "Duplicate", action: () => toast("Duplicate coming soon") },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 28,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "var(--dh-surface)",
      border: "1px solid var(--dh-border)",
      borderRadius: 999,
      padding: "6px 10px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {tools.map(({ icon: Icon, label, action }) => {
        const isAgentBtn = label === "Agent";
        const isActive = isAgentBtn && mode === "agent";
        return (
          <button
            key={label}
            title={label}
            onClick={action}
            style={{
              width: 36, height: 36, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isActive ? "var(--dh-accent)" : "transparent",
              border: "none",
              color: isActive ? "#1A1A1A" : "var(--dh-text-secondary)",
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--dh-text-primary)"; } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--dh-text-secondary)"; } }}
          >
            <Icon size={16} strokeWidth={1.8} />
          </button>
        );
      })}

      <div style={{ width: 1, height: 24, background: "var(--dh-border)", margin: "0 4px" }} />

      {/* Search */}
      <button
        onClick={() => onOverlay("media-search")}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--dh-surface-input)", border: "none",
          borderRadius: 999, padding: "6px 14px",
          color: "var(--dh-text-muted)", fontSize: 13,
          fontFamily: "'Figtree', sans-serif",
          transition: "background 150ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface-input)")}
      >
        <Search size={14} />
        <span>Search media...</span>
      </button>

      {/* Agent Mode CTA */}
      {mode !== "default" && (
        <button
          onClick={() => onModeChange(mode === "agent" ? "editing" : "agent")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: mode === "agent" ? "var(--dh-accent)" : "rgba(225,255,0,0.12)",
            border: `1px solid ${mode === "agent" ? "var(--dh-accent)" : "rgba(225,255,0,0.3)"}`,
            borderRadius: 999, padding: "6px 14px",
            color: mode === "agent" ? "#1A1A1A" : "var(--dh-accent)",
            fontSize: 13, fontWeight: 600,
            transition: "all 150ms",
            marginLeft: 4,
          }}
        >
          <Sparkles size={14} />
          Agent Mode
        </button>
      )}
    </div>
  );
}

// ── Media Search Overlay ─────────────────────────────────────────────────────

function MediaSearchOverlay({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("Image");
  return (
    <div style={{
      position: "fixed",
      bottom: 90,
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(780px, 90vw)",
      background: "var(--dh-surface)",
      border: "1px solid var(--dh-border)",
      borderRadius: 16,
      padding: 20,
      zIndex: 200,
      boxShadow: "0 16px 64px rgba(0,0,0,0.6)",
    }}>
      {/* Search input row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "var(--dh-surface-input)", borderRadius: 8, padding: "8px 14px",
          border: "1px solid var(--dh-border)",
        }}>
          <Search size={14} color="var(--dh-text-muted)" />
          <input
            autoFocus
            placeholder="Search images, UI, animations..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
            }}
          />
        </div>
        <button
          style={{
            background: "var(--dh-surface-raised)", border: "1px solid var(--dh-border)",
            borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "var(--dh-text-secondary)",
            whiteSpace: "nowrap",
          }}
          onClick={() => toast("Detailed search coming soon")}
        >
          Detailed Search
        </button>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--dh-text-muted)", padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {MEDIA_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "5px 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 500,
              background: activeTab === tab ? "var(--dh-accent)" : "var(--dh-surface-input)",
              color: activeTab === tab ? "#1A1A1A" : "var(--dh-text-secondary)",
              transition: "all 150ms",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Results masonry */}
      <div style={{ columns: "3 180px", columnGap: 8, maxHeight: 320, overflowY: "auto" }}>
        {MEDIA_RESULTS.map(item => (
          <div
            key={item.id}
            style={{
              breakInside: "avoid", marginBottom: 8,
              borderRadius: 8, height: item.h,
              background: item.color,
              border: "1px solid var(--dh-border)",
              cursor: "pointer",
              display: "flex", alignItems: "flex-end", padding: 8,
              transition: "transform 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            onClick={() => { toast("Added to canvas"); onClose(); }}
          >
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Fira Mono', monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose }: { onClose: () => void }) {
  const [width, setWidth] = useState("1440");
  const [height, setHeight] = useState("900");
  const [format, setFormat] = useState("PNG");
  const [quality, setQuality] = useState(80);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          background: "var(--dh-surface-raised)",
          border: "1px solid var(--dh-border)",
          borderRadius: 16, padding: 28, width: 420,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--dh-text-primary)", margin: 0 }}>Export Canvas</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--dh-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{
          height: 160, background: "#1a1a1a", borderRadius: 10,
          border: "1px solid var(--dh-border)", marginBottom: 20,
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 12, color: "var(--dh-text-disabled)", fontFamily: "'Fira Mono', monospace" }}>Canvas Preview</span>
          {/* Blue crop handles */}
          {[{t:8,l:8},{t:8,r:8},{b:8,l:8},{b:8,r:8}].map((pos, i) => (
            <div key={i} style={{
              position: "absolute",
              top: (pos as any).t, bottom: (pos as any).b,
              left: (pos as any).l, right: (pos as any).r,
              width: 12, height: 12,
              background: "var(--dh-graph)",
              borderRadius: 2,
            }} />
          ))}
        </div>

        {/* Dimensions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--dh-text-muted)", display: "block", marginBottom: 4 }}>Width</label>
            <input
              value={width} onChange={e => setWidth(e.target.value)}
              style={{
                width: "100%", background: "var(--dh-surface-input)", border: "1px solid var(--dh-border)",
                borderRadius: 8, padding: "8px 12px", color: "var(--dh-text-primary)",
                fontSize: 14, fontFamily: "'Figtree', sans-serif", outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--dh-text-muted)", display: "block", marginBottom: 4 }}>Height</label>
            <input
              value={height} onChange={e => setHeight(e.target.value)}
              style={{
                width: "100%", background: "var(--dh-surface-input)", border: "1px solid var(--dh-border)",
                borderRadius: 8, padding: "8px 12px", color: "var(--dh-text-primary)",
                fontSize: 14, fontFamily: "'Figtree', sans-serif", outline: "none",
              }}
            />
          </div>
        </div>

        {/* Quality slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: "var(--dh-text-muted)" }}>Quality</label>
            <span style={{ fontSize: 11, color: "var(--dh-text-secondary)" }}>{quality}%</span>
          </div>
          <input
            type="range" min={10} max={100} value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--dh-accent)" }}
          />
        </div>

        {/* Format */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "var(--dh-text-muted)", display: "block", marginBottom: 4 }}>Format</label>
          <select
            value={format} onChange={e => setFormat(e.target.value)}
            style={{
              width: "100%", background: "var(--dh-surface-input)", border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "8px 12px", color: "var(--dh-text-primary)",
              fontSize: 14, fontFamily: "'Figtree', sans-serif", outline: "none",
            }}
          >
            <option value="PNG">PNG</option>
            <option value="JPG">JPG</option>
            <option value="SVG">SVG</option>
            <option value="PDF">PDF</option>
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => toast("Copied to clipboard")}
            style={{
              flex: 1, background: "var(--dh-surface)", border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600,
              color: "var(--dh-text-primary)", transition: "background 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface)")}
          >
            Copy
          </button>
          <button
            onClick={() => { toast("Export started"); onClose(); }}
            style={{
              flex: 1, background: "var(--dh-accent)", border: "none",
              borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700,
              color: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "opacity 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Download size={15} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Context Radial Menu ──────────────────────────────────────────────────────

function ContextMenu({ x, y, onClose, onAdd }: {
  x: number; y: number; onClose: () => void; onAdd: (type: NodeType) => void;
}) {
  const items = [
    { icon: Image, label: "Image", type: "image" as NodeType },
    { icon: Code2, label: "Code", type: "code" as NodeType },
    { icon: MousePointer2, label: "Select", type: "text" as NodeType },
    { icon: Link2, label: "Link", type: "link" as NodeType },
  ];
  const angles = [-45, 45, -135, 135];
  const r = 64;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 150 }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", left: x, top: y }}>
        {/* Center dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--dh-accent)",
          position: "absolute", left: -4, top: -4,
        }} />
        {items.map(({ icon: Icon, label, type }, i) => {
          const angle = (angles[i] * Math.PI) / 180;
          const cx = Math.cos(angle) * r;
          const cy = Math.sin(angle) * r;
          return (
            <button
              key={label}
              title={label}
              onClick={e => { e.stopPropagation(); onAdd(type); onClose(); }}
              style={{
                position: "absolute",
                left: cx - 20, top: cy - 20,
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--dh-surface-raised)",
                border: "1px solid var(--dh-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--dh-text-primary)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                transition: "background 150ms, transform 150ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--dh-accent)"; e.currentTarget.style.color = "#1A1A1A"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--dh-surface-raised)"; e.currentTarget.style.color = "var(--dh-text-primary)"; }}
            >
              <Icon size={16} strokeWidth={1.8} />
            </button>
          );
        })}
        {/* Label */}
        <div style={{
          position: "absolute", left: 12, top: -20,
          fontSize: 11, color: "var(--dh-accent)",
          fontFamily: "'Fira Mono', monospace",
          background: "var(--dh-surface-raised)",
          padding: "2px 6px", borderRadius: 4,
          border: "1px solid var(--dh-border)",
          whiteSpace: "nowrap",
        }}>
          + add node
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProjectCanvas() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<CanvasMode>("editing");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES);
  const [connections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled 1");
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, []);

  const addNode = useCallback((type: NodeType) => {
    const id = `n${Date.now()}`;
    const center = canvasRef.current;
    const rect = center?.getBoundingClientRect();
    const x = rect ? (rect.width / 2 - 72) + Math.random() * 100 - 50 : 300;
    const y = rect ? (rect.height / 2) + Math.random() * 100 - 50 : 200;
    const content = type === "text" ? "new idea" : type === "link" ? "https://example.com" : "Image";
    setNodes(prev => [...prev, { id, type, x, y, content }]);
    setMode("editing");
    toast(`${type} node added`);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--dh-bg)" }}>
      <NavRail mode="canvas" activeProject={1} />

      {/* Canvas area */}
      <div
        ref={canvasRef}
        className="canvas-grid"
        style={{
          marginLeft: 72,
          flex: 1,
          position: "relative",
          overflow: "hidden",
          cursor: contextMenu ? "crosshair" : "default",
        }}
        onContextMenu={handleCanvasRightClick}
        onClick={handleCanvasClick}
      >
        {/* Top chrome */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", zIndex: 10,
          background: "linear-gradient(to bottom, rgba(30,30,30,0.9) 0%, transparent 100%)",
        }}>
          {/* Project title */}
          <button
            style={{
              background: "transparent", border: "none",
              display: "flex", alignItems: "center", gap: 6,
              color: "var(--dh-text-muted)", fontSize: 16, fontWeight: 600,
              fontFamily: "'Figtree', sans-serif",
            }}
            onClick={() => toast("Rename coming soon")}
          >
            {projectTitle}
            <ChevronDown size={14} />
          </button>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "'Fira Mono', monospace",
              fontSize: 11, color: "var(--dh-text-disabled)",
              marginRight: 8,
            }}>
              ctrl/cmd +/- Zoom · middle scroll: pan
            </span>
            <button
              onClick={() => toast("Organize coming soon")}
              style={{
                background: "var(--dh-surface)", border: "1px solid var(--dh-border)",
                borderRadius: 8, padding: "6px 14px", fontSize: 13,
                color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--dh-surface)")}
            >
              Organize
            </button>
            <button
              onClick={() => setOverlay("export")}
              style={{
                background: "#D3D4D9", border: "none",
                borderRadius: 8, padding: "6px 14px", fontSize: 13,
                color: "#1A1A1A", fontWeight: 700, fontFamily: "'Figtree', sans-serif",
                transition: "opacity 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Export
            </button>
          </div>
        </div>

        {/* Connection lines */}
        <ConnectionLines nodes={nodes} connections={connections} />

        {/* Canvas nodes */}
        {nodes.map(node => (
          <CanvasNodeEl
            key={node.id}
            node={node}
            selected={selectedNode === node.id}
            onSelect={setSelectedNode}
          />
        ))}

        {/* Agent mode indicator */}
        {mode === "agent" && (
          <div style={{
            position: "absolute", top: 60, right: 20,
            background: "rgba(255,0,233,0.12)",
            border: "1px solid rgba(255,0,233,0.3)",
            borderRadius: 8, padding: "6px 12px",
            fontSize: 12, color: "var(--dh-agent)",
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "'Fira Mono', monospace",
          }}>
            <Sparkles size={12} />
            Agent is co-creating...
          </div>
        )}

        {/* Selected node inline toolbar */}
        {selectedNode && (() => {
          const node = nodes.find(n => n.id === selectedNode);
          if (!node) return null;
          return (
            <div style={{
              position: "absolute",
              left: node.x, top: node.y - 44,
              background: "var(--dh-surface-raised)",
              border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "4px 8px",
              display: "flex", alignItems: "center", gap: 2,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: 20,
            }}>
              {[
                { icon: Bold, label: "Bold" },
                { icon: Italic, label: "Italic" },
                { icon: Link2, label: "Link" },
                { icon: Sparkles, label: "AI" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  title={label}
                  onClick={() => toast(`${label} coming soon`)}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: "transparent", border: "none",
                    color: "var(--dh-text-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon size={13} strokeWidth={2} />
                </button>
              ))}
            </div>
          );
        })()}

        {/* Context radial menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onAdd={addNode}
          />
        )}

        {/* Toolbar */}
        <CanvasToolbar
          mode={mode}
          onModeChange={setMode}
          onOverlay={setOverlay}
          onAddNode={addNode}
        />

        {/* Media search overlay */}
        {overlay === "media-search" && (
          <MediaSearchOverlay onClose={() => setOverlay("none")} />
        )}

        {/* Export modal */}
        {overlay === "export" && (
          <ExportModal onClose={() => setOverlay("none")} />
        )}
      </div>
    </div>
  );
}
