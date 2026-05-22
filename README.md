# vorex.fit

The Vorex coach acquisition site. Vanilla HTML/CSS/JS + a single Netlify
Function that creates Stripe Checkout sessions for coach subscriptions.

This is the "Coach pays on the website" half of the onboarding funnel:

```
vorex.fit (this repo) → Stripe Checkout → Stripe webhook
  → Supabase Edge Function generates COACH-XXXX-XXXX
  → Resend emails the code
  → Coach enters code in iOS app → onboards their team
```

## File map

```
vorex-fit-site/
├── index.html                              landing + pricing
├── success.html                            post-payment confirmation
├── cancel.html                             canceled checkout fallback
├── terms.html  /  privacy.html             legal stubs
├── css/styles.css                          design system
├── js/checkout.js                          pricing toggle + Stripe redirect
├── assets/                                 logo.png, og-image.png
├── netlify/functions/
│   └── create-checkout-session.js          serverless Stripe Checkout creator
├── netlify.toml                            build + redirects + headers
├── package.json                            stripe dep
└── README.md                               you are here
```

## Local development

```sh
# Install deps (one-time)
npm install

# Run the full Netlify dev environment (serves site + functions on :8888)
npm run dev

# OR — just serve static pages (no Stripe function, faster iteration)
npm run serve   # → http://localhost:8080
```

`netlify dev` requires the Netlify CLI: `npm install -g netlify-cli`.

## Deploy to vorex.fit (one-time setup)

### 1. Push to GitHub

```sh
cd ~/vorex-fit-site
git init
git add .
git commit -m "Initial commit — vorex.fit"
git branch -M main
git remote add origin https://github.com/XavierManning/vorex-fit-site.git
git push -u origin main
```

### 2. Connect Netlify

1. Log in to [Netlify](https://app.netlify.com) and click "Add new site" → "Import from Git"
2. Pick the `vorex-fit-site` repo
3. Build command: `npm install` (already set in netlify.toml)
4. Publish directory: `.` (already set in netlify.toml)
5. Click Deploy — Netlify builds + provisions a `*.netlify.app` URL

### 3. Set environment variables

Netlify dashboard → Site → **Site configuration** → **Environment variables** → Add:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` for testing, `sk_live_...` when ready to launch |

(No other env vars are needed — the iOS app and Supabase Edge Function have their own.)

### 4. Connect the custom domain

Netlify dashboard → Site → **Domain management** → Add custom domain → `vorex.fit`. Follow Netlify's DNS instructions (point your A/AAAA + CNAME at Netlify's nameservers OR add their records to your existing DNS provider). HTTPS provisions automatically via Let's Encrypt within a few minutes.

### 5. Paste real Stripe price IDs

Open `index.html` and search for `REPLACE_ME` — you'll find six placeholders (3 plans × 2 billing periods):

```html
data-price-id-monthly="price_starter_monthly_REPLACE_ME"
data-price-id-annual="price_starter_annual_REPLACE_ME"
...
```

In Stripe Dashboard → Products → click each tier → copy the Price ID for the monthly + annual recurring prices and paste them in.

Commit + push — Netlify auto-deploys.

### 6. Verify the Stripe webhook is configured (this lives in Supabase, not here)

The webhook that fires after a successful Checkout is the existing Supabase Edge Function `stripe-webhook` from Phase 1. It generates the COACH code + emails it via Resend. Make sure the webhook endpoint is set in Stripe Dashboard → Webhooks → pointing at:

```
https://mpcaoiuujvegxyfdaxxz.supabase.co/functions/v1/stripe-webhook
```

with events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

(Already done in Phase 1 — verify it's still listed.)

## End-to-end test (after deploy)

1. Visit `https://vorex.fit`
2. Tap **START FREE TRIAL** on any pricing card
3. You'll be redirected to `checkout.stripe.com`
4. Pay with Stripe's test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Land on `/success.html`
6. Within ~30 seconds, receive an email from `Vorex <noreply@vorex.fit>` with your `COACH-XXXX-XXXX` code
7. Open Vorex on your phone → tap any "Create Team" entry → enter the code → complete onboarding

## TODOs

- Replace placeholder testimonial copy with real coach quotes
- Replace placeholder "trusted by" logos with real institutional marks
- Drop `assets/logo.png` (gold V mark) and `assets/og-image.png` (1200×630 social card)
- Wire `data-demo-modal` to a real video player when demo video is recorded
- Consider Plausible or Fathom for privacy-respecting analytics later (no tracking pixels in v1)
