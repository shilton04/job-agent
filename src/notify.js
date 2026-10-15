import nodemailer from 'nodemailer';

const MAX_DIGEST_JOBS = Number(process.env.MAX_DIGEST_JOBS || 30);

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
  });
}

export async function sendDigestEmail(jobs) {
  if (jobs.length === 0) {
    console.log('[notify] No matched jobs today, skipping email');
    return;
  }

  const sorted = [...jobs].sort((a, b) => b.match_score - a.match_score);
  const shown = sorted.slice(0, MAX_DIGEST_JOBS);
  const overflow = sorted.length - shown.length;

  const rows = shown.map(j => `
    <tr>
      <td><a href="${j.url}">${j.title}</a></td>
      <td>${j.company}</td>
      <td>${j.match_score}</td>
      <td>${j.match_reason || ''}</td>
      <td><ul>${(j.highlights || []).map(h => `<li>${h}</li>`).join('')}</ul></td>
      <td>${(j.missingKeywords || []).length ? `<ul>${j.missingKeywords.map(k => `<li>${k}</li>`).join('')}</ul>` : '—'}</td>
    </tr>
  `).join('');

  const html = `
    <h2>Job Agent Digest — ${new Date().toDateString()}</h2>
    <p>${jobs.length} job(s) matched today${overflow > 0 ? ` — showing the top ${shown.length} by match score, ${overflow} more saved in job-agent.db` : ''}. No resumes/cover letters generated — use the key points below to tailor your own application, then apply via the link. The "Missing keywords" column is what's likely blocking an ATS/recruiter keyword match — if you genuinely have that skill, make sure it's on your resume before applying.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Title</th><th>Company</th><th>Match</th><th>Why it matched</th><th>Key points to emphasize</th><th>Missing keywords</th></tr>
      ${rows}
    </table>
  `;

  await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `Job Agent: ${jobs.length} matches — ${new Date().toDateString()}`,
    html
  });

  console.log(`[notify] Digest sent for ${shown.length}/${jobs.length} jobs`);
}

export async function sendScoringFailureAlert(failedCount, totalCount) {
  console.error(`[notify] ${failedCount}/${totalCount} jobs failed scoring — alerting`);

  await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `Job Agent: scoring is broken (${failedCount}/${totalCount} failed)`,
    html: `
      <h2>Job Agent — scoring failure</h2>
      <p>${failedCount} of ${totalCount} fetched jobs failed to score today (most likely an invalid/expired GEMINI_API_KEY or exhausted quota).</p>
      <p>Any "matches" in today's digest, if sent, are not reliable — check the GitHub Actions run logs and your Gemini API key/quota.</p>
    `
  });
}
