// Home: Explore (map + ranked list) and Scatter. Data is read on the server with the public key (RLS applies).
import Explore from "./components/Explore";
import { supabasePublic, EXPLORE_COLUMNS } from "@/lib/supabase-public";
import type { CompanyRow } from "@/lib/supabase-public";

export const dynamic = "force-dynamic"; // always read fresh rows; never at build time

export default async function Home() {
  let companies: CompanyRow[] = [];
  let error: string | null = null;
  try {
    const { data, error: e } = await supabasePublic().from("company_latest").select(EXPLORE_COLUMNS).limit(2000);
    if (e) throw e;
    companies = (data ?? []) as unknown as CompanyRow[];
  } catch (e: any) {
    error = e?.message ?? String(e);
  }
  return <Explore companies={companies} loadError={error} />;
}
