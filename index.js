import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const COMPANY = 'OMNICONVERT SRL';
const CIF = '31411197';
const ABOUT_URL = 'https://www.omniconvert.com/about/';

function extractJobsFromAboutPage(html) {
  const $ = cheerio.load(html);
  const jobs = [];

  $('a[href^="/jobs/"]').each((i, el) => {
    const href = $(el).attr('href');
    const parentText = $(el).parent().text().trim();
    const linkText = $(el).text().trim();

    let title = '';
    if (linkText && !linkText.match(/^(Details|details|Apply|apply|→|←)$/i)) {
      title = linkText;
    } else {
      const prev = $(el).closest('div').prev().text().trim();
      if (prev && prev.length > 2) title = prev;
    }

    if (title && href && href.startsWith('/jobs/')) {
      const fullUrl = `https://www.omniconvert.com${href}`;
      if (!jobs.find(j => j.url === fullUrl)) {
        jobs.push({
          title: title.trim(),
          url: fullUrl,
          location: 'București',
          workplaceType: '',
          postingDate: '',
        });
      }
    }
  });

  return jobs;
}

async function scrapeJobDetails(job) {
  try {
    const res = await fetch(job.url, {
      headers: { 'User-Agent': 'job_seeker_ro_spider' }
    });
    if (!res.ok) return job;
    const html = await res.text();
    const $ = cheerio.load(html);

    const text = $('body').text();

    const titleMatch = text.match(/([^\n]+)\s*[-–|]\s*(?:Bucharest|București|Iași|Cluj|Timișoara|Brașov|Constanța|Sibiu|Oradea)/i);
    if (titleMatch) {
      job.title = titleMatch[1].trim();
    }

    const locationMatch = text.match(/(?:Bucharest|București|Iași|Cluj|Timișoara|Brașov|Constanța|Sibiu|Oradea)/i);
    if (locationMatch) {
      job.location = locationMatch[0] === 'Bucharest' ? 'București' : locationMatch[0];
    }

    const workMatch = text.match(/(Remote|On-site|Hybrid|Full-time|Part-time)/i);
    if (workMatch) {
      const w = workMatch[1].toLowerCase();
      if (w === 'remote') job.workplaceType = 'remote';
      else if (w === 'hybrid' || w === 'full-time') job.workplaceType = 'hybrid';
      else if (w === 'on-site' || w === 'part-time') job.workplaceType = 'on-site';
    }

    const dateText = $('meta[property="article:published_time"]').attr('content')
      || $('time').attr('datetime')
      || $('[itemprop="datePosted"]').attr('content')
      || '';
    if (dateText) {
      job.postingDate = dateText.slice(0, 10);
    }
  } catch {
  }
  return job;
}

async function scrapeJobs() {
  console.log(`Fetching ${ABOUT_URL}...`);
  const res = await fetch(ABOUT_URL, {
    headers: { 'User-Agent': 'job_seeker_ro_spider' }
  });
  const html = await res.text();

  let jobs = extractJobsFromAboutPage(html);
  console.log(`Found ${jobs.length} job links`);

  for (let i = 0; i < jobs.length; i++) {
    console.log(`Fetching details for: ${jobs[i].title}`);
    jobs[i] = await scrapeJobDetails(jobs[i]);
  }

  return jobs;
}

function transformJobs(jobs) {
  return jobs.map(job => ({
    url: job.url,
    title: job.title,
    company: COMPANY,
    cif: CIF,
    location: [job.location || 'București'],
    workmode: job.workplaceType || 'hybrid',
    country: 'România',
  }));
}

async function uploadJobsToSolr(jobs) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) {
    console.log('SOLR_AUTH not set - skipping SOLR upload');
    return;
  }

  const solr = await import('./solr.js');
  await solr.upsertJobs(jobs);
  console.log(`✅ Uploaded ${jobs.length} jobs to SOLR`);
}

async function main() {
  console.log(`\n🚀 Omniconvert Job Scraper - ${COMPANY}\n`);

  const jobs = await scrapeJobs();
  const payload = transformJobs(jobs);

  const jobsPath = path.join(TMP_DIR, 'jobs.json');
  fs.writeFileSync(jobsPath, JSON.stringify(payload, null, 2));
  console.log(`\n💾 Saved ${jobs.length} jobs to ${jobsPath}`);

  await uploadJobsToSolr(payload);

  console.log(`\n✅ Done. ${jobs.length} Omniconvert jobs processed.\n`);
  return payload;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch(err => {
    console.error('❌ Scraper failed:', err.message);
    process.exit(1);
  });
}

export { scrapeJobs, transformJobs, uploadJobsToSolr };
