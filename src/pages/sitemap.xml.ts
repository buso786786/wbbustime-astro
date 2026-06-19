// Static demo URLs - will be replaced by Supabase fetched routes later
const staticPages = [
	{ url: '/', lastmod: new Date().toISOString() },
	{ url: '/route-finder', lastmod: new Date().toISOString() },
	{ url: '/all-routes', lastmod: new Date().toISOString() },
	{ url: '/bus-search', lastmod: new Date().toISOString() },
	{ url: '/rent-vehicle', lastmod: new Date().toISOString() },
	{ url: '/about', lastmod: new Date().toISOString() },
	{ url: '/faq', lastmod: new Date().toISOString() },
	{ url: '/contact', lastmod: new Date().toISOString() },
	{ url: '/privacy-policy', lastmod: new Date().toISOString() },
	{ url: '/terms-and-conditions', lastmod: new Date().toISOString() }
];

// Static route data array with 10 demo routes
const routes = [
	{ slug: "arambagh-to-bandar" },
	{ slug: "kolkata-to-durgapur" },
	{ slug: "kolkata-to-siliguri" },
	{ slug: "kolkata-to-asansol" },
	{ slug: "bankura-to-asansol" },
	{ slug: "durgapur-to-asansol" },
	{ slug: "tarakeswar-to-digha" },
	{ slug: "howrah-to-tarakeswar" },
	{ slug: "mecheda-to-digha" },
	{ slug: "kolkata-to-contai" }
];

const routePages = routes.map(route => ({
	url: `/bus-timetable/${route.slug}/`,
	lastmod: new Date().toISOString()
}));

const baseUrl = 'https://soniabuddy.in';

const allPages = [...staticPages, ...routePages];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
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
