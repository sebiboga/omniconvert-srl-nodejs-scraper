# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-09

### Changed
- Replaced API scraping with cheerio-based HTML parsing (Astro static site)
- Rewrote extractJobsFromAboutPage for actual `<li><h4>title</h4><a>` structure
- Extract structured data from Schema.org JSON-LD on job detail pages
- Output saved as `{jobs: [...]}` for workflow compatibility
- Updated docs to reflect cheerio approach

### Added
- `status: scraped` field to transformed job objects

### Fixed
- Scraper found 0 jobs due to wrong selector (used `.team-section` instead of `li h4 + a`)
- Cheerio import in e2e tests (`cheerio.load` was undefined)

## [1.0.0] - 2026-04-16

### Added
- Initial release
- Job scraping from Omniconvert Careers Romania API
- Company validation via ANAF
- Solr integration for job storage
- GitHub Actions workflows for daily scraping and testing
- Comprehensive test suite (unit, integration, E2E)
- ANAF API fallback with cached data support
- Node 24 compatibility

### Features
- Automated daily job scraping
- Company core validation and management
- Job URL validation
- Data integrity checks
- Romanian location filtering
- Work mode normalization

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE
Licensed under MIT License
