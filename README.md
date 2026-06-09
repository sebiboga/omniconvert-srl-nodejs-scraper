# job_seeker_ro_spider — Omniconvert Careers Romania Scraper

[![WebScraper Omniconvert to Peviitor](https://github.com/sebiboga/omniconvert-srl-nodejs-scraper/actions/workflows/scrape.yml/badge.svg)](https://github.com/sebiboga/omniconvert-srl-nodejs-scraper/actions/workflows/scrape.yml)
[![Automation Tests](https://github.com/sebiboga/omniconvert-srl-nodejs-scraper/actions/workflows/test.yml/badge.svg)](https://github.com/sebiboga/omniconvert-srl-nodejs-scraper/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ESM-F7DF1E?logo=javascript&logoColor=black)](https://ecma-international.org/)
[![Node.js](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

**job_seeker_ro_spider** — un scraper pentru job-urile Omniconvert SRL din România. Extrage anunțurile de pe [Omniconvert About](https://www.omniconvert.com/about/) (Astro site static) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul SOLR.

## Overview

Proiectul automatizează colectarea zilnică a job-urilor Omniconvert din România, menținând board-ul peviitor.ro la zi cu cele mai recente oportunități de carieră.

## Features

- Extrage job-uri din pagina `/about/` (cheerio HTML parsing)
- Validează compania via ANAF (CUI, status activ/inactiv, adresă completă)
- Cross-validează cu Peviitor API
- Stochează în SOLR (job core + company core)
- GitHub Actions: scrape zilnic + testare automată (unit, integration, e2e)
- 68 teste (55 unit + 12 integration + 11 e2e, 1 skip fără SOLR)
- Teste SOLR condiționale — auto-skip când `SOLR_AUTH` nu e setat
- Se identifică prin User-Agent: `job_seeker_ro_spider`

## Project Structure

```
├── index.js           # Main scraper entry point
├── company.js         # Company validation via ANAF + Peviitor + SOLR
├── demoanaf.js        # CLI wrapper for src/anaf.js
├── src/anaf.js        # ANAF API core module (search + company details)
├── solr.js            # SOLR operations (query, upsert, delete, company)
├── company.json       # Cached company data (fallback when ANAF is down)
├── ROBOTS.md          # robots.txt analysis and scraping policy
├── tests/             # Test suite
│   ├── unit/          # 55 tests (mocked APIs)
│   ├── integration/   # 12 tests (ANAF + SOLR live)
│   └── e2e/           # 11 tests (full pipeline, real Omniconvert about page)
├── .github/workflows/
│   ├── scrape.yml     # Daily scraping at 6 AM UTC
│   └── test.yml       # Automation Tests on push/PR
└── package.json
```

## Setup

### Prerequisites

- Node.js 24+
- npm

### Installation

```bash
npm install
```

### Configuration

Set the `SOLR_AUTH` environment variable with your Solr credentials:

```bash
export SOLR_AUTH="username:password"
```

## Usage

### Run the Scraper

```bash
npm run scrape
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Workflows

### Daily Scraping

The `scrape.yml` workflow runs daily at 6 AM UTC via GitHub Actions. It:
1. Validates company data via ANAF
2. Scrapes current job listings from Omniconvert Careers
3. Updates Solr with new/removed jobs
4. Uploads job data as artifacts

### Test Automation

The `test.yml` workflow runs on every push and pull request. It:
1. Ensures Omniconvert exists in the company core
2. Runs unit, integration, and E2E tests
3. Validates data integrity in Solr

## Acknowledgments

This project was developed with assistance from:
- **[OpenCode](https://opencode.ai)** - AI-powered CLI tool for software engineering
- **Big Pickle LLM** - Large language model powering OpenCode

Special thanks to the open source community and the peviitor.ro team for their support.

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE

Licensed under the [MIT License](LICENSE).

## Managed By

This project is managed by [ASOCIATIA OPORTUNITATI SI CARIERE](https://oportunitatisicariere.ro) and used as a web scraper for the [peviitor.ro](https://peviitor.ro) job board project.

## Disclaimer

This scraper is designed for educational purposes and legitimate job data aggregation for the Romanian job market. Please respect Omniconvert's Terms of Service and robots.txt when using this scraper.
