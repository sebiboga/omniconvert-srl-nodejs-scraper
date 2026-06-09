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

  $('li a[href^="/jobs/"]').each((i, el) => {
    const href = $(el).attr('href');
    const li = $(el).closest('li');
    const title = li.find('h4').first().text().trim();

    if (title && href && href.startsWith('/jobs/')) {
      const fullUrl = `https://www.omniconvert.com${href}`;
      if (!jobs.find(j => j.url === fullUrl)) {
        jobs.push({
          title,
          url: fullUrl,
          location: '',
          workplaceType: '',
          postingDate: '',
        });
      }
    }
  });

  return jobs;
}

function extractStructuredData(html) {
  const $ = cheerio.load(html);
  const data = { title: '', location: '', workplaceType: '', postingDate: '' };

  const ldJson = $('script[type="application/ld+json"]')
    .map((i, el) => {
      try { return JSON.parse($(el).text()); } catch { return null; }
    })
    .get()
    .find(item => {
      const graph = item['@graph'] || [];
      return graph.some(g => g['@type'] === 'JobPosting');
    });

  if (ldJson) {
    const graph = ldJson['@graph'] || [];
    const posting = graph.find(g => g['@type'] === 'JobPosting') || {};
    data.title = posting.title || '';
    data.postingDate = posting.datePosted ? posting.datePosted.slice(0, 10) : '';

    const addr = posting.jobLocation?.address || {};
    const city = addr.addressLocality || '';
    data.location = city === 'Bucharest' ? 'București' : city;

    if (posting.employmentType) {
      const et = posting.employmentType.toUpperCase();
      if (et === 'FULL_TIME') data.workplaceType = 'hybrid';
      else if (et === 'PART_TIME') data.workplaceType = 'hybrid';
      else if (et === 'REMOTE') data.workplaceType = 'remote';
      else if (et === 'ON_SITE') data.workplaceType = 'on-site';
    }
  }

  return data;
}

const LOCATION_WORK_REGEX = /(?:Bucharest|București|Iași|Cluj|Timișoara|Brașov|Constanța|Sibiu|Oradea)\s*[·•]\s*(Full-time|Part-time|Hybrid|Remote|On-site)/i;
const LOCATION_REGEX = /(Bucharest|București|Iași|Cluj|Timișoara|Brașov|Constanța|Sibiu|Oradea)/i;
const WORK_REGEX = /(Remote|On-Site|Onsite|Hybrid|Full-time|Part-time)/i;

function extractLocationFromText(text) {
  const data = { location: '', workplaceType: '' };

  const combined = text.match(LOCATION_WORK_REGEX);
  if (combined) {
    data.location = combined[1] === 'Bucharest' ? 'București' : combined[1];
    const w = combined[2].toLowerCase();
    if (w === 'on-site' || w === 'onsite') data.workplaceType = 'on-site';
    else if (w === 'remote') data.workplaceType = 'remote';
    else if (w === 'hybrid' || w === 'full-time' || w === 'part-time') data.workplaceType = 'hybrid';
    return data;
  }

  const locMatch = text.match(LOCATION_REGEX);
  if (locMatch) {
    data.location = locMatch[1] === 'Bucharest' ? 'București' : locMatch[1];
  }

  const workMatch = text.match(WORK_REGEX);
  if (workMatch) {
    const w = workMatch[1].toLowerCase();
    if (w === 'on-site' || w === 'onsite') data.workplaceType = 'on-site';
    else if (w === 'remote') data.workplaceType = 'remote';
    else if (w === 'hybrid' || w === 'full-time' || w === 'part-time') data.workplaceType = 'hybrid';
  }

  return data;
}

async function scrapeJobDetails(job) {
  try {
    const res = await fetch(job.url, {
      headers: { 'User-Agent': 'job_seeker_ro_spider' }
    });
    if (!res.ok) return job;
    const html = await res.text();
    const structured = extractStructuredData(html);

    if (structured.title) job.title = structured.title;
    if (structured.location) job.location = structured.location;
    if (structured.workplaceType) job.workplaceType = structured.workplaceType;
    if (structured.postingDate) job.postingDate = structured.postingDate;

    if (!job.location || !job.workplaceType) {
      const $ = cheerio.load(html);
      const visibleText = $('h1').first().parent().text() || $('body').text();
      const fallback = extractLocationFromText(visibleText);
      if (!job.location && fallback.location) job.location = fallback.location;
      if (!job.workplaceType && fallback.workplaceType) job.workplaceType = fallback.workplaceType;
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
    status: 'scraped',
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
  fs.writeFileSync(jobsPath, JSON.stringify({ jobs: payload }, null, 2));
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
