// Late-stage additions (team decision, Nov 17): 15 well-known, heavily funded private companies from the Rocketship
// List, added on top of the representative 100-company sample (lib/sample.ts) because they have deep public
// coverage and tend to score well. They are NOT part of the random sample: say so when describing the sample's mix.
// Picked by the list's funding as a directional ranking, then by hand for joinability and variety (sector, city);
// left out: frontier labs (OpenAI, Anthropic), Scale (large Meta stake), Inflection (team went to Microsoft),
// Cerebras (IPO status unclear) and a duplicate Crusoe entry. The list's numbers are still never shown or scored.
export const FEATURED_NAMES: readonly string[] = [
  "Cursor",
  "Cognition",
  "Decagon",
  "Perplexity",
  "Harvey",
  "Vercel",
  "ClickHouse",
  "Applied Intuition",
  "Ramp",
  "Kalshi",
  "Cyera",
  "Anduril Industries",
  "Shield AI",
  "Abridge",
  "WHOOP",
];

const SET = new Set(FEATURED_NAMES.map((n) => n.toLowerCase()));
export const isFeatured = (name: string) => SET.has(name.toLowerCase());
