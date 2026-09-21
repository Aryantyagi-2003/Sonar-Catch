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

// --- LinkedIn: JSON-LD present. Mirrors the real guest-page block fetched live
//     2026-09-16 (linkedin.com/jobs/view/4419969671/, General Motors). ---
export const LINKEDIN_JSONLD = `
<html><head><title>General Motors hiring Senior Software Engineer | LinkedIn</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "Senior Software Engineer – Go (Golang)",
    "datePosted": "2026-09-10",
    "validThrough": "2026-10-10",
    "employmentType": "FULL_TIME",
    "hiringOrganization": { "@type": "Organization", "name": "General Motors" },
    "jobLocation": { "@type": "Place", "address": {
      "@type": "PostalAddress", "addressLocality": "Warren", "addressRegion": "MI", "addressCountry": "US" } },
    "description": "${LONG("We are looking for a Senior Software Engineer to join our Go platform team.")} Base salary: $140,000 - $190,000"
  }
  </script>
</head><body><div id="main-content"></div></body></html>
`;

// --- LinkedIn: no JSON-LD, but the authenticated split-view SPA's DOM selectors (current
//     scraping-guide consensus, NOT independently verified live — see platforms.ts). ---
export const LINKEDIN_DOM_ONLY = `
<html><head><title>LinkedIn</title></head><body>
  <div class="job-details-jobs-unified-top-card__container">
    <h1 class="job-details-jobs-unified-top-card__job-title">Staff Software Engineer</h1>
    <div class="job-details-jobs-unified-top-card__company-name"><a href="/company/acme">Acme Corp</a></div>
    <div class="job-details-jobs-unified-top-card__primary-description-container">Toronto, ON, Canada</div>
  </div>
  <div id="job-details">
    ${LONG("Acme Corp is looking for a Staff Software Engineer to lead our platform team.")}
  </div>
</body></html>
`;

// --- LinkedIn: no JSON-LD, but the GUEST page's DOM selectors (confirmed live
//     2026-09-16 against linkedin.com/jobs/view/<id>/). ---
export const LINKEDIN_GUEST_DOM_ONLY = `
<html><head><title>LinkedIn</title></head><body>
  <div class="top-card-layout">
    <h1 class="top-card-layout__title">Backend Engineer</h1>
    <a class="topcard__org-name-link" href="/company/acme">Acme Corp</a>
    <span class="main-job-card__location">Remote</span>
  </div>
  <div class="description__text--rich">
    ${LONG("Acme Corp is hiring a Backend Engineer for our platform team.")}
  </div>
</body></html>
`;

// --- LinkedIn: neither JSON-LD nor any known selector matched — only the generic tier
//     can catch it (e.g. after one of LinkedIn's periodic redesigns). ---
export const LINKEDIN_BROKEN = `
<html><head><title>Staff Software Engineer | Acme Corp | LinkedIn</title></head><body>
  <nav>Home My Network Jobs Messaging Notifications</nav>
  <main>
    <div class="renamed-job-card-abc">
      <h1>Staff Software Engineer</h1>
      <p>${LONG("Acme Corp is looking for a Staff Software Engineer to lead our platform team.")}</p>
      <p>${LONG("You will partner with product and design to ship reliable, well-tested systems.")}</p>
    </div>
  </main>
  <footer>About Accessibility User Agreement Privacy Policy</footer>
</body></html>
`;

// --- LinkedIn guest page, shaped like the REAL one fetched live 2026-09-20 (job 4464579833):
//     no JSON-LD, the job's own location is the first `.topcard__flavor--bullet`, and a
//     "similar jobs" card further down uses `.main-job-card__location` for a DIFFERENT job
//     — which is first in document order among elements with that class. ---
export const LINKEDIN_GUEST_WITH_SIMILAR_JOBS = `
<html><head><title>Audiobooks.com hiring Data Scientist | LinkedIn</title></head><body>
  <section class="top-card-layout">
    <div class="top-card-layout__entity-info">
      <h1 class="top-card-layout__title topcard__title">Data Scientist / Analytics Engineer</h1>
      <h4 class="top-card-layout__second-subline">
        <div class="topcard__flavor-row">
          <span class="topcard__flavor"><a class="topcard__org-name-link" href="/company/audiobookscom">Audiobooks.com</a></span>
          <span class="topcard__flavor topcard__flavor--bullet">Burlington, Ontario, Canada</span>
        </div>
        <div class="topcard__flavor-row">
          <span class="posted-time-ago__text topcard__flavor--metadata">1 week ago</span>
          <span class="num-applicants__caption topcard__flavor--metadata topcard__flavor--bullet">174 applicants</span>
        </div>
      </h4>
    </div>
  </section>
  <div class="description__text description__text--rich">
    <section class="show-more-less-html"><div class="show-more-less-html__markup">
      ${LONG("Audiobooks.com is seeking a hands-on Data Scientist / Analytics Engineer.")}
    </div></section>
  </div>
  <section class="similar-jobs">
    <div class="base-main-card__metadata">
      <span class="main-job-card__location">Toronto, Ontario, Canada</span>
    </div>
  </section>
</body></html>
`;

// --- Shopify job page, shaped like the REAL rendered DOM (headless Chrome, 2026-09-20):
//     microdata wrapper, TWO <h1>s (title, then an "apply" banner), location <li> with a pin
//     icon beside a department <li>, description microdata holding only the role body, and
//     hidden microdata spans that carry values in `content` attributes, not text. ---
export const SHOPIFY_JOB = `
<html><head><title>Senior Compliance Analyst - Shopify</title></head><body>
<main data-job="6debf006-a6d2-4725-b152-38e932097480">
  <div itemscope itemtype="https://schema.org/JobPosting">
    <a href="/careers">Back</a>
    <section>
      <div class="md:grow">
        <h1><span class="richtext">Senior Compliance Analyst</span></h1>
        <ul>
          <li><img src="pin.svg" alt="" width="18" height="18">Remote - Americas</li>
          <li>Legal</li>
        </ul>
      </div>
      <button>Apply Now</button>
    </section>
    <section>
      <h2>About the role</h2>
      <div itemprop="description">
        <h2><strong>Team Overview</strong></h2>
        <p>${LONG("Within the Shopify Legal Team, the Compliance Team ensures regulatory commitments are met.")}</p>
        <h2><strong>What You’ll Do</strong></h2>
        <ul><li><p>Own day-to-day compliance responsibilities.</p></li></ul>
      </div>
    </section>
    <section><h2>About Shopify</h2><div class="richtext"><p>Opportunity is not evenly distributed.</p></div></section>
    <div class="hidden" itemscope itemprop="hiringOrganization" itemtype="https://schema.org/Organization">
      <span itemprop="name">Shopify</span>
    </div>
    <div class="hidden"><span itemprop="title" content="Senior Compliance Analyst"></span></div>
    <section>
      <h1>We hire people, not resumes. If you think you’re right for the role, apply now.</h1>
      <ul></ul>
    </section>
  </div>
  <footer role="contentinfo"><h2>Work with us in your early career</h2></footer>
</main>
</body></html>
`;

// --- Shopify listing page: lots of job links, no single posting. ---
export const SHOPIFY_LISTING = `
<html><head><title>Careers - Shopify</title></head><body><main>
  <h1>Join the fully-remote rocketship</h1>
  <ul><li><a href="/careers/senior-compliance-analyst_8639c248-b9f3-45ca-9ea8-5b66a4c7d208">Senior Compliance Analyst</a></li></ul>
</main></body></html>
`;

// --- Nothing job-shaped at all. ---
export const NOT_A_JOB_PAGE = `
<html><head><title>RBC</title></head><body>
  <main><h1>Welcome</h1><p>Search below for opportunities.</p></main>
</body></html>
`;
