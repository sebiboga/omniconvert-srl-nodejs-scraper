import { jest } from '@jest/globals';

jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn()
}));

const MOCK_ABOUT_HTML = `<!DOCTYPE html><html><body>
<ul class="grid max-w-[780px] grid-cols-1 gap-6 md:grid-cols-2">
  <li>
    <h4>Sales Account Executive</h4>
    <a href="/jobs/sales-account-executive/">View details</a>
  </li>
  <li>
    <h4>Sales Development Representative</h4>
    <a href="/jobs/sales-development-representative/">View details</a>
  </li>
  <li>
    <h4>Business Development Manager</h4>
    <a href="/jobs/business-development-manager/">View details</a>
  </li>
</ul>
</body></html>`;

const MOCK_JOB_LD = {
  '@context': 'https://schema.org',
  '@graph': [{
    '@type': 'JobPosting',
    url: 'https://www.omniconvert.com/jobs/sales-account-executive/',
    title: 'Sales Account Executive',
    datePosted: '2019-04-30T06:22:54+00:00',
    employmentType: 'FULL_TIME',
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Bucharest' }
    }
  }]
};

const MOCK_JOB_PAGE_HTML = `<!DOCTYPE html><html><body>
<script type="application/ld+json">${JSON.stringify(MOCK_JOB_LD)}</script>
<h1>Sales Account Executive</h1>
<p>Bucharest · Full-time / Hybrid</p>
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
    it('should extract job links from about page using li > a[href^="/jobs/"]', async () => {
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

    it('should fetch and parse JSON-LD from job detail pages', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: async () => MOCK_ABOUT_HTML })
        .mockResolvedValueOnce({ ok: true, text: async () => MOCK_JOB_PAGE_HTML })
        .mockResolvedValueOnce({ ok: true, text: async () => MOCK_JOB_PAGE_HTML })
        .mockResolvedValueOnce({ ok: true, text: async () => MOCK_JOB_PAGE_HTML });

      const jobs = await index.scrapeJobs();

      expect(jobs.length).toBe(3);
      expect(jobs[0].location).toBe('București');
      expect(jobs[0].workplaceType).toBe('hybrid');
      expect(jobs[0].postingDate).toBe('2019-04-30');
    });
  });

  describe('transformJobs', () => {
    it('should return valid job objects with required fields', () => {
      const rawJobs = [{
        title: 'Sales Account Executive',
        url: 'https://www.omniconvert.com/jobs/sales-account-executive/',
        location: 'București',
        workplaceType: 'hybrid',
        postingDate: '2019-04-30',
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
