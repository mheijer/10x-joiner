"use client";
// "☆ Save" on a company: tick the lists it belongs to, or start a new one. Lists are saved with the user's profile.
import { useEffect, useRef, useState } from "react";
import { createList, listsFor, setMembership } from "@/lib/lists";
import type { SavedList } from "@/lib/lists";

export default function SaveToList({ companyId, lists, onChange }: { companyId: string; lists: SavedList[]; onChange: (l: SavedList[]) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const mine = listsFor(lists, companyId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const add = () => {
    if (!name.trim()) return;
    onChange(createList(lists, name, companyId));
    setName("");
  };

  return (
    <div className="savelist" ref={box}>
      <button className={`btn ${mine.length ? "saved" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {mine.length ? `★ Saved${mine.length === 1 ? `: ${mine[0].name}` : ` in ${mine.length} lists`}` : "☆ Save to a list"}
      </button>
      {open && (
        <div className="savepop small">
          {lists.length > 0 && (
            <div className="savelists">
              {lists.map((l) => (
                <label key={l.id} className="row">
                  <input
                    type="checkbox"
                    checked={l.company_ids.includes(companyId)}
                    onChange={(e) => onChange(setMembership(lists, l.id, companyId, e.target.checked))}
                  />
                  {l.name} <span className="muted">({l.company_ids.length})</span>
                </label>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            <input type="text" placeholder={lists.length ? "New list…" : "Name your first list, e.g. Interviewing"} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="btn primary" onClick={add} disabled={!name.trim()}>Add</button>
          </div>
          <div className="muted" style={{ marginTop: 4 }}>Saved with your profile. Filter by a list from the left panel.</div>
        </div>
      )}
    </div>
  );
}
