/* =========================================================
   Plyndi — Dynamic website preview
   One reusable travel-agency template; content is swapped in
   from the client's submission. Every value is inserted with
   textContent (never innerHTML) and links are http(s)-only.
   ========================================================= */
import { api, h, safeUrl } from './client-api.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const id = params.get('id') || '';

init();

async function init() {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(id)) return showState('Preview not found', 'This preview link is incomplete. Please use the full link you received after submitting.');
  let data;
  try {
    data = await api('/preview?id=' + encodeURIComponent(id));
  } catch (e) {
    if (e.status === 404) return showState('Preview not found', 'This preview link is not valid. If you just submitted, please use the link from that page or contact contact@plyndi.com.');
    return showState('Preview unavailable', e.message, true);
  }
  setupNotice(data);
  renderSite(data);
  $('pv-state').hidden = true;
  $('pv-site').hidden = false;
}

function showState(title, msg, retry) {
  $('pv-actions').hidden = true;
  $('pv-state').replaceChildren(
    h('h1', null, title), h('p', null, msg),
    retry ? h('button', { type: 'button', class: 'pv-nbtn pv-nbtn-solid', onclick: () => location.reload() }, 'Try again') : null);
}

function setupNotice(data) {
  const p = data.project;
  $('pv-ref').textContent = `Ref ${p.ref} · Revision ${p.revision_number} · ${new Date(p.submitted_at).toLocaleDateString()}`;
  if (data.invite) {
    const base = `/client-form?invite=${encodeURIComponent(data.invite)}`;
    $('pv-edit').href = `${base}&edit=${encodeURIComponent(id)}&mode=review`;
    $('pv-revision').href = `${base}&edit=${encodeURIComponent(id)}&mode=revision`;
    $('pv-back').href = base;
  } else {
    ['pv-edit', 'pv-revision', 'pv-back'].forEach(x => { const a = $(x); a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.title = 'This project form link has been closed. Contact Plyndi to make changes.'; });
  }
  if (params.get('new') === '1') {
    const t = $('pv-toast');
    t.hidden = false;
    t.textContent = `Thank you — your information was submitted (reference ${p.ref}). Here is a first preview of your website.`;
    history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(id));
    setTimeout(() => { t.hidden = true; }, 9000);
  }
}

/* ---------------- Theme ---------------- */
const STYLE_THEMES = {
  Luxury:      { primary: '#1F2A44', accent: '#C8A45C', radius: '2px', font: 'Elegant / luxury serif' },
  Premium:     { primary: '#232B3A', accent: '#B98B4E', radius: '4px', font: 'Elegant / luxury serif' },
  Elegant:     { primary: '#3E3A5C', accent: '#C49A8A', radius: '4px', font: 'Classic serif' },
  Minimal:     { primary: '#1E1E1E', accent: '#8A8A8A', radius: '0px', font: 'Modern sans-serif' },
  Adventurous: { primary: '#24533A', accent: '#E58E26', radius: '10px', font: 'Bold / adventurous' },
  Friendly:    { primary: '#1F6F8B', accent: '#F2A65A', radius: '16px', font: 'Friendly / rounded' },
  Professional:{ primary: '#17406D', accent: '#2BA3B5', radius: '6px', font: 'Modern sans-serif' },
  Modern:      { primary: '#0F5E63', accent: '#20C1C4', radius: '10px', font: 'Modern sans-serif' }
};
const FONTS = {
  'Modern sans-serif':       { css: 'Plus+Jakarta+Sans:wght@400;600;700;800', head: "'Plus Jakarta Sans'", body: "'Plus Jakarta Sans'" },
  'Classic serif':           { css: 'Lora:wght@500;600;700&family=Source+Sans+3:wght@400;600', head: "'Lora'", body: "'Source Sans 3'" },
  'Elegant / luxury serif':  { css: 'Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600', head: "'Cormorant Garamond'", body: "'Jost'" },
  'Friendly / rounded':      { css: 'Nunito:wght@400;600;700;800', head: "'Nunito'", body: "'Nunito'" },
  'Bold / adventurous':      { css: 'Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600', head: "'Montserrat'", body: "'Open Sans'" }
};

function applyTheme(p, root) {
  const style = (p.design_styles || []).find(s => STYLE_THEMES[s]) || 'Modern';
  const t = STYLE_THEMES[style];
  const primary = validHex(p.primary_color) || t.primary;
  const accent = validHex(p.secondary_color) || t.accent;
  const font = FONTS[p.font_style] || FONTS[t.font];
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.css}&display=swap`;
  document.head.append(link);
  root.style.setProperty('--c-primary', primary);
  root.style.setProperty('--c-accent', accent);
  root.style.setProperty('--c-on-primary', readableOn(primary));
  root.style.setProperty('--c-on-accent', readableOn(accent));
  root.style.setProperty('--radius', t.radius);
  root.style.setProperty('--font-head', `${font.head}, Georgia, serif`);
  root.style.setProperty('--font-body', `${font.body}, system-ui, sans-serif`);
  root.dataset.style = style.toLowerCase();
}
function validHex(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : null; }
function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.45 ? '#141414' : '#FFFFFF';
}

/* ---------------- Helpers ---------------- */
const has = v => v !== null && v !== undefined && String(v).trim() !== '' && !(Array.isArray(v) && !v.length);
const pick = (...vals) => vals.find(has);
const lines = v => has(v) ? String(v).split(/\r?\n|•/).map(s => s.replace(/^[-*·\s]+/, '').trim()).filter(Boolean) : [];
const short = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…' : s; };
const initials = name => String(name || 'Your Company').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const digits = v => String(v || '').replace(/[^\d+]/g, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sample() { return h('span', { class: 'pv-sample', title: 'Placeholder — add this information in the form' }, 'Sample'); }

function img(file, alt, cls, fallbackLabel) {
  if (file && file.url) {
    const el = h('img', { src: file.url, alt: alt || '', loading: 'lazy', decoding: 'async', class: cls || '' });
    el.addEventListener('error', () => el.replaceWith(placeholderArt(fallbackLabel || alt, cls)), { once: true });
    return el;
  }
  return placeholderArt(fallbackLabel || alt, cls);
}
function placeholderArt(label, cls) {
  const seed = [...String(label || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 400 260'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('aria-hidden', 'true');
  const shift = (seed % 5) * 18;
  svg.innerHTML = // static shapes only — no user text in this markup
    `<rect width="400" height="260" fill="var(--c-primary)"/>
     <rect width="400" height="260" fill="var(--c-accent)" opacity=".18"/>
     <circle cx="${300 - shift}" cy="70" r="30" fill="var(--c-accent)" opacity=".75"/>
     <path d="M0 210 L${80 + shift} 120 L${150 + shift} 180 L${230 + shift} 90 L400 200 L400 260 L0 260Z" fill="#fff" opacity=".14"/>
     <path d="M0 240 L${110 - shift / 2} 170 L${200} 225 L${300 + shift / 2} 160 L400 230 L400 260 L0 260Z" fill="#fff" opacity=".22"/>`;
  return h('div', { class: 'pv-art ' + (cls || ''), role: 'img', 'aria-label': label ? `Image placeholder: ${label}` : 'Image placeholder' }, svg);
}

/* ---------------- Template ---------------- */
function renderSite(data) {
  const p = data.project;
  const L = data.lists || {};
  const files = data.files || [];
  const byId = new Map(files.map(f => [f.id, f]));
  const cat = c => files.filter(f => f.category === c && f.url);
  const imgsOf = ids => (ids || []).map(i => byId.get(i)).filter(f => f && f.url && (f.type || '').startsWith('image/'));
  const images = c => cat(c).filter(f => (f.type || '').startsWith('image/'));

  const root = $('pv-site');
  applyTheme(p, root);

  const name = pick(p.company_name, 'Your Company');
  document.title = `${name} — Website Preview`;
  const tagline = pick(p.tagline, 'Journeys crafted with care');
  const logo = images('logo')[0];
  const booking = p.booking_method || '';
  const ctaText = /instant|online/i.test(booking) ? 'Book now' : /request/i.test(booking) ? 'Request a booking' : 'Send an enquiry';

  const services = (L.services || []);
  const tours = (L.tours || []);
  const dests = (L.destinations || []);
  const team = (L.team || []);
  const reviews = (L.reviews || []).filter(r => has(r.review_text));
  const faqs = (L.faqs || []).filter(f => has(f.question));

  const tourImgPool = [...images('tour_photos'), ...images('company_photos')];
  const destImgPool = images('destination_photos');
  const heroImg = pick(images('company_photos')[0], tourImgPool[0], destImgPool[0], ...tours.map(t => imgsOf(t.image_file_ids)[0]), ...dests.map(d => imgsOf(d.image_file_ids)[0]));

  const nav = [
    ['about', 'About'], ['services', 'Services'], ['tours', 'Tours'], ['destinations', 'Destinations'],
    reviews.length ? ['reviews', 'Reviews'] : null, ['faq', 'FAQ'], ['contact', 'Contact']
  ].filter(Boolean);

  /* Header */
  const brand = h('a', { class: 'pv-brand', href: '#top' },
    logo ? h('img', { src: logo.url, alt: `${name} logo`, class: 'pv-logo' }) : h('span', { class: 'pv-monogram', 'aria-hidden': 'true' }, initials(name)),
    logo ? null : h('span', { class: 'pv-brand-name' }, name));
  const navToggle = h('button', { type: 'button', class: 'pv-toggle', 'aria-expanded': 'false', 'aria-controls': 'pv-nav', 'aria-label': 'Open menu' }, h('span'));
  const navEl = h('nav', { class: 'pv-nav', id: 'pv-nav', 'aria-label': 'Main' },
    nav.map(([href, label]) => h('a', { href: '#' + href }, label)),
    h('a', { class: 'pv-btn pv-btn-accent pv-nav-cta', href: '#contact' }, ctaText));
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navEl.classList.toggle('is-open', open);
  });
  navEl.addEventListener('click', e => { if (e.target.closest('a')) { navToggle.setAttribute('aria-expanded', 'false'); navEl.classList.remove('is-open'); } });
  const header = h('header', { class: 'pv-header', id: 'top' }, h('div', { class: 'pv-wrap pv-header-inner' }, brand, navToggle, navEl));

  /* Hero */
  const stats = [
    has(p.years_experience) ? [p.years_experience.replace(/\s*years?$/i, '') + (/\d$/.test(p.years_experience) ? '+' : ''), 'Years of experience'] : null,
    has(p.year_established) ? [p.year_established, 'Established'] : null,
    tours.length ? [String(tours.length), tours.length === 1 ? 'Signature tour' : 'Signature tours'] : null,
    dests.length ? [String(dests.length), dests.length === 1 ? 'Destination' : 'Destinations'] : null
  ].filter(Boolean);
  const hero = h('section', { class: 'pv-hero' + (heroImg ? ' has-img' : '') },
    heroImg ? h('img', { class: 'pv-hero-img', src: heroImg.url, alt: '' }) : placeholderArt(name, 'pv-hero-img'),
    h('div', { class: 'pv-hero-shade' }),
    h('div', { class: 'pv-wrap pv-hero-inner' },
      h('p', { class: 'pv-eyebrow' }, pick(p.main_destinations, p.business_type, [p.city, p.country].filter(has).join(', '), 'Tours & travel experiences')),
      h('h1', null, name),
      h('p', { class: 'pv-hero-tag' }, tagline, has(p.tagline) ? null : sample()),
      h('p', { class: 'pv-hero-lede' }, short(pick(p.company_description, p.company_introduction, 'Thoughtfully designed trips, local experts and memorable moments — tell visitors in one or two sentences what makes your journeys special.'), 220)),
      h('div', { class: 'pv-hero-actions' },
        h('a', { class: 'pv-btn pv-btn-accent', href: '#tours' }, 'Explore tours'),
        h('a', { class: 'pv-btn pv-btn-ghost', href: '#contact' }, ctaText))),
    stats.length ? h('div', { class: 'pv-wrap pv-stats' }, stats.map(([n, l]) => h('div', { class: 'pv-stat' }, h('strong', null, n), h('span', null, l)))) : null);

  /* About */
  const values = lines(p.company_values);
  const aboutImg = pick(images('company_photos')[1], images('team_photos')[0], images('company_photos')[0]);
  const about = section('about', 'About us', `Welcome to ${name}`, null,
    h('div', { class: 'pv-about' + (aboutImg ? '' : ' no-img') },
      h('div', { class: 'pv-about-copy' },
        h('p', { class: 'pv-lead' }, pick(p.company_introduction, p.company_description, 'Introduce your company here — your story, who you are and the kind of travel you love creating.')),
        has(p.founder_background) ? h('p', null, p.founder_background) : null,
        (has(p.mission) || has(p.vision)) ? h('div', { class: 'pv-mv' },
          has(p.mission) ? h('div', null, h('h3', null, 'Our mission'), h('p', null, p.mission)) : null,
          has(p.vision) ? h('div', null, h('h3', null, 'Our vision'), h('p', null, p.vision)) : null) : null,
        values.length ? h('ul', { class: 'pv-values' }, values.map(v => h('li', null, v))) : null),
      h('div', { class: 'pv-about-media' }, img(aboutImg, `${name} team`, 'pv-cover', name))));

  /* Services */
  const svcCards = services.length ? services.map((s, i) => h('article', { class: 'pv-card' },
    img(imgsOf(s.image_file_ids)[0], s.name, 'pv-card-img', s.name || `Service ${i + 1}`),
    h('div', { class: 'pv-card-body' },
      h('h3', null, pick(s.name, `Service ${i + 1}`)),
      h('p', null, short(pick(s.short_description, s.detailed_description, 'A short description of this service.'), 160)),
      metaRow([s.duration && ['Duration', s.duration], s.starting_price && ['From', s.starting_price]]))))
    : ['Private Tours', 'Group Departures', 'Custom Itineraries'].map(n => h('article', { class: 'pv-card is-sample' },
      placeholderArt(n, 'pv-card-img'), h('div', { class: 'pv-card-body' }, h('h3', null, n, ' ', sample()), h('p', null, 'Your services will appear here with a photo, short description, duration and starting price.'))));
  const servicesSec = section('services', 'What we offer', 'Our services', null, h('div', { class: 'pv-grid pv-grid-3' }, svcCards), 'pv-alt');

  /* Tours */
  const tourCards = tours.length ? tours.map((t, i) => tourCard(t, i, imgsOf(t.image_file_ids)[0] || tourImgPool[i] || null, ctaText))
    : ['Old Town Food Walk', 'Mountain & Coast Day Trip', 'Hidden Temples Tour'].map(n => h('article', { class: 'pv-tour is-sample' },
      placeholderArt(n, 'pv-tour-img'), h('div', { class: 'pv-tour-body' }, h('h3', null, n, ' ', sample()), h('p', null, 'Add example tours in the form to see real names, prices and durations here.'))));
  const toursSec = section('tours', 'Featured tours', 'Experiences travellers love', has(p.promote_services) ? short(p.promote_services, 180) : null,
    h('div', { class: 'pv-grid pv-grid-3' }, tourCards));

  /* Destinations */
  const destCards = dests.length ? dests.map((d, i) => h('article', { class: 'pv-dest' },
    img(imgsOf(d.image_file_ids)[0] || destImgPool[i] || null, d.name, 'pv-dest-img', d.name),
    h('div', { class: 'pv-dest-body' },
      h('h3', null, pick(d.name, `Destination ${i + 1}`)),
      h('p', null, short(pick(d.description, d.main_attractions, ''), 150)),
      has(d.best_time_to_visit) ? h('p', { class: 'pv-dest-meta' }, 'Best time: ', d.best_time_to_visit) : null)))
    : lines(p.main_destinations).length || has(p.main_destinations)
      ? String(p.main_destinations).split(/,|\n/).map(s => s.trim()).filter(Boolean).slice(0, 6).map(n => h('article', { class: 'pv-dest' }, placeholderArt(n, 'pv-dest-img'), h('div', { class: 'pv-dest-body' }, h('h3', null, n))))
      : ['Coastline', 'Mountains', 'Old Town'].map(n => h('article', { class: 'pv-dest is-sample' }, placeholderArt(n, 'pv-dest-img'), h('div', { class: 'pv-dest-body' }, h('h3', null, n, ' ', sample()))));
  const destSec = section('destinations', 'Where we go', 'Destinations', null, h('div', { class: 'pv-grid pv-grid-3' }, destCards), 'pv-alt');

  /* Why choose us */
  const points = lines(p.selling_points);
  const whyItems = (points.length ? points : ['Local expert guides', 'Small groups & private options', 'Flexible, honest booking']).slice(0, 6);
  const whySec = h('section', { class: 'pv-section pv-why', 'aria-labelledby': 'why-title' },
    h('div', { class: 'pv-wrap pv-why-inner' },
      h('div', null,
        h('p', { class: 'pv-kicker' }, 'Why choose us'),
        h('h2', { id: 'why-title' }, `Why travel with ${name}`),
        h('p', null, pick(p.why_choose_us, p.differentiator, 'Explain in a few sentences why customers should choose you over anyone else.'))),
      h('ul', { class: 'pv-why-list' }, whyItems.map((t, i) => h('li', null, h('span', { class: 'pv-why-num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), h('span', null, t, points.length ? null : [' ', sample()]))))));

  /* Team */
  const teamSec = team.length ? section('team', 'Meet the team', 'The people behind your trip', null,
    h('div', { class: 'pv-grid pv-grid-4' }, team.map((m, i) => h('article', { class: 'pv-person' },
      img(imgsOf(m.photo_file_ids)[0], m.name, 'pv-person-img', m.name || `Team member ${i + 1}`),
      h('h3', null, pick(m.name, `Team member ${i + 1}`)),
      has(m.position) ? h('p', { class: 'pv-person-role' }, m.position) : null,
      has(m.languages) ? h('p', { class: 'pv-person-meta' }, 'Speaks ', m.languages) : null,
      has(m.biography) ? h('p', null, short(m.biography, 160)) : null)))) : null;

  /* Reviews */
  const reviewSec = section('reviews', 'Reviews', 'What travellers say', null,
    h('div', { class: 'pv-grid pv-grid-3' }, (reviews.length ? reviews : [{ review_text: 'Your best customer reviews will be shown here — real words from real travellers build trust fast.', customer_name: 'Happy traveller', platform: 'Google', _sample: true }])
      .map(r => {
        const photo = imgsOf(r.photo_file_ids)[0];
        const link = safeUrl(r.review_url);
        return h('figure', { class: 'pv-review' + (r._sample ? ' is-sample' : '') },
          h('div', { class: 'pv-stars', 'aria-hidden': 'true' }, '★★★★★'),
          h('blockquote', null, h('p', null, short(r.review_text, 320))),
          h('figcaption', null,
            photo ? h('img', { src: photo.url, alt: '', class: 'pv-review-photo' }) : h('span', { class: 'pv-review-avatar', 'aria-hidden': 'true' }, initials(r.customer_name || 'Guest')),
            h('span', null, h('strong', null, pick(r.customer_name, 'Verified traveller')), r._sample ? [' ', sample()] : null,
              has(r.platform) ? h('span', { class: 'pv-review-src' }, link ? h('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, 'via ', r.platform) : ['via ', r.platform]) : null)));
      })), 'pv-alt');

  /* FAQ */
  const faqList = faqs.length ? faqs : [
    { question: 'How do I book a tour?', answer: `${ctaText} through the website or contact us directly — we reply quickly.`, _sample: true },
    { question: 'Can tours be customised?', answer: 'Add your real questions and answers in the form and they will appear here.', _sample: true }];
  const faqSec = section('faq', 'FAQ', 'Frequently asked questions', null,
    h('div', { class: 'pv-faq' }, faqList.map(f => h('details', null, h('summary', null, f.question, f._sample ? [' ', sample()] : null), h('p', null, pick(f.answer, '—'))))));

  /* Contact */
  const contactItems = [];
  if (has(p.office_address) || has(p.city) || has(p.country)) contactItems.push(['Address', [p.office_address, [p.city, p.country].filter(has).join(', ')].filter(has).join('\n')]);
  if (has(p.phone)) contactItems.push(['Phone', h('a', { href: 'tel:' + digits(p.phone) }, p.phone)]);
  if (has(p.email) && EMAIL_RE.test(p.email)) contactItems.push(['Email', h('a', { href: 'mailto:' + p.email }, p.email)]);
  if (has(p.whatsapp)) contactItems.push(['WhatsApp', h('a', { href: 'https://wa.me/' + digits(p.whatsapp).replace('+', ''), target: '_blank', rel: 'noopener noreferrer' }, p.whatsapp)]);
  if (has(p.line_id)) { const u = safeUrl(p.line_id); contactItems.push(['LINE', u ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, 'Chat on LINE') : p.line_id]); }
  if (has(p.business_hours)) contactItems.push(['Hours', p.business_hours]);
  const socials = [['Facebook', p.facebook_url], ['Instagram', p.instagram_url], ['TikTok', p.tiktok_url], ['YouTube', p.youtube_url]]
    .map(([n, u]) => [n, safeUrl(u)]).filter(([, u]) => u);
  const mapUrl = safeUrl(p.google_maps_url);
  const contactSec = h('section', { class: 'pv-section pv-contact', id: 'contact', 'aria-labelledby': 'contact-title' },
    h('div', { class: 'pv-wrap pv-contact-inner' },
      h('div', null,
        h('p', { class: 'pv-kicker' }, 'Contact'),
        h('h2', { id: 'contact-title' }, 'Plan your next journey with us'),
        h('p', null, 'Tell us where you would like to go and we’ll get back to you with ideas and prices.'),
        contactItems.length ? h('dl', { class: 'pv-contact-list' }, contactItems.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))
          : h('p', { class: 'pv-muted' }, 'Your phone, email, address and opening hours will appear here. ', sample()),
        mapUrl ? h('a', { class: 'pv-btn pv-btn-primary', href: mapUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open in Google Maps') : null,
        socials.length ? h('div', { class: 'pv-social' }, socials.map(([n, u]) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, n))) : null),
      h('form', { class: 'pv-form', onsubmit: e => e.preventDefault(), 'aria-describedby': 'pv-form-note' },
        h('h3', null, ctaText),
        field('Your name', 'text'), field('Email', 'email'),
        tours.length ? h('label', null, 'Tour', h('select', { disabled: true }, h('option', null, 'Choose a tour…'), tours.map(t => h('option', null, pick(t.tour_name, 'Tour'))))) : null,
        field('Preferred date', 'text'), h('label', null, 'Message', h('textarea', { rows: 3, disabled: true })),
        h('button', { type: 'submit', class: 'pv-btn pv-btn-accent', disabled: true }, ctaText),
        h('p', { class: 'pv-muted', id: 'pv-form-note' }, 'Preview only — this form is not active yet.'))));

  /* Footer */
  const legal = ['Privacy Policy', 'Terms & Conditions', 'Cancellation Policy'];
  const footer = h('footer', { class: 'pv-footer' },
    h('div', { class: 'pv-wrap pv-footer-grid' },
      h('div', null,
        h('p', { class: 'pv-footer-brand' }, logo ? h('img', { src: logo.url, alt: '', class: 'pv-logo pv-logo-footer' }) : h('span', { class: 'pv-monogram', 'aria-hidden': 'true' }, initials(name)), h('span', null, name)),
        h('p', null, tagline)),
      h('div', null, h('h3', null, 'Explore'), h('ul', null, nav.map(([href, label]) => h('li', null, h('a', { href: '#' + href }, label))))),
      h('div', null, h('h3', null, 'Information'), h('ul', null, legal.map(l => h('li', null, h('a', { href: '#top', onclick: e => e.preventDefault() }, l)))))),
    h('div', { class: 'pv-wrap pv-footer-bottom' },
      h('span', null, `© ${new Date().getFullYear()} ${pick(p.official_name, name)}. All rights reserved.`),
      h('span', null, 'Preview generated by Plyndi')));

  root.replaceChildren(header, h('main', null, hero, about, servicesSec, toursSec, destSec, whySec, teamSec, reviewSec, faqSec, contactSec), footer);
}

function section(id, kicker, title, lede, content, extra) {
  return h('section', { class: 'pv-section ' + (extra || ''), id, 'aria-labelledby': id + '-title' },
    h('div', { class: 'pv-wrap' },
      h('header', { class: 'pv-section-head' }, h('p', { class: 'pv-kicker' }, kicker), h('h2', { id: id + '-title' }, title), lede ? h('p', null, lede) : null),
      content));
}
function metaRow(pairs) {
  const ok = pairs.filter(Boolean);
  return ok.length ? h('ul', { class: 'pv-meta' }, ok.map(([k, v]) => h('li', null, new RegExp('^' + k + '\\b', 'i').test(v) ? null : [h('span', null, k), ' '], h('strong', null, v)))) : null;
}
function field(label, type) { return h('label', null, label, h('input', { type, disabled: true })); }

function tourCard(t, i, image, ctaText) {
  const name = pick(t.tour_name, `Tour ${i + 1}`);
  const detail = [
    ['Itinerary', t.itinerary], ["What's included", t.included], ["What's excluded", t.excluded], ['What to bring', t.what_to_bring],
    ['Meeting point', t.meeting_point], ['Departure', t.departure_time], ['Available', t.available_dates],
    ['Group size', [t.min_participants && `min ${t.min_participants}`, t.max_participants && `max ${t.max_participants}`].filter(Boolean).join(' · ')],
    ['Cancellation', t.cancellation_policy]
  ].filter(([, v]) => has(v));
  return h('article', { class: 'pv-tour' },
    h('div', { class: 'pv-tour-media' }, img(image, name, 'pv-tour-img', name),
      has(t.category) ? h('span', { class: 'pv-tag' }, t.category) : null,
      has(t.sale_price) ? h('span', { class: 'pv-tag pv-tag-sale' }, 'Offer') : null),
    h('div', { class: 'pv-tour-body' },
      has(t.destination) ? h('p', { class: 'pv-tour-dest' }, t.destination) : null,
      h('h3', null, name),
      h('p', null, short(pick(t.short_description, t.full_description, 'Tour description coming soon.'), 150)),
      h('div', { class: 'pv-tour-foot' },
        has(t.duration) ? h('span', { class: 'pv-tour-dur' }, t.duration) : h('span'),
        h('span', { class: 'pv-price' },
          has(t.sale_price) && has(t.price) ? h('s', null, t.price) : null, ' ',
          h('strong', null, pick(t.sale_price, t.price, 'Price on request')))),
      detail.length ? h('details', { class: 'pv-tour-more' }, h('summary', null, 'Tour details'),
        h('dl', null, detail.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
        h('a', { class: 'pv-btn pv-btn-primary pv-btn-sm', href: '#contact' }, ctaText)) : null));
}

/* Keep the client's sticky header just below the (variable-height) preview notice. */
const noticeEl = document.querySelector('.pv-notice');
const syncNotice = () => document.documentElement.style.setProperty('--notice-h', noticeEl.offsetHeight + 'px');
if (noticeEl) { syncNotice(); if ('ResizeObserver' in window) new ResizeObserver(syncNotice).observe(noticeEl); }
