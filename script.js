/* =========================================================
   Plyndi — script.js
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initNavToggle();
  initPlanner();
  initNewsletterForm();
  initContactForm();
  initBlogFilters();
  initBookingLinks();
  initAnalytics();
});

/* ---------- Sticky header shadow on scroll ---------- */
function initHeader(){
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Mobile nav toggle ---------- */
function initNavToggle(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Trip skeleton generator ----------
   This is an honest, static template generator — NOT an AI
   itinerary. It builds a sensible day-by-day skeleton from a
   small ruleset so first-time visitors have a starting frame,
   then points them to the matching in-depth guide. */
const TRIP_TEMPLATES = {
  bangkok: {
    label: 'Bangkok, Thailand',
    guideUrl: 'blog-bangkok.html',
    anchors: [
      'Old City temples: Grand Palace, Wat Pho, Wat Arun',
      'Chinatown (Yaowarat) street food crawl',
      'Chatuchak Weekend Market (Sat/Sun only)',
      'Chao Phraya river-boat pier hopping',
      'Sukhumvit rooftop bar + BTS Skytrain loop',
      'Day trip: Ayutthaya ruins or floating market',
    ],
  },
  bali: {
    label: 'Bali, Indonesia',
    guideUrl: 'blog-bali.html',
    anchors: [
      'Canggu: rice-field walks and beach clubs',
      'Ubud: Tegalalang rice terraces + monkey forest',
      'Uluwatu clifftop temple + sunset Kecak dance',
      'Sekumpul or Tibumana waterfall visit',
      'Snorkeling day trip: Nusa Penida or Blue Lagoon',
      'Warung-hopping and a Balinese cooking class',
    ],
  },
  tokyo: {
    label: 'Tokyo, Japan',
    guideUrl: 'blog-tokyo.html',
    anchors: [
      'Senso-ji Temple + Asakusa old town',
      'Shibuya Crossing + Harajuku Takeshita Street',
      'Shinjuku Gyoen or Meiji Jingu for quiet green space',
      'Tsukiji Outer Market breakfast crawl',
      'teamLab digital art or Akihabara electronics district',
      'Day trip: Kamakura or Nikko',
    ],
  },
  taipei: {
    label: 'Taipei, Taiwan',
    guideUrl: 'blog-taipei.html',
    anchors: [
      'Longshan Temple + old Wanhua district',
      'Raohe or Shilin Night Market food crawl',
      'Beitou hot springs + Thermal Valley',
      'Taipei 101 observation deck at night',
      'Bukchon-style old-street walk: Dihua Street',
      'Day trip: Jiufen (early bus to beat the crowds)',
    ],
  },
  kaohsiung: {
    label: 'Kaohsiung, Taiwan',
    guideUrl: 'blog-kaohsiung.html',
    anchors: [
      'Formosa Boulevard Dome of Light + Liuhe Night Market',
      'Pier-2 Art Center and the harbor at golden hour',
      'Lotus Pond: Dragon and Tiger Pagodas',
      'Cijin Island by ferry: bike, beach, seafood',
      'Fo Guang Shan Buddha Memorial Center (half-day)',
      'Ruifeng Night Market (check which nights it runs)',
    ],
  },
  tainan: {
    label: 'Tainan, Taiwan',
    guideUrl: 'blog-tainan.html',
    anchors: [
      'Beef-soup breakfast + Chihkan Tower',
      'Confucius Temple + Shennong Street',
      'Anping: Fort Zeelandia, Old Street, Tree House',
      'Danzai noodle and street-snack crawl',
      'Hayashi Department Store at golden hour',
      'Chimei Museum (check closing day)',
    ],
  },
  taitung: {
    label: 'Taitung, Taiwan',
    guideUrl: 'blog-taitung.html',
    anchors: [
      'Chishang bike ride + railway bento lunch',
      'Luye Highland balloon ride (in season, early morning)',
      'East coast drive: Dulan and Sanxiantai',
      'Zhiben hot springs',
      'Railway Art Village + Tiehua Village evening',
      'Chenggong fishing harbor seafood lunch',
    ],
  },
  pingtung: {
    label: 'Kenting (Pingtung), Taiwan',
    guideUrl: 'blog-pingtung.html',
    anchors: [
      'Baisha Beach morning, Kenting Street dinner',
      'Eluanbi Lighthouse + southern-tip coastal trail',
      'Fengchuisha dunes at sunset',
      'Hengchun Old Town walk + local noodles',
      'Donggang seafood + ferry to Xiaoliuqiu',
      'Xiaoliuqiu snorkeling (keep your distance from turtles)',
    ],
  },
  hualien: {
    label: 'Hualien & Taroko Gorge, Taiwan',
    guideUrl: 'blog-hualien.html',
    anchors: [
      'Taroko: Shakadang Trail (check open trails first)',
      'Swallow Grotto + Tunnel of Nine Turns',
      'Changchun Shrine + Baiyang Trail if open',
      'Dongdamen Night Market dinner',
      'Qixingtan Beach at sunrise or sunset',
      'Liyu Lake bike loop',
    ],
  },
  chiangmai: {
    label: 'Chiang Mai, Thailand',
    guideUrl: 'blog-chiangmai.html',
    anchors: [
      'Old City temple walk: Wat Phra Singh, Wat Chedi Luang',
      'Doi Suthep at sunset',
      'Vetted no-riding elephant sanctuary visit',
      'Sunday Walking Street market',
      'Nimman coffee district',
      'Day trip: Pai (or 1–2 night stay if time allows)',
    ],
  },
  seoul: {
    label: 'Seoul, South Korea',
    guideUrl: 'blog-seoul.html',
    anchors: [
      'Gyeongbokgung Palace + hanbok rental',
      'Bukchon Hanok Village (go early)',
      'Myeongdong street food + shopping',
      'Hongdae nightlife + busking street',
      'Korean BBQ dinner',
      'Day trip: DMZ tour or Nami Island',
    ],
  },
  singapore: {
    label: 'Singapore',
    guideUrl: 'blog-singapore.html',
    anchors: [
      'Maxwell Food Centre or Lau Pa Sat hawker crawl',
      'Gardens by the Bay (late afternoon into the night show)',
      'Marina Bay skyline view + Helix Bridge',
      'Chinatown, Little India, Kampong Glam walking route',
      'Sentosa half-day',
      'Cloud Forest / Flower Dome conservatories',
    ],
  },
  paris: {
    label: 'Paris, France',
    guideUrl: 'blog-paris.html',
    anchors: [
      'Louvre (timed entry, Carrousel entrance)',
      'Eiffel Tower view from Trocadéro',
      'Notre-Dame + Île de la Cité + Sainte-Chapelle',
      'Le Marais or Saint-Germain-des-Prés wander',
      'Montmartre + Sacré-Cœur',
      'Day trip: Versailles (early start, timed entry)',
    ],
  },
  rome: {
    label: 'Rome, Italy',
    guideUrl: 'blog-rome.html',
    anchors: [
      'Colosseum + Roman Forum + Palatine Hill (timed entry)',
      'Vatican Museums + Sistine Chapel + St. Peter\u2019s Basilica',
      'Trevi Fountain + Pantheon early morning',
      'Trastevere wander + dinner',
      'Piazza Navona + Gianicolo Hill sunset',
      'Testaccio neighborhood food crawl',
    ],
  },
  hanoi: {
    label: 'Hanoi, Vietnam',
    guideUrl: 'blog-hanoi.html',
    anchors: [
      'Old Quarter wander (36 streets)',
      'Egg coffee at a classic cafe',
      'Bún chả + street food crawl',
      'Ho Chi Minh Mausoleum + Temple of Literature',
      'Train Street + West Lake',
      'Ha Long Bay overnight (if time allows)',
    ],
  },
  danang: {
    label: 'Da Nang, Vietnam',
    guideUrl: 'blog-danang.html',
    anchors: [
      'Han River promenade + Dragon Bridge (fire show Sat/Sun 9pm)',
      'My Khe Beach sunrise swim',
      'Marble Mountains in the morning',
      'Son Tra Peninsula + Linh Ung Pagoda',
      'Mi Quang + seafood dinner',
      'Ba Na Hills (arrive at opening)',
    ],
  },
  hoian: {
    label: 'Hoi An, Vietnam',
    guideUrl: 'blog-hoian.html',
    anchors: [
      'Ancient Town at 7am (buy the combo ticket)',
      'Cao lau + banh mi food crawl',
      'Tailor consultation + first fitting',
      'Bike ride to An Bang beach',
      'Cooking class',
      'Lanterns on the river after dark',
    ],
  },
  hochiminh: {
    label: 'Ho Chi Minh City, Vietnam',
    guideUrl: 'blog-hochiminh.html',
    anchors: [
      'District 1 walk: Nguyen Hue, Post Office, Notre-Dame exterior',
      'War Remnants Museum + Independence Palace',
      'Ben Thanh Market lunch',
      'Bitexco Skydeck at sunset',
      'Cu Chi tunnels (early start)',
      'Mekong Delta day trip',
    ],
  },
  quynhon: {
    label: 'Quy Nhon, Vietnam',
    guideUrl: 'blog-quynhon.html',
    anchors: [
      'City beach morning + banh xeo tom nhay',
      'Ghenh Rang + Queen\'s Beach',
      'Boat to Ky Co and Hon Kho',
      'Eo Gio at sunset',
      'Banh It Cham Towers',
      'Seafood dinner on the bay',
    ],
  },
  phuquoc: {
    label: 'Phu Quoc, Vietnam',
    guideUrl: 'blog-phuquoc.html',
    anchors: [
      'Long Beach or Ong Lang beach morning',
      'Duong Dong night market dinner',
      'Island-hopping + snorkeling (calm season)',
      'Sao Beach',
      'Hon Thom cable car',
      'Sunset Town at golden hour',
    ],
  },
  kyoto: {
    label: 'Kyoto, Japan',
    guideUrl: 'blog-kyoto.html',
    anchors: [
      'Fushimi Inari at sunrise',
      'Arashiyama Bamboo Grove early morning',
      'Kinkaku-ji (Golden Pavilion)',
      'Gion district respectful walk',
      'Kiyomizu-dera + Sannenzaka/Ninenzaka',
      'Ginkaku-ji + Philosopher\u2019s Path',
    ],
  },
  hongkong: {
    label: 'Hong Kong',
    guideUrl: 'blog-hongkong.html',
    anchors: [
      'Victoria Peak (booked ahead)',
      'Dim sum crawl (Tim Ho Wan or cart-service hall)',
      'Star Ferry at sunset',
      'Sham Shui Po or Graham Street wet market',
      'Man Mo Temple',
      'Big Buddha + Po Lin Monastery, Lantau Island',
    ],
  },
  kualalumpur: {
    label: 'Kuala Lumpur, Malaysia',
    guideUrl: 'blog-kualalumpur.html',
    anchors: [
      'Petronas Towers + KLCC Park',
      'Batu Caves (early morning)',
      'Jalan Alor food street',
      'Petaling Street (Chinatown)',
      'Brickfields (Little India) + Merdeka Square',
      'Cameron Highlands overnight (if time allows)',
    ],
  },
  cebu: {
    label: 'Cebu, Philippines',
    guideUrl: 'blog-cebu.html',
    anchors: [
      'Kawasan Falls canyoneering',
      'Moalboal sardine run snorkel',
      'Whale shark encounter (Oslob or Donsol \u2014 research first)',
      'Cebu City: Magellan\u2019s Cross + Fort San Pedro',
      'Lechon lunch',
      'Malapascua or Bantayan island day trip',
    ],
  },
  barcelona: {
    label: 'Barcelona, Spain',
    guideUrl: 'blog-barcelona.html',
    anchors: [
      'Sagrada Família (booked weeks ahead)',
      'Park Güell monumental zone',
      'Gothic Quarter + Las Ramblas (eyes on your bag)',
      'Tapas crawl starting ~7pm',
      'La Boqueria market (walk past the entrance stalls)',
      'Gràcia neighborhood evening',
    ],
  },
};

function initPlanner(){
  const form = document.getElementById('planner-form');
  const output = document.getElementById('planner-output');
  if (!form || !output) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const destination = form.destination.value;
    const days = Math.min(Math.max(parseInt(form.days.value, 10) || 3, 1), 14);
    const pace = form.pace.value;

    if (!destination || !TRIP_TEMPLATES[destination]) {
      output.innerHTML = '<p class="planner-empty">Pick a destination to generate a starter skeleton.</p>';
      return;
    }

    const trip = TRIP_TEMPLATES[destination];
    const perDay = pace === 'relaxed' ? 1 : pace === 'packed' ? 3 : 2;
    const items = [];
    let anchorIndex = 0;
    for (let day = 1; day <= days; day++) {
      const picks = [];
      for (let i = 0; i < perDay; i++) {
        picks.push(trip.anchors[anchorIndex % trip.anchors.length]);
        anchorIndex++;
      }
      items.push(`<li><strong>Day ${day}:</strong> ${picks.join('; ')}</li>`);
    }

    output.innerHTML = `
      <p class="box-title">Your ${days}-day ${trip.label} skeleton (${pace} pace)</p>
      <ol>${items.join('')}</ol>
      <p class="planner-disclaimer">
        This is a starting frame, not a booked plan — swap items around and leave
        buffer time for travel between stops. Read the full
        <a href="${trip.guideUrl}"><strong>${trip.label} guide</strong></a> for opening hours,
        ticket prices, and how to get between these places.
      </p>
    `;
  });
}

/* ---------- Newsletter form (Formspree) ---------- */
function initNewsletterForm(){
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  const status = form.parentElement.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Subscribe';
  const listField = form.querySelector('input[name="list"]');
  const isAppLaunch = !!listField && listField.value === 'app-launch';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = isAppLaunch ? 'Sending…' : 'Subscribing…'; }

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        form.reset();
        if (status) {
          status.style.display = 'block';
          status.textContent = isAppLaunch
            ? "You're on the launch list — we'll email you once, the day Plyndi is live."
            : "You're on the list — you'll hear from us when a new guide goes up.";
        }
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Something went wrong subscribing — please try again in a moment.';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
    }
  });
}

/* ---------- Blog listing filters ---------- */
function initBlogFilters(){
  const buttons = document.querySelectorAll('.filter-row button');
  const cards = document.querySelectorAll('[data-category]');
  const heading = document.querySelector('.page-hero h1');
  if (!buttons.length || !cards.length) return;

  function apply(filter, push){
    const known = [...buttons].some(b => b.dataset.filter === filter);
    if (!known) filter = 'all';
    buttons.forEach(b => b.classList.toggle('is-active', b.dataset.filter === filter));
    let shown = 0;
    cards.forEach(card => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    if (heading){
      const label = [...buttons].find(b => b.dataset.filter === filter);
      heading.textContent = filter === 'all'
        ? 'Travel guides'
        : (label ? label.textContent.replace(/ guides$/,'') + ' travel guides' : 'Travel guides');
    }
    document.title = filter === 'all'
      ? 'Travel Guides — Plyndi'
      : (heading ? heading.textContent + ' — Plyndi' : document.title);
    if (push){
      const hash = filter === 'all' ? ' ' : '#' + filter;
      history.replaceState(null, '', filter === 'all' ? location.pathname : hash);
    }
    return shown;
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => apply(btn.dataset.filter, true));
  });

  /* Deep links: blog.html#japan lands already filtered, so every
     "All <country> guides" link in a guide actually goes somewhere. */
  const initial = decodeURIComponent(location.hash.replace('#',''));
  if (initial) apply(initial, false);
  window.addEventListener('hashchange', () => {
    apply(decodeURIComponent(location.hash.replace('#','')) || 'all', false);
  });
}

/* ---------- Privacy-friendly analytics ----------
   Cloudflare Web Analytics: no cookies, so no cookie banner needed.
   Paste your token into config.js and it starts collecting. */
function initAnalytics(){
  const token = (window.PLYNDI_ANALYTICS || {}).cloudflareToken;
  if (!token || /^PASTE_/.test(token)) return;
  const el = document.createElement('script');
  el.defer = true;
  el.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  el.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(el);
}

/* ---------- Contact form (Formspree) ---------- */
function initContactForm(){
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        form.reset();
        if (status) {
          status.style.display = 'block';
          status.textContent = "Thanks — your message is on its way. I'll get back to you soon.";
        }
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Something went wrong sending that — please try again, or email directly.';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send message'; }
    }
  });
}

/* ---------- Affiliate booking links ----------
   Reads window.PLYNDI_AFFILIATES from config.js and fills in every
   [data-book] button on the page. A partner that isn't enabled yet
   has its buttons removed rather than left pointing nowhere — the
   site never shows a dead or fake booking link. */
function initBookingLinks(){
  const cfg = window.PLYNDI_AFFILIATES || {};
  const buttons = document.querySelectorAll('[data-book]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    const entry = cfg[btn.dataset.book];
    const dest = btn.dataset.dest || '';

    if (!entry || !entry.enabled || !entry.url || /^PASTE_/.test(entry.url)) {
      btn.remove();
      return;
    }

    /* Trip.com hotel search needs its own numeric city ID, not a name.
       No ID for this destination = no button, rather than a link that
       lands the reader on an empty "0 properties found" page. */
    let url = entry.url;
    if (url.indexOf('{cityId}') !== -1) {
      const cityId = (window.PLYNDI_TRIP_CITIES || {})[dest];
      if (!cityId) { btn.remove(); return; }
      url = url.replace('{cityId}', encodeURIComponent(cityId));
    }

    btn.href = url.replace('{dest}', encodeURIComponent(dest));
    btn.target = '_blank';
    btn.rel = 'sponsored noopener nofollow';
    if (entry.partner) {
      btn.setAttribute('title', 'Opens ' + entry.partner + ' in a new tab');
    }
  });

  /* Any booking container left with no live buttons gets an honest note. */
  document.querySelectorAll('.booking-block, .affiliate-box').forEach(box => {
    if (box.querySelector('a[data-book]')) return;
    const actions = box.querySelector('.booking-actions');
    if (actions) actions.remove();
    const note = document.createElement('p');
    note.className = 'form-note';
    note.textContent = 'Booking partners are being connected \u2014 no booking links are live on this page yet.';
    box.appendChild(note);
  });
}

/* =========================================================
   App preview: rotate the phone mockup through the 5 modules
   ========================================================= */
(function () {
  var slides = document.querySelectorAll('.phone-slide');
  var dots = document.querySelectorAll('.phone-dot');
  var label = document.querySelector('.phone-module-label');
  if (!slides.length) return;
  var i = 0;
  function show(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    if (label) label.textContent = slides[i].getAttribute('data-module');
  }
  show(0);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setInterval(function () { show(i + 1); }, 4000);
})();

/* =========================================================
   Feature cards: gentle reveal as they scroll into view
   ========================================================= */
(function () {
  var cards = document.querySelectorAll('.feature-card');
  if (!cards.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  cards.forEach(function (c) { c.classList.add('reveal'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  cards.forEach(function (c) { io.observe(c); });
})();
