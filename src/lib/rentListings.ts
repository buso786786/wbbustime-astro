import { supabase } from "./supabase";
const RENT_PHOTO_BUCKET = "rent-listing-photos";
export type RentListing = {
  id: string;
  owner_name: string | null;
  owner_phone: string;
  owner_whatsapp: string | null;
  reg_number: string | null;
  vehicle_type: string;
  vehicle_model: string | null;
  seats: number | null;
  purposes: string[];
  base_city_id: string | null;
  service_city_ids: string[];
  price_text: string | null;
  photos: string[];
  description: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

export type RegisterRentListingInput = {
  ownerName: string;
  phone: string;
  whatsapp: string;
  regNumber: string;
  vehicleType: string;
  vehicleModel: string;
  seats: number;
  purposes: string[];
  baseCityId: string;
  serviceCityIds: string[];
  priceText: string;
  description: string;
  consentAccepted: boolean;
};

function cleanPhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");
}

function cleanRegNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function listActiveRentListings(): Promise<RentListing[]> {
  const { data, error } = await supabase
    .from("rent_listings")
    .select(`
      id,
      owner_name,
      owner_phone,
      owner_whatsapp,
      vehicle_type,
      vehicle_model,
      seats,
      purposes,
      base_city_id,
      service_city_ids,
      price_text,
      photos,
      description,
      status,
      created_at,
      updated_at,
      is_verified
    `)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []) as RentListing[];
}

export async function submitRentListing(input: RegisterRentListingInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user.email) {
    throw new Error("Please login with Google first.");
  }

  if (!input.ownerName.trim()) throw new Error("Owner name is required.");
  if (!input.phone.trim()) throw new Error("Phone number is required.");
  if (!input.whatsapp.trim()) throw new Error("WhatsApp number is required.");
  if (!input.regNumber.trim()) throw new Error("Vehicle registration number is required.");
  if (!input.vehicleType) throw new Error("Vehicle type is required.");
  if (!input.vehicleModel.trim()) throw new Error("Vehicle model is required.");
  if (!input.seats || input.seats < 1) throw new Error("Seats is required.");
  if (!input.baseCityId) throw new Error("Base city is required.");
  if (!input.serviceCityIds.length) throw new Error("At least 1 service city is required.");
  if (!input.purposes.length) throw new Error("At least 1 rent type is required.");
  if (!input.priceText.trim()) throw new Error("Price is required.");
  if (!input.description.trim()) throw new Error("Description is required.");
  if (!input.consentAccepted) throw new Error("Consent is required.");

  const user = sessionData.session.user;

  const { data, error } = await supabase
    .from("rent_listings")
    .insert({
      owner_user_id: user.id,
      owner_email: user.email,
      owner_name: input.ownerName.trim(),
      owner_phone: cleanPhone(input.phone),
      owner_whatsapp: cleanPhone(input.whatsapp),
      reg_number: cleanRegNumber(input.regNumber),
      vehicle_type: input.vehicleType,
      vehicle_model: input.vehicleModel.trim(),
      seats: input.seats,
      purposes: input.purposes,
      base_city_id: input.baseCityId,
      service_city_ids: input.serviceCityIds.slice(0, 3),
      price_text: input.priceText.trim(),
      description: input.description.trim(),
      photos: [],
      status: "pending",
      consent_accepted: true,
      consent_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  return data.id as string;
}
export function photoUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;

  const { data } = supabase.storage
    .from(RENT_PHOTO_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}