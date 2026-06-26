const BASE_URL = 'https://soniabuddy.in';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ytxtyphbguszjndtpakm.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4';

const today = new Date().toISOString();

type BusRoute = {
  source: string | null;
  destination: string | null;
};

type RentCity = {
  id: string;
  name_en?: string | null;
  name?: string | null;
};

type RentListing = {
  vehicle_type?: string | null;
  base_city_id?: string | null;
  service_city_ids?: string[] | null;
};

const clean = (value: string | null | undefined) => String(value || '').trim();

const slugify = (value: string) =>
  clean(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

function addUrl(set: Set<string>, url: string) {
  if (!url.startsWith('/')) return;
  set.add(url.endsWith('/') ? url : `${url}/`);
}

async function supabaseFetch<T>(path: string, timeoutMs = 2500): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}${path}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    clearTimeout(timer);

    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function addBusSeoUrls(urls: Set<string>) {
  const routes = await supabaseFetch<BusRoute>(
    '/rest/v1/bus_routes?select=source,destination&limit=2000'
  );

  for (const route of routes) {
    const source = clean(route.source);
    const destination = clean(route.destination);

    if (!source || !destination) continue;

    const sourceSlug = slugify(source);
    const destinationSlug = slugify(destination);

    if (!sourceSlug || !destinationSlug) continue;
    if (sourceSlug === destinationSlug) continue;

    addUrl(urls, `/bus-timetable/${sourceSlug}-to-${destinationSlug}/`);
    addUrl(urls, `/bus-timetable/${destinationSlug}-to-${sourceSlug}/`);
  }
}

function vehicleSlugPart(type: string) {
  const value = clean(type).toLowerCase();

  if (value.includes('pickup')) return 'pickup-van-rental';
  if (value.includes('ambulance')) return 'ambulance-service';
  if (value.includes('toto')) return 'toto-rental';
  if (value.includes('auto')) return 'auto-rental';
  if (value.includes('bus')) return 'bus-rental';

  return 'car-rental';
}

async function addRentSeoUrls(urls: Set<string>) {
  const cities = await supabaseFetch<RentCity>(
    '/rest/v1/rent_cities?select=id,name_en,name,active&active=eq.true&limit=1000'
  );

  const listings = await supabaseFetch<RentListing>(
    '/rest/v1/rent_listings?select=vehicle_type,base_city_id,service_city_ids,status&status=eq.active&limit=2000'
  );

  const cityById = new Map<string, string>();

  for (const city of cities) {
    const cityName = clean(city.name_en || city.name);
    if (city.id && cityName) {
      cityById.set(city.id, cityName);
    }
  }

  const cityVehicleMap = new Map<string, Set<string>>();

  for (const listing of listings) {
    const vehicle = vehicleSlugPart(listing.vehicle_type || 'car');

    const cityIds = [
      listing.base_city_id,
      ...(Array.isArray(listing.service_city_ids) ? listing.service_city_ids : []),
    ].filter(Boolean) as string[];

    for (const cityId of cityIds) {
      if (!cityById.has(cityId)) continue;

      const vehicles = cityVehicleMap.get(cityId) || new Set<string>();
      vehicles.add(vehicle);
      cityVehicleMap.set(cityId, vehicles);
    }
  }

  for (const [cityId, vehicles] of cityVehicleMap.entries()) {
    const cityName = cityById.get(cityId);
    if (!cityName) continue;

    const citySlug = slugify(cityName);
    if (!citySlug) continue;

    for (const vehicle of vehicles) {
      addUrl(urls, `/rent/${vehicle}-in-${citySlug}/`);
    }

    if (vehicles.has('car') || vehicles.has('bus')) {
      addUrl(urls, `/rent/wedding-car-bus-rental-in-${citySlug}/`);
      addUrl(urls, `/rent/tour-car-bus-rental-in-${citySlug}/`);
      addUrl(urls, `/rent/school-office-car-bus-rental-in-${citySlug}/`);
    }

    if (vehicles.has('car') || vehicles.has('toto') || vehicles.has('auto')) {
      addUrl(urls, `/rent/local-car-toto-auto-rental-in-${citySlug}/`);
    }

    if (vehicles.has('ambulance')) {
      addUrl(urls, `/rent/emergency-ambulance-rental-in-${citySlug}/`);
    }

    if (vehicles.has('pickup-van')) {
      addUrl(urls, `/rent/goods-pickup-van-rental-in-${citySlug}/`);
    }
  }
}

export async function GET() {
  const urls = new Set<string>();

  // Useful public pages
addUrl(urls, '/');
addUrl(urls, '/all-routes/');
addUrl(urls, '/route-finder/');

// Trust/legal public pages
addUrl(urls, '/about/');
addUrl(urls, '/privacy-policy/');
addUrl(urls, '/terms-and-conditions/');

  // Real SEO URLs from database only
  await addBusSeoUrls(urls);
  await addRentSeoUrls(urls);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls)
  .sort()
  .map((url) => `  <url>
    <loc>${xmlEscape(`${BASE_URL}${url}`)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === '/' ? '1.0' : '0.8'}</priority>
  </url>`)
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}