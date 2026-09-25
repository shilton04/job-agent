# Job Agent — starter project

A daily pipeline that finds jobs, scores them against your resume, tailors a resume + cover letter per job,
prepares (but never auto-submits) applications, and emails you a review digest.

**By design, nothing is ever submitted automatically.** Every run ends with an email you review yourself.

## What it does each run
1. Fetches new postings from Adzuna, JSearch (aggregates LinkedIn/Indeed/Naukri-style listings), and RemoteOK
2. Skips anything already seen (tracked in `job-agent.db`)
3. Scores each new job against your resume using Gemini (free tier)
4. For matches above your threshold: rewrites your resume + writes a cover letter, tailored to that job
5. Renders the tailored resume to PDF
6. For Greenhouse/Lever postings: fills the application form and screenshots it (still doesn't click submit)
7. For everything else: just prepares the tailored materials for you to apply manually
8. Emails you everything: job list, match scores, tailored resume PDFs, screenshots where available

## One-time setup

1. **Get free API keys** (all free tiers, no credit card needed for most):
   - Adzuna: https://developer.adzuna.com/
   - JSearch (RapidAPI): https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
   - Gemini: https://aistudio.google.com/apikey
   - Gmail App Password: https://myaccount.google.com/apppasswords (requires 2FA enabled on the Gmail account)

2. **Install dependencies**
   ```bash
   npm install
   npx playwright install chromium
   ```

3. **Fill in your resume**
   ```bash
   cp data/resume.example.json data/resume.json
   ```
   Edit `data/resume.json` with your real details — this is the source of truth the AI edits from, so put your
   real skills, bullets, and experience in here.

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in the API keys and your keyword list.

5. **Test locally**
   ```bash
   npm run test-fetch   # sanity-check that job sources return results
   node src/run.js      # full run
   ```

## Running it daily for free (GitHub Actions)

1. Push this repo to GitHub (private repo is fine, GitHub Actions free minutes cover a daily job like this easily)
2. In the repo settings → Secrets and variables → Actions, add each value from your `.env` as a secret
   (same names: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JSEARCH_API_KEY`, `GEMINI_API_KEY`, `EMAIL_USER`,
   `EMAIL_APP_PASSWORD`, `EMAIL_TO`)
3. That's it — `.github/workflows/daily.yml` runs it every day at 8:30 AM IST and commits the updated
   tracking database so it never reprocesses the same job twice. You can also trigger it manually from the
   Actions tab any time.

## Extending it

- **More ATS coverage**: `src/prepareApplication.js` currently only auto-fills Greenhouse/Lever forms —
  add more `if` branches with selectors for other platforms as you encounter them.
- **Better matching**: swap the LLM score in `scoreJob.js` for embeddings (e.g. Gemini embeddings +
  cosine similarity) if you want cheaper/faster scoring at higher job volume.
- **Naukri/LinkedIn specific search**: JSearch already aggregates these, but if you want direct API access
  you'll need LinkedIn's official Talent/Jobs API (requires partnership approval) — not worth it for personal use.
