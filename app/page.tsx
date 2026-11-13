// Home: Explore (map + ranked list) and Scatter. Companies are read on the server. Every company is shared:
// the Rocketship List plus companies users added (team decision), so the server reads them all with the service
// role and passes only the explore columns to the browser. No user data is read here.
import Explore from "./components/Explore";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EXPLORE_COLUMNS } from "@/lib/supabase-public";
import type { CompanyRow } from "@/lib/supabase-public";

export const dynamic = "force-dynamic"; // always read fresh rows; never at build time

export default async function Home() {
  let companies: CompanyRow[] = [];
  let error: string | null = null;
  try {
    const { data, error: e } = await supabaseAdmin().from("company_latest").select(EXPLORE_COLUMNS).limit(2000);
    if (e) throw e;
    companies = (data ?? []) as unknown as CompanyRow[];
  } catch (e: any) {
    error = e?.message ?? String(e);
  }
  return <Explore companies={companies} loadError={error} />;
}
