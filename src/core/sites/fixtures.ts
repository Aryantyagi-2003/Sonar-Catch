// Hand-built fixtures for the non-Indeed site adapters. Their SHAPES are taken from real
// pages fetched 2026-08-28 (raw HTML, no JS executed):
//   - Workday JSON-LD: bestbuycanada.wd3.myworkdayjobs.com + cibc.wd3.myworkdayjobs.com
//     both emit a standard root "@type":"JobPosting" block with a plain-text
//     "description", hiringOrganization.name, and jobLocation.address.addressLocality.
//     WORKDAY_JSONLD below deliberately OMITS @type — it's the synthetic case that
//     exercises looksLikeJobPosting's no-@type acceptance path, not a copy of the real
//     block (which has @type; see WORKDAY_JSONLD_TYPED).
//   - Phenom JSON-LD: jobs.rbc.com emits "@type":"JobPosting" with a DOUBLE-escaped-HTML
//     "description" (literal "&lt;p&gt;...") behind ~30 nested empty <div>s, plus a
//     second, unrelated "@type":"WebPage" ld+json block on the same page.
// They are not literal DOM dumps — real pages carry far more markup — so treat them as
// "the shape we confirmed for the fields we extract" and expect to update them when a
// platform changes something.

const LONG = (marker: string): string =>
  `${marker} This role owns a substantial surface area of the team's work and you will ` +
  "collaborate across engineering, product, and operations to deliver measurable outcomes. " +
  "Responsibilities include designing and building resilient systems, mentoring teammates, " +
  "running incident reviews, and steadily improving how the team ships software. You will " +
  "partner with stakeholders to turn ambiguous problems into concrete plans, then execute " +
  "them with a small group of engineers. Requirements: several years of relevant hands-on " +
  "experience, strong written and verbal communication, comfort with on-call rotations, and " +
  "a demonstrated bias to action. Nice to have: prior experience in a regulated industry, " +
  "familiarity with cloud infrastructure, and a track record of mentoring. We offer a " +
  "collaborative culture, flexible working arrangements, and meaningful growth opportunities " +
  "for people who want to broaden their scope over time and take on more responsibility.";

// --- Workday: JSON-LD present (Tier 1). Mirrors Best Buy CA's real block. ---
export const WORKDAY_JSONLD = `
<html><head>
  <title></title>
  <script type="application/ld+json">
  {
    "jobLocation": { "@type": "Place", "address": {
      "@type": "PostalAddress", "addressCountry": "Canada", "addressLocality": "11936 London" } },
    "hiringOrganization": { "name": "050 Best Buy Canada Ltd.", "@type": "Organization", "sameAs": "" },
    "identifier": { "name": "Merchandiser (Part Time)", "@type": "PropertyValue", "value": "R-52702" },
    "datePosted": "2026-08-28",
    "employmentType": "PART_TIME",
    "title": "Merchandiser (Part Time)",
    "description": "${LONG("You’ll love it here — we are hiring a merchandiser.")} Hourly pay rate: $17.60 - $20.21"
  }
  </script>
</head><body><div id="root"></div></body></html>
`;

// --- Workday: no JSON-LD, but the rendered data-automation-id nodes exist (Tier 2). ---
export const WORKDAY_DOM_ONLY = `
<html><head><title>Careers</title></head><body>
  <div data-automation-id="jobPostingPage">
    <h2 data-automation-id="jobPostingHeader">Sr. Consultant, Application Development</h2>
    <div data-automation-id="locations">Toronto, ON</div>
    <div data-automation-id="jobPostingDescription">
      ${LONG("We’re building a relationship-oriented bank for the modern world.")}
    </div>
  </div>
</body></html>
`;

// --- Workday: JSON-LD gone AND selectors renamed. Only the generic tier can catch it. ---
export const WORKDAY_BROKEN = `
<html><head><title>Sr. Consultant, Application Development | CIBC</title></head><body>
  <nav>Home Search Sign In</nav>
  <main>
    <div class="wd-renamed-xyz">
      <h1>Sr. Consultant, Application Development</h1>
      <p>${LONG("You’ll contribute to CIBC’s digital transformation.")}</p>
      <p>${LONG("Within the Enterprise Payments Technology group you’ll build personalized solutions.")}</p>
      <p>Compensation: $95,000 - $120,000 a year plus bonus.</p>
    </div>
  </main>
  <footer>Cookie preferences and legal links go here.</footer>
</body></html>
`;

// --- Workday: the REAL block shape — standard schema.org JobPosting with @context/@type
//     serialized LAST (as Workday actually does it, verified live 2026-08-28). ---
export const WORKDAY_JSONLD_TYPED = `
<html><head><title></title>
  <script type="application/ld+json">
  {
    "jobLocation": { "@type": "Place", "address": {
      "@type": "PostalAddress", "addressCountry": "Canada", "addressLocality": "Toronto-81 Bay", "addressRegion": "Ontario" } },
    "hiringOrganization": { "name": "Canadian Imperial Bank of Commerce (Canada)", "@type": "Organization" },
    "identifier": { "name": "Director, Network Engineering", "@type": "PropertyValue", "value": "2616394" },
    "datePosted": "2026-08-28",
    "validThrough": "2026-09-04",
    "employmentType": "FULL_TIME",
    "title": "Director, Network Engineering",
    "description": "${LONG("We’re building a relationship-oriented bank for the modern world.")} Salary range: $165,000 - $240,000",
    "@context": "https://schema.org/",
    "@type": "JobPosting"
  }
  </script>
</head><body><div id="root"></div></body></html>
`;

// --- Phenom: JSON-LD present, description is DOUBLE-escaped HTML, AND a second unrelated
//     WebPage ld+json block on the same page (RBC's real shape). ---
export const PHENOM_JSONLD = `
<html><head>
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "WebPage", "inLanguage": "en_ca",
    "name": "job", "url": "https://jobs.rbc.com/ca/en/job/SEQ/x" }
  </script>
  <script type="application/ld+json">
  {
    "identifier": { "@type": "PropertyValue", "name": "Royal Bank of Canada", "value": "R-0000167419" },
    "hiringOrganization": { "@type": "Organization", "name": "Royal Bank of Canada" },
    "jobLocation": { "@type": "Place", "address": {
      "@type": "PostalAddress", "addressCountry": "Canada", "addressLocality": "TORONTO", "addressRegion": "Ontario" } },
    "employmentType": ["FULL_TIME"],
    "@type": "JobPosting",
    "title": "Senior ServiceNow Discovery & Service Mapping Engineer",
    "description": "&lt;div&gt;&lt;div&gt;&lt;p&gt;&lt;b&gt;WHAT IS THE OPPORTUNITY?&lt;/b&gt;&lt;/p&gt;&lt;p&gt;${LONG("As a Senior ServiceNow Discovery &amp; Service Mapping Engineer, you\\u2019ll design and optimize solutions.")}&lt;/p&gt;&lt;/div&gt;&lt;/div&gt;"
  }
  </script>
</head><body><div id="phApp"></div></body></html>
`;

// --- Phenom: no JSON-LD, but data-ph-at-id nodes exist (Tier 2). ---
export const PHENOM_DOM_ONLY = `
<html><head><title>Careers</title></head><body>
  <div class="ph-page">
    <h1 data-ph-at-id="job-title">Associate</h1>
    <div data-ph-at-id="job-location">VANCOUVER, British Columbia, Canada</div>
    <div data-ph-at-id="job-description">
      ${LONG("Join our client advice team as an Associate.")}
    </div>
  </div>
</body></html>
`;

// --- Nothing job-shaped at all. ---
export const NOT_A_JOB_PAGE = `
<html><head><title>RBC</title></head><body>
  <main><h1>Welcome</h1><p>Search below for opportunities.</p></main>
</body></html>
`;
