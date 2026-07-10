/**
 * To-Do Widget — Design Hub
 * Not Figma-sourced — built from a pasted reference screenshot + docs/skill/SKILL.md
 * tokens, with interaction motion patterned after motion.dev's React to-do
 * list example (https://motion.dev/examples/react-todo-list): drag-to-reorder
 * active tasks, animated strikethrough on complete, and animated layout
 * reflow everywhere a row moves, appears, or disappears. See
 * .claude/skills/motion/SKILL.md for the conventions this follows.
 *
 * Fixed to the top-right of the home screen (NavRail floats the same way on
 * the left). Multiple lists, accordion-style (one expanded at a time).
 * Clicking a list header expands/collapses it; double-clicking the title
 * renames it; right-click opens a delete popup. Double-clicking a task's
 * timer lets you type a custom duration.
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ChevronDown, Add, Checkmark, Play, Pause } from "@carbon/icons-react";
import { useTodoStore, liveRemainingSeconds, formatTimer, type TodoTask } from "@/lib/todoStore";
import { EASE_OUT, T_TODO, T_TODO_PLUS } from "@/lib/pageLoadTiming";

function TaskRow({
  task, onToggle, onPlay, onPause, onBumpInterval, editingTime, timeDraft,
  onStartEditTime, onTimeDraftChange, onCommitEditTime, onCancelEditTime,
  editingText, textDraft, onStartEditText, onTextDraftChange, onCommitEditText, onCancelEditText,
  muted,
}: {
  task: TodoTask;
  onToggle: () => void;
  onPlay: () => void;
  onPause: () => void;
  onBumpInterval: () => void;
  editingTime: boolean;
  timeDraft: string;
  onStartEditTime: () => void;
  onTimeDraftChange: (v: string) => void;
  onCommitEditTime: () => void;
  onCancelEditTime: () => void;
  editingText: boolean;
  textDraft: string;
  onStartEditText: () => void;
  onTextDraftChange: (v: string) => void;
  onCommitEditText: () => void;
  onCancelEditText: () => void;
  muted?: boolean;
}) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single click bumps the timer by an interval, but a following double-click
  // should open custom edit instead — delay the bump briefly so the
  // double-click handler can cancel it if it arrives in time.
  const handleTimeClick = () => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      onBumpInterval();
      clickTimer.current = null;
    }, 220);
  };

  const handleTimeDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onStartEditTime();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      style={{
        position: "relative", zIndex: task.completed ? 100 : "auto",
        display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", opacity: muted ? 0.55 : 1,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0, padding: 0,
          background: task.completed ? "var(--dh-text-muted)" : "transparent",
          border: task.completed ? "none" : "1.5px solid var(--dh-text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <AnimatePresence>
          {task.completed && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{ display: "flex" }}
            >
              <Checkmark size={11} color="#1A1A1A" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {editingText ? (
        <input
          autoFocus
          value={textDraft}
          onFocus={e => e.currentTarget.select()}
          onChange={e => onTextDraftChange(e.target.value)}
          onBlur={onCommitEditText}
          onKeyDown={e => {
            if (e.key === "Enter") onCommitEditText();
            if (e.key === "Escape") onCancelEditText();
          }}
          style={{
            flex: 1, minWidth: 0, fontSize: 13,
            background: "transparent", border: "none", outline: "none",
            color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
          }}
        />
      ) : (
        <span
          onDoubleClick={onStartEditText}
          title="Double-click to edit"
          style={{
            position: "relative", flex: 1, minWidth: 0, fontSize: 13,
            color: task.completed ? "var(--dh-text-muted)" : "var(--dh-text-secondary)",
            fontFamily: "'Figtree', sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {task.text}
          <AnimatePresence>
            {task.completed && (
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                exit={{ scaleX: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                style={{
                  position: "absolute", left: 0, right: 0, top: "50%",
                  height: 1, background: "var(--dh-text-muted)",
                  transformOrigin: "left", pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>
        </span>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 3, flexShrink: 0,
        background: "var(--dh-surface-raised)", borderRadius: 6,
        padding: "3px 6px",
      }}>
        {editingTime ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={timeDraft}
            onFocus={e => e.currentTarget.select()}
            onChange={e => onTimeDraftChange(e.target.value.replace(/\D/g, ""))}
            onBlur={onCommitEditTime}
            onKeyDown={e => {
              if (e.key === "Enter") onCommitEditTime();
              if (e.key === "Escape") onCancelEditTime();
            }}
            style={{
              width: 30, background: "transparent", border: "none", outline: "none",
              fontSize: 10, color: "var(--dh-text-primary)", fontFamily: "'Fira Mono', monospace",
              textAlign: "right",
            }}
          />
        ) : (
          <span
            onClick={handleTimeClick}
            onDoubleClick={handleTimeDoubleClick}
            title="Click to add 15 min, double-click to set a custom time"
            style={{
              fontSize: 10, fontFamily: "'Fira Mono', monospace", minWidth: 26, textAlign: "right",
              color: task.running ? "var(--dh-text-secondary)" : "var(--dh-text-muted)",
              cursor: "pointer",
            }}
          >
            {formatTimer(liveRemainingSeconds(task))}
          </span>
        )}
        <button
          onClick={task.running ? onPause : onPlay}
          disabled={task.completed}
          style={{
            background: "transparent", border: "none", color: "var(--dh-text-muted)",
            display: "flex", padding: 0, opacity: task.completed ? 0.5 : 1,
          }}
        >
          {task.running ? <Pause size={11} /> : <Play size={11} />}
        </button>
      </div>
    </motion.div>
  );
}

interface TodoListPillProps {
  list: { id: number; name: string; tasks: TodoTask[] };
  expanded: boolean;
  onToggleExpand: () => void;
  renaming: boolean;
  draftName: string;
  onStartRename: () => void;
  onDraftNameChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleTask: (taskId: number) => void;
  onPlay: (taskId: number) => void;
  onPause: (taskId: number) => void;
  onBumpInterval: (taskId: number) => void;
  onReorderActive: (orderedIds: number[]) => void;
  editingTimeTaskId: number | null;
  timeDraft: string;
  onStartEditTime: (taskId: number, current: TodoTask) => void;
  onTimeDraftChange: (v: string) => void;
  onCommitEditTime: () => void;
  onCancelEditTime: () => void;
  editingTextTaskId: number | null;
  textDraft: string;
  onStartEditText: (taskId: number, current: TodoTask) => void;
  onTextDraftChange: (v: string) => void;
  onCommitEditText: () => void;
  onCancelEditText: () => void;
  addingTask: boolean;
  newTaskText: string;
  onStartAddTask: () => void;
  onNewTaskTextChange: (v: string) => void;
  onCommitAddTask: () => void;
  onCancelAddTask: () => void;
}

function TodoListPill({
  list, expanded, onToggleExpand, renaming, draftName, onStartRename,
  onDraftNameChange, onCommitRename, onCancelRename, onContextMenu,
  onToggleTask, onPlay, onPause, onBumpInterval, onReorderActive,
  editingTimeTaskId, timeDraft, onStartEditTime,
  onTimeDraftChange, onCommitEditTime, onCancelEditTime,
  editingTextTaskId, textDraft, onStartEditText,
  onTextDraftChange, onCommitEditText, onCancelEditText,
  addingTask, newTaskText, onStartAddTask,
  onNewTaskTextChange, onCommitAddTask, onCancelAddTask,
}: TodoListPillProps) {
  const active = list.tasks.filter(t => !t.completed);
  // Most recently completed first, so the task you just checked off appears
  // at the top of Recents instead of wherever it happened to sit before.
  const completed = list.tasks
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A single click toggles expand, but it needs to yield to a following
  // double-click (which renames instead) — so delay the toggle briefly and
  // let the double-click handler cancel it if it arrives in time.
  const handleHeaderClick = () => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      onToggleExpand();
      clickTimer.current = null;
    }, 220);
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onStartRename();
  };

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        background: "var(--dh-surface)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        onClick={handleHeaderClick}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 14px", height: 44, cursor: "pointer" }}
      >
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onClick={e => e.stopPropagation()}
            onChange={e => onDraftNameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={e => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            style={{
              background: "transparent", border: "none", outline: "none",
              fontSize: 14, fontWeight: 700, color: "var(--dh-text-primary)",
              fontFamily: "'Figtree', sans-serif", flex: 1, minWidth: 0,
            }}
          />
        ) : (
          <span
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to rename"
            style={{
              fontSize: 14, fontWeight: 700, color: "var(--dh-text-primary)",
              fontFamily: "'Figtree', sans-serif", flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {list.name}
          </span>
        )}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          style={{ color: "var(--dh-text-secondary)", display: "flex", flexShrink: 0 }}
        >
          <ChevronDown size={16} />
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ background: "var(--dh-surface-input)", margin: "0 8px 10px", borderRadius: 10, padding: "8px 8px 10px" }}>
              <Reorder.Group
                as="div"
                axis="y"
                values={active.map(t => t.id)}
                onReorder={onReorderActive}
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                <AnimatePresence initial={false}>
                  {active.map(task => (
                    <Reorder.Item key={task.id} value={task.id} as="div" style={{ listStyle: "none" }}>
                      <TaskRow
                        task={task}
                        onToggle={() => onToggleTask(task.id)}
                        onPlay={() => onPlay(task.id)}
                        onPause={() => onPause(task.id)}
                        onBumpInterval={() => onBumpInterval(task.id)}
                        editingTime={editingTimeTaskId === task.id}
                        timeDraft={timeDraft}
                        onStartEditTime={() => onStartEditTime(task.id, task)}
                        onTimeDraftChange={onTimeDraftChange}
                        onCommitEditTime={onCommitEditTime}
                        onCancelEditTime={onCancelEditTime}
                        editingText={editingTextTaskId === task.id}
                        textDraft={textDraft}
                        onStartEditText={() => onStartEditText(task.id, task)}
                        onTextDraftChange={onTextDraftChange}
                        onCommitEditText={onCommitEditText}
                        onCancelEditText={onCancelEditText}
                      />
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>

              {addingTask ? (
                <input
                  autoFocus
                  value={newTaskText}
                  onChange={e => onNewTaskTextChange(e.target.value)}
                  onBlur={onCommitAddTask}
                  onKeyDown={e => {
                    if (e.key === "Enter") onCommitAddTask();
                    if (e.key === "Escape") onCancelAddTask();
                  }}
                  placeholder="New to-do..."
                  style={{
                    width: "100%", background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: "var(--dh-text-primary)", fontFamily: "'Figtree', sans-serif",
                    padding: "6px 4px",
                  }}
                />
              ) : (
                <button
                  onClick={onStartAddTask}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "transparent", border: "none", color: "var(--dh-text-muted)",
                    fontSize: 12, padding: "6px 4px", fontFamily: "'Figtree', sans-serif",
                  }}
                >
                  <Add size={12} /> Add to-do
                </button>
              )}

              {completed.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "var(--dh-text-muted)",
                    letterSpacing: "0.07em", textTransform: "uppercase",
                    margin: "10px 4px 4px", fontFamily: "'Fira Mono', monospace",
                  }}>
                    Recents
                  </div>
                  <AnimatePresence initial={false}>
                    {completed.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        muted
                        onToggle={() => onToggleTask(task.id)}
                        onPlay={() => onPlay(task.id)}
                        onPause={() => onPause(task.id)}
                        onBumpInterval={() => onBumpInterval(task.id)}
                        editingTime={editingTimeTaskId === task.id}
                        timeDraft={timeDraft}
                        onStartEditTime={() => onStartEditTime(task.id, task)}
                        onTimeDraftChange={onTimeDraftChange}
                        onCommitEditTime={onCommitEditTime}
                        onCancelEditTime={onCancelEditTime}
                        editingText={editingTextTaskId === task.id}
                        textDraft={textDraft}
                        onStartEditText={() => onStartEditText(task.id, task)}
                        onTextDraftChange={onTextDraftChange}
                        onCommitEditText={onCommitEditText}
                        onCancelEditText={onCancelEditText}
                      />
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TodoWidget({ playIntro = false }: { playIntro?: boolean }) {
  const {
    lists, addList, renameList, deleteList, addTask, renameTask, toggleTask, startTimer, pauseTimer,
    setCustomMinutes, bumpByInterval, reorderTasks,
  } = useTodoStore();
  const [expandedId, setExpandedId] = useState<number | null>(lists[0]?.id ?? null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [addingTaskFor, setAddingTaskFor] = useState<number | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [contextMenu, setContextMenu] = useState<{ listId: number; x: number; y: number } | null>(null);
  const [editingTime, setEditingTime] = useState<{ listId: number; taskId: number } | null>(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [editingTaskText, setEditingTaskText] = useState<{ listId: number; taskId: number } | null>(null);
  const [taskTextDraft, setTaskTextDraft] = useState("");

  const commitRename = () => {
    if (renamingId != null && draftName.trim()) renameList(renamingId, draftName.trim());
    setRenamingId(null);
  };

  const commitAddTask = () => {
    if (addingTaskFor != null && newTaskText.trim()) addTask(addingTaskFor, newTaskText.trim());
    setNewTaskText("");
    setAddingTaskFor(null);
  };

  const commitEditTime = () => {
    if (editingTime) {
      const minutes = parseInt(timeDraft, 10);
      if (Number.isFinite(minutes) && minutes > 0) {
        setCustomMinutes(editingTime.listId, editingTime.taskId, minutes);
      }
    }
    setEditingTime(null);
  };

  const commitEditTaskText = () => {
    if (editingTaskText && taskTextDraft.trim()) {
      renameTask(editingTaskText.listId, editingTaskText.taskId, taskTextDraft.trim());
    }
    setEditingTaskText(null);
  };

  return (
    <div style={{ position: "fixed", top: 24, right: 24, width: 260, zIndex: 40, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Inner wrapper carries the entrance transform — kept off the outer
          fixed container so the context-menu popup below (also position:fixed)
          isn't reparented into a transformed containing block. */}
      <motion.div
        initial={playIntro ? { opacity: 0, scale: 0.85, y: -10 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT, delay: T_TODO }}
        style={{ display: "flex", flexDirection: "column", gap: 8, transformOrigin: "top right" }}
      >
      <AnimatePresence initial={false}>
        {lists.map(list => (
          <motion.div
            key={list.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <TodoListPill
              list={list}
              expanded={expandedId === list.id}
              onToggleExpand={() => setExpandedId(v => (v === list.id ? null : list.id))}
              renaming={renamingId === list.id}
              draftName={draftName}
              onStartRename={() => { setRenamingId(list.id); setDraftName(list.name); }}
              onDraftNameChange={setDraftName}
              onCommitRename={commitRename}
              onCancelRename={() => setRenamingId(null)}
              onContextMenu={e => { e.preventDefault(); setContextMenu({ listId: list.id, x: e.clientX, y: e.clientY }); }}
              onToggleTask={taskId => toggleTask(list.id, taskId)}
              onPlay={taskId => startTimer(list.id, taskId)}
              onPause={taskId => pauseTimer(list.id, taskId)}
              onBumpInterval={taskId => bumpByInterval(list.id, taskId)}
              onReorderActive={orderedIds => reorderTasks(list.id, orderedIds)}
              editingTimeTaskId={editingTime?.listId === list.id ? editingTime.taskId : null}
              timeDraft={timeDraft}
              onStartEditTime={(taskId, task) => {
                setEditingTime({ listId: list.id, taskId });
                setTimeDraft(String(Math.ceil(liveRemainingSeconds(task) / 60)));
              }}
              onTimeDraftChange={setTimeDraft}
              onCommitEditTime={commitEditTime}
              onCancelEditTime={() => setEditingTime(null)}
              editingTextTaskId={editingTaskText?.listId === list.id ? editingTaskText.taskId : null}
              textDraft={taskTextDraft}
              onStartEditText={(taskId, task) => {
                setEditingTaskText({ listId: list.id, taskId });
                setTaskTextDraft(task.text);
              }}
              onTextDraftChange={setTaskTextDraft}
              onCommitEditText={commitEditTaskText}
              onCancelEditText={() => setEditingTaskText(null)}
              addingTask={addingTaskFor === list.id}
              newTaskText={newTaskText}
              onStartAddTask={() => { setAddingTaskFor(list.id); setNewTaskText(""); }}
              onNewTaskTextChange={setNewTaskText}
              onCommitAddTask={commitAddTask}
              onCancelAddTask={() => { setAddingTaskFor(null); setNewTaskText(""); }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.button
        onClick={addList}
        title="New list"
        initial={playIntro ? { opacity: 0, scale: 0.4 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 20, delay: T_TODO_PLUS }}
        style={{
          alignSelf: "center", width: 36, height: 36, borderRadius: "50%",
          background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--dh-text-secondary)", marginTop: 4,
          transition: "background 150ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#333")}
        onMouseLeave={e => (e.currentTarget.style.background = "#2A2A2A")}
      >
        <Add size={16} />
      </motion.button>
      </motion.div>

      {contextMenu && (
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
          <div style={{
            position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 60,
            background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.6)", padding: 4, minWidth: 130,
          }}>
            <button
              onClick={() => { deleteList(contextMenu.listId); setContextMenu(null); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "transparent", border: "none", color: "#FF6B6B",
                fontSize: 13, padding: "6px 10px", borderRadius: 6,
                fontFamily: "'Figtree', sans-serif",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              Delete list
            </button>
          </div>
        </>
      )}
    </div>
  );
}
