export function GET() {
  const robotsTxt = `
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /owner/
Disallow: /api/
Disallow: /login/
Disallow: /signup/

Sitemap: https://soniabuddy.in/sitemap.xml
`.trim();

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}