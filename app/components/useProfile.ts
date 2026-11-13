"use client";
// The user's profile: loaded instantly from this browser, then synced to Supabase.
//   - Everyone starts with an anonymous account (no sign-up), remembered by this browser.
//   - "Email me a sign-in link" (Supabase magic link) gives a real account that works on any device. On the first
//     sign-in, the profile built on this browser is carried over if the account has none yet.
// If Supabase is unreachable, everything still works and is saved on this device only.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EMPTY_PROFILE } from "@/lib/personal";
import type { ProfileState } from "@/lib/personal";

const LOCAL_KEY = "10x-joiner-profile-v1";
export type SyncStatus = "local" | "connecting" | "saved" | "saving" | "error";

function readLocal(): ProfileState {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}
function writeLocal(p: ProfileState) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: keep it in memory */
  }
}

const toRow = (userId: string, p: ProfileState) => ({
  user_id: userId,
  background_text: p.background_text,
  looking_for: p.looking_for,
  preferences: p.preferences,
  parsed: p.parsed,
  weights: p.weights,
  weights_source: p.weights_source,
  blend: p.blend,
  red_flag_mode: p.red_flag_mode,
  updated_at: new Date().toISOString(),
});

const fromRow = (row: any): ProfileState => ({
  background_text: row.background_text ?? "",
  looking_for: row.looking_for ?? "",
  preferences: row.preferences ?? {},
  parsed: row.parsed ?? null,
  weights: row.weights ?? EMPTY_PROFILE.weights,
  weights_source: row.weights_source ?? "default",
  blend: row.blend != null ? Number(row.blend) : 0.5,
  red_flag_mode: row.red_flag_mode ?? "show",
});

export function useProfile() {
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null); // null = anonymous account
  const loaded = useRef(false);
  const current = useRef<ProfileState>(EMPTY_PROFILE);
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the saved profile for this account. If the account has none yet (first email sign-in, or a brand-new
  // anonymous account), save what this browser already has so nothing is lost.
  const adopt = useCallback(async (session: Session | null) => {
    const db = supabaseBrowser();
    if (!db || !session) return;
    const uid = session.user.id;
    setUserId(uid);
    setEmail(session.user.is_anonymous ? null : session.user.email ?? null);
    if (loadedFor.current === uid) return;
    loadedFor.current = uid;
    const { data: row } = await db.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (row) {
      const remote = fromRow(row);
      current.current = remote;
      setProfile(remote);
      writeLocal(remote);
    } else if (current.current !== EMPTY_PROFILE) {
      await db.from("profiles").upsert(toRow(uid, current.current));
    }
    setStatus("saved");
    loaded.current = true;
  }, []);

  useEffect(() => {
    const local = readLocal();
    current.current = local;
    setProfile(local);
    const db = supabaseBrowser();
    if (!db) {
      setStatus("local");
      loaded.current = true;
      return;
    }
    // Fires after a magic-link click (the session arrives in the URL) and on sign-in / sign-out.
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") void adopt(session);
    });
    (async () => {
      try {
        const { data: s } = await db.auth.getSession();
        if (s.session) await adopt(s.session);
        else if (!window.location.hash.includes("access_token")) {
          const { data, error } = await db.auth.signInAnonymously();
          if (error) throw error;
          await adopt(data.session);
        }
        // Clean the sign-in token out of the address bar after a magic-link click.
        if (window.location.hash.includes("access_token")) history.replaceState(null, "", window.location.pathname);
      } catch {
        setStatus("local"); // anonymous sign-ins off, or offline: device-only
        loaded.current = true;
      }
    })();
    return () => sub.subscription.unsubscribe();
  }, [adopt]);

  const save = useCallback(
    (next: ProfileState) => {
      writeLocal(next);
      const db = supabaseBrowser();
      if (!db || !userId) return;
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(async () => {
        const { error } = await db.from("profiles").upsert(toRow(userId, next));
        setStatus(error ? "error" : "saved");
      }, 700);
    },
    [userId],
  );

  const update = useCallback(
    (patch: Partial<ProfileState> | ((p: ProfileState) => ProfileState)) => {
      setProfile((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        current.current = next;
        if (loaded.current) save(next);
        return next;
      });
    },
    [save],
  );

  const accessToken = useCallback(async () => {
    const db = supabaseBrowser();
    const { data } = (await db?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  }, []);

  /** Email a one-time sign-in link. Clicking it signs this (or any) browser in to the same account. */
  const sendSignInLink = useCallback(async (address: string): Promise<string | null> => {
    const db = supabaseBrowser();
    if (!db) return "Sign-in isn't available right now.";
    const { error } = await db.auth.signInWithOtp({
      email: address.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    if (!error) return null;
    if (/rate limit/i.test(error.message)) return "Too many sign-in emails were sent in the last hour. Try again a bit later.";
    return error.message;
  }, []);

  /** Sign out: this browser goes back to a fresh anonymous account with an empty profile. */
  const signOut = useCallback(async () => {
    const db = supabaseBrowser();
    if (!db) return;
    await db.auth.signOut();
    loadedFor.current = null;
    current.current = EMPTY_PROFILE;
    setProfile(EMPTY_PROFILE);
    writeLocal(EMPTY_PROFILE);
    setEmail(null);
    const { data } = await db.auth.signInAnonymously();
    if (data.session) await adopt(data.session);
  }, [adopt]);

  const clearAll = useCallback(() => update({ ...EMPTY_PROFILE }), [update]);

  return { profile, update, status, signedIn: !!userId, email, accessToken, clearAll, sendSignInLink, signOut };
}
