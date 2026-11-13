"use client";
// The user's profile: loaded instantly from this browser, then synced to Supabase under an anonymous account so it
// is remembered. If anonymous sign-in is unavailable, everything still works and is saved on this device only.
import { useCallback, useEffect, useRef, useState } from "react";
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

export function useProfile() {
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [userId, setUserId] = useState<string | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load: local first (instant), then the saved row if signed in.
  useEffect(() => {
    setProfile(readLocal());
    const db = supabaseBrowser();
    if (!db) {
      setStatus("local");
      loaded.current = true;
      return;
    }
    (async () => {
      try {
        let { data: s } = await db.auth.getSession();
        if (!s.session) {
          const { data, error } = await db.auth.signInAnonymously();
          if (error) throw error;
          s = { session: data.session } as any;
        }
        const uid = s.session?.user.id ?? null;
        setUserId(uid);
        if (uid) {
          const { data: row } = await db.from("profiles").select("*").eq("user_id", uid).maybeSingle();
          if (row) {
            const remote: ProfileState = {
              background_text: row.background_text ?? "",
              looking_for: row.looking_for ?? "",
              preferences: row.preferences ?? {},
              parsed: row.parsed ?? null,
              weights: row.weights ?? EMPTY_PROFILE.weights,
              weights_source: row.weights_source ?? "default",
              blend: row.blend != null ? Number(row.blend) : 0.5,
              red_flag_mode: row.red_flag_mode ?? "show",
            };
            setProfile(remote);
            writeLocal(remote);
          }
        }
        setStatus("saved");
      } catch {
        setStatus("local"); // anonymous sign-ins off, or offline: device-only
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  const save = useCallback(
    (next: ProfileState) => {
      writeLocal(next);
      const db = supabaseBrowser();
      if (!db || !userId) return;
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(async () => {
        const { error } = await db.from("profiles").upsert({
          user_id: userId,
          background_text: next.background_text,
          looking_for: next.looking_for,
          preferences: next.preferences,
          parsed: next.parsed,
          weights: next.weights,
          weights_source: next.weights_source,
          blend: next.blend,
          red_flag_mode: next.red_flag_mode,
          updated_at: new Date().toISOString(),
        });
        setStatus(error ? "error" : "saved");
      }, 700);
    },
    [userId],
  );

  const update = useCallback(
    (patch: Partial<ProfileState> | ((p: ProfileState) => ProfileState)) => {
      setProfile((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
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

  const clearAll = useCallback(() => update({ ...EMPTY_PROFILE }), [update]);

  return { profile, update, status, signedIn: !!userId, accessToken, clearAll };
}
