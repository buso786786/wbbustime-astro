const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ytxtyphbguszjndtpakm.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4';

export type RentCity = {
  id: string;
  name_en?: string | null;
  name_bn?: string | null;
  name?: string | null;
  district_en?: string | null;
  district_bn?: string | null;
  active?: boolean | null;
};

export type RentListing = {
  vehicle_type?: string | null;
  rent_types?: string[] | null;
  base_city_id?: string | null;
  service_city_ids?: string[] | null;
  status?: string | null;
};

export type CityLinkGroup = {
  id: string;
  city: string;
  cityBn: string;
  district: string;
  vehicles: string[];
  rentTypes: string[];
};

export type RentSeoLink = {
  label: string;
  url: string;
  slug: string;
};

export type RentSeoPage = {
  slug: string;
  city: string;
  cityBn: string;
  district: string;
  label: string;
  kind: 'vehicle' | 'use-case';
  title: string;
  description: string;
  relatedLinks: RentSeoLink[];
};

export const clean = (value: string | null | undefined) => String(value || '').trim();

export const slugify = (value: string) =>
  clean(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort();
}

function isActiveListing(status: string | null | undefined) {
  return clean(status).toLowerCase() === 'active';
}

export function vehicleKey(type: string) {
  const value = clean(type).toLowerCase();

  if (value.includes('pickup')) return 'pickup-van';
  if (value.includes('ambulance')) return 'ambulance';
  if (value.includes('toto')) return 'toto';
  if (value.includes('auto')) return 'auto';
  if (value.includes('bus')) return 'bus';

  return 'car';
}

export function vehicleLabel(key: string) {
  const labels: Record<string, string> = {
    car: 'Car Rent',
    bus: 'Bus Rent',
    toto: 'Toto Rent',
    auto: 'Auto Rent',
    'pickup-van': 'Pickup Van Rent',
    ambulance: 'Ambulance Rent',
  };

  return labels[key] || `${key} Rent`;
}

export function vehicleUrl(vehicle: string, city: string) {
  return `/rent/${slugify(vehicle)}-rental-in-${slugify(city)}/`;
}

async function supabaseFetch<T>(path: string, timeoutMs = 3500): Promise<T[]> {
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

export function getVehicleLinks(group: CityLinkGroup): RentSeoLink[] {
  return group.vehicles.map((vehicle) => {
    const url = vehicleUrl(vehicle, group.city);

    return {
      label: `${vehicleLabel(vehicle)} in ${group.city}`,
      url,
      slug: url.replace('/rent/', '').replace('/', ''),
    };
  });
}

export function getUseCaseLinks(group: CityLinkGroup): RentSeoLink[] {
  const citySlug = slugify(group.city);
  const vehicles = new Set(group.vehicles);
  const rentText = group.rentTypes.join(' ').toLowerCase();

  const links: RentSeoLink[] = [];

  const add = (label: string, slug: string) => {
  links.push({
    label: `${label} in ${group.city}`,
    slug,
    url: `/rent/${slug}/`,
  });
};

  if ((vehicles.has('car') || vehicles.has('bus')) && rentText.includes('wedding')) {
    add('Wedding Car & Bus', `wedding-car-bus-rental-in-${citySlug}`);
  }

  if ((vehicles.has('car') || vehicles.has('bus')) && rentText.includes('tour')) {
    add('Tour Car & Bus', `tour-car-bus-rental-in-${citySlug}`);
  }

  if (
    (vehicles.has('car') || vehicles.has('toto') || vehicles.has('auto')) &&
    rentText.includes('local')
  ) {
    add('Local Car Toto Auto', `local-car-toto-auto-rental-in-${citySlug}`);
  }

  if (vehicles.has('ambulance') && rentText.includes('emergency')) {
    add('Emergency Ambulance', `emergency-ambulance-rental-in-${citySlug}`);
  }

  if (vehicles.has('pickup-van') && (rentText.includes('goods') || rentText.includes('parcel'))) {
    add('Goods Pickup Van', `goods-pickup-van-rental-in-${citySlug}`);
  }

  if ((vehicles.has('car') || vehicles.has('bus')) && (rentText.includes('school') || rentText.includes('office'))) {
    add('School Office Vehicle', `school-office-car-bus-rental-in-${citySlug}`);
  }

  return links;
}

export async function buildRentCityGroups(): Promise<CityLinkGroup[]> {
  const cities = await supabaseFetch<RentCity>(
    '/rest/v1/rent_cities?select=id,name_en,name_bn,name,district_en,district_bn,active&active=eq.true&limit=1000'
  );

  const listings = await supabaseFetch<RentListing>(
    '/rest/v1/rent_listings?select=vehicle_type,rent_types,base_city_id,service_city_ids,status&status=eq.active&limit=2000'
  );

  const cityById = new Map<string, CityLinkGroup>();

  for (const city of cities) {
    const cityName = clean(city.name_en || city.name);
    if (!city.id || !cityName) continue;

    cityById.set(city.id, {
      id: city.id,
      city: cityName,
      cityBn: clean(city.name_bn),
      district: clean(city.district_en || city.district_bn),
      vehicles: [],
      rentTypes: [],
    });
  }

  for (const listing of listings) {
    if (!isActiveListing(listing.status)) continue;

    const vehicle = vehicleKey(listing.vehicle_type || 'car');

    const cityIds = [
      listing.base_city_id,
      ...(Array.isArray(listing.service_city_ids) ? listing.service_city_ids : []),
    ].filter(Boolean) as string[];

    for (const cityId of cityIds) {
      const group = cityById.get(cityId);
      if (!group) continue;

      group.vehicles = unique([...group.vehicles, vehicle]);
      group.rentTypes = unique([...group.rentTypes, ...(listing.rent_types || [])]);
    }
  }

   const activeGroups = Array.from(cityById.values())
    .filter((group) => group.vehicles.length > 0)
    .sort((a, b) => a.city.localeCompare(b.city));

  if (activeGroups.length > 0) {
    return activeGroups;
  }

  return Array.from(cityById.values())
    .map((group) => ({
      ...group,
      vehicles: ['car'],
      rentTypes: ['local', 'tour', 'wedding'],
    }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

export async function buildRentSeoPages(): Promise<RentSeoPage[]> {
  const groups = await buildRentCityGroups();
  const pages: RentSeoPage[] = [];

  for (const group of groups) {
    const relatedLinks = [...getVehicleLinks(group), ...getUseCaseLinks(group)];

    for (const link of getVehicleLinks(group)) {
      pages.push({
        slug: link.slug,
        city: group.city,
        cityBn: group.cityBn,
        district: group.district,
        label: link.label,
        kind: 'vehicle',
        title: `${link.label} in ${group.city}`,
        description: `Find ${link.label.toLowerCase()} options with driver in ${group.city}, West Bengal.`,
        relatedLinks,
      });
    }

    for (const link of getUseCaseLinks(group)) {
      pages.push({
        slug: link.slug,
        city: group.city,
        cityBn: group.cityBn,
        district: group.district,
        label: link.label,
        kind: 'use-case',
        title: `${link.label} Rental in ${group.city}`,
        description: `Find ${link.label.toLowerCase()} rental options in ${group.city}, West Bengal.`,
        relatedLinks,
      });
    }
  }

  return pages;
}