// Turn the seed list's HQ strings into map coordinates.
// The list mixes formats ("San Francisco, California, United States", "San Francisco, CA",
// "San Francisco , California"), so we normalize to "City, ST" first, then geocode with
// OpenStreetMap Nominatim (free; max 1 request/second; results cached by the seed script).

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const ABBRS = new Set(Object.values(STATES));

/** "San Francisco, California, United States" -> "San Francisco, CA". Returns null if unparseable. */
export function normalizeUsLocation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Dual HQs ("Dublin, Ireland; San Francisco, California, United States"): keep the US one.
  if (raw.includes(";")) raw = raw.split(";").find((s) => /united states|, [A-Z]{2}\b/i.test(s)) ?? raw.split(";")[0];
  if (/^san francisco bay area$/i.test(raw.trim())) return "San Francisco, CA";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^(united states|usa|us)$/i.test(p));
  if (parts.length === 0) return null;
  const city = parts[0].replace(/\s+/g, " ");
  const stateRaw = parts[1]?.trim();
  if (!stateRaw) return city;
  const st = ABBRS.has(stateRaw.toUpperCase()) ? stateRaw.toUpperCase() : STATES[stateRaw.toLowerCase()];
  return st ? `${city}, ${st}` : `${city}, ${stateRaw}`;
}

export async function geocodeUs(location: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(location)}`;
  const r = await fetch(url, { headers: { "User-Agent": "next-10x-joiner (HBS LTV class project)" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { lat: string; lon: string }[];
  if (!j.length) return null;
  return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
}
