# Owner gates — Chicagoland Ride Guide (~20 min total, one time)

Everything else is autonomous. In cash-impact order:

## 1. Buy the domain (~2 min, $11.25/yr)
`chicagolandrideguide.com` — https://vercel.com/domains/search?q=chicagolandrideguide.com
(Or approve an aged same-topic domain if the domain-hunt research surfaced a good one — ask Claude for the shortlist.)

## 2. Connect hosting (~3 min)
In Vercel (team royalcarriagelimollc-6255): Add New Project → Import `royalcarriage/chicagolandrideguide` → framework "Other", build command `echo none`, output directory `.` (static; api/ not used) → attach the domain.
Until then the GH Pages mirror serves previews (paths look broken there — expected; canonicals already point at the real domain).

## 3. Google Search Console (~3 min)
Add property `https://chicagolandrideguide.com/` under royalcarriagelimollc@gmail.com → verify via DNS TXT (Vercel domain → easy) → submit `sitemap.xml`.
Bing needs nothing — IndexNow is automated.

## 4. AdSense (~2 min once ≥20 posts are live)
AdSense (account with `ca-pub-1959018852581373`) → Sites → Add site → chicagolandrideguide.com.
ads.txt and the loader snippet are already deployed. Wait for review; nothing else needed.

## 5. GEMINI_API_KEY repo secret (only if Claude couldn't set it)
Repo → Settings → Secrets → Actions → `GEMINI_API_KEY` = same key AuthorityForge uses.
Without it the pipeline still runs in template mode (worse content).

That's it. No selling, no onboarding, no writing.
