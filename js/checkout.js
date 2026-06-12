/* ============================================================
   Vorex — checkout.js
   Vanilla JS — runs on index.html only (other pages defer-load it
   but every selector .querySelectorAll's gracefully on absent DOM).

   Responsibilities:
     1. Pricing toggle (Monthly ↔ Annual) — swaps prices + active
        price-id attribute on every CTA.
     2. Pricing CTA click — POSTs to the Netlify Function with
        the active price ID, then redirects to Stripe Checkout.
     3. Reveal-on-scroll for `.reveal` elements (IntersectionObserver).
     4. Mobile nav toggle (#nav-toggle / #nav-menu).
     5. Demo modal placeholder (until video lands).
   ============================================================ */

(function () {
    "use strict";

    /* -----------------------------------------
       1. Pricing toggle
       ----------------------------------------- */
    const toggleButtons = document.querySelectorAll(".pricing-toggle__btn");
    const indicator     = document.querySelector(".pricing-toggle__indicator");
    const amounts       = document.querySelectorAll(".price-card__amount");
    const notes         = document.querySelectorAll(".price-card__note");
    const ctas          = document.querySelectorAll("[data-checkout-cta]");

    let currentPeriod = "monthly";

    function positionIndicator(activeBtn) {
        if (!indicator || !activeBtn) return;
        indicator.style.width     = activeBtn.offsetWidth + "px";
        indicator.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
    }

    function setPeriod(period) {
        currentPeriod = period;

        toggleButtons.forEach((btn) => {
            const active = btn.dataset.period === period;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
            if (active) positionIndicator(btn);
        });

        amounts.forEach((el) => {
            const v = el.dataset[`amount${period === "annual" ? "Annual" : "Monthly"}`];
            if (v) el.textContent = "$" + v;
        });

        notes.forEach((el) => {
            const v = el.dataset[`note${period === "annual" ? "Annual" : "Monthly"}`];
            el.textContent = v || "";
        });
    }

    toggleButtons.forEach((btn) => {
        btn.addEventListener("click", () => setPeriod(btn.dataset.period));
    });

    // Initial indicator position (next tick — let layout settle)
    requestAnimationFrame(() => {
        const active = document.querySelector(".pricing-toggle__btn.is-active");
        if (active) positionIndicator(active);
    });
    window.addEventListener("resize", () => {
        const active = document.querySelector(".pricing-toggle__btn.is-active");
        if (active) positionIndicator(active);
    });

    /* -----------------------------------------
       2. Pricing CTA → Stripe Checkout
       ----------------------------------------- */
    ctas.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const priceId = currentPeriod === "annual"
                ? btn.dataset.priceIdAnnual
                : btn.dataset.priceIdMonthly;

            if (!priceId || priceId.includes("REPLACE_ME")) {
                alert("This plan isn't connected to Stripe yet. Replace the price ID in index.html (search for REPLACE_ME).");
                return;
            }

            const original = btn.textContent;
            btn.textContent = "REDIRECTING…";
            btn.disabled = true;

            try {
                const res = await fetch("/.netlify/functions/create-checkout-session", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ priceId })
                });
                const data = await res.json();
                if (!res.ok || !data.url) {
                    throw new Error(data.error || `HTTP ${res.status}`);
                }
                window.location.href = data.url;
            } catch (err) {
                console.error("[checkout]", err);
                alert("Couldn't start checkout. " + (err.message || "Try again."));
                btn.textContent = original;
                btn.disabled = false;
            }
        });
    });

    /* -----------------------------------------
       3. Reveal-on-scroll (with CSS-var stagger)
       ----------------------------------------- */
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

        document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    } else {
        // Reduced-motion users + IE/older browsers — surface content immediately
        document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    }

    /* -----------------------------------------
       4. Mobile nav toggle
       ----------------------------------------- */
    const navToggle = document.getElementById("nav-toggle");
    const navMenu   = document.getElementById("nav-menu");
    function closeNav() {
        if (!navToggle || !navMenu) return;
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
        navMenu.dataset.open = "false";
        document.body.style.overflow = "";
    }
    function openNav() {
        if (!navToggle || !navMenu) return;
        navToggle.setAttribute("aria-expanded", "true");
        navToggle.setAttribute("aria-label", "Close menu");
        navMenu.dataset.open = "true";
        document.body.style.overflow = "hidden";
    }
    if (navToggle && navMenu) {
        navToggle.addEventListener("click", () => {
            const expanded = navToggle.getAttribute("aria-expanded") === "true";
            expanded ? closeNav() : openNav();
        });
        // Any link tap closes the overlay so the anchor scroll lands cleanly
        navMenu.querySelectorAll("a").forEach((a) =>
            a.addEventListener("click", () => closeNav())
        );
        // Escape closes
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeNav();
        });
        // Resize back to desktop also closes (in case the user rotated)
        window.addEventListener("resize", () => {
            if (window.innerWidth > 820) closeNav();
        });
    }

    /* -----------------------------------------
       5. Demo modal placeholder
       ----------------------------------------- */
    document.querySelectorAll("[data-demo-modal]").forEach((el) => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            alert("Demo video coming soon. In the meantime, the App Store listing has screenshots.");
        });
    });
})();
