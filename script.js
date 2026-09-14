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
      <h4>Your ${days}-day ${trip.label} skeleton (${pace} pace)</h4>
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Subscribing…'; }

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
          status.textContent = "You're on the list — you'll hear from us when a new guide goes up.";
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
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Subscribe'; }
    }
  });
}

/* ---------- Blog listing filters ---------- */
function initBlogFilters(){
  const buttons = document.querySelectorAll('.filter-row button');
  const cards = document.querySelectorAll('[data-category]');
  if (!buttons.length || !cards.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
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
