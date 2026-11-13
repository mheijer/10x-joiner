"use client";
// "Add a company": a user suggests a startup that isn't on the list. The app researches and scores it with the same
// LTV rubric (about 1-3 minutes, ~$0.75 of API), and it then shows up for everyone, tagged "Added by a user".
// Duplicates come back instantly for free. The site adds at most a few new companies per day (budget guardrail).
import { useEffect, useState } from "react";

export default function AddCompany({
  accessToken,
  onDone,
  onClose,
}: {
  accessToken: () => Promise<string | null>;
  onDone: (companyId: string, existing: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [hq, setHq] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function submit() {
    if (!name.trim()) return setErr("Enter the company name.");
    if (!website.trim()) return setErr("Enter the company's website, so we research the right company.");
    setErr(null);
    setBusy(true);
    setSecs(0);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Couldn't connect your session. Refresh the page and try again.");
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), website: website.trim(), hq_location: hq.trim() || null }),
      });
      const j = await res.json().catch(() => ({ error: "The research took too long and timed out. Please try again." }));
      if (!res.ok || !j.company_id) throw new Error(j.error ?? "Something went wrong");
      onDone(j.company_id, !!j.existing);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const step = secs < 10 ? "Checking job boards and public signals…" : secs < 100 ? "Researching the company with web search…" : "Scoring it against the LTV rubric…";

  return (
    <div className="modalback" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a company">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Add a company</strong>
          {!busy && <button className="close" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <p className="muted small">
          Not on the list? We'll research it and score it with the same LTV rubric. It then appears for <b>everyone</b>,
          tagged "Added by a user".
        </p>
        <label className="title small">Company name</label>
        <input type="text" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme AI" />
        <label className="title small">Website</label>
        <input type="text" value={website} disabled={busy} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.ai" />
        <label className="title small">HQ city (optional)</label>
        <input type="text" value={hq} disabled={busy} onChange={(e) => setHq(e.target.value)} placeholder="New York, NY" />
        {err && <div className="note" style={{ marginTop: 8 }}>{err}</div>}
        {busy ? (
          <div className="note" style={{ marginTop: 10 }}>
            <b>{step}</b> ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")})
            <div className="muted small">This usually takes 1–3 minutes. Keep this tab open.</div>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit}>Research and add</button>
          </div>
        )}
        <div className="muted small" style={{ marginTop: 8 }}>
          Each new company costs real research money, so the site adds up to 10 new companies a day (3 per person).
          Companies already on the list come back instantly.
        </div>
      </div>
    </div>
  );
}
