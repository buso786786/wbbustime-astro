import { supabase } from './supabase';

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
  purposes?: string[] | null;
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

function vehicleSlugPart(vehicle: string) {
  const key = vehicleKey(vehicle);

  const parts: Record<string, string> = {
    car: 'car-rental',
    bus: 'bus-rental',
    toto: 'toto-rental',
    auto: 'auto-rental',
    'pickup-van': 'pickup-van-rental',
    ambulance: 'ambulance-service',
  };

  return parts[key] || 'car-rental';
}

export function vehicleUrl(vehicle: string, city: string) {
  return `/rent/${vehicleSlugPart(vehicle)}-in-${slugify(city)}/`;
}

export function getVehicleLinks(group: CityLinkGroup): RentSeoLink[] {
  return group.vehicles.map((vehicle) => {
    const url = vehicleUrl(vehicle, group.city);
    const slug = url.replace('/rent/', '').replace(/\/$/, '');

    return {
      label: `${vehicleLabel(vehicle)} in ${group.city}`,
      url,
      slug,
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

  if (
    (vehicles.has('car') || vehicles.has('bus')) &&
    (rentText.includes('school') || rentText.includes('office'))
  ) {
    add('School Office Vehicle', `school-office-car-bus-rental-in-${citySlug}`);
  }

  return links;
}

export async function buildRentCityGroups(): Promise<CityLinkGroup[]> {
  const { data: citiesData, error: cityError } = await supabase
    .from('rent_cities')
    .select('id,name_en,name_bn,name,district_en,district_bn,active')
    .eq('active', true)
    .limit(1000);

  if (cityError) {
    console.error('[rentSeoLinks] rent_cities fetch failed:', cityError.message);
    return [];
  }

  const { data: listingsData, error: listingError } = await supabase
    .from('rent_listings')
    .select('vehicle_type,purposes,base_city_id,service_city_ids,status')
    .eq('status', 'active')
    .limit(2000);

  if (listingError) {
    console.error('[rentSeoLinks] rent_listings fetch failed:', listingError.message);
    return [];
  }

  const cities = Array.isArray(citiesData) ? citiesData : [];
  const listings = Array.isArray(listingsData) ? listingsData : [];

  const cityById = new Map<string, CityLinkGroup>();

  for (const city of cities) {
    const cityName = clean(city.name_en || city.name || city.name_bn);
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
      group.rentTypes = unique([
        ...group.rentTypes,
        ...(Array.isArray(listing.purposes) ? listing.purposes : []),
      ]);
    }
  }

  return Array.from(cityById.values())
    .filter((group) => group.vehicles.length > 0)
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