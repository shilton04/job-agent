import fetch from 'node-fetch';

export async function fetchAdzunaJobs(keywords, { adzunaCountry: country, adzunaWhere: where, label }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.warn('[adzuna] Skipped: ADZUNA_APP_ID / ADZUNA_APP_KEY not set');
    return [];
  }
  if (!country) {
    console.warn(`[adzuna] Skipped for "${label}": no supported Adzuna country code for this location`);
    return [];
  }

  const query = encodeURIComponent(keywords.join(' '));
  const pages = Number(process.env.ADZUNA_PAGES || 2);
  const results = [];

  for (let page = 1; page <= pages; page++) {
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=50&what_or=${query}&where=${encodeURIComponent(where || '')}&content-type=application/json`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[adzuna] request failed for "${label}" (page ${page})`, res.status, await res.text());
      break;
    }
    const data = await res.json();
    if (!data.results?.length) break;
    results.push(...data.results);
  }

  return results.map(j => ({
    id: `adzuna_${j.id}`,
    source: 'adzuna',
    title: j.title,
    company: j.company?.display_name || 'Unknown',
    url: j.redirect_url,
    description: (j.description || '').slice(0, 4000)
  }));
}
