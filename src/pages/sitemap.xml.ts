// Static demo URLs - will be replaced by Supabase fetched routes later
const staticPages = [
	{ url: '/', lastmod: new Date().toISOString() },
	{ url: '/bus-search', lastmod: new Date().toISOString() },
	{ url: '/bus-timetable/tarakeswar-to-digha/', lastmod: new Date().toISOString() },
	{ url: '/rent-vehicle', lastmod: new Date().toISOString() },
	{ url: '/about', lastmod: new Date().toISOString() },
	{ url: '/faq', lastmod: new Date().toISOString() },
	{ url: '/contact', lastmod: new Date().toISOString() },
	{ url: '/privacy-policy', lastmod: new Date().toISOString() },
	{ url: '/terms-and-conditions', lastmod: new Date().toISOString() }
];

const baseUrl = 'https://soniabuddy.in';

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`.trim();

export function GET() {
	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
}
