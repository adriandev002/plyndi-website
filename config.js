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
    // {cityId} is looked up from PLYNDI_TRIP_CITIES below using the
    // button's data-dest value. Trip.com IGNORES a text keyword here —
    // it only understands its own numeric city IDs, so a city that is
    // missing from that map has its button hidden rather than sending
    // a reader to an empty "0 properties found" page.
    url: "https://www.trip.com/hotels/list?city={cityId}&Allianceid=10211734&SID=331682352&trip_sub1=plyndi_blog"
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
   Trip.com city IDs
   ---------------------------------------------------------
   Trip.com's hotel search only accepts ITS OWN numeric city ID
   (?city=359), not a city name. The key on the left must match the
   button's data-dest exactly, e.g. <a data-book="stays" data-dest="Chiang Mai">.

   TO ADD A NEW DESTINATION GUIDE
   1. Go to trip.com/hotels, search the city, press Search.
   2. Look at the address bar: .../hotels/list?city=NNNN  <- that number.
   3. Add a line below. Until you do, that guide's hotel button
      simply won't render — nothing breaks, nothing fakes a link.

   Verified live on 8 Oct 2026 (each ID returned real properties). Vietnam IDs added 9 Oct 2026
   (Da Nang, Hoi An, Ho Chi Minh City, Quy Nhon, Phu Quoc), each confirmed to return a hotel list.
   ========================================================= */

window.PLYNDI_TRIP_CITIES = {
  "Bali": 723,
  "Bangkok": 359,
  "Barcelona": 40795,
  "Cebu": 1239,
  "Chiang Mai": 623,
  "Da Nang": 1356,
  "Hanoi": 286,
  "Ho Chi Minh City": 301,
  "Hoi An": 1775,
  "Hong Kong": 58,
  "Hualien": 6954,
  "Kaohsiung": 720,
  "Kenting": 5589,
  "Kuala Lumpur": 315,
  "Kyoto": 734,
  "Paris": 192,
  "Phu Quoc": 5649,
  "Quy Nhon": 6172,
  "Rome": 343,
  "Seoul": 274,
  "Singapore": 73,
  "Tainan": 3847,
  "Taipei": 617,
  "Taitung": 3848,
  "Tokyo": 228
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
