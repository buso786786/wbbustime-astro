import { supabase } from "./supabase";

export type RentCity = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  name_en?: string | null;
  name_bn?: string | null;
  district_en?: string | null;
  district_bn?: string | null;
  search_keywords_en?: string[] | null;
  search_keywords_bn?: string[] | null;
  sort_order?: number | null;
};

export async function listRentCities(): Promise<RentCity[]> {
  const { data, error } = await supabase
    .from("rent_cities")
    .select(`
      id,
      name,
      slug,
      active,
      created_at,
      updated_at,
      name_en,
      name_bn,
      district_en,
      district_bn,
      search_keywords_en,
      search_keywords_bn,
      sort_order
    `)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) throw error;

  return (data ?? []) as RentCity[];
}

export function cityDisplayName(city: RentCity): string {
  if (!city) return "";
  return city.name_en || city.name_bn || city.name || "";
}
