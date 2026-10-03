import fetch from 'node-fetch';

export async function fetchJSearchJobs(keywords, { label, jsearchCountry }) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    console.warn('[jsearch] Skipped: JSEARCH_API_KEY not set');
    return [];
  }

  const query = encodeURIComponent(`(${keywords.join(' OR ')}) jobs in ${label}`);
  const country = jsearchCountry ? `&country=${jsearchCountry}` : '';
  const url = `https://jsearch.p.rapidapi.com/search-v2?query=${query}${country}&num_pages=1&date_posted=today`;

  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });
  if (!res.ok) {
    console.error(`[jsearch] request failed for "${label}"`, res.status, await res.text());
    return [];
  }
  const data = await res.json();

  return (data.data?.jobs || []).map(j => ({
    id: `jsearch_${j.job_id}`,
    source: j.job_publisher || 'jsearch',
    title: j.job_title,
    company: j.employer_name || 'Unknown',
    url: j.job_apply_link,
    description: (j.job_description || '').slice(0, 4000)
  }));
}
