// Which companies the app shows (team decisions). Pure; used by the home page and AI search.
//   - The 100-company representative sample of the Rocketship List (lib/sample.ts), plus every user-added company
//   - Minus public companies (Nov 17): a joiner there gets public stock, not startup equity, so they're out of scope.
//     Judged by the researched stage, so it follows the data; nothing is deleted from the database.
import { inSample } from "./sample.ts";

export const isPublicCompany = (stage: string | null | undefined): boolean => !!stage && /^\s*(public|ipo)\b/i.test(stage);

export function inApp(c: { name: string; is_seed: boolean; stage?: string | null }): boolean {
  if (isPublicCompany(c.stage)) return false;
  return !c.is_seed || inSample(c.name);
}
