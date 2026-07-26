# Chicagoland Ride Guide

**Canonical host:** https://chicagolandrideguide.com (domain purchase pending — owner gate)
**What it is:** independent, autonomous info site on ground-transportation costs and planning in Chicagoland. Monetization: AdSense (post-domain) + disclosed booking referrals to Royal Carriage Limousine.
**Owner steps (the only manual work):** [docs/OWNER-GATES.md](docs/OWNER-GATES.md)

## How it runs itself
- **Daily autonomous cycle** (16:00 UTC): health check → Gemini plans new long-tail topics → keeps queue ≥6 → publishes 1 post/day until 40 posts exist → rebuilds → IndexNow ping.
- **Content pipeline** (Tue + Fri 17:00 UTC): publishes next queued post, rebuilds blog/hubs/sitemap/canonicals, pings IndexNow.
- Zero-cost LLM policy: free Gemini only (`GEMINI_API_KEY` secret); template fallback. Never paid APIs.
- Everything commits to `main`; hosting redeploys automatically (Vercel once connected; GH Pages mirror meanwhile).

## Editorial guardrails (enforced in prompts)
- Informational intent only — never "[suburb] limo service" commercial pages (those belong to the operator's own sites; this site must not cannibalize them).
- Realistic price RANGES, never fake precision or invented surveys.
- Concrete Chicago specifics in every section; slop vocabulary banned.
- Referrals disclosed sitewide + `/legal/affiliate-disclosure/` (common ownership stated).

## Build locally
```bash
node scripts/publish-next.mjs     # publish next queued topic
node scripts/build-blog.mjs && node scripts/build-hubs.mjs && node scripts/build-sitemap.mjs && node scripts/fix-canonicals.mjs
npx serve .                       # preview
```
