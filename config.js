/* =========================================================
   Plyndi — affiliate link configuration
   ---------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT WHEN AN AFFILIATE LINK CHANGES.
   Every "Find stays" / "Compare flights" / "Tours" button on the
   whole site reads its URL from here.

   HOW TO TURN A PARTNER ON
   1. Paste your real tracking URL into `url` below.
   2. Use {dest} where the destination name should go
      (it gets URL-encoded automatically). If your link has no
      destination parameter, just leave {dest} out.
   3. Set `enabled: true`.

   While a partner is `enabled: false`, its buttons are hidden and
   the booking block falls back to an honest "not live yet" note.
   Nothing on the site ever shows a dead or fake booking link.

   STATUS as of 8 Oct 2026
   - Trip.com     : LIVE for hotels (stays). Allianceid 10211734,
                    SID 331682352 (site "Plyndi", https://www.plyndi.com).
                    Flights + activities URLs are filled in and ready —
                    flip their `enabled` to true when you want them live.
   - Booking.com  : applied via Commission Junction (CJ) — pending
   - Travelpayouts: not approved, not in use

   LONG-TERM (noted 1 Oct 2026): affiliate is TEMPORARY. When direct
   partnerships land, delete the affiliate entries in this file entirely
   and update about.html "How Plyndi makes money" + disclosure.html.
   Do not leave dead affiliate config behind.
   ========================================================= */

window.PLYNDI_AFFILIATES = {

  stays: {
    enabled: true,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/hotels/list?city={dest}&Allianceid=YOURID&SID=YOURSID"
    url: "https://www.trip.com/hotels/list?keyword={dest}&Allianceid=10211734&SID=331682352&trip_sub1=plyndi_blog"
  },

  flights: {
    enabled: false,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/flights/?Allianceid=YOURID&SID=YOURSID&dcity={dest}"
    url: "https://www.trip.com/flights/?Allianceid=10211734&SID=331682352&trip_sub1=plyndi_blog"
  },

  activities: {
    enabled: false,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/things-to-do/?keyword={dest}&Allianceid=YOURID&SID=YOURSID"
    url: "https://www.trip.com/things-to-do/?keyword={dest}&Allianceid=10211734&SID=331682352&trip_sub1=plyndi_blog"
  },

  // Booking.com via CJ — flip `stays` above to this once CJ approves,
  // or run both by changing the button's data-book value to "stays_booking".
  stays_booking: {
    enabled: false,
    partner: "Booking.com",
    url: "PASTE_BOOKING_COM_CJ_LINK_HERE"
  }
};


/* =========================================================
   Analytics — Cloudflare Web Analytics
   ---------------------------------------------------------
   NOTHING TO DO HERE. plyndi.com uses Cloudflare's "Automatic
   setup", confirmed working 21 Sep 2026 — because the site is
   proxied through Cloudflare, it inserts the analytics code into
   your pages by itself. No token, no snippet, no cookie banner.

   See your numbers at: Cloudflare dashboard -> Analytics & Logs
   -> Web Analytics -> plyndi.com

   Only fill the token in below if you ever switch that site to
   "Manual setup" in Cloudflare, or move the site off Cloudflare.
   Filling it in while Automatic setup is on would load the
   analytics script TWICE and double-count every visit.
   ========================================================= */

window.PLYNDI_ANALYTICS = {
  cloudflareToken: ""   // leave empty — Automatic setup is handling this
};
