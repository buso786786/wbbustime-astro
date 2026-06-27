import { supabase } from "./supabase";

export type RentCity = {
  id: string;
  name: string | null;
  slug: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  name_en?: string | null;
  name_bn?: string | null;
  district_en?: string | null;
  district_bn?: string | null;
  search_keywords_en?: string | null;
  search_keywords_bn?: string | null;
  sort_order?: number | null;
};

type ListRentCitiesOptions = {
  onlyActive?: boolean;
};

export async function listRentCities(
  options: ListRentCitiesOptions = {}
): Promise<RentCity[]> {
  let query = supabase
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
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name_en", { ascending: true });

  if (options.onlyActive !== false) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as RentCity[];
}

export function cityDisplayName(city: RentCity): string {
  if (!city) return "";

  return city.name_en || city.name_bn || city.name || "";
}

export function citySearchText(city: RentCity): string {
  if (!city) return "";

  return [
    city.name,
    city.slug,
    city.name_en,
    city.name_bn,
    city.district_en,
    city.district_bn,
    city.search_keywords_en,
    city.search_keywords_bn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}