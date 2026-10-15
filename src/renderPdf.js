import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderResumeToPdf(resume, outputPath) {
  let html = fs.readFileSync(path.join(__dirname, 'templates/resume.html'), 'utf-8');

  const skillsHtml = resume.skills.map(s => `<span>${escapeHtml(s)}</span>`).join(' ');
  const experienceHtml = resume.experience.map(job => `
    <div class="job">
      <div class="job-header"><span>${escapeHtml(job.role)} — ${escapeHtml(job.company)}</span><span>${job.start} – ${job.end}</span></div>
      <ul>${job.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    </div>
  `).join('');
  const educationHtml = resume.education.map(e => `<p>${escapeHtml(e.degree)}, ${escapeHtml(e.school)} (${e.year})</p>`).join('');

  const links = resume.links || {};
  const linksHtml = Object.entries(links)
    .filter(([, url]) => url)
    .map(([, url]) => `<a href="https://${escapeHtml(url)}">${escapeHtml(url)}</a>`)
    .join(' · ');

  const projectsHtml = (resume.projects || []).map(p => `
    <div class="project">
      <div class="project-header">${escapeHtml(p.name)} <span class="project-stack">(${escapeHtml(p.stack)})</span></div>
      <p>${escapeHtml(p.description)}${p.link ? ` — <a href="https://${escapeHtml(p.link)}">${escapeHtml(p.link)}</a>` : ''}</p>
    </div>
  `).join('');

  const languagesLine = (resume.languages || []).length ? `Languages: ${resume.languages.map(escapeHtml).join(', ')}` : '';
  const publicationsLine = (resume.publications || []).length ? `Publications: ${resume.publications.map(escapeHtml).join('; ')}` : '';

  html = html
    .replace('{{name}}', escapeHtml(resume.name))
    .replace('{{title}}', escapeHtml(resume.title))
    .replace('{{email}}', escapeHtml(resume.email))
    .replace('{{phone}}', escapeHtml(resume.phone))
    .replace('{{location}}', escapeHtml(resume.location))
    .replace('{{linksHtml}}', linksHtml)
    .replace('{{summary}}', escapeHtml(resume.summary))
    .replace('{{skillsHtml}}', skillsHtml)
    .replace('{{experienceHtml}}', experienceHtml)
    .replace('{{projectsHtml}}', projectsHtml)
    .replace('{{educationHtml}}', educationHtml)
    .replace('{{languagesLine}}', languagesLine)
    .replace('{{publicationsLine}}', publicationsLine);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
  await browser.close();

  return outputPath;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
