import { jest } from '@jest/globals';

jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn()
}));

const MOCK_ABOUT_HTML = `<!DOCTYPE html><html><body>
<div class="team-section">
  <a href="/jobs/sales-account-executive/">Sales Account Executive</a>
  <a href="/jobs/sales-development-representative/">Sales Development Representative</a>
  <a href="/jobs/business-development-manager/">Business Development Manager</a>
</div>
</body></html>`;

describe('index.js', () => {
  let index;
  let mockFetch;

  beforeAll(async () => {
    mockFetch = (await import('node-fetch')).default;
    index = await import('../../index.js');
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('scrapeJobs', () => {
    it('should extract job links from about page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => MOCK_ABOUT_HTML
      });

      const jobs = await index.scrapeJobs();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(3);
      expect(jobs[0].title).toBe('Sales Account Executive');
      expect(jobs[0].url).toMatch(/omniconvert\.com\/jobs\//);
    });
  });

  describe('transformJobs', () => {
    it('should return valid job objects with required fields', () => {
      const rawJobs = [{
        title: 'Sales Account Executive',
        url: 'https://www.omniconvert.com/jobs/sales-account-executive/',
        location: 'București',
        workplaceType: 'hybrid',
        postingDate: '2026-01-15',
      }];

      const result = index.transformJobs(rawJobs);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);

      const job = result[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', 'OMNICONVERT SRL');
      expect(job).toHaveProperty('cif', '31411197');
      expect(job).toHaveProperty('location');
      expect(Array.isArray(job.location)).toBe(true);
      expect(job).toHaveProperty('workmode');
      expect(job).toHaveProperty('country', 'România');
    });
  });

  describe('uploadJobsToSolr', () => {
    it('should skip upload when SOLR_AUTH not set', async () => {
      delete process.env.SOLR_AUTH;
      await expect(index.uploadJobsToSolr([])).resolves.not.toThrow();
      process.env.SOLR_AUTH = 'test:test';
    });
  });
});
