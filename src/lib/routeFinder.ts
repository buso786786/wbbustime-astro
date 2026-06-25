const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ytxtyphbguszjndtpakm.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4";

export type RouteSegment = {
  bus_id?: string;
  bus_name?: string;
  bus_type?: string | null;
  image_url?: string | null;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
  fare?: string | null;
  route_source?: string | null;
  route_destination?: string | null;
  duration?: string | null;
  matchScore?: number;
  matchReason?: string;
};

export type IndirectOption = {
  midpoint?: string;
  midpointA?: string;
  midpointB?: string;
  step1?: RouteSegment;
  step2?: RouteSegment;
  step3?: RouteSegment;
  waitMin?: number | null;
  waitMin2?: number | null;
  timed?: boolean;
  estimated?: boolean;
  matchScore?: number;
  matchReason?: string;
};

export type RoutePlan = {
  kind: "direct" | "indirect" | "none" | "error";
  source: string;
  destination: string;
  direct: RouteSegment[];
  indirect: IndirectOption[];
  alternativeIndirect: IndirectOption[];
  message?: string;
  error?: string;
};

const emptyPlan = (source = "", destination = ""): RoutePlan => ({
  kind: "none",
  source,
  destination,
  direct: [],
  indirect: [],
  alternativeIndirect: [],
});

export async function findJourney(source: string, destination: string): Promise<RoutePlan> {
  const s = source.trim();
  const d = destination.trim();

  if (!s || !d) {
    return {
      ...emptyPlan(s, d),
      kind: "error",
      error: "Source and destination required",
    };
  }

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/route-finder`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        source: s,
        destination: d,
        query: `${s} to ${d}`,
        format: "data",
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ...emptyPlan(s, d),
        kind: "error",
        error: `${response.status} ${response.statusText}: ${text}`,
      };
    }

    const json = JSON.parse(text) as {
      kind?: "direct" | "indirect" | "none";
      data?: {
        source?: string;
        destination?: string;
        options?: unknown[];
        indirect_options?: unknown[];
      };
      message?: string;
      error?: string;
    };

    const kind = json.kind || "none";
    const options = (json.data?.options || []) as Array<RouteSegment | IndirectOption>;
    const alt = (json.data?.indirect_options || []) as IndirectOption[];
        if (kind === "none" || !options.length) {
      const fallbackPlan = await findLocalDirectJourney(s, d);

      if (fallbackPlan.direct.length) {
        return fallbackPlan;
      }
    }
    return {
      kind,
      source: json.data?.source || s,
      destination: json.data?.destination || d,
      direct: kind === "direct" ? (options as RouteSegment[]) : [],
      indirect: kind === "indirect" ? (options as IndirectOption[]) : [],
      alternativeIndirect: alt,
      message: json.message || "",
      error: json.error || "",
    };
  } catch (error) {
    return {
      ...emptyPlan(s, d),
      kind: "error",
      error: error instanceof Error ? error.message : "Route finder failed",
    };
  }
}
type DbStop = {
  stoppage_name?: string | null;
  up_time?: string | null;
  down_time?: string | null;
};

type DbRoute = {
  id: string;
  bus_name?: string | null;
  bus_type?: string | null;
  image_url?: string | null;
  source?: string | null;
  destination?: string | null;
  route_data?: DbStop[] | null;
};

const cleanText = (value: string | null | undefined) => String(value || "").trim();

const canonicalText = (value: string | null | undefined) =>
  cleanText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[.,/\\&_+|:;'"!?\-]/g, " ")
    .replace(/\bbus\s*stand\b/gu, " ")
    .replace(/\bbus\s*stop\b/gu, " ")
    .replace(/\bbus\s*station\b/gu, " ")
    .replace(/\bstand\b/gu, " ")
    .replace(/বাস\s*স্ট্যান্ড/gu, " ")
    .replace(/বাসস্ট্যান্ড/gu, " ")
    .replace(/বাস\s*স্টপ/gu, " ")
    .replace(/বাসস্টপ/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const sameStopName = (a: string | null | undefined, b: string | null | undefined) => {
  const x = canonicalText(a);
  const y = canonicalText(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

const getRouteStops = (route: DbRoute) => {
  const stops: Array<{ name: string; up_time: string; down_time: string }> = [];

  if (route.source) {
    stops.push({ name: cleanText(route.source), up_time: "", down_time: "" });
  }

  for (const stop of route.route_data || []) {
    const name = cleanText(stop.stoppage_name);
    if (!name) continue;

    const last = stops[stops.length - 1];

    if (last && sameStopName(last.name, name)) {
      if (!last.up_time && stop.up_time) last.up_time = cleanText(stop.up_time);
      if (!last.down_time && stop.down_time) last.down_time = cleanText(stop.down_time);
      continue;
    }

    stops.push({
      name,
      up_time: cleanText(stop.up_time),
      down_time: cleanText(stop.down_time),
    });
  }

  if (route.destination) {
    const last = stops[stops.length - 1];
    if (!last || !sameStopName(last.name, route.destination)) {
      stops.push({ name: cleanText(route.destination), up_time: "", down_time: "" });
    }
  }

  return stops;
};

async function findLocalDirectJourney(source: string, destination: string): Promise<RoutePlan> {
  const url =
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/bus_routes?select=id,bus_name,bus_type,image_url,source,destination,route_data&deleted_at=is.null&limit=3000`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) return emptyPlan(source, destination);

    const rows = (await response.json()) as DbRoute[];
    const direct: RouteSegment[] = [];

    for (const route of rows) {
      const stops = getRouteStops(route);
      const fromIndex = stops.findIndex((stop) => sameStopName(stop.name, source));
      const toIndex = stops.findIndex((stop) => sameStopName(stop.name, destination));

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) continue;

      const isDown = fromIndex > toIndex;
      const fromStop = stops[fromIndex];
      const toStop = stops[toIndex];

      direct.push({
        bus_id: route.id,
        bus_name: cleanText(route.bus_name) || "Bus",
        bus_type: route.bus_type || "Bus",
        image_url: route.image_url || null,
        from: fromStop.name,
        to: toStop.name,
        route_source: route.source || fromStop.name,
        route_destination: route.destination || toStop.name,
        departure: isDown ? toStop.down_time || fromStop.down_time || "Time not available" : fromStop.up_time || "Time not available",
        arrival: isDown ? fromStop.down_time || toStop.down_time || "Time not available" : toStop.up_time || "Time not available",
        fare: null,
        matchScore: 700,
        matchReason: "middle stop",
      });
    }

    if (!direct.length) return emptyPlan(source, destination);

    return {
      kind: "direct",
      source,
      destination,
      direct: direct.slice(0, 20),
      indirect: [],
      alternativeIndirect: [],
      message: "Middle stop direct match",
    };
  } catch {
    return emptyPlan(source, destination);
  }
}
export async function findRoutes(source: string, destination: string) {
  return findJourney(source, destination);
}