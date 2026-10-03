import { fetchAdzunaJobs } from './jobSources/adzuna.js';
import { fetchJSearchJobs } from './jobSources/jsearch.js';
import { fetchRemoteOKJobs } from './jobSources/remoteok.js';
import { resolveLocations } from './jobSources/locations.js';
import { jobExists, insertJob } from './db.js';

export async function fetchAllJobs() {
  const keywords = (process.env.SEARCH_KEYWORDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const locations = resolveLocations(process.env.SEARCH_LOCATIONS || '');

  const perLocation = locations.flatMap(loc => [
    fetchAdzunaJobs(keywords, loc).catch(e => { console.error(`[adzuna] error for "${loc.label}"`, e); return []; }),
    fetchJSearchJobs(keywords, loc).catch(e => { console.error(`[jsearch] error for "${loc.label}"`, e); return []; })
  ]);

  const [results, remoteok] = await Promise.all([
    Promise.all(perLocation),
    fetchRemoteOKJobs(keywords).catch(e => { console.error('[remoteok] error', e); return []; })
  ]);

  const all = [...new Map([...results.flat(), ...remoteok].map(j => [j.id, j])).values()];
  const newJobs = all.filter(j => !jobExists(j.id));

  for (const job of newJobs) insertJob(job);

  console.log(`[fetchJobs] Found ${all.length} total, ${newJobs.length} new`);
  return newJobs;
}
