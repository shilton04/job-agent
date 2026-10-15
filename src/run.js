import 'dotenv/config';
import fs from 'fs';
import { fetchAllJobs } from './fetchJobs.js';
import { scoreJob } from './scoreJob.js';
import { mapWithConcurrency } from './concurrency.js';
import { sendDigestEmail, sendScoringFailureAlert } from './notify.js';
import { updateJob } from './db.js';

// Tailored resume/cover-letter generation (tailorResumeAndCoverLetter + renderResumeToPdf +
// prepareApplication) is paused for now — digest just carries match score + key highlights
// per job instead of a full per-job application packet. Re-enable by restoring the loop
// that used to follow scoring (see git history on this file).
const THRESHOLD = Number(process.env.MATCH_THRESHOLD || 70);
const SCORE_CONCURRENCY = Number(process.env.SCORE_CONCURRENCY || 5);

async function main() {
  const resume = JSON.parse(fs.readFileSync('data/resume.json', 'utf-8'));

  const newJobs = await fetchAllJobs();
  const matched = [];
  let failedCount = 0;

  await mapWithConcurrency(newJobs, SCORE_CONCURRENCY, async job => {
    const { score, reason, highlights, missingKeywords } = await scoreJob(resume, job);
    if (reason === 'scoring failed') failedCount++;

    updateJob(job.id, {
      status: score < THRESHOLD ? 'skipped' : 'scored',
      match_score: score,
      match_reason: reason,
      match_highlights: JSON.stringify(highlights),
      missing_keywords: JSON.stringify(missingKeywords)
    });

    if (score < THRESHOLD) return;

    console.log(`[run] Match: ${job.title} @ ${job.company} (${score})`);
    matched.push({ ...job, match_score: score, match_reason: reason, highlights, missingKeywords });
  });

  // If most scoring calls failed (bad/expired API key, quota exhausted, etc.) every
  // job silently gets score 0 and the digest would just look like "no matches" with
  // no indication anything is actually broken — so raise that explicitly instead.
  if (newJobs.length > 0 && failedCount > newJobs.length * 0.5) {
    await sendScoringFailureAlert(failedCount, newJobs.length);
  }

  await sendDigestEmail(matched);
}

main().catch(e => {
  console.error('[run] fatal error', e);
  process.exit(1);
});
