#!/usr/bin/env node
/**
 * Build the homepage, hub pages, and info/legal pages via pageShell.
 * Re-run whenever nav/branding changes: node scripts/build-hubs.mjs
 */
import { SITE, NAME, RCL_BOOK, RCL_TEL, RCL_TEL_LABEL, pageShell, write, listPostFiles, parsePost } from "./lib.mjs";

const posts = (() => {
  try {
    return listPostFiles()
      .map(parsePost)
      .filter((p) => (p.meta.status || "published") !== "draft")
      .sort((a, b) => String(b.meta.date).localeCompare(String(a.meta.date)))
      .slice(0, 6);
  } catch {
    return [];
  }
})();

const recentCards = posts
  .map(
    (p) => `
    <a class="card" href="/blog/${p.meta.slug}/">
      <h3>${p.meta.title}</h3>
      <p>${p.meta.description || ""}</p>
      <div class="meta">${p.meta.date} →</div>
    </a>`
  )
  .join("");

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: NAME,
  url: SITE,
  description:
    "Independent guide to ground-transportation costs, planning, and venues across Chicago and its suburbs.",
};

write(
  "index.html",
  pageShell({
    title: `${NAME} — Real Limo, Party Bus & Car Service Costs in Chicago`,
    description:
      "What rides actually cost in Chicagoland: party bus, limo, sprinter, and airport car service price ranges, event logistics, and booking guides. Independent and data-first.",
    path: "/",
    schema: orgSchema,
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Chicago + suburbs · independent guide</p>
    <h1>What rides really cost in Chicagoland</h1>
    <p>Party bus, limo, sprinter, and airport car service — realistic price ranges, event timelines, and booking know-how for Chicago and the suburbs. No fluff, just numbers and logistics.</p>
    <div class="cta-band">
      <a class="btn" href="/costs/">See cost data</a>
      <a class="btn btn-outline" href="/guides/">Planning guides</a>
    </div>
  </div></header>
  <section class="section"><div class="wrap grid-3">
    <a class="card" href="/costs/"><h3>Cost data</h3><p>Typical Chicagoland price ranges by vehicle, hours, and season — what changes the number and what doesn't.</p><div class="meta">Hub →</div></a>
    <a class="card" href="/guides/"><h3>Planning guides</h3><p>Timelines, group logistics, deposits, gratuity, and how to book without surprises.</p><div class="meta">Hub →</div></a>
    <a class="card" href="/events/"><h3>Events</h3><p>Prom, weddings, Lollapalooza, Bears games, holiday parties — getting groups there on time.</p><div class="meta">Hub →</div></a>
  </div></section>
  ${posts.length ? `<section class="section"><div class="wrap"><h2 class="section-title">Latest</h2><div class="grid-3">${recentCards}</div></div></section>` : ""}
`,
  })
);

const hubs = [
  {
    path: "/costs/",
    title: `Chicagoland Ride Cost Data | ${NAME}`,
    h1: "Cost data",
    description:
      "Real-world price ranges for party buses, limos, sprinters, and car service in Chicago and the suburbs — by hours, vehicle, and season.",
    intro:
      "Typical ranges for the Chicagoland market, updated as new posts publish. Prices are ranges, not quotes — season, day of week, and vehicle age move the number.",
    tag: "costs",
  },
  {
    path: "/guides/",
    title: `Ground Transportation Planning Guides | ${NAME}`,
    h1: "Planning guides",
    description:
      "How to plan and book group transportation in Chicagoland: timelines, deposits, gratuity, vehicle choice, and the mistakes that cost money.",
    intro:
      "Working procedures for real trips — the stuff operators wish every group knew before booking.",
    tag: "guides",
  },
  {
    path: "/events/",
    title: `Chicago Event Transportation | ${NAME}`,
    h1: "Event transportation",
    description:
      "Getting groups to Chicago events: prom season, weddings, Lollapalooza, Soldier Field, holiday parties — timing, pickup zones, and costs.",
    intro:
      "Chicago's calendar drives demand and pricing. These guides cover the big dates and how to plan around them.",
    tag: "events",
  },
  {
    path: "/venues/",
    title: `Chicago Venue Transport Guides | ${NAME}`,
    h1: "Venue guides",
    description:
      "Wedding venues, event spaces, and nightlife districts across Chicagoland — load-in rules, parking reality, and shuttle logistics per venue.",
    intro:
      "Venue-by-venue transport logistics: where vehicles can stage, what venues require, and how guests actually get there.",
    tag: "venues",
  },
];

for (const h of hubs) {
  write(
    h.path.slice(1) + "index.html",
    pageShell({
      title: h.title,
      description: h.description,
      path: h.path,
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: h.h1,
        url: `${SITE}${h.path}`,
        description: h.description,
      },
      body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Hub</p>
    <h1>${h.h1}</h1>
    <p>${h.intro}</p>
  </div></header>
  <section class="section"><div class="wrap">
    <p class="muted">Posts land here automatically as the pipeline publishes. Browse <a href="/blog/">all posts</a> meanwhile.</p>
  </div></section>
`,
    })
  );
}

write(
  "about/index.html",
  pageShell({
    title: `About | ${NAME}`,
    description:
      "Chicagoland Ride Guide publishes independent cost data and planning guides for ground transportation in Chicago, informed by real market knowledge.",
    path: "/about/",
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">About</p>
    <h1>Independent, data-first, Chicago-local</h1>
    <p>${NAME} exists because "how much does a party bus cost" deserves a real answer, not a quote form. We publish realistic price ranges and working logistics for Chicagoland trips — informed by real market knowledge of how this industry operates.</p>
    <p>The site runs on an autonomous publishing pipeline; every page carries the same standard: concrete numbers, named places, no invented statistics. When you're ready to book, we refer you to licensed local operators and disclose that relationship on every page — see <a href="/legal/affiliate-disclosure/">how we make money</a>.</p>
  </div></header>
`,
  })
);

write(
  "contact/index.html",
  pageShell({
    title: `Contact | ${NAME}`,
    description: `Questions, corrections, or venue info for ${NAME}? Reach the team here.`,
    path: "/contact/",
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Contact</p>
    <h1>Get in touch</h1>
    <p>Corrections and venue updates are welcome — accuracy is the product.</p>
    <ul>
      <li>Email: <a href="mailto:royalcarriagelimollc@gmail.com">royalcarriagelimollc@gmail.com</a></li>
      <li>Booking a trip? Call a licensed operator directly: <a href="${RCL_TEL}" rel="sponsored">${RCL_TEL_LABEL}</a> or <a href="${RCL_BOOK}" rel="sponsored noopener">book online</a> (referral — <a href="/legal/affiliate-disclosure/">disclosure</a>).</li>
    </ul>
  </div></header>
`,
  })
);

write(
  "legal/index.html",
  pageShell({
    title: `Legal | ${NAME}`,
    description: `Legal pages for ${NAME}: privacy policy and monetization disclosure.`,
    path: "/legal/",
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Legal</p>
    <h1>Legal</h1>
    <ul>
      <li><a href="/legal/privacy/">Privacy policy</a></li>
      <li><a href="/legal/affiliate-disclosure/">How we make money</a></li>
    </ul>
  </div></header>
`,
  })
);

write(
  "legal/privacy/index.html",
  pageShell({
    title: `Privacy Policy | ${NAME}`,
    description: `${NAME} privacy policy: what we collect (very little), cookies, advertising partners, and your choices.`,
    path: "/legal/privacy/",
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Legal</p>
    <h1>Privacy policy</h1>
    <p>Effective ${new Date().toISOString().slice(0, 10)}.</p>
    <h2>What we collect</h2>
    <p>This site has no accounts and no forms. We do not collect names, emails, or payment details.</p>
    <h2>Advertising and cookies</h2>
    <p>We use Google AdSense to show ads. Google and its partners may use cookies (including the DoubleClick cookie) to serve ads based on prior visits to this or other websites. You can opt out of personalized advertising at <a href="https://adssettings.google.com" rel="noopener">Google Ads Settings</a>. Third-party vendors' use of cookies is governed by their own policies.</p>
    <h2>Referral links</h2>
    <p>Booking links on this site refer you to independent licensed operators. What happens on their sites is governed by their privacy policies. See <a href="/legal/affiliate-disclosure/">how we make money</a>.</p>
    <h2>Analytics</h2>
    <p>We may use privacy-respecting, aggregate analytics to understand which guides help readers. No individual profiles are built.</p>
    <h2>Contact</h2>
    <p>Privacy questions: <a href="mailto:royalcarriagelimollc@gmail.com">royalcarriagelimollc@gmail.com</a>.</p>
  </div></header>
`,
  })
);

write(
  "legal/affiliate-disclosure/index.html",
  pageShell({
    title: `How We Make Money | ${NAME}`,
    description: `${NAME} monetization disclosure: advertising and disclosed booking referrals to licensed Chicagoland operators, including Royal Carriage Limousine.`,
    path: "/legal/affiliate-disclosure/",
    body: `
  <header class="page-hero"><div class="wrap prose">
    <p class="kicker">Legal</p>
    <h1>How we make money</h1>
    <p>Two ways, both disclosed:</p>
    <h2>1. Advertising</h2>
    <p>Display ads served by Google AdSense. Advertisers don't see our drafts and don't influence our numbers.</p>
    <h2>2. Booking referrals</h2>
    <p>When a guide links to "book online" or a phone number, that's a referral to a licensed Chicagoland operator — currently <strong>Royal Carriage Limousine</strong>, which shares common ownership with this site. We say so here and mark those links <code>rel="sponsored"</code> because you deserve to know. Our cost ranges are published independently of any operator's rate card, and you should always compare quotes.</p>
    <h2>What we don't do</h2>
    <p>No pay-to-play rankings, no invented reviews, no undisclosed placements.</p>
  </div></header>
`,
  })
);

console.log("built homepage, 4 hubs, about, contact, legal pages");
