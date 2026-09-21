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

   STATUS as of 21 Sep 2026
   - Trip.com     : APPROVED — paste the tracking URL, flip to true
   - Booking.com  : applied via Commission Junction (CJ) — pending
   - Travelpayouts: not approved, not in use
   ========================================================= */

window.PLYNDI_AFFILIATES = {

  stays: {
    enabled: false,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/hotels/list?city={dest}&Allianceid=YOURID&SID=YOURSID"
    url: "PASTE_TRIPCOM_HOTEL_LINK_HERE"
  },

  flights: {
    enabled: false,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/flights/?Allianceid=YOURID&SID=YOURSID&dcity={dest}"
    url: "PASTE_TRIPCOM_FLIGHT_LINK_HERE"
  },

  activities: {
    enabled: false,
    partner: "Trip.com",
    // e.g. "https://www.trip.com/things-to-do/?keyword={dest}&Allianceid=YOURID&SID=YOURSID"
    url: "PASTE_TRIPCOM_ACTIVITIES_LINK_HERE"
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
