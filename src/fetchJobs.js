import { fetchAdzunaJobs } from './jobSources/adzuna.js';
import { fetchJSearchJobs } from './jobSources/jsearch.js';
import { fetchRemoteOKJobs } from './jobSources/remoteok.js';
import { fetchIndeedJobs } from './jobSources/indeed.js';
import { resolveLocations } from './jobSources/locations.js';
import { jobExists, fingerprint, fingerprintExists, insertJob } from './db.js';

export async function fetchAllJobs() {
  const keywords = (process.env.SEARCH_KEYWORDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const locations = resolveLocations(process.env.SEARCH_LOCATIONS || '');

  const perLocation = locations.flatMap(loc => [
    fetchAdzunaJobs(keywords, loc).catch(e => { console.error(`[adzuna] error for "${loc.label}"`, e); return []; }),
    fetchJSearchJobs(keywords, loc).catch(e => { console.error(`[jsearch] error for "${loc.label}"`, e); return []; }),
    fetchIndeedJobs(keywords, loc).catch(e => { console.error(`[indeed] error for "${loc.label}"`, e); return []; })
  ]);

  const [results, remoteok] = await Promise.all([
    Promise.all(perLocation),
    fetchRemoteOKJobs(keywords).catch(e => { console.error('[remoteok] error', e); return []; })
  ]);

  const all = [...new Map([...results.flat(), ...remoteok].map(j => [j.id, j])).values()];
  const unseen = all.filter(j => !jobExists(j.id));

  // Dedup cross-source duplicates (same posting via Adzuna + JSearch + Indeed, etc.)
  // by normalized title+company — both within this batch and against jobs already
  // stored from a previous run.
  const seenFingerprints = new Set();
  const newJobs = [];
  for (const job of unseen) {
    const fp = fingerprint(job);
    if (seenFingerprints.has(fp) || fingerprintExists(fp)) continue;
    seenFingerprints.add(fp);
    newJobs.push(job);
  }

  for (const job of newJobs) insertJob(job);

  const duplicates = unseen.length - newJobs.length;
  console.log(`[fetchJobs] Found ${all.length} total, ${newJobs.length} new (${duplicates} cross-source duplicates skipped)`);
  return newJobs;
}
