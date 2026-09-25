import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fetchAllJobs } from './fetchJobs.js';
import { scoreJob, tailorResumeAndCoverLetter } from './scoreJob.js';
import { renderResumeToPdf } from './renderPdf.js';
import { prepareApplication } from './prepareApplication.js';
import { sendDigestEmail } from './notify.js';
import { updateJob } from './db.js';

const OUTPUT_DIR = path.resolve('output/pending-applications');
const THRESHOLD = Number(process.env.MATCH_THRESHOLD || 70);

async function main() {
  const resume = JSON.parse(fs.readFileSync('data/resume.json', 'utf-8'));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const newJobs = await fetchAllJobs();
  const matched = [];

  for (const job of newJobs) {
    const { score, reason } = await scoreJob(resume, job);
    updateJob(job.id, { status: 'scored', match_score: score, match_reason: reason });

    if (score < THRESHOLD) {
      updateJob(job.id, { status: 'skipped' });
      continue;
    }

    console.log(`[run] Match: ${job.title} @ ${job.company} (${score}) — tailoring`);
    let tailored;
    try {
      tailored = await tailorResumeAndCoverLetter(resume, job);
    } catch (e) {
      console.error(`[run] tailoring failed for ${job.id}`, e.message);
      continue;
    }

    const resumePdfPath = path.join(OUTPUT_DIR, `${job.id}_resume.pdf`);
    const coverLetterPath = path.join(OUTPUT_DIR, `${job.id}_cover_letter.txt`);
    await renderResumeToPdf(tailored.resume, resumePdfPath);
    fs.writeFileSync(coverLetterPath, tailored.coverLetter);

    const prep = await prepareApplication(job, resumePdfPath, tailored.coverLetter, OUTPUT_DIR);

    updateJob(job.id, {
      status: prep.status,
      resume_path: resumePdfPath,
      cover_letter_path: coverLetterPath,
      screenshot_path: prep.screenshotPath
    });

    matched.push({ ...job, match_score: score, status: prep.status, resume_path: resumePdfPath });
  }

  await sendDigestEmail(matched);
}

main().catch(e => {
  console.error('[run] fatal error', e);
  process.exit(1);
});
