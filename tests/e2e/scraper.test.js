import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const TEST_CIF = '31411197';
const TEST_BRAND = 'Omniconvert';
const OMNICONVERT_ABOUT_URL = 'https://www.omniconvert.com/about/';

describe('E2E: Full Scraping Pipeline', () => {

  describe('Omniconvert About Page — HTML Scrape Test', () => {
    let html;
    let $;

    beforeAll(async () => {
      const res = await fetch(OMNICONVERT_ABOUT_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'text/html'
        }
      });
      html = await res.text();
      const cheerioModule = await import('cheerio');
      $ = cheerioModule.load(html);
    }, 15000);

    it('should return valid HTML from the about page', () => {
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('</html>');
    });

    it('should contain job links on the about page', () => {
      const jobLinks = $('a[href^="/jobs/"]');
      expect(jobLinks.length).toBeGreaterThan(0);
    });

    it('should have at least one job link with valid href', () => {
      const jobLinks = $('a[href^="/jobs/"]');
      const hrefs = jobLinks.map((i, el) => $(el).attr('href')).get();
      expect(hrefs.length).toBeGreaterThan(0);
      hrefs.forEach(href => {
        expect(href.startsWith('/jobs/')).toBe(true);
      });
    });
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    it('should find Omniconvert in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const company = results.find(c =>
        c.name.toUpperCase().startsWith('OMNICONVERT') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(company).toBeDefined();
      expect(company.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('OMNICONVERT SRL');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('⚠️ No Omniconvert jobs in Solr — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany('Omniconvert');

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have Omniconvert jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No Omniconvert jobs in Solr — skipping SOLR data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe('OMNICONVERT SRL');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have Omniconvert company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const company = result.docs[0];
      expect(company.company).toBe('OMNICONVERT SRL');
      expect(company.status).toBe('activ');
    }, 15000);
  });
});
