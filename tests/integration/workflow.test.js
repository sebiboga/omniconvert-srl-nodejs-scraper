import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

const OMNICONVERT_CIF = '31411197';

describe('Integration: API Workflow', () => {

  describe('ANAF API', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should search for Omniconvert brand and find the company', async () => {
      const results = await anaf.searchCompany('Omniconvert');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const companyResult = results.find(c =>
        c.name.toUpperCase().includes('OMNICONVERT') && c.statusLabel === 'Funcțiune'
      );
      expect(companyResult).toBeDefined();
      expect(companyResult.cui.toString()).toBe(OMNICONVERT_CIF);
    }, 15000);

    it('should return empty array for non-existent brand', async () => {
      const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 15000);

    it('should fetch company details by valid CIF', async () => {
      const data = await anaf.getCompanyFromANAF(OMNICONVERT_CIF);

      expect(data).toBeDefined();
      expect(data.cui).toBe(31411197);
      expect(data.name).toBe('OMNICONVERT SRL');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
      expect(data).toHaveProperty('caenCode');
      expect(data).toHaveProperty('inactive', false);
      expect(data).toHaveProperty('onrcStatusLabel', 'Funcțiune');
    }, 15000);

    it('should throw for invalid CIF', async () => {
      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    }, 60000);

    it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
      const cached = { cui: 31411197, name: 'OMNICONVERT SRL' };

      const data = await anaf.getCompanyFromANAFWithFallback(OMNICONVERT_CIF, cached);

      expect(data).toBeDefined();
      expect(data.cui).toBe(31411197);
    }, 15000);
  });

  describe('Peviitor API', () => {
    let company;

    beforeAll(async () => {
      company = await import('../../company.js');
    });

    it.skip('should respond successfully and contain companies array (Peviitor API may block non-browser requests)', async () => {
      const res = await fetch('https://api.peviitor.ro/v1/company/', {
        headers: { 'User-Agent': 'job_seeker_ro_spider' }
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('companies');
      expect(Array.isArray(data.companies)).toBe(true);
    }, 15000);
  });

  describe('SOLR Company Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query company core by ID', async () => {
      const result = await solr.queryCompanySOLR(`id:${OMNICONVERT_CIF}`);

      expect(result.numFound).toBe(1);
      const companyEntry = result.docs[0];
      expect(companyEntry.id).toBe(OMNICONVERT_CIF);
      expect(companyEntry.company).toBe('OMNICONVERT SRL');
      expect(companyEntry.brand).toBe('Omniconvert');
      expect(companyEntry.status).toBe('activ');
      expect(Array.isArray(companyEntry.location)).toBe(true);
      expect(companyEntry.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 15000);

    itIfSolr('should have required company model fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${OMNICONVERT_CIF}`);
      const companyEntry = result.docs[0];

      expect(companyEntry).toHaveProperty('id', OMNICONVERT_CIF);
      expect(companyEntry).toHaveProperty('company');
      expect(companyEntry).toHaveProperty('brand', 'Omniconvert');
      expect(companyEntry).toHaveProperty('status');
      expect(['activ', 'suspendat', 'inactiv', 'radiat']).toContain(companyEntry.status);
      expect(companyEntry).toHaveProperty('location');
      expect(Array.isArray(companyEntry.location)).toBe(true);
      expect(companyEntry).toHaveProperty('website');
      expect(Array.isArray(companyEntry.website)).toBe(true);
      expect(companyEntry.website[0]).toMatch(/^https?:\/\/.+/);
      expect(companyEntry).toHaveProperty('career');
      expect(Array.isArray(companyEntry.career)).toBe(true);
      expect(companyEntry.career[0]).toMatch(/^https?:\/\/.+/);
      expect(companyEntry).toHaveProperty('lastScraped');
      expect(companyEntry).toHaveProperty('scraperFile');
    }, 15000);

    itIfSolr('should have optional field (group) if present', async () => {
      const result = await solr.queryCompanySOLR(`id:${OMNICONVERT_CIF}`);
      const companyEntry = result.docs[0];

      if (companyEntry.group !== undefined) {
        expect(typeof companyEntry.group).toBe('string');
      }
    }, 15000);
  });

  describe('SOLR Jobs Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query jobs by CIF and return valid data', async () => {
      const result = await solr.querySOLR(OMNICONVERT_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No Omniconvert jobs in Solr — skipping job field assertions (scraper may not have run yet)');
        return;
      }

      expect(result.numFound).toBeGreaterThan(0);
      expect(Array.isArray(result.docs)).toBe(true);

      const job = result.docs[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', 'OMNICONVERT SRL');
      expect(job).toHaveProperty('cif', OMNICONVERT_CIF);
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('location');
    }, 15000);

    itIfSolr('should not have duplicate URLs for same CIF', async () => {
      const result = await solr.querySOLR(OMNICONVERT_CIF);

      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(result.docs.length);
    }, 15000);

    itIfSolr('should have valid status values for all jobs', async () => {
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];
      const result = await solr.querySOLR(OMNICONVERT_CIF);

      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    }, 15000);

    itIfSolr('should have valid CIF format for all jobs', async () => {
      const result = await solr.querySOLR(OMNICONVERT_CIF);

      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{8}$/);
      }
    }, 15000);
  });

  describe('Full Validation Workflow', () => {
    let anaf;
    let companyModule;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      companyModule = await import('../../company.js');
    });

    it('should complete the ANAF → Peviitor validation path', async () => {
      const searchResults = await anaf.searchCompany('Omniconvert');
      expect(searchResults.length).toBeGreaterThan(0);

      const companyEntry = searchResults.find(c =>
        c.name.toUpperCase().includes('OMNICONVERT') && c.statusLabel === 'Funcțiune'
      );
      expect(companyEntry).toBeDefined();

      const anafData = await anaf.getCompanyFromANAF(companyEntry.cui.toString());
      expect(anafData.name).toBe('OMNICONVERT SRL');
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should have matching CIF in company core', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      const solrObj = await import('../../solr.js');

      const solrResult = await solrObj.queryCompanySOLR(`id:${OMNICONVERT_CIF}`);
      expect(solrResult.numFound).toBe(1);
      expect(solrResult.docs[0].id).toBe(OMNICONVERT_CIF);
      expect(solrResult.docs[0].company).toBe('OMNICONVERT SRL');
    }, 30000);

    itIfSolr('should validate company and query SOLR for existing jobs', async () => {
      const companyResult = await companyModule.validateAndGetCompany();

      expect(companyResult.status).toBe('active');
      expect(companyResult.company).toBe('OMNICONVERT SRL');
      expect(companyResult.cif).toBe(OMNICONVERT_CIF);

      if (companyResult.existingJobsCount === 0) {
        console.log('⚠️ No Omniconvert jobs in Solr — skipping job count assertion (scraper may not have run yet)');
        return;
      }
      expect(companyResult.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });
});
