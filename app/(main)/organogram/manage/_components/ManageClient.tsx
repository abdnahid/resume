"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UnitNode, PostNode } from "@/lib/org";
import { sumSanctioned } from "@/lib/org";

// ─── Modal types ──────────────────────────────────────────────────────────────

type UnitModal =
  | { mode: "add-top" }
  | { mode: "add-child"; parentId: number; parentName: string }
  | { mode: "edit"; unit: UnitNode };

type PostModal =
  | { mode: "add"; unitId: number; unitName: string }
  | { mode: "edit"; post: PostNode; unitId: number };

// ─── Category helpers ─────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  wing: "Wing",
  divisional: "Divisional Office",
  regional: "Regional Office",
  unit: "Unit / Department",
};

const CAT_DOT: Record<string, string> = {
  wing: "bg-violet-500",
  divisional: "bg-emerald-500",
  regional: "bg-amber-500",
  unit: "bg-slate-400",
};

// ─── UnitModal ────────────────────────────────────────────────────────────────

function UnitFormModal({
  modal,
  allUnits,
  onClose,
  onSaved,
}: {
  modal: UnitModal;
  allUnits: UnitNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = modal.mode === "edit";
  const initial = isEdit ? modal.unit : null;

  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [nameBn, setNameBn] = useState(initial?.nameBn ?? "");
  const [category, setCategory] = useState(initial?.category ?? "unit");
  const [parentId, setParentId] = useState<number | null>(
    modal.mode === "add-child" ? modal.parentId : (initial?.parentId ?? null),
  );
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function flatList(nodes: UnitNode[], depth = 0): { id: number; label: string }[] {
    return nodes.flatMap((n) => [
      { id: n.id, label: "  ".repeat(depth) + n.nameEn },
      ...flatList(n.children, depth + 1),
    ]);
  }
  const flat = flatList(allUnits).filter((u) => !isEdit || u.id !== (initial?.id ?? -1));

  async function save() {
    if (!nameEn.trim() || !nameBn.trim()) { setErr("Both names are required"); return; }
    setSaving(true);
    setErr("");
    try {
      const url = isEdit ? `/api/org/units/${initial!.id}` : "/api/org/units";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { nameEn, nameBn, category, parentId, sortOrder, isActive }
        : { nameEn, nameBn, category, parentId, sortOrder };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? "Failed"); return; }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-base font-bold mb-4">
        {modal.mode === "add-top" ? "Add Top-Level Unit" : modal.mode === "add-child" ? `Add Child Unit under "${modal.parentName}"` : `Edit Unit — ${initial!.nameEn}`}
      </h2>

      <Label>Name (English)</Label>
      <Input value={nameEn} onChange={setNameEn} placeholder="e.g. CM, Gazipur" />

      <Label>Name (Bengali)</Label>
      <Input value={nameBn} onChange={setNameBn} placeholder="e.g. সিএম, গাজীপুর" />

      <Label>Category</Label>
      <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
        {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <Label>Parent Unit <span className="text-muted-foreground">(none = top-level)</span></Label>
      <select
        className={SELECT}
        value={parentId ?? ""}
        onChange={(e) => setParentId(e.target.value ? parseInt(e.target.value) : null)}
        disabled={modal.mode === "add-child"}
      >
        <option value="">— None (top-level) —</option>
        {flat.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>

      <div className="flex gap-4 mt-1">
        <div className="flex-1">
          <Label>Sort Order</Label>
          <input
            type="number"
            className={`${INPUT} w-full`}
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          />
        </div>
        {isEdit && (
          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" id="ua" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="ua" className="text-sm">Active</label>
          </div>
        )}
      </div>

      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className={BTN_GHOST}>Cancel</button>
        <button onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Overlay>
  );
}

// ─── PostModal ────────────────────────────────────────────────────────────────

function PostFormModal({
  modal,
  onClose,
  onSaved,
}: {
  modal: PostModal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = modal.mode === "edit";
  const initial = isEdit ? modal.post : null;

  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [nameBn, setNameBn] = useState(initial?.nameBn ?? "");
  const [count, setCount] = useState(initial?.sanctionedCount ?? 1);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!nameEn.trim() || !nameBn.trim()) { setErr("Both names are required"); return; }
    if (count < 1) { setErr("Count must be ≥ 1"); return; }
    setSaving(true);
    setErr("");
    try {
      const url = isEdit ? `/api/org/posts/${initial!.id}` : "/api/org/posts";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { nameEn, nameBn, sanctionedCount: count, sortOrder, isActive }
        : { unitId: modal.unitId, nameEn, nameBn, sanctionedCount: count, sortOrder };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? "Failed"); return; }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-base font-bold mb-4">
        {isEdit ? `Edit Post — ${initial!.nameEn}` : `Add Post to "${modal.mode === "add" ? modal.unitName : ""}"`}
      </h2>

      <Label>Designation (English)</Label>
      <Input value={nameEn} onChange={setNameEn} placeholder="e.g. Assistant Director (CM)" />

      <Label>Designation (Bengali)</Label>
      <Input value={nameBn} onChange={setNameBn} placeholder="e.g. সহকারী পরিচালক (সিএম)" />

      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Sanctioned Count</Label>
          <input type="number" min={1} className={`${INPUT} w-full`} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
        </div>
        <div className="flex-1">
          <Label>Sort Order</Label>
          <input type="number" className={`${INPUT} w-full`} value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        {isEdit && (
          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" id="pa" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="pa" className="text-sm">Active</label>
          </div>
        )}
      </div>

      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className={BTN_GHOST}>Cancel</button>
        <button onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Overlay>
  );
}

// ─── Tree rows ────────────────────────────────────────────────────────────────

function UnitRow({
  unit,
  depth,
  allUnits,
  onAddChild,
  onAddPost,
  onEdit,
  onDelete,
  onEditPost,
  onDeletePost,
}: {
  unit: UnitNode;
  depth: number;
  allUnits: UnitNode[];
  onAddChild: (u: UnitNode) => void;
  onAddPost: (u: UnitNode) => void;
  onEdit: (u: UnitNode) => void;
  onDelete: (u: UnitNode) => void;
  onEditPost: (p: PostNode, unitId: number) => void;
  onDeletePost: (p: PostNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const total = sumSanctioned(unit);
  const hasKids = unit.children.length > 0 || unit.posts.length > 0;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      {/* Unit header row */}
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group hover:bg-muted/50 ${!unit.isActive ? "opacity-50" : ""}`}>
        <button
          onClick={() => hasKids && setOpen((v) => !v)}
          className="w-4 shrink-0 text-muted-foreground text-xs"
        >
          {hasKids ? (open ? "▼" : "▶") : " "}
        </button>

        <span className={`size-2 rounded-full shrink-0 ${CAT_DOT[unit.category] ?? "bg-slate-400"}`} />

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-foreground">{unit.nameEn}</span>
          <span className="ml-2 text-xs text-muted-foreground font-bn-serif">{unit.nameBn}</span>
        </div>

        {total > 0 && (
          <span className="shrink-0 bg-slate-100 text-slate-600 text-xs font-bold rounded-full px-2 py-0.5">
            {total}
          </span>
        )}

        {/* Actions — visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <Btn title="Add child unit" onClick={() => onAddChild(unit)}>+Unit</Btn>
          <Btn title="Add post" onClick={() => onAddPost(unit)}>+Post</Btn>
          <Btn title="Edit unit" onClick={() => onEdit(unit)}>Edit</Btn>
          <Btn
            title={unit.children.length > 0 ? "Remove children first" : "Delete unit"}
            onClick={() => onDelete(unit)}
            danger
          >
            Del
          </Btn>
        </div>
      </div>

      {/* Expanded content */}
      {open && hasKids && (
        <div>
          {/* Posts */}
          {unit.posts.map((post) => (
            <div
              key={post.id}
              style={{ marginLeft: (depth + 1) * 20 }}
              className={`flex items-center gap-2 py-1 px-2 rounded-lg group hover:bg-blue-50/50 ${!post.isActive ? "opacity-50" : ""}`}
            >
              <span className="w-4 shrink-0" />
              <span className="size-1.5 rounded-full bg-blue-300 shrink-0" />

              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground font-bn-serif">{post.nameBn}</span>
                <span className="ml-2 text-xs text-muted-foreground">{post.nameEn}</span>
              </div>

              <span className="shrink-0 text-xs font-bold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">
                {post.sanctionedCount}×
              </span>
              {post.employeeCount > 0 && (
                <span className="shrink-0 text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                  {post.employeeCount} posted
                </span>
              )}

              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <Btn onClick={() => onEditPost(post, unit.id)}>Edit</Btn>
                <Btn
                  danger
                  title={post.employeeCount > 0 ? "Employees assigned — reassign first" : "Delete post"}
                  onClick={() => onDeletePost(post)}
                >
                  Del
                </Btn>
              </div>
            </div>
          ))}

          {/* Child units */}
          {unit.children.map((child) => (
            <UnitRow
              key={child.id}
              unit={child}
              depth={depth + 1}
              allUnits={allUnits}
              onAddChild={onAddChild}
              onAddPost={onAddPost}
              onEdit={onEdit}
              onDelete={onDelete}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

export default function ManageClient({ initialTree }: { initialTree: UnitNode[] }) {
  const router = useRouter();
  const [unitModal, setUnitModal] = useState<UnitModal | null>(null);
  const [postModal, setPostModal] = useState<PostModal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  function flatAll(nodes: UnitNode[]): UnitNode[] {
    return nodes.flatMap((n) => [n, ...flatAll(n.children)]);
  }

  async function deleteUnit(unit: UnitNode) {
    if (!confirm(`Delete unit "${unit.nameEn}"?\nThis will also delete all its posts (if unoccupied).`)) return;
    setDeleting(true);
    const res = await fetch(`/api/org/units/${unit.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Could not delete");
      return;
    }
    refresh();
  }

  async function deletePost(post: PostNode) {
    if (post.employeeCount > 0) {
      alert(`${post.employeeCount} employee(s) are assigned to this post. Reassign them first.`);
      return;
    }
    if (!confirm(`Delete post "${post.nameEn}"?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/org/posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Could not delete");
      return;
    }
    refresh();
  }

  const grouped: Record<string, UnitNode[]> = {
    wing: initialTree.filter((u) => u.category === "wing"),
    divisional: initialTree.filter((u) => u.category === "divisional"),
    regional: initialTree.filter((u) => u.category === "regional"),
    unit: initialTree.filter((u) => !["wing", "divisional", "regional"].includes(u.category)),
  };

  const allFlat = flatAll(initialTree);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-xs">
          {Object.entries(CAT_DOT).map(([cat, dot]) => (
            <span key={cat} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`size-2 rounded-full ${dot}`} /> {CAT_LABELS[cat]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-blue-300" /> Post
          </span>
        </div>
        <button
          onClick={() => setUnitModal({ mode: "add-top" })}
          className={BTN_PRIMARY}
          disabled={deleting}
        >
          + Add Top-Level Unit
        </button>
      </div>

      {/* Tree sections */}
      {(["wing", "divisional", "regional", "unit"] as const).map((cat) => {
        const nodes = grouped[cat];
        if (!nodes.length) return null;
        return (
          <section key={cat} className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {CAT_LABELS[cat]}
            </h2>
            {nodes.map((unit) => (
              <UnitRow
                key={unit.id}
                unit={unit}
                depth={0}
                allUnits={allFlat}
                onAddChild={(u) => setUnitModal({ mode: "add-child", parentId: u.id, parentName: u.nameEn })}
                onAddPost={(u) => setPostModal({ mode: "add", unitId: u.id, unitName: u.nameEn })}
                onEdit={(u) => setUnitModal({ mode: "edit", unit: u })}
                onDelete={deleteUnit}
                onEditPost={(p, uid) => setPostModal({ mode: "edit", post: p, unitId: uid })}
                onDeletePost={deletePost}
              />
            ))}
          </section>
        );
      })}

      {/* Modals */}
      {unitModal && (
        <UnitFormModal
          modal={unitModal}
          allUnits={allFlat}
          onClose={() => setUnitModal(null)}
          onSaved={refresh}
        />
      )}
      {postModal && (
        <PostFormModal
          modal={postModal}
          onClose={() => setPostModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// ─── Tiny shared primitives ───────────────────────────────────────────────────

const INPUT = "border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const SELECT = `${INPUT} w-full bg-background`;
const BTN_PRIMARY = "rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const BTN_GHOST = "rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">{children}</p>;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${INPUT} w-full`}
    />
  );
}

function Btn({ children, onClick, danger, title }: { children: React.ReactNode; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded px-1.5 py-0.5 text-xs font-medium border ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-border text-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
