/* =========================================================
   Plyndi — "Start Your Project" (public inquiry)
   Collects only an email and saves it through the existing
   client API (/api/client/inquiry). It never reveals the
   private client form — Plyndi reviews the request first and
   sends a personal link from the admin dashboard.
   ========================================================= */
import { api } from '/assets/client-system/client-api.js';

const dialog = document.getElementById('sp-dialog');
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const SERVICE = 'website';

if (dialog) init();

function init() {
  const steps = [...dialog.querySelectorAll('.sp-step')];
  const form = dialog.querySelector('[data-step="email"]');
  const input = document.getElementById('sp-email');
  const error = document.getElementById('sp-error');
  const submit = dialog.querySelector('[data-sp-submit]');
  let opener = null;
  let sending = false;

  const show = name => {
    steps.forEach(s => { s.hidden = s.dataset.step !== name; });
    const target = name === 'email' ? input : dialog.querySelector(`[data-step="${name}"] h2`);
    if (target) setTimeout(() => target.focus(), 30);
  };
  const setError = msg => {
    error.textContent = msg || '';
    error.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const open = e => {
    opener = e.currentTarget;
    form.reset(); setError('');
    show('intro');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  };
  const close = () => {
    if (sending) return;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  };

  document.querySelectorAll('[data-start-project]').forEach(btn => btn.addEventListener('click', open));
  dialog.querySelectorAll('[data-sp-close]').forEach(btn => btn.addEventListener('click', close));
  dialog.querySelector('[data-sp-continue]').addEventListener('click', () => show('email'));
  dialog.addEventListener('close', () => { if (opener) opener.focus(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });   // click on backdrop
  input.addEventListener('input', () => { if (!error.hidden) setError(''); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    const email = input.value.trim();
    if (!email) return setError('Please enter your email address.');
    if (email.length > 254 || !EMAIL_RE.test(email)) return setError('Please enter a valid email address, e.g. name@company.com.');

    sending = true;
    submit.disabled = true; submit.classList.add('is-loading'); submit.textContent = 'Sending…';
    try {
      const res = await api('/inquiry', {
        method: 'POST',
        body: { email, service: SERVICE, source_page: location.pathname, company_website: form.company_website.value }
      });
      const sent = dialog.querySelector('.sp-sent');
      sent.hidden = !res.confirmation_email;
      sent.textContent = res.confirmation_email ? `We’ve sent a confirmation to ${email}.` : '';
      show('done');
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts — please wait a minute and try again.'
        : err.status === 422 ? err.message
        : 'Something went wrong and your request was not sent. Please try again, or email contact@plyndi.com.');
    } finally {
      sending = false;
      submit.disabled = false; submit.classList.remove('is-loading'); submit.textContent = 'Request a Project Form';
    }
  });
}
