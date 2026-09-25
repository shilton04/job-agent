import { chromium } from 'playwright';
import path from 'path';

/**
 * IMPORTANT: This never clicks submit. It only:
 *  - opens the job's apply page
 *  - fills fields it can confidently identify (name/email/phone/resume upload) on
 *    known ATS platforms (Greenhouse, Lever) where field structure is predictable
 *  - takes a screenshot so you can see exactly what would be submitted
 * For everything else (LinkedIn Easy Apply, Naukri, Indeed, custom company portals)
 * it just records the link + your tailored resume/cover letter for you to apply
 * manually — those sites actively fight automation and it's not worth the fragility
 * or the ToS risk.
 */
export async function prepareApplication(job, resumePdfPath, coverLetterText, screenshotDir) {
  const screenshotPath = path.join(screenshotDir, `${job.id}.png`);

  const isKnownATS = /greenhouse\.io|lever\.co/i.test(job.url);

  if (!isKnownATS) {
    return {
      status: 'manual_apply_needed',
      screenshotPath: null,
      note: 'This site is not a supported auto-fill target. Apply manually using the tailored resume/cover letter attached in the digest email.'
    };
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Best-effort selectors - Greenhouse/Lever forms vary, adjust as you encounter real postings
    const nameField = page.locator('input[name*="name" i]').first();
    const emailField = page.locator('input[type="email"], input[name*="email" i]').first();
    const resumeUpload = page.locator('input[type="file"]').first();

    if (await nameField.count()) await nameField.fill(process.env.CANDIDATE_NAME || '');
    if (await emailField.count()) await emailField.fill(process.env.EMAIL_TO || '');
    if (await resumeUpload.count()) await resumeUpload.setInputFiles(resumePdfPath);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    return {
      status: 'ready_for_review',
      screenshotPath,
      note: 'Form filled and screenshotted. Nothing submitted — open the link, verify, and click submit yourself.'
    };
  } catch (e) {
    console.error(`[prepareApplication] ${job.id} failed`, e.message);
    return { status: 'manual_apply_needed', screenshotPath: null, note: `Auto-fill failed: ${e.message}` };
  } finally {
    await browser.close();
  }
}
