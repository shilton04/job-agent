import { fetchAdzunaJobs } from './jobSources/adzuna.js';
import { fetchJSearchJobs } from './jobSources/jsearch.js';
import { fetchRemoteOKJobs } from './jobSources/remoteok.js';
import { jobExists, insertJob } from './db.js';

export async function fetchAllJobs() {
  const keywords = (process.env.SEARCH_KEYWORDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const location = process.env.SEARCH_LOCATION || '';

  const [adzuna, jsearch, remoteok] = await Promise.all([
    fetchAdzunaJobs(keywords, location).catch(e => { console.error('[adzuna] error', e); return []; }),
    fetchJSearchJobs(keywords, location).catch(e => { console.error('[jsearch] error', e); return []; }),
    fetchRemoteOKJobs(keywords).catch(e => { console.error('[remoteok] error', e); return []; })
  ]);

  const all = [...adzuna, ...jsearch, ...remoteok];
  const newJobs = all.filter(j => !jobExists(j.id));

  for (const job of newJobs) insertJob(job);

  console.log(`[fetchJobs] Found ${all.length} total, ${newJobs.length} new`);
  return newJobs;
}
