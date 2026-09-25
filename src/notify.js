import nodemailer from 'nodemailer';

export async function sendDigestEmail(jobs) {
  if (jobs.length === 0) {
    console.log('[notify] No matched jobs today, skipping email');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
  });

  const rows = jobs.map(j => `
    <tr>
      <td>${j.title}</td>
      <td>${j.company}</td>
      <td>${j.match_score}</td>
      <td>${j.status}</td>
      <td><a href="${j.url}">Open</a></td>
    </tr>
  `).join('');

  const html = `
    <h2>Job Agent Digest — ${new Date().toDateString()}</h2>
    <p>${jobs.length} job(s) matched today. Nothing has been submitted anywhere — review and apply using the links/attachments below.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Title</th><th>Company</th><th>Match</th><th>Status</th><th>Link</th></tr>
      ${rows}
    </table>
  `;

  const attachments = jobs
    .filter(j => j.resume_path)
    .map(j => ({ filename: `resume_${j.company}.pdf`, path: j.resume_path }));

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `Job Agent: ${jobs.length} matches — ${new Date().toDateString()}`,
    html,
    attachments
  });

  console.log(`[notify] Digest sent for ${jobs.length} jobs`);
}
