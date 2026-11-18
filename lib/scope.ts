// Which companies the app shows (team decisions). Pure; used by the home page and AI search.
//   - The 100-company representative sample of the Rocketship List (lib/sample.ts), the 15 late-stage additions
//     (lib/featured.ts), and every user-added company
//   - Minus public and acquired companies (Nov 17): a joiner there gets public stock or joins the acquirer, not a
//     startup. Judged by the researched stage, so it follows the data; nothing is deleted from the database.
//     The sample itself replaces them like-for-like (scripts/sample.ts, OUT_OF_SCOPE).
import { inSample } from "./sample.ts";
import { isFeatured } from "./featured.ts";

export const isPublicCompany = (stage: string | null | undefined): boolean => !!stage && /^\s*(public|ipo|acquired)\b/i.test(stage);

export function inApp(c: { name: string; is_seed: boolean; stage?: string | null }): boolean {
  if (isPublicCompany(c.stage)) return false;
  return !c.is_seed || inSample(c.name) || isFeatured(c.name);
}

/** The list companies the pipeline works on: the sample plus the late-stage additions. */
export const inAppList = (name: string): boolean => inSample(name) || isFeatured(name);
