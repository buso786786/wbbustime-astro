import { getCanonicalStopKey, getStopIdentityKey } from './canonicalStop';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ytxtyphbguszjndtpakm.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4';

export type RouteStop = {
  stoppage_name?: string | null;
  up_time?: string | null;
  down_time?: string | null;
};

export type BusRouteRow = {
  id: string;
  bus_name: string | null;
  bus_type: string | null;
  source: string | null;
  destination: string | null;
  source_bn?: string | null;
  destination_bn?: string | null;
  image_url?: string | null;
  route_data?: RouteStop[] | null;
  route_data_bn?: RouteStop[] | null;
  schedule_data?: RouteStop[] | null;
  schedule_data_bn?: RouteStop[] | null;
  deleted_at?: string | null;
};

export type BusSeoRoute = {
  slug: string;
  source: string;
  destination: string;
  routeCount: number;
  busNames: string[];
  href: string;
};

export type BusStopSuggestion = {
  value: string;
  label: string;
  search: string;
};

export const clean = (value: string | null | undefined) => String(value || '').trim();

export const slugify = (value: string) =>
  clean(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const normalKey = (value: string | null | undefined) =>
  clean(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,/\\&_+|:;'"!?\-]/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const routeSlug = (source: string, destination: string) =>
  `${slugify(source)}-to-${slugify(destination)}`;

const unique = (values: string[]) =>
  Array.from(new Set(values.map(clean).filter(Boolean)));

function hasBengaliScript(value: string): boolean {
  return /[\u0980-\u09FF]/.test(value);
}

function getRouteStops(row: BusRouteRow): RouteStop[] {
  if (Array.isArray(row.route_data) && row.route_data.length > 0) return row.route_data;
  if (Array.isArray(row.schedule_data) && row.schedule_data.length > 0) return row.schedule_data;
  return [];
}

function getRouteStopsBn(row: BusRouteRow): RouteStop[] {
  if (Array.isArray(row.route_data_bn) && row.route_data_bn.length > 0) return row.route_data_bn;
  if (Array.isArray(row.schedule_data_bn) && row.schedule_data_bn.length > 0) return row.schedule_data_bn;
  return [];
}

async function supabaseFetch<T>(path: string, timeoutMs = 5000): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}`, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error('[busSeoLinks] Supabase fetch failed:', res.status, await res.text());
      return [];
    }

    return (await res.json()) as T[];
  } catch (error) {
    clearTimeout(timer);
    console.error('[busSeoLinks] Supabase fetch error:', error);
    return [];
  }
}

export async function fetchBusRows() {
  return supabaseFetch<BusRouteRow>(
    '/rest/v1/bus_routes?select=id,bus_name,bus_type,source,destination,source_bn,destination_bn,image_url,route_data,route_data_bn,deleted_at&deleted_at=is.null&limit=3000'
  );
}

export async function buildBusSeoRoutes(): Promise<BusSeoRoute[]> {
  const rows = await fetchBusRows();
  const map = new Map<string, BusSeoRoute>();

  const addRoutePair = (
    sourceRaw: string | null | undefined,
    destinationRaw: string | null | undefined,
    busNameRaw: string | null | undefined
  ) => {
    const source = clean(sourceRaw);
    const destination = clean(destinationRaw);

    if (!source || !destination) return;
    if (getCanonicalStopKey(source) === getCanonicalStopKey(destination)) return;

    const slug = routeSlug(source, destination);
    if (!slug || slug.includes('--')) return;

    const existing = map.get(slug);

    if (existing) {
      existing.routeCount += 1;
      existing.busNames = unique([...existing.busNames, clean(busNameRaw)]);
      return;
    }

    map.set(slug, {
      slug,
      source,
      destination,
      routeCount: 1,
      busNames: unique([clean(busNameRaw)]),
      href: `/bus-timetable/${slug}/`,
    });
  };

  for (const row of rows) {
    addRoutePair(row.source, row.destination, row.bus_name);
    addRoutePair(row.destination, row.source, row.bus_name);
  }

  return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

type StopEntry = {
  en: string;
  bn: string;
  enSpellings: Set<string>;
  canonKeys: Set<string>;
};

function makeStopIdentity(en: string, bn: string) {
  const identity = getStopIdentityKey(en, bn);
  if (identity) return identity;

  const enKey = getCanonicalStopKey(en);
  const bnKey = getCanonicalStopKey(bn);

  if (bnKey) return `bn:${bnKey}`;
  if (enKey) return `en:${enKey}`;
  return '';
}

function rememberEnglish(entry: StopEntry, value: string) {
  const text = normalKey(value);
  if (text) entry.enSpellings.add(text);

  const canon = getCanonicalStopKey(value);
  if (canon) entry.canonKeys.add(canon);
}

export async function buildBusStopSuggestions(): Promise<BusStopSuggestion[]> {
  const rows = await fetchBusRows();
  const byIdentity = new Map<string, StopEntry>();

  const addPair = (enRaw?: string | null, bnRaw?: string | null) => {
    const en = clean(enRaw);
    const bn = clean(bnRaw);
    if (!en && !bn) return;

    const identity = makeStopIdentity(en, bn);
    if (!identity) return;

    const existing = byIdentity.get(identity);

    if (!existing) {
      const entry: StopEntry = {
        en,
        bn,
        enSpellings: new Set<string>(),
        canonKeys: new Set<string>(),
      };

      if (en) rememberEnglish(entry, en);
      if (bn) {
        const bnCanon = getCanonicalStopKey(bn);
        if (bnCanon) entry.canonKeys.add(bnCanon);
      }

      byIdentity.set(identity, entry);
      return;
    }

    if (en) rememberEnglish(existing, en);

    if ((!existing.en || hasBengaliScript(existing.en)) && en && !hasBengaliScript(en)) {
      existing.en = en;
    }

    if (!existing.bn && bn) existing.bn = bn;

    if (bn) {
      const bnCanon = getCanonicalStopKey(bn);
      if (bnCanon) existing.canonKeys.add(bnCanon);
    }
  };

  for (const row of rows) {
    addPair(row.source, row.source_bn);
    addPair(row.destination, row.destination_bn);

    const stops = getRouteStops(row);
    const stopsBn = getRouteStopsBn(row);

    stops.forEach((stop, index) => {
      addPair(stop?.stoppage_name, stopsBn[index]?.stoppage_name);
    });
  }

  const suggestions: BusStopSuggestion[] = [];

  for (const entry of byIdentity.values()) {
    const value = entry.en || entry.bn;
    if (!value) continue;

    const label = entry.en && entry.bn ? `${entry.en} (${entry.bn})` : entry.en || entry.bn;
    const canonList = Array.from(entry.canonKeys).join(' ');
    const search = normalKey(`${entry.en} ${entry.bn} ${label} ${canonList}`);

    suggestions.push({
      value,
      label,
      search,
    });
  }

  return suggestions
    .sort((a, b) => a.value.localeCompare(b.value))
    .slice(0, 1200);
}