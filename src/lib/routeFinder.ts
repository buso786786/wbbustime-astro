const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ytxtyphbguszjndtpakm.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4";

export async function findRoutes(source: string, destination: string) {
  const s = source.trim();
  const d = destination.trim();

  if (!s || !d) {
    return { kind: "none", error: "source and destination required" };
  }

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/route-finder`;

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
      kind: "error",
      status: response.status,
      statusText: response.statusText,
      responseText: text,
      url,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      kind: "error",
      error: "Invalid JSON response",
      responseText: text,
      url,
    };
  }
}