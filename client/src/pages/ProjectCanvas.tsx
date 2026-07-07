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
  Copy, Search, X, Download, ChevronDown, ChevronUp, ZoomIn, ZoomOut,
  Bold, Italic, Star, HelpCircle, AlertCircle, Circle,
  StickyNote, Waypoints, Trash2, BringToFront, SendToBack, Eye,
} from "lucide-react";
import NavRail from "@/components/NavRail";

// ── Types ────────────────────────────────────────────────────────────────────

type NodeType = "text" | "link" | "image" | "code" | "sticky" | "sticker";
type StickerKind = "star" | "question" | "exclamation" | "circle";
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
  height?: number; // only sticky notes resize on both axes; other types are width-only
  color?: string; // sticky note background
  sticker?: StickerKind; // set only when type === "sticker"
  fontSize?: number; // text nodes scale via this instead of width/height
  textColor?: string; // text node font color
  codePreview?: boolean; // code nodes: showing rendered output instead of the editor
  imageUrl?: string; // image nodes: the dragged/picked-in image, as a data URL
}

interface Connection {
  id: string;
  from: string;
  to: string;
  isAgent?: boolean;
}

// Fallback footprint for connection-line anchoring and drag/resize math
// before a node has been explicitly resized.
const NODE_DEFAULT_SIZE: Record<NodeType, { width: number; height: number }> = {
  text: { width: 140, height: 28 },
  link: { width: 200, height: 64 },
  image: { width: 180, height: 148 },
  code: { width: 280, height: 160 },
  sticky: { width: 160, height: 140 },
  sticker: { width: 40, height: 40 },
};

const EDITABLE_NODE_TYPES: NodeType[] = ["text", "sticky", "code", "image", "link"];

const STICKY_COLORS = ["#F5D90A", "#FF8FB1", "#8FE3A6", "#9FB4FF"];
const TEXT_COLORS = ["#FFFFFF", "#E1FF00", "#4DA3FF", "#FF4D9E", "#8FE3A6", "#FF8A4D"];

const STICKER_META: Record<StickerKind, { icon: React.ElementType; color: string }> = {
  star: { icon: Star, color: "#FFD60A" },
  question: { icon: HelpCircle, color: "#4DA3FF" },
  exclamation: { icon: AlertCircle, color: "#FF4D4D" },
  circle: { icon: Circle, color: "#FF4D4D" },
};

function getNodeSize(node: CanvasNode) {
  const def = NODE_DEFAULT_SIZE[node.type];
  return { width: node.width ?? def.width, height: node.height ?? def.height };
}

function nodeContainsPoint(node: CanvasNode, x: number, y: number) {
  const { width, height } = getNodeSize(node);
  return x >= node.x && x <= node.x + width && y >= node.y && y <= node.y + height;
}

// Clips a line so it lands on a node's rectangle edge instead of running
// straight into its center — projects the node's center out toward
// (towardX, towardY) until it hits the box boundary.
function clipToNodeEdge(node: CanvasNode, towardX: number, towardY: number) {
  const { width, height } = getNodeSize(node);
  const cx = node.x + width / 2;
  const cy = node.y + height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// Link nodes have no real metadata-scraped preview, so the "title" is just
// the URL's own hostname — the raw URL itself is still shown underneath.
function getLinkTitle(url: string) {
  try {
    const { hostname } = new URL(url.startsWith("http") ? url : `https://${url}`);
    return hostname.replace(/^www\./, "");
  } catch {
    return "Untitled Link";
  }
}

function toHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
// Snaps to a clean 10%-of-100% step so repeated zooming lands on 30%, 40%,
// 130%... instead of drifting off-grid from float rounding error.
const snapZoom = (z: number) => Math.round(z * 100) / 100;

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
  { id: "c1", from: "n1", to: "n2", isAgent: false },
  { id: "c2", from: "n2", to: "n3", isAgent: false },
  { id: "c3", from: "n1", to: "n4", isAgent: false },
  { id: "c4", from: "n4", to: "n5", isAgent: false },
  { id: "c5", from: "n2", to: "a1", isAgent: true },
  { id: "c6", from: "n3", to: "a2", isAgent: true },
];

const MEDIA_TABS = ["Image", "UI", "UX", "Text", "Video", "Sound", "Animation"];
const MEDIA_RESULTS = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  h: [160, 120, 180, 140, 200, 130, 170, 150, 190][i],
  color: ["#1e2a1e", "#1a1a2e", "#2a1a1a", "#1e1e2a", "#2a2a1a", "#1a2a2a", "#2a1a2a", "#1e2a2a", "#2a2a2e"][i],
  label: ["Mobbin", "Are.na", "Pinterest", "Dribbble", "Behance", "Awwwards", "Mobbin", "Are.na", "Pinterest"][i],
}));

// ── Canvas Node rendering ────────────────────────────────────────────────────

function CanvasNodeEl({
  node, selected, connectMode, editing, editValue,
  onMouseDown, onStartEdit, onEditChange, onCommitEdit, onResizeStart, onTextWidthResizeStart, onToggleCodePreview, onContextMenu,
  onOpenLink, onRequestImageUpload, onImageDrop,
}: {
  node: CanvasNode;
  selected: boolean;
  connectMode: boolean;
  editing: boolean;
  editValue: string;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onStartEdit: (id: string) => void;
  onEditChange: (value: string) => void;
  onCommitEdit: () => void;
  onResizeStart: (id: string, e: React.MouseEvent) => void;
  onTextWidthResizeStart: (id: string, side: "left" | "right", e: React.MouseEvent) => void;
  onToggleCodePreview: (id: string) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  onOpenLink: (id: string) => void;
  onRequestImageUpload: (id: string) => void;
  onImageDrop: (id: string, e: React.DragEvent) => void;
}) {
  // A link node's title needs to tell a single click (open the URL) apart
  // from a double-click (stopPropagation, no open) — but browsers fire two
  // independent "click" events before "dblclick" even lands, so without
  // this a double-click would briefly open the link twice. Debouncing the
  // open behind a short timeout, cancelled by the dblclick, fixes that.
  const titleClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (titleClickTimeoutRef.current) clearTimeout(titleClickTimeoutRef.current); }, []);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    cursor: connectMode ? "crosshair" : "grab",
    userSelect: "none",
    // The parent world-space layer sets pointerEvents:none (so blank canvas
    // space isn't hit-tested as a node) — nodes opt back in individually.
    pointerEvents: "auto",
    transition: "box-shadow 150ms",
  };

  const editKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommitEdit(); }
    if (e.key === "Escape") onCommitEdit();
  };

  // Bottom-right corner handle shared by the box-shaped node types. Text
  // instead scales font size via a bottom-center handle — bottom-right is
  // reserved on text nodes for the width side-handles' hit area.
  const resizeHandle = selected && !connectMode && (
    <div
      onMouseDown={e => { e.stopPropagation(); onResizeStart(node.id, e); }}
      style={
        node.type === "text"
          ? {
              position: "absolute", left: "50%", bottom: -5, transform: "translateX(-50%)",
              width: 12, height: 12, borderRadius: 3,
              background: "var(--dh-accent)",
              cursor: "ns-resize",
              boxShadow: "0 0 0 2px var(--dh-surface)",
            }
          : {
              position: "absolute", right: -5, bottom: -5,
              width: 12, height: 12, borderRadius: 3,
              background: "var(--dh-accent)",
              cursor: "nwse-resize",
              boxShadow: "0 0 0 2px var(--dh-surface)",
            }
      }
    />
  );

  if (node.type === "text") {
    // Undefined width = hugs its content, like a normal label. Only set once
    // a side handle has been dragged, at which point it wraps within that
    // fixed width instead of hugging.
    const fixedWidth = node.width !== undefined;
    // Width stays a fixed thickness, but height tracks font size a little so
    // the handle doesn't look stranded once the text has been stretched
    // much bigger via the font-size handle — 20px at the default size 20.
    const widthHandleHeight = 14 + (node.fontSize ?? 20) * 0.3;
    return (
      <div
        style={{
          ...baseStyle,
          fontFamily: "'Mynerve', cursive",
          fontSize: node.fontSize ?? 20,
          color: node.textColor ?? (node.isAgent ? "var(--dh-agent)" : "var(--dh-text-primary)"),
          padding: "4px 8px",
          borderRadius: 6,
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.5)" : "none",
          background: selected ? "rgba(225,255,0,0.06)" : "transparent",
          width: fixedWidth ? node.width : undefined,
          whiteSpace: fixedWidth ? "normal" : "nowrap",
          wordBreak: fixedWidth ? "break-word" : undefined,
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
        onDoubleClick={() => onStartEdit(node.id)}
      >
        {editing ? (
          fixedWidth ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={editKeyDown}
              onMouseDown={e => e.stopPropagation()}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                font: "inherit", color: "inherit",
              }}
            />
          ) : (
            // Auto-width: an <input> defaults to a fixed ~20ch regardless of
            // its value, which was making the box balloon out the instant
            // editing started — this CSS-grid ghost-element trick (see
            // .dh-autosize-text) sizes it to the actual typed content instead.
            <div className="dh-autosize-text" data-value={editValue || " "}>
              <input
                autoFocus
                value={editValue}
                onChange={e => onEditChange(e.target.value)}
                onBlur={onCommitEdit}
                onKeyDown={editKeyDown}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  font: "inherit", color: "inherit",
                }}
              />
            </div>
          )
        ) : node.content || <span style={{ opacity: 0.4 }}>Type something…</span>}
        {selected && !connectMode && (
          <>
            <div
              onMouseDown={e => { e.stopPropagation(); onTextWidthResizeStart(node.id, "left", e); }}
              style={{
                position: "absolute", left: -9, top: "50%", transform: "translateY(-50%)",
                width: 10, height: widthHandleHeight, borderRadius: 999,
                background: "#4DA3FF",
                cursor: "ew-resize",
                boxShadow: "0 0 0 2px var(--dh-surface)",
              }}
            />
            <div
              onMouseDown={e => { e.stopPropagation(); onTextWidthResizeStart(node.id, "right", e); }}
              style={{
                position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)",
                width: 10, height: widthHandleHeight, borderRadius: 999,
                background: "#4DA3FF",
                cursor: "ew-resize",
                boxShadow: "0 0 0 2px var(--dh-surface)",
              }}
            />
          </>
        )}
        {resizeHandle}
      </div>
    );
  }

  if (node.type === "link") {
    const linkTitle = getLinkTitle(node.content);
    return (
      <div
        style={{
          ...baseStyle,
          background: "var(--dh-surface)",
          border: `1px solid ${selected ? "var(--dh-accent)" : "var(--dh-border)"}`,
          borderRadius: 10,
          overflow: "hidden",
          width: node.width ?? NODE_DEFAULT_SIZE.link.width,
          height: node.height,
          display: "flex",
          flexDirection: "column",
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.2)" : "none",
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
        onDoubleClick={() => onStartEdit(node.id)}
      >
        {/* Preview — same "box above, text below" shape as image nodes;
            there's no metadata-scraped thumbnail source here, so it's a
            static placeholder rather than a real fetched preview. */}
        <div style={{ flex: 1, minHeight: 80, background: "#1a2a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Link2 size={24} color="var(--dh-text-disabled)" />
        </div>
        <div style={{ padding: "8px 10px", flexShrink: 0 }}>
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={editKeyDown}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", font: "inherit", color: "inherit", fontSize: 13 }}
            />
          ) : (
            <>
              {/* Title opens the link on a plain click; a double-click here
                  is swallowed (stopPropagation) so it doesn't also fall
                  through to the card's edit-the-URL double-click below. */}
              <div
                onClick={e => {
                  e.stopPropagation();
                  titleClickTimeoutRef.current = setTimeout(() => {
                    titleClickTimeoutRef.current = null;
                    onOpenLink(node.id);
                  }, 220);
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (titleClickTimeoutRef.current) { clearTimeout(titleClickTimeoutRef.current); titleClickTimeoutRef.current = null; }
                }}
                style={{ fontSize: 13, color: "var(--dh-text-primary)", fontWeight: 500, cursor: "pointer" }}
              >
                {linkTitle}
              </div>
              <div style={{ fontSize: 11, color: "var(--dh-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {node.content}
              </div>
            </>
          )}
        </div>
        {resizeHandle}
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
          width: node.width ?? NODE_DEFAULT_SIZE.image.width,
          height: node.height,
          display: "flex",
          flexDirection: "column",
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.2)" : "none",
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
      >
        {/* Double-click opens the file picker; the area also always accepts
            a dropped image file directly, matching how OS/browser image
            drag-and-drop normally works. */}
        <div
          onDoubleClick={e => { e.stopPropagation(); onRequestImageUpload(node.id); }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => onImageDrop(node.id, e)}
          style={{
            flex: 1, minHeight: 100,
            background: node.imageUrl ? `#1a2a1a url(${node.imageUrl}) center/cover no-repeat` : "#1a2a1a",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          {!node.imageUrl && <Image size={28} color="var(--dh-text-disabled)" />}
        </div>
        <div
          style={{ padding: "8px 10px", flexShrink: 0 }}
          onDoubleClick={e => { e.stopPropagation(); onStartEdit(node.id); }}
        >
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={editKeyDown}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", font: "inherit", color: "inherit", fontSize: 12 }}
            />
          ) : (
            <div style={{ fontSize: 12, color: "var(--dh-text-secondary)" }}>{node.content}</div>
          )}
        </div>
        {resizeHandle}
      </div>
    );
  }

  if (node.type === "code") {
    return (
      <div
        style={{
          ...baseStyle,
          background: "#151515",
          border: `1px solid ${selected ? "var(--dh-accent)" : "var(--dh-border)"}`,
          borderRadius: 10,
          padding: "10px 14px",
          width: node.width ?? NODE_DEFAULT_SIZE.code.width,
          height: node.height ?? NODE_DEFAULT_SIZE.code.height,
          display: "flex",
          flexDirection: "column",
          boxShadow: selected ? "0 0 0 2px rgba(225,255,0,0.2)" : "none",
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
        onDoubleClick={() => onStartEdit(node.id)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace" }}>{"</>"} code</div>
          <button
            title={node.codePreview ? "Show code" : "Preview"}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onToggleCodePreview(node.id)}
            style={{
              width: 20, height: 20, borderRadius: 4,
              background: "transparent", border: "none",
              color: "var(--dh-text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {node.codePreview ? <Code2 size={12} /> : <Eye size={12} />}
          </button>
        </div>
        {node.codePreview ? (
          <iframe
            title={`${node.id}-preview`}
            srcDoc={node.content}
            sandbox="allow-scripts"
            onMouseDown={e => e.stopPropagation()}
            style={{ flex: 1, width: "100%", border: "none", borderRadius: 6, background: "#fff" }}
          />
        ) : editing ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => { if (e.key === "Escape") onCommitEdit(); }}
            onMouseDown={e => e.stopPropagation()}
            spellCheck={false}
            style={{
              flex: 1, width: "100%", resize: "none",
              background: "transparent", border: "none", outline: "none",
              fontSize: 12, color: "var(--dh-text-primary)", fontFamily: "'Fira Mono', monospace", lineHeight: 1.5,
            }}
          />
        ) : (
          <pre style={{ margin: 0, flex: 1, overflow: "auto", fontSize: 12, color: "var(--dh-text-primary)", fontFamily: "'Fira Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {node.content || <span style={{ opacity: 0.4 }}>// type some code…</span>}
          </pre>
        )}
        {resizeHandle}
      </div>
    );
  }

  if (node.type === "sticky") {
    return (
      <div
        style={{
          ...baseStyle,
          background: node.color ?? STICKY_COLORS[0],
          borderRadius: 4,
          padding: 12,
          width: node.width ?? NODE_DEFAULT_SIZE.sticky.width,
          height: node.height ?? NODE_DEFAULT_SIZE.sticky.height,
          boxShadow: selected ? "0 0 0 2px var(--dh-accent), 0 8px 20px rgba(0,0,0,0.4)" : "0 4px 14px rgba(0,0,0,0.35)",
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
        onDoubleClick={() => onStartEdit(node.id)}
      >
        {editing ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => { if (e.key === "Escape") onCommitEdit(); }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: "100%", height: "100%", resize: "none",
              background: "transparent", border: "none", outline: "none",
              fontSize: 13, color: "#1A1A1A", fontFamily: "'Figtree', sans-serif", lineHeight: 1.4,
            }}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#1A1A1A", fontFamily: "'Figtree', sans-serif", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {node.content}
          </div>
        )}
        {resizeHandle}
      </div>
    );
  }

  if (node.type === "sticker") {
    const kind = node.sticker ?? "star";
    const { icon: Icon, color } = STICKER_META[kind];
    return (
      <div
        style={{
          ...baseStyle,
          width: NODE_DEFAULT_SIZE.sticker.width,
          height: NODE_DEFAULT_SIZE.sticker.height,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%",
          boxShadow: selected ? "0 0 0 2px var(--dh-accent)" : "none",
        }}
        onMouseDown={e => onMouseDown(node.id, e)}
        onContextMenu={e => onContextMenu(node.id, e)}
      >
        <Icon size={28} color={color} fill={kind === "star" ? color : "none"} strokeWidth={2} />
      </div>
    );
  }

  return null;
}

// ── SVG Connections ──────────────────────────────────────────────────────────

interface ReattachDraft {
  connectionId: string;
  end: "from" | "to";
  fixedId: string;
  x: number;
  y: number;
}

function ConnectionLines({
  nodes, connections, connectDraft, selectedConnectionId, reattachDraft,
  connectMode, onSelectConnection, onHandleMouseDown,
}: {
  nodes: CanvasNode[];
  connections: Connection[];
  connectDraft: { from: string; x: number; y: number } | null;
  selectedConnectionId: string | null;
  reattachDraft: ReattachDraft | null;
  connectMode: boolean;
  onSelectConnection: (id: string, e: React.MouseEvent) => void;
  onHandleMouseDown: (connectionId: string, end: "from" | "to", e: React.MouseEvent) => void;
}) {
  const getCenter = (n: CanvasNode) => {
    const { width, height } = getNodeSize(n);
    return { x: n.x + width / 2, y: n.y + height / 2 };
  };

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      {connections.map(c => {
        const fromNode = nodes.find(n => n.id === c.from);
        const toNode = nodes.find(n => n.id === c.to);
        if (!fromNode || !toNode) return null;

        // Mid-reattach: draw a live dashed line from the still-fixed end to
        // the cursor instead of the connection's normal (both-ends-anchored) line.
        if (reattachDraft && reattachDraft.connectionId === c.id) {
          const fixedNode = reattachDraft.end === "from" ? toNode : fromNode;
          const fixed = clipToNodeEdge(fixedNode, reattachDraft.x, reattachDraft.y);
          return (
            <line
              key={c.id}
              x1={fixed.x} y1={fixed.y}
              x2={reattachDraft.x} y2={reattachDraft.y}
              stroke="var(--dh-accent)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.8}
            />
          );
        }

        const fromCenter = getCenter(fromNode);
        const toCenter = getCenter(toNode);
        const from = clipToNodeEdge(fromNode, toCenter.x, toCenter.y);
        const to = clipToNodeEdge(toNode, fromCenter.x, fromCenter.y);
        const isSelected = c.id === selectedConnectionId;

        return (
          <g key={c.id}>
            <line
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isSelected ? "var(--dh-accent)" : c.isAgent ? "var(--dh-accent)" : "var(--dh-graph)"}
              strokeWidth={isSelected ? 2 : 1.5}
              strokeDasharray={c.isAgent ? "5 4" : "none"}
              opacity={isSelected ? 1 : 0.7}
            />
            {/* Invisible wide hit-area — a 1.5px line is otherwise nearly
                impossible to click precisely. */}
            {!connectMode && (
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseDown={e => onSelectConnection(c.id, e)}
              />
            )}
            {isSelected && (
              <>
                <circle
                  cx={from.x} cy={from.y} r={5}
                  fill="var(--dh-surface)" stroke="var(--dh-accent)" strokeWidth={2}
                  style={{ pointerEvents: "auto", cursor: "grab" }}
                  onMouseDown={e => onHandleMouseDown(c.id, "from", e)}
                />
                <circle
                  cx={to.x} cy={to.y} r={5}
                  fill="var(--dh-surface)" stroke="var(--dh-accent)" strokeWidth={2}
                  style={{ pointerEvents: "auto", cursor: "grab" }}
                  onMouseDown={e => onHandleMouseDown(c.id, "to", e)}
                />
              </>
            )}
          </g>
        );
      })}
      {connectDraft && (() => {
        const fromNode = nodes.find(n => n.id === connectDraft.from);
        if (!fromNode) return null;
        const from = clipToNodeEdge(fromNode, connectDraft.x, connectDraft.y);
        return (
          <line
            x1={from.x} y1={from.y}
            x2={connectDraft.x} y2={connectDraft.y}
            stroke="var(--dh-accent)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.8}
          />
        );
      })()}
    </svg>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function CanvasToolbar({
  mode, onModeChange, onOverlay, onAddNode,
  connectMode, onToggleConnect, onSelectTool,
  stickerPicker, onToggleStickerPicker, onPickSticker,
}: {
  mode: CanvasMode;
  onModeChange: (m: CanvasMode) => void;
  onOverlay: (o: Overlay) => void;
  onAddNode: (type: NodeType) => void;
  connectMode: boolean;
  onToggleConnect: () => void;
  onSelectTool: () => void;
  stickerPicker: boolean;
  onToggleStickerPicker: () => void;
  onPickSticker: (kind: StickerKind) => void;
}) {
  const tools = [
    { icon: MousePointer2, label: "Select", action: onSelectTool, active: false },
    { icon: Image, label: "Image", action: () => onAddNode("image"), active: false },
    { icon: Type, label: "Text", action: () => onAddNode("text"), active: false },
    { icon: Link2, label: "Link", action: () => onAddNode("link"), active: false },
    { icon: Code2, label: "Code", action: () => onAddNode("code"), active: false },
    { icon: StickyNote, label: "Sticky Note", action: () => onAddNode("sticky"), active: false },
    { icon: Star, label: "Sticker", action: onToggleStickerPicker, active: stickerPicker },
    { icon: Waypoints, label: "Connect", action: onToggleConnect, active: connectMode },
    { icon: Pen, label: "Draw", action: () => toast("Draw tool coming soon"), active: false },
  ];

  return (
    <div
      onWheel={e => e.stopPropagation()}
      style={{
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
      {stickerPicker && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 6,
          background: "var(--dh-surface-raised)", border: "1px solid var(--dh-border)",
          borderRadius: 12, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {(Object.keys(STICKER_META) as StickerKind[]).map(kind => {
            const { icon: Icon, color } = STICKER_META[kind];
            return (
              <button
                key={kind}
                title={kind}
                onClick={() => onPickSticker(kind)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "transparent", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Icon size={18} color={color} fill={kind === "star" ? color : "none"} />
              </button>
            );
          })}
        </div>
      )}

      {tools.map(({ icon: Icon, label, action, active }) => (
        <button
          key={label}
          title={label}
          onClick={action}
          style={{
            width: 36, height: 36, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: active ? "var(--dh-accent)" : "transparent",
            border: "none",
            color: active ? "#1A1A1A" : "var(--dh-text-secondary)",
            transition: "background 150ms, color 150ms",
          }}
          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--dh-text-primary)"; } }}
          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--dh-text-secondary)"; } }}
        >
          <Icon size={16} strokeWidth={1.8} />
        </button>
      ))}

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
    <div
      onWheel={e => e.stopPropagation()}
      style={{
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
          <span style={{ fontSize: 12, color: "var(--dh-text-muted)", fontFamily: "'Fira Mono', monospace" }}>Canvas Preview</span>
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
    { icon: StickyNote, label: "Sticky Note", type: "sticky" as NodeType },
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
      </div>
    </div>
  );
}

// Right-click-on-a-node arrange menu — a plain vertical list (Figma/Adobe
// convention for object context menus), unlike the radial "add node" menu
// blank canvas gets.
function NodeArrangeMenu({ x, y, onClose, onArrange }: {
  x: number; y: number; onClose: () => void;
  onArrange: (action: "front" | "forward" | "backward" | "back") => void;
}) {
  const items = [
    { icon: BringToFront, label: "Bring to Front", action: "front" as const },
    { icon: ChevronUp, label: "Bring Forward", action: "forward" as const },
    { icon: ChevronDown, label: "Send Backward", action: "backward" as const },
    { icon: SendToBack, label: "Send to Back", action: "back" as const },
  ];
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 150 }}
      onClick={onClose}
      onContextMenu={e => { e.preventDefault(); onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", left: x, top: y,
          minWidth: 180,
          background: "var(--dh-surface-raised)",
          border: "1px solid var(--dh-border)",
          borderRadius: 8, padding: 4,
          display: "flex", flexDirection: "column",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {items.map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={() => { onArrange(action); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 10px", borderRadius: 6,
              background: "transparent", border: "none",
              color: "var(--dh-text-primary)", fontSize: 13,
              fontFamily: "'Figtree', sans-serif", textAlign: "left",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Icon size={14} strokeWidth={1.8} />
            {label}
          </button>
        ))}
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
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
  const textColorPopoverRef = useRef<HTMLDivElement>(null);

  // FigJam-style "click the swatch to open a color list" popover — closes on
  // any click outside the swatch button + its popover panel.
  useEffect(() => {
    if (!textColorPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (textColorPopoverRef.current && !textColorPopoverRef.current.contains(e.target as Node)) {
        setTextColorPickerOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [textColorPickerOpen]);
  const [projectTitle, setProjectTitle] = useState("Untitled 1");
  const [connectMode, setConnectMode] = useState(false);
  const [connectDraft, setConnectDraft] = useState<{ from: string; x: number; y: number } | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [reattachDraft, setReattachDraft] = useState<ReattachDraft | null>(null);
  const [stickerPicker, setStickerPicker] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  // Marquee/rubber-band selection rectangle, in screen space (it's a
  // selection-UI overlay, not canvas content, so it doesn't scale with zoom).
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mirrors state so the window-level drag/connect listeners (subscribed once
  // below) always read fresh data via refs instead of resubscribing per render.
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const connectionsRef = useRef(connections);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  const connectDraftRef = useRef(connectDraft);
  useEffect(() => { connectDraftRef.current = connectDraft; }, [connectDraft]);
  const reattachDraftRef = useRef(reattachDraft);
  useEffect(() => { reattachDraftRef.current = reattachDraft; }, [reattachDraft]);
  // In-memory clipboard for Ctrl/Cmd+C/V — not the OS clipboard, since these
  // are canvas node/connection objects, not text.
  const clipboardRef = useRef<{ nodes: CanvasNode[]; connections: Connection[] } | null>(null);
  const panRef = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Multi-node drag: each dragged node keeps its own recorded origin so the
  // whole selection moves together by the same world-space delta.
  const dragRef = useRef<{ ids: string[]; startWorldX: number; startWorldY: number; origins: Map<string, { x: number; y: number }> } | null>(null);
  // Tracks whether the current mousedown-on-a-node turned into an actual
  // drag (vs. a plain click) — a link node's title needs this to avoid
  // opening the URL right after the user finished repositioning the card,
  // since a click still fires on mouseup even after real pointer movement.
  const dragMovedRef = useRef(false);
  const panDragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startWidth: number; startHeight: number; startFontSize: number; startX: number; startY: number } | null>(null);
  // Text nodes hug their content by default (node.width undefined); dragging
  // a side handle pins node.width to a fixed value from then on.
  const textWidthResizeRef = useRef<{ id: string; side: "left" | "right"; startWidth: number; startNodeX: number; startX: number } | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number; additive: boolean } | null>(null);
  // A completed marquee-drag still fires a native click afterward (mousedown
  // and mouseup both land on the canvas), which would otherwise immediately
  // wipe out the selection the marquee just made — this suppresses that one click.
  const suppressNextClickRef = useRef(false);

  // Wheel-scroll panning has no discrete start/end event like middle-drag
  // does, so treat it as "panning" until scroll ticks stop arriving for a beat.
  const [isWheelPanning, setIsWheelPanning] = useState(false);
  const wheelPanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wheelPanTimeoutRef.current) clearTimeout(wheelPanTimeoutRef.current); }, []);
  const isAnyPanning = isPanning || isWheelPanning;

  const handleCanvasRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Right-clicking a node shows the Figma/Adobe-style arrange menu instead of
  // the blank-canvas "add node" radial menu — selects the node first (if it
  // wasn't already the selection) so the menu's target is unambiguous.
  const handleNodeContextMenu = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(current => (current.has(id) ? current : new Set([id])));
    setSelectedConnectionId(null);
    setNodeContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  // Only deselect/close menus when the canvas background itself was clicked,
  // not when a click bubbles up from a node — same mousedown/click-target
  // ambiguity handled the same way for the Home hero canvas.
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    setSelectedIds(new Set());
    setNodeContextMenu(null);
    setSelectedConnectionId(null);
    setContextMenu(null);
    setStickerPicker(false);
  }, []);

  const handleSelectConnection = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectMode) return;
    setSelectedIds(new Set());
    setSelectedConnectionId(id);
  }, [connectMode]);

  const handleConnectionHandleMouseDown = useCallback((connectionId: string, end: "from" | "to", e: React.MouseEvent) => {
    e.stopPropagation();
    const conn = connectionsRef.current.find(c => c.id === connectionId);
    if (!conn) return;
    const fixedId = end === "from" ? conn.to : conn.from;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
    setReattachDraft({ connectionId, end, fixedId, x, y });
  }, []);

  const addNode = useCallback((type: NodeType, extra?: Partial<CanvasNode>) => {
    const id = `n${Date.now()}`;
    const rect = canvasRef.current?.getBoundingClientRect();
    // New nodes appear near the middle of the current viewport — convert the
    // screen-space center through the current pan/zoom to world coordinates.
    const worldCenterX = rect ? (rect.width / 2 - pan.x) / zoom : 300;
    const worldCenterY = rect ? (rect.height / 2 - pan.y) / zoom : 200;
    const x = worldCenterX - 72 + Math.random() * 100 - 50;
    const y = worldCenterY + Math.random() * 100 - 50;
    const content = type === "text" ? "new idea"
      : type === "link" ? "https://example.com"
      : type === "sticky" ? "Sticky note"
      : type === "code" ? "// new snippet"
      : type === "sticker" ? ""
      : "Image";
    setNodes(prev => [...prev, { id, type, x, y, content, ...extra }]);
    setSelectedIds(new Set([id]));
    setMode("editing");
    toast(`${type === "sticker" ? "Sticker" : type} added`);
  }, [pan, zoom]);

  const addSticker = useCallback((kind: StickerKind) => {
    addNode("sticker", { sticker: kind, content: kind });
    setStickerPicker(false);
  }, [addNode]);

  // Duplicates every currently-selected node (offset by +24,+24) and selects
  // the new copies — used by the Duplicate button, Ctrl/Cmd+D, and as the
  // first half of alt-drag-to-duplicate.
  const duplicateSelected = useCallback(() => {
    setSelectedIds(prevSelected => {
      if (prevSelected.size === 0) return prevSelected;
      const copies: CanvasNode[] = [];
      const newIds: string[] = [];
      nodesRef.current.forEach(n => {
        if (prevSelected.has(n.id)) {
          const newId = `n${Date.now()}_${n.id}`;
          newIds.push(newId);
          copies.push({ ...n, id: newId, x: n.x + 24, y: n.y + 24, isAgent: false });
        }
      });
      setNodes(prev => [...prev, ...copies]);
      return new Set(newIds);
    });
  }, []);

  const deleteSelected = useCallback(() => {
    setSelectedIds(prevSelected => {
      if (prevSelected.size === 0) return prevSelected;
      setNodes(prev => prev.filter(n => !prevSelected.has(n.id)));
      setConnections(prev => prev.filter(c => !prevSelected.has(c.from) && !prevSelected.has(c.to)));
      setEditingNodeId(prev => (prev && prevSelected.has(prev) ? null : prev));
      return new Set();
    });
  }, []);

  // Double-clicking bare canvas drops a new, empty text node right at the
  // click point and puts it straight into edit mode — bypasses addNode's
  // "somewhere near viewport center" placement since a double-click already
  // gives us an exact spot, and seeds empty content so typing starts clean.
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || connectMode) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;
    const id = `n${Date.now()}`;
    setNodes(prev => [...prev, { id, type: "text", x: worldX, y: worldY, content: "" }]);
    setSelectedIds(new Set([id]));
    setEditingNodeId(id);
    setEditValue("");
  }, [connectMode, pan, zoom]);

  const startEditing = useCallback((id: string) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node || !EDITABLE_NODE_TYPES.includes(node.type)) return;
    if (node.type === "code" && node.codePreview) return;
    setEditingNodeId(id);
    setEditValue(node.content);
  }, []);

  const commitEditing = useCallback(() => {
    setEditingNodeId(current => {
      if (current) {
        const node = nodesRef.current.find(n => n.id === current);
        // An empty text box left untyped-in isn't worth keeping around —
        // delete it rather than leaving an invisible node on the canvas.
        if (node?.type === "text" && editValue.trim() === "") {
          setNodes(prev => prev.filter(n => n.id !== current));
        } else {
          setNodes(prev => prev.map(n => (n.id === current ? { ...n, content: editValue } : n)));
        }
      }
      return null;
    });
  }, [editValue]);

  // Commits any in-flight edit first — otherwise flipping to preview mid-type
  // would silently drop whatever hadn't been blurred yet.
  const handleToggleCodePreview = useCallback((id: string) => {
    commitEditing();
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, codePreview: !n.codePreview } : n)));
  }, [commitEditing]);

  const setTextColor = useCallback((id: string, textColor: string) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, textColor } : n)));
  }, []);

  // Opens a link node's URL — but only on a genuine click, not a click that
  // fires (as browsers always do) right after the user finished dragging
  // the card to reposition it.
  const handleOpenLink = useCallback((id: string) => {
    if (dragMovedRef.current) return;
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    window.open(toHref(node.content), "_blank", "noopener,noreferrer");
  }, []);

  const applyImageFile = useCallback((id: string, file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNodes(prev => prev.map(n => (n.id === id ? { ...n, imageUrl: reader.result as string } : n)));
    };
    reader.readAsDataURL(file);
  }, []);

  // Double-clicking an image node's thumbnail opens the native file picker
  // (imageFileInputRef, rendered once at the canvas level) rather than each
  // node owning its own hidden <input> — pendingImageUploadId threads the
  // result back to the right node once a file is chosen.
  const [pendingImageUploadId, setPendingImageUploadId] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const handleRequestImageUpload = useCallback((id: string) => {
    setPendingImageUploadId(id);
    imageFileInputRef.current?.click();
  }, []);

  const handleImageFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingImageUploadId) applyImageFile(pendingImageUploadId, file);
    e.target.value = "";
    setPendingImageUploadId(null);
  }, [pendingImageUploadId, applyImageFile]);

  const handleImageDrop = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) applyImageFile(id, file);
  }, [applyImageFile]);

  // Reorders a single node within the shared z-order (nodes render in array
  // order, so later = visually on top — no separate numeric z-index needed).
  const reorderNode = useCallback((id: string, action: "front" | "back" | "forward" | "backward") => {
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === id);
      if (idx === -1) return prev;
      const arr = [...prev];
      const [node] = arr.splice(idx, 1);
      if (action === "front") arr.push(node);
      else if (action === "back") arr.unshift(node);
      else if (action === "forward") arr.splice(Math.min(idx + 1, arr.length), 0, node);
      else arr.splice(Math.max(idx - 1, 0), 0, node);
      return arr;
    });
  }, []);

  const handleNodeMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConnectionId(null);
    if (editingNodeId && editingNodeId !== id) commitEditing();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;

    if (connectMode) {
      setConnectDraft({ from: id, x: worldX, y: worldY });
      return;
    }

    // Space-hold always pans, even if the mousedown lands on a node.
    if (isSpaceHeld) {
      setIsPanning(true);
      panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
      return;
    }

    // Shift-click only toggles membership — matches Figma: it doesn't also
    // start a drag, so a shift-click never accidentally nudges the node.
    if (e.shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }

    setSelectedIds(prevSelected => {
      // Dragging a node that's already part of a multi-selection moves the
      // whole selection together; otherwise this click starts a fresh,
      // single-node selection (matches Figma's click-vs-shift-click model).
      const movingIds = prevSelected.has(id) && prevSelected.size > 1 ? Array.from(prevSelected) : [id];
      let dragIds = movingIds;

      if (e.altKey) {
        // Alt+drag: duplicate the about-to-move node(s) first and drag the
        // copies — the originals stay exactly where they were.
        const copies: CanvasNode[] = [];
        const newIds: string[] = [];
        movingIds.forEach(mid => {
          const source = nodesRef.current.find(n => n.id === mid);
          if (!source) return;
          const newId = `n${Date.now()}_${mid}`;
          newIds.push(newId);
          copies.push({ ...source, id: newId, isAgent: false });
        });
        setNodes(prev => [...prev, ...copies]);
        dragIds = newIds;
      }

      const origins = new Map<string, { x: number; y: number }>();
      dragIds.forEach((did, i) => {
        // A freshly-made copy starts at exactly its original's position.
        const source = nodesRef.current.find(n => n.id === (e.altKey ? movingIds[i] : did));
        if (source) origins.set(did, { x: source.x, y: source.y });
      });
      dragRef.current = { ids: dragIds, startWorldX: worldX, startWorldY: worldY, origins };
      dragMovedRef.current = false;

      return new Set(dragIds);
    });
  }, [connectMode, editingNodeId, commitEditing, pan, zoom, isSpaceHeld]);

  const handleResizeStart = useCallback((id: string, e: React.MouseEvent) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    const { width, height } = getNodeSize(node);
    resizeRef.current = {
      id, startWidth: width, startHeight: height,
      startFontSize: node.fontSize ?? 20,
      startX: e.clientX, startY: e.clientY,
    };
  }, []);

  // Text nodes hug their content until a side handle is dragged — measuring
  // the box's live rendered width (rather than trusting node.width, which is
  // still undefined the first time this fires) so the box doesn't jump the
  // instant the drag starts.
  const handleTextWidthResizeStart = useCallback((id: string, side: "left" | "right", e: React.MouseEvent) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    const boxRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
    if (!boxRect) return;
    const startWidth = boxRect.width / zoomRef.current;
    textWidthResizeRef.current = { id, side, startWidth, startNodeX: node.x, startX: e.clientX };
  }, []);

  // Middle-mouse-button (or space-held left-button) drag pans the canvas.
  // A plain left-button drag starting on bare canvas instead begins a
  // marquee: on release, every node whose box intersects the rectangle
  // becomes the new selection (shift held: added to the existing selection).
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
      return;
    }
    if (e.button === 0 && e.target === e.currentTarget && !connectMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      marqueeRef.current = { startX, startY, additive: e.shiftKey };
      setMarquee({ x: startX, y: startY, width: 0, height: 0 });
    }
  }, [pan, isSpaceHeld, connectMode]);

  // Zooms in/out by one fixed 10% step, anchored on the current viewport
  // center so the content visually appears to stay put — used by keyboard
  // shortcuts and the zoom control's +/- buttons. `direction` is +1 or -1;
  // a fixed additive step (not proportional to the current zoom) is what
  // keeps repeated steps landing cleanly on 10% increments.
  const zoomAtCenter = useCallback((direction: 1 | -1) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = clampZoom(snapZoom(zoom + direction * ZOOM_STEP));
    const worldX = (cx - pan.x) / zoom;
    const worldY = (cy - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: cx - worldX * newZoom, y: cy - worldY * newZoom });
  }, [zoom, pan]);

  // Plain scroll pans; ctrl/cmd+scroll (or trackpad pinch) zooms anchored
  // under the cursor, matching the Figma/FigJam convention.
  //
  // Attached as a native (non-passive) listener rather than React's onWheel:
  // React/the browser treats wheel listeners as passive by default, which
  // silently makes preventDefault() a no-op — so ctrl+scroll was *also*
  // triggering the browser's native page-zoom underneath our canvas zoom,
  // scaling the whole page (NavRail, toolbars, everything) along with it.
  // A manually-attached { passive: false } listener is the only way to
  // reliably suppress that.
  //
  // Zoom moves in fixed 10% steps per tick, using only deltaY's *sign* —
  // not its magnitude. Raw deltaY varies wildly across mice/trackpads (a
  // single "tick" can report anywhere from ~3 to 100+), so the old
  // magnitude-proportional formula could swing the multiplier negative on
  // a big tick, which clampZoom then floored to 25% — the "jumps to 25%"
  // bug. Reads/writes zoomRef/panRef directly (not React state) so a fast
  // burst of ticks compounds correctly even before a re-render commits.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const zoomNow = zoomRef.current;
      const panNow = panRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const direction = e.deltaY < 0 ? 1 : -1;
        const newZoom = clampZoom(snapZoom(zoomNow + direction * ZOOM_STEP));
        const worldX = (cursorX - panNow.x) / zoomNow;
        const worldY = (cursorY - panNow.y) / zoomNow;
        const newPan = { x: cursorX - worldX * newZoom, y: cursorY - worldY * newZoom };
        zoomRef.current = newZoom;
        panRef.current = newPan;
        setZoom(newZoom);
        setPan(newPan);
      } else {
        e.preventDefault();
        const newPan = { x: panNow.x - e.deltaX, y: panNow.y - e.deltaY };
        panRef.current = newPan;
        setPan(newPan);
        // Wheel ticks arrive in a burst with no explicit "pan ended" event —
        // treat panning as active until 150ms pass without another tick.
        setIsWheelPanning(true);
        if (wheelPanTimeoutRef.current) clearTimeout(wheelPanTimeoutRef.current);
        wheelPanTimeoutRef.current = setTimeout(() => setIsWheelPanning(false), 150);
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Single window-level drag/resize/connect-draft/pan listener pair,
  // subscribed once — reads/writes via refs and functional state updates so
  // it never needs to resubscribe mid-drag as nodes/pan/zoom change.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const zoomNow = zoomRef.current;
      const panNow = panRef.current;
      if (dragRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const { ids, startWorldX, startWorldY, origins } = dragRef.current;
        const worldX = (e.clientX - rect.left - panNow.x) / zoomNow;
        const worldY = (e.clientY - rect.top - panNow.y) / zoomNow;
        const dx = worldX - startWorldX;
        const dy = worldY - startWorldY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMovedRef.current = true;
        setNodes(prev => prev.map(n => {
          const origin = origins.get(n.id);
          if (!origin || !ids.includes(n.id)) return n;
          return { ...n, x: origin.x + dx, y: origin.y + dy };
        }));
      } else if (marqueeRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const { startX, startY } = marqueeRef.current;
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        setMarquee({
          x: Math.min(startX, curX), y: Math.min(startY, curY),
          width: Math.abs(curX - startX), height: Math.abs(curY - startY),
        });
      } else if (resizeRef.current) {
        const { id, startWidth, startHeight, startFontSize, startX, startY } = resizeRef.current;
        const dx = (e.clientX - startX) / zoomNow;
        const dy = (e.clientY - startY) / zoomNow;
        setNodes(prev => prev.map(n => {
          if (n.id !== id) return n;
          if (n.type === "text") {
            // Text has no width/height box to resize — dragging the handle
            // scales font size instead (down/right grows, up/left shrinks).
            const fontSize = Math.min(96, Math.max(10, Math.round(startFontSize + dy / 2)));
            return { ...n, fontSize };
          }
          const width = Math.max(80, startWidth + dx);
          const height = Math.max(n.type === "sticky" ? 80 : 60, startHeight + dy);
          return { ...n, width, height };
        }));
      } else if (textWidthResizeRef.current) {
        const { id, side, startWidth, startNodeX, startX } = textWidthResizeRef.current;
        const dx = (e.clientX - startX) / zoomNow;
        setNodes(prev => prev.map(n => {
          if (n.id !== id) return n;
          if (side === "right") {
            return { ...n, width: Math.max(40, startWidth + dx) };
          }
          // Left handle: the box's right edge stays put, so both width and
          // x shift together as the left edge moves.
          const width = Math.max(40, startWidth - dx);
          return { ...n, width, x: startNodeX + (startWidth - width) };
        }));
      } else if (connectDraftRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panNow.x) / zoomNow;
        const worldY = (e.clientY - rect.top - panNow.y) / zoomNow;
        setConnectDraft(prev => (prev ? { ...prev, x: worldX, y: worldY } : null));
      } else if (reattachDraftRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panNow.x) / zoomNow;
        const worldY = (e.clientY - rect.top - panNow.y) / zoomNow;
        setReattachDraft(prev => (prev ? { ...prev, x: worldX, y: worldY } : null));
      } else if (panDragRef.current) {
        const { startX, startY, startPanX, startPanY } = panDragRef.current;
        setPan({ x: startPanX + (e.clientX - startX), y: startPanY + (e.clientY - startY) });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      dragRef.current = null;
      resizeRef.current = null;
      textWidthResizeRef.current = null;
      panDragRef.current = null;
      setIsPanning(false);

      if (marqueeRef.current) {
        const additive = marqueeRef.current.additive;
        marqueeRef.current = null;
        setMarquee(m => {
          if (m && (m.width > 2 || m.height > 2)) {
            suppressNextClickRef.current = true;
            const zoomNow = zoomRef.current;
            const panNow = panRef.current;
            const worldLeft = (m.x - panNow.x) / zoomNow;
            const worldTop = (m.y - panNow.y) / zoomNow;
            const worldRight = (m.x + m.width - panNow.x) / zoomNow;
            const worldBottom = (m.y + m.height - panNow.y) / zoomNow;
            const hits = nodesRef.current
              .filter(n => {
                const { width, height } = getNodeSize(n);
                return n.x < worldRight && n.x + width > worldLeft && n.y < worldBottom && n.y + height > worldTop;
              })
              .map(n => n.id);
            setSelectedIds(prev => (additive ? new Set(Array.from(prev).concat(hits)) : new Set(hits)));
            setSelectedConnectionId(null);
          }
          return null;
        });
      }

      setConnectDraft(draft => {
        if (!draft) return null;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const zoomNow = zoomRef.current;
        const panNow = panRef.current;
        const x = (e.clientX - rect.left - panNow.x) / zoomNow;
        const y = (e.clientY - rect.top - panNow.y) / zoomNow;
        const target = nodesRef.current.find(n => n.id !== draft.from && nodeContainsPoint(n, x, y));
        if (target) {
          setConnections(prev => {
            const exists = prev.some(c =>
              (c.from === draft.from && c.to === target.id) || (c.from === target.id && c.to === draft.from)
            );
            return exists ? prev : [...prev, { id: `c${Date.now()}`, from: draft.from, to: target.id }];
          });
          toast("Connected");
        }
        return null;
      });

      setReattachDraft(draft => {
        if (!draft) return null;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const zoomNow = zoomRef.current;
        const panNow = panRef.current;
        const x = (e.clientX - rect.left - panNow.x) / zoomNow;
        const y = (e.clientY - rect.top - panNow.y) / zoomNow;
        const target = nodesRef.current.find(n => n.id !== draft.fixedId && nodeContainsPoint(n, x, y));
        if (target) {
          setConnections(prev => prev.map(c => (c.id === draft.connectionId ? { ...c, [draft.end]: target.id } : c)));
          toast("Connection updated");
        }
        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // A curated subset of Figma's shortcuts — only the ones with a real
  // feature behind them in this canvas. Not implemented (no underlying
  // model to back them): grouping (Ctrl+G/Shift+G), align/distribute,
  // boolean ops, components, vector/pen tools, and layer Tab-cycling.
  //
  // Delete/Backspace deletes the selection; Cmd/Ctrl+D duplicates it;
  // Cmd/Ctrl+C/V copies and pastes the selection (in-memory clipboard, not
  // the OS one — these are node/connection objects, not text); Cmd/Ctrl+A
  // selects all; Cmd/Ctrl+] / [ moves a single selected node forward/backward
  // in the z-order, Shift adds "all the way" (front/back); arrow keys nudge
  // the selection 1px (10px with Shift); V switches to the select tool;
  // space (held) temporarily pans; Cmd/Ctrl +/- zooms, Cmd/Ctrl+0 resets the
  // view; Escape backs out of connect mode or clears the current selection.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setSelectedIds(current => {
          if (current.size > 0) {
            const copiedNodes = nodesRef.current.filter(n => current.has(n.id));
            const copiedConnections = connectionsRef.current.filter(c => current.has(c.from) && current.has(c.to));
            clipboardRef.current = { nodes: copiedNodes, connections: copiedConnections };
            toast(`Copied ${copiedNodes.length} node${copiedNodes.length === 1 ? "" : "s"}`);
          }
          return current;
        });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const clip = clipboardRef.current;
        if (clip && clip.nodes.length > 0) {
          const idMap = new Map<string, string>();
          const pasted = clip.nodes.map(n => {
            const newId = `n${Date.now()}_${n.id}`;
            idMap.set(n.id, newId);
            return { ...n, id: newId, x: n.x + 24, y: n.y + 24, isAgent: false };
          });
          const pastedConnections = clip.connections.map(c => ({
            ...c, id: `c${Date.now()}_${c.id}`, from: idMap.get(c.from)!, to: idMap.get(c.to)!,
          }));
          setNodes(prev => [...prev, ...pasted]);
          setConnections(prev => [...prev, ...pastedConnections]);
          setSelectedIds(new Set(pasted.map(n => n.id)));
          setSelectedConnectionId(null);
          // Chains repeated pastes diagonally (Figma/Illustrator convention)
          // instead of stacking every paste exactly on top of the last.
          clipboardRef.current = { nodes: pasted, connections: pastedConnections };
          toast(`Pasted ${pasted.length} node${pasted.length === 1 ? "" : "s"}`);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(nodesRef.current.map(n => n.id)));
        setSelectedConnectionId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        setSelectedIds(current => {
          if (current.size === 1) reorderNode(Array.from(current)[0], e.shiftKey ? "front" : "forward");
          return current;
        });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        setSelectedIds(current => {
          if (current.size === 1) reorderNode(Array.from(current)[0], e.shiftKey ? "back" : "backward");
          return current;
        });
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setSelectedIds(current => {
          if (current.size > 0) setNodes(prev => prev.map(n => (current.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)));
          return current;
        });
      } else if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
        setConnectMode(false);
        setConnectDraft(null);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomAtCenter(1);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomAtCenter(-1);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === "Escape") {
        setNodeContextMenu(null);
        setTextColorPickerOpen(false);
        if (connectMode) { setConnectMode(false); setConnectDraft(null); }
        else { setSelectedIds(new Set()); setSelectedConnectionId(null); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [connectMode, deleteSelected, duplicateSelected, zoomAtCenter, reorderNode]);

  return (
    <div
      className="canvas-grid"
      style={{
        display: "flex", height: "100vh", overflow: "hidden",
        // The grid lives on this full-width outer container — not the inset
        // canvas area below — so it renders as one continuous pattern behind
        // NavRail's floating pill too, instead of stopping at its gutter.
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
      }}
    >
      <NavRail mode="canvas" activeProject={1} />

      {/* Shared hidden file input for image nodes' "double-click to pick a
          new image" — one input reused across all nodes, targeted via
          pendingImageUploadId rather than each node owning its own. */}
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFileInputChange}
      />

      {/* Canvas area — transparent so the outer grid shows through unbroken */}
      <div
        ref={canvasRef}
        style={{
          marginLeft: 72,
          flex: 1,
          position: "relative",
          overflow: "hidden",
          cursor: isPanning ? "grabbing" : isSpaceHeld ? "grab" : contextMenu || connectMode ? "crosshair" : "default",
        }}
        onContextMenu={handleCanvasRightClick}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
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
              fontSize: 11, color: "var(--dh-text-muted)",
              marginRight: 4,
            }}>
              scroll: pan · ctrl/cmd+scroll: zoom · middle-drag: pan
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: 2,
              background: "var(--dh-surface)", border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "3px 4px", marginRight: 4,
            }}>
              <button
                title="Zoom out"
                onClick={() => zoomAtCenter(-1)}
                style={{ width: 24, height: 24, borderRadius: 6, background: "transparent", border: "none", color: "var(--dh-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ZoomOut size={14} />
              </button>
              <button
                title="Reset zoom"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{
                  width: 42, background: "transparent", border: "none",
                  fontSize: 11, color: "var(--dh-text-secondary)", fontFamily: "'Fira Mono', monospace",
                  textAlign: "center",
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                title="Zoom in"
                onClick={() => zoomAtCenter(1)}
                style={{ width: 24, height: 24, borderRadius: 6, background: "transparent", border: "none", color: "var(--dh-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--dh-surface-raised)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ZoomIn size={14} />
              </button>
            </div>
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

        {/* World-space layer — pan/zoom transform applies only here; chrome,
            toolbar, and overlays stay fixed in screen space.
            pointerEvents:none here is required: this div spans the entire
            canvas (inset:0), so without it, it would swallow every
            mousedown/click over blank grid space before it ever reached
            canvasRef — breaking click-to-deselect and marquee-drag-to-select,
            both of which gate on e.target === canvasRef. Nodes opt back into
            hit-testing individually via pointerEvents:auto. */}
        <div style={{
          position: "absolute", inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}>
          {/* Connection lines */}
          <ConnectionLines
            nodes={nodes}
            connections={connections}
            connectDraft={connectDraft}
            selectedConnectionId={selectedConnectionId}
            reattachDraft={reattachDraft}
            connectMode={connectMode}
            onSelectConnection={handleSelectConnection}
            onHandleMouseDown={handleConnectionHandleMouseDown}
          />

          {/* Canvas nodes */}
          {nodes.map(node => (
            <CanvasNodeEl
              key={node.id}
              node={node}
              selected={selectedIds.has(node.id)}
              connectMode={connectMode}
              editing={editingNodeId === node.id}
              editValue={editValue}
              onMouseDown={handleNodeMouseDown}
              onStartEdit={startEditing}
              onEditChange={setEditValue}
              onCommitEdit={commitEditing}
              onResizeStart={handleResizeStart}
              onTextWidthResizeStart={handleTextWidthResizeStart}
              onToggleCodePreview={handleToggleCodePreview}
              onContextMenu={handleNodeContextMenu}
              onOpenLink={handleOpenLink}
              onRequestImageUpload={handleRequestImageUpload}
              onImageDrop={handleImageDrop}
            />
          ))}
        </div>

        {/* Marquee/rubber-band selection rectangle — screen space, drawn
            outside the pan/zoom transform since it's selection UI, not content. */}
        {marquee && (
          <div style={{
            position: "absolute",
            left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height,
            border: "1px solid var(--dh-accent)",
            background: "rgba(225,255,0,0.08)",
            pointerEvents: "none",
            zIndex: 15,
          }} />
        )}

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

        {/* Selected node inline toolbar — shown only for a single-node
            selection (no bounding-box UI for multi-select yet), and hidden
            mid-pan so it doesn't visibly slide around; it reappears,
            correctly repositioned, once panning stops. */}
        {selectedIds.size === 1 && !connectMode && !isAnyPanning && (() => {
          const node = nodes.find(n => n.id === Array.from(selectedIds)[0]);
          if (!node) return null;
          const iconButtonStyle: React.CSSProperties = {
            width: 28, height: 28, borderRadius: 6,
            background: "transparent", border: "none",
            color: "var(--dh-text-secondary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 120ms",
          };
          // This toolbar lives in screen space (outside the pan/zoom transform)
          // so its own size stays constant regardless of canvas zoom — convert
          // the node's world position through the current pan/zoom to place it.
          const screenX = pan.x + node.x * zoom;
          const screenY = pan.y + node.y * zoom;
          return (
            <div style={{
              position: "absolute",
              left: screenX, top: screenY - 44,
              background: "var(--dh-surface-raised)",
              border: "1px solid var(--dh-border)",
              borderRadius: 8, padding: "4px 8px",
              display: "flex", alignItems: "center", gap: 2,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: 20,
            }}>
              {[
                // Bold/Italic format inline text — meaningless on image/link/
                // code nodes, which don't have a free-text run to format.
                ...(node.type !== "image" && node.type !== "link" && node.type !== "code"
                  ? [{ icon: Bold, label: "Bold" }, { icon: Italic, label: "Italic" }]
                  : []),
                // Linking a run of text only makes sense on a text node — the
                // other node types either already are a link (link nodes) or
                // have no inline-text concept at all.
                ...(node.type === "text" ? [{ icon: Link2, label: "Link" }] : []),
                { icon: Sparkles, label: "AI" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  title={label}
                  onClick={() => toast(`${label} coming soon`)}
                  style={iconButtonStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon size={13} strokeWidth={2} />
                </button>
              ))}

              <div style={{ width: 1, height: 18, background: "var(--dh-border)", margin: "0 2px" }} />

              <button
                title="Duplicate"
                onClick={duplicateSelected}
                style={iconButtonStyle}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Copy size={13} strokeWidth={2} />
              </button>
              <button
                title="Delete"
                onClick={deleteSelected}
                style={iconButtonStyle}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,80,80,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>

              {node.type === "sticky" && (
                <>
                  <div style={{ width: 1, height: 18, background: "var(--dh-border)", margin: "0 2px" }} />
                  {STICKY_COLORS.map(c => (
                    <button
                      key={c}
                      title="Sticky color"
                      onClick={() => setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, color: c } : n)))}
                      style={{
                        width: 16, height: 16, borderRadius: "50%", background: c,
                        border: node.color === c ? "2px solid var(--dh-text-primary)" : "1px solid rgba(0,0,0,0.2)",
                        padding: 0, cursor: "pointer", flexShrink: 0,
                      }}
                    />
                  ))}
                </>
              )}

              {node.type === "text" && (
                <>
                  <div style={{ width: 1, height: 18, background: "var(--dh-border)", margin: "0 2px" }} />
                  <div ref={textColorPopoverRef} style={{ position: "relative" }}>
                    <button
                      title="Text color"
                      onClick={() => setTextColorPickerOpen(v => !v)}
                      style={iconButtonStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: node.textColor ?? "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.3)",
                        display: "block",
                      }} />
                    </button>
                    {textColorPickerOpen && (
                      <div style={{
                        position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                        marginBottom: 8,
                        display: "flex", gap: 6,
                        background: "var(--dh-surface-raised)",
                        border: "1px solid var(--dh-border)",
                        borderRadius: 8, padding: 6,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                        zIndex: 30,
                      }}>
                        {TEXT_COLORS.map(c => (
                          <button
                            key={c}
                            title={c}
                            onClick={() => { setTextColor(node.id, c); setTextColorPickerOpen(false); }}
                            style={{
                              width: 18, height: 18, borderRadius: "50%", background: c,
                              border: (node.textColor ?? "#FFFFFF") === c ? "2px solid var(--dh-accent)" : "1px solid rgba(255,255,255,0.2)",
                              padding: 0, cursor: "pointer", flexShrink: 0,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
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

        {nodeContextMenu && (
          <NodeArrangeMenu
            x={nodeContextMenu.x}
            y={nodeContextMenu.y}
            onClose={() => setNodeContextMenu(null)}
            onArrange={action => reorderNode(nodeContextMenu.id, action)}
          />
        )}

        {/* Toolbar */}
        <CanvasToolbar
          mode={mode}
          onModeChange={setMode}
          onOverlay={setOverlay}
          onAddNode={addNode}
          connectMode={connectMode}
          onToggleConnect={() => { setConnectMode(v => !v); setConnectDraft(null); }}
          onSelectTool={() => { setConnectMode(false); setConnectDraft(null); }}
          stickerPicker={stickerPicker}
          onToggleStickerPicker={() => setStickerPicker(v => !v)}
          onPickSticker={addSticker}
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
