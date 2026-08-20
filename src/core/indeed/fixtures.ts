// Hand-built fixtures modeling Indeed's split-view search page structure, per the
// selector chains in selectors.ts. The Tier 1 fixture's structure (container class,
// title/company/location/description selectors) matches what was confirmed 2026-08-20
// against a real, live Indeed page via a real browser — see selectors.ts's header comment
// for exactly what was and wasn't confirmed. Still hand-built, not a literal DOM dump
// (Indeed's markup carries far more than what's modeled here), so treat this as "the
// shape we've confirmed holds for the fields we extract," not a full page capture — and
// expect it to need updating again whenever Indeed next changes something.

export const INDEED_SPLIT_VIEW_TIER1 = `
<html>
  <body>
    <div id="mosaic-provider-jobcards">
      <ul>
        <li data-testid="slider_item">
          <h2 class="jobTitle"><a>Staff Software Engineer</a></h2>
          <span data-testid="company-name">Other Company Inc</span>
          <div data-testid="text-location">Austin, TX</div>
          <div class="job-snippet">This other posting wants Python and Django experience...</div>
        </li>
        <li data-testid="slider_item">
          <h2 class="jobTitle"><a>Backend Developer</a></h2>
          <span data-testid="company-name">Third Company LLC</span>
          <div data-testid="text-location">Denver, CO</div>
        </li>
      </ul>
    </div>
    <div class="jobsearch-RightPane">
      <div class="jobsearch-JobInfoHeader-title-container">
        <h1 class="jobsearch-JobInfoHeader-title">Senior Backend Engineer</h1>
      </div>
      <div data-testid="inlineHeader-companyName">Nimbus Data</div>
      <div data-testid="inlineHeader-companyLocation">Remote</div>
      <div data-testid="jobsearch-JobMetadataHeader-item">$150,000 - $190,000 a year</div>
      <div class="jobsearch-JobComponent-embeddedBody">
        We are looking for a Senior Backend Engineer with 5+ years experience in
        TypeScript, Node.js, and PostgreSQL to join our infrastructure team. You will
        design scalable APIs and mentor junior engineers. Required: TypeScript, Node.js,
        PostgreSQL, AWS, distributed systems experience. This is a fully remote role with
        a collaborative, senior-heavy team culture and strong growth opportunities.
      </div>
    </div>
  </body>
</html>
`;

// No data-testid/class hits at all in the detail region — only the structural
// tier (largest non-list text block) can find this one.
export const INDEED_SPLIT_VIEW_STRUCTURAL_FALLBACK = `
<html>
  <body>
    <div id="mosaic-provider-jobcards">
      <ul>
        <li data-testid="slider_item">
          <h2 class="jobTitle"><a>Frontend Developer</a></h2>
          <span data-testid="company-name">Different Co</span>
          <div class="job-snippet">Looking for a Vue.js developer with 3 years experience.</div>
        </li>
      </ul>
    </div>
    <div class="some-renamed-wrapper-abc123">
      <h1>Platform Engineer</h1>
      <p>Acme Rebuilt Corp</p>
      <p>
        Acme Rebuilt Corp is hiring a Platform Engineer to own our Kubernetes
        infrastructure, CI/CD pipelines, and internal developer tooling. You'll work
        closely with the SRE team to improve reliability and reduce deploy friction.
        Experience with Terraform, Kubernetes, and Go strongly preferred. This role is
        based in our Chicago office with hybrid flexibility three days a week.
      </p>
    </div>
  </body>
</html>
`;

export const INDEED_SPLIT_VIEW_LOADING = `
<html>
  <body>
    <div id="mosaic-provider-jobcards"></div>
    <div class="jobsearch-RightPane">
      <div class="jobsearch-ViewJobSkeleton" data-testid="viewJob-skeleton"></div>
    </div>
  </body>
</html>
`;

export const INDEED_SPLIT_VIEW_NO_JOB_SELECTED = `
<html>
  <body>
    <div id="mosaic-provider-jobcards">
      <ul>
        <li data-testid="slider_item">
          <h2 class="jobTitle"><a>Some Job</a></h2>
        </li>
      </ul>
    </div>
  </body>
</html>
`;
