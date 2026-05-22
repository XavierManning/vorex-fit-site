/* ============================================================
   Netlify Function — create-checkout-session
   Endpoint:  POST /.netlify/functions/create-checkout-session
   Body:      { "priceId": "price_..." }
   Returns:   { "url": "https://checkout.stripe.com/..." }
              or { "error": "..." } on failure

   Required env vars (Netlify dashboard → Site → Environment):
     STRIPE_SECRET_KEY   — sk_test_... or sk_live_...

   Flow:
     1. Client (js/checkout.js) POSTs the active price ID
     2. We create a Stripe Checkout Session (subscription mode,
        30-day free trial, promo codes allowed)
     3. Return the hosted checkout URL — client redirects to it
     4. Stripe handles the rest and fires the webhook configured
        in the Supabase project (stripe-webhook Edge Function),
        which generates the COACH-XXXX-XXXX code and emails it.
   ============================================================ */

const Stripe = require("stripe");

exports.handler = async (event) => {
    // Health-check / CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: ""
        };
    }

    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed. Use POST." });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        return json(500, { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in Netlify environment." });
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return json(400, { error: "Invalid JSON body." });
    }

    const priceId = (body.priceId || "").trim();
    if (!priceId || !priceId.startsWith("price_")) {
        return json(400, { error: "Missing or malformed priceId." });
    }
    if (priceId.includes("REPLACE_ME")) {
        return json(400, { error: "Price ID is still a placeholder. Update index.html with real Stripe price IDs." });
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });

    // origin: prefer Netlify's URL env, fall back to the request host.
    // Both vorex.fit and the netlify.app preview URL work.
    const origin = process.env.URL
        || (event.headers && (event.headers.origin || `https://${event.headers.host}`))
        || "https://vorex.fit";

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            subscription_data: {
                trial_period_days: 30,
                metadata: { source: "vorex.fit" }
            },
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${origin}/cancel.html`,
            // Collect email — required for the Resend follow-up email
            // that delivers the COACH-XXXX-XXXX code.
            customer_creation: "always",
            billing_address_collection: "auto"
        });
        return json(200, { url: session.url });
    } catch (err) {
        console.error("[create-checkout-session] Stripe error:", err.message);
        return json(500, { error: err.message || "Stripe session creation failed." });
    }
};

function json(statusCode, payload) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify(payload)
    };
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}
