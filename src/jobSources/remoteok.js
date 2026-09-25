import fetch from 'node-fetch';

export async function fetchRemoteOKJobs(keywords) {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'job-agent (personal use)' }
  });
  if (!res.ok) {
    console.error('[remoteok] request failed', res.status);
    return [];
  }
  const data = await res.json();
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  return data
    .filter(j => j.id && j.position) // first element is metadata, skip it
    .filter(j => {
      const haystack = `${j.position} ${(j.tags || []).join(' ')}`.toLowerCase();
      return lowerKeywords.some(k => haystack.includes(k.toLowerCase()));
    })
    .map(j => ({
      id: `remoteok_${j.id}`,
      source: 'remoteok',
      title: j.position,
      company: j.company,
      url: j.url,
      description: (j.description || '').slice(0, 4000)
    }));
}
