export const STOP_ALIASES: Record<string, string> = {
  tarakeswar: "tarakeshwar",
  tarokeshwar: "tarakeshwar",
  tarakeshwor: "tarakeshwar",
  "তারকেশ্বর": "tarakeshwar",

  "আসানসোল": "asansol",

  haora: "howrah",
  "হাওড়া": "howrah",

  calcutta: "kolkata",
  kolkatta: "kolkata",
  "কলকাতা": "kolkata",

  "শিয়ালদহ": "sealdah",
  "শিয়ালদা": "sealdah",

  "এসপ্ল্যানেড": "esplanade",
  "এসপ্লানেড": "esplanade",

  burdwan: "bardhaman",
  "বর্ধমান": "bardhaman",

  "দুর্গাপুর": "durgapur",

  "শিলিগুড়ি": "siliguri",

  arambag: "arambagh",
  "আরামবাগ": "arambagh",
  arambaghbusstand: "arambagh",
  "arambagh bus stand": "arambagh",
  "arambagh busstop": "arambagh",
  "arambagh bus stop": "arambagh",
  "আরামবাগ বাস স্ট্যান্ড": "arambagh",
  "আরামবাগ বাসস্ট্যান্ড": "arambagh",

  tarakeswarbusstand: "tarakeshwar",
  "tarakeswar bus stand": "tarakeshwar",
  "tarakeshwar bus stand": "tarakeshwar",
  "তারকেশ্বর বাস স্ট্যান্ড": "tarakeshwar",

  dighabusstand: "digha",
  "digha bus stand": "digha",
  "দীঘা বাস স্ট্যান্ড": "digha",

  olddighabusstand: "old digha",
  "old digha bus stand": "old digha",
  "পুরাতন দীঘা বাস স্ট্যান্ড": "old digha",
};


export function getCanonicalStopKey(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = String(raw).normalize("NFKC").toLowerCase().trim();
  if (!s) return "";

  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[([{][^)\]}]*[)\]}]/g, " ");
  s = s.replace(/[.,/\\&_+|:;'"!?\-]/g, " ");
    s = s
    .replace(/\bbus\s*stand\b/gu, " ")
    .replace(/\bbus\s*stop\b/gu, " ")
    .replace(/\bstation\b/gu, " ")
    .replace(/বাস\s*স্ট্যান্ড/gu, " ")
    .replace(/বাসস্ট্যান্ড/gu, " ")
    .replace(/বাস\s*স্টপ/gu, " ");
      s = s
    .replace(/\bbus\s*stand\b/gu, " ")
    .replace(/\bbus\s*stop\b/gu, " ")
    .replace(/\bbus\s*station\b/gu, " ")
    .replace(/\bstand\b/gu, " ")
    .replace(/বাস\s*স্ট্যান্ড/gu, " ")
    .replace(/বাসস্ট্যান্ড/gu, " ")
    .replace(/বাস\s*স্টপ/gu, " ")
    .replace(/বাসস্টপ/gu, " ");
  s = s.replace(/\s+/gu, " ").trim();

  if (!s) return "";

  if (STOP_ALIASES[s]) return STOP_ALIASES[s];

  return s;
}

export function isSameStop(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const ka = getCanonicalStopKey(a);
  const kb = getCanonicalStopKey(b);
  return !!ka && ka === kb;
}

export function getStopIdentityKey(
  en: string | null | undefined,
  bn: string | null | undefined
): string {
  const bnKey = getCanonicalStopKey(bn);
  if (bnKey) return `bn:${bnKey}`;

  const enKey = getCanonicalStopKey(en);
  if (enKey) return `en:${enKey}`;

  return "";
}