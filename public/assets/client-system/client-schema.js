/* =========================================================
   Plyndi — Client Project Form schema (single source of truth)
   ---------------------------------------------------------
   Used by: client-form.js (renders the form + review),
            admin.js (renders the submission detail view),
            the API Worker (whitelists which keys may be saved).

   A copy of this file lives in plyndi-client-backend/worker/src/client-schema.js.
   If you edit one, copy it over the other (run `npm run sync-schema`
   in plyndi-client-backend/worker) so the server whitelist matches the form.

   Website field `key`s match the database column names exactly.
   App projects (APP_STEPS, further down) store their extra answers in
   client_projects.app_details.
   Contains NO secrets and NO client data — safe to be public.
   ========================================================= */

const DESIGN_STYLES = ['Modern', 'Luxury', 'Minimal', 'Professional', 'Elegant', 'Friendly', 'Adventurous', 'Premium', 'Other'];
const FONT_STYLES = ['Modern sans-serif', 'Classic serif', 'Elegant / luxury serif', 'Friendly / rounded', 'Bold / adventurous', 'Not sure — recommend one'];
const BOOKING_METHODS = ['Contact / inquiry only', 'Booking request', 'Online booking', 'Instant booking', 'Not decided yet'];
export const LOGO_STATUS = ['Yes — I’ll upload it here', 'No — I need one designed', 'It’s being made — I’ll send it later'];
const PAYMENT_METHODS = ['Credit / debit card', 'Bank transfer', 'PayPal', 'Cash', 'Other'];
const LANGUAGES = ['English', 'Traditional Chinese', 'Simplified Chinese', 'Japanese', 'Korean', 'Other'];
const FEATURES = ['Tour listing', 'Tour detail pages', 'Booking', 'Contact form', 'Blog', 'Reviews', 'FAQ', 'Destination pages', 'Gallery', 'Map', 'Newsletter', 'Customer login', 'Admin dashboard', 'Online payment', 'Other'];

const IMG = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/heic';
const DOCS = 'application/pdf,.doc,.docx,.ppt,.pptx,.txt';
const VIDEO = 'video/mp4,video/quicktime,video/webm';

/* Upload limits (keep in step with the storage bucket settings in schema.sql) */
export const UPLOAD_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,      // 50 MB per file (Supabase free-plan maximum)
  maxFilesPerInvite: 400,
  maxBytesPerInvite: 3 * 1024 * 1024 * 1024
};

/* Every file category the form can upload into, with what it accepts. */
export const FILE_CATEGORIES = {
  logo:               { label: 'Logo', accept: IMG + ',application/pdf', multiple: false },
  brand_guidelines:   { label: 'Brand guidelines', accept: IMG + ',' + DOCS, multiple: true },
  company_photos:     { label: 'Company photos', accept: IMG, multiple: true },
  tour_photos:        { label: 'Tour photos', accept: IMG, multiple: true },
  team_photos:        { label: 'Team photos', accept: IMG, multiple: true },
  destination_photos: { label: 'Destination photos', accept: IMG, multiple: true },
  videos:             { label: 'Videos', accept: VIDEO, multiple: true },
  brochures:          { label: 'Brochures', accept: IMG + ',' + DOCS, multiple: true },
  pdf_documents:      { label: 'PDF documents', accept: 'application/pdf', multiple: true },
  other_files:        { label: 'Other files', accept: IMG + ',' + DOCS + ',' + VIDEO + ',.zip', multiple: true },
  legal_privacy:      { label: 'Privacy Policy document', accept: DOCS, multiple: true },
  legal_terms:        { label: 'Terms & Conditions document', accept: DOCS, multiple: true },
  legal_cancellation: { label: 'Cancellation Policy document', accept: DOCS, multiple: true },
  legal_refund:       { label: 'Refund Policy document', accept: DOCS, multiple: true },
  legal_cookie:       { label: 'Cookie Policy document', accept: DOCS, multiple: true },
  legal_liability:    { label: 'Liability disclaimer document', accept: DOCS, multiple: true },
  legal_insurance:    { label: 'Travel insurance document', accept: DOCS, multiple: true },
  service_image:      { label: 'Service image', accept: IMG, multiple: false },
  tour_images:        { label: 'Tour images', accept: IMG, multiple: true },
  destination_image:  { label: 'Destination image', accept: IMG, multiple: false },
  team_photo:         { label: 'Photo', accept: IMG, multiple: false },
  review_photo:       { label: 'Customer photo', accept: IMG, multiple: false },
  // App projects
  app_references:     { label: 'Screenshots of apps you like', accept: IMG + ',application/pdf', multiple: true },
  app_wireframes:     { label: 'Sketches, wireframes or mockups', accept: IMG + ',' + DOCS + ',.zip', multiple: true }
};

/* ---------- Repeatable groups (each one is its own database table) ---------- */
export const LISTS = {
  services: {
    table: 'services', itemLabel: 'Service', addLabel: '+ Add Another Service', min: 0,
    titleKey: 'name',
    fields: [
      { key: 'name', label: 'Service name', type: 'text', placeholder: 'e.g. Private Tours' },
      { key: 'short_description', label: 'Short description', type: 'text', max: 300 },
      { key: 'detailed_description', label: 'Detailed description', type: 'textarea' },
      { key: 'starting_price', label: 'Starting price', type: 'text', placeholder: 'e.g. From NT$3,500 per person', half: true },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g. Full day (8 hours)', half: true },
      { key: 'image_file_ids', label: 'Image', type: 'file', category: 'service_image' },
      { key: 'additional_info', label: 'Additional information', type: 'textarea', rows: 2 }
    ]
  },
  tours: {
    table: 'tour_examples', itemLabel: 'Tour', addLabel: '+ Add Another Tour', min: 0,
    titleKey: 'tour_name',
    fields: [
      { key: 'tour_name', label: 'Tour name', type: 'text', placeholder: 'e.g. Taroko Gorge Day Trip' },
      { key: 'short_description', label: 'Short description', type: 'text', max: 300 },
      { key: 'full_description', label: 'Full description', type: 'textarea' },
      { key: 'destination', label: 'Destination', type: 'text', half: true },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Nature, Food, Culture', half: true },
      { key: 'price', label: 'Price', type: 'text', half: true },
      { key: 'sale_price', label: 'Sale price', type: 'text', half: true },
      { key: 'duration', label: 'Duration', type: 'text', half: true },
      { key: 'available_dates', label: 'Available dates', type: 'text', placeholder: 'e.g. Daily, or Tue/Thu/Sat', half: true },
      { key: 'departure_time', label: 'Departure time', type: 'text', half: true },
      { key: 'meeting_point', label: 'Meeting point', type: 'text', half: true },
      { key: 'end_point', label: 'End point', type: 'text', half: true },
      { key: 'max_participants', label: 'Maximum participants', type: 'text', inputmode: 'numeric', half: true },
      { key: 'min_participants', label: 'Minimum participants', type: 'text', inputmode: 'numeric', half: true },
      { key: 'itinerary', label: 'Itinerary', type: 'textarea', placeholder: '08:00 Pick-up at hotel\n10:30 Shakadang Trail\n…' },
      { key: 'included', label: "What's included", type: 'textarea', rows: 3 },
      { key: 'excluded', label: "What's excluded", type: 'textarea', rows: 3 },
      { key: 'what_to_bring', label: 'What to bring', type: 'textarea', rows: 2 },
      { key: 'age_restrictions', label: 'Age restrictions', type: 'text', half: true },
      { key: 'accessibility', label: 'Accessibility information', type: 'text', half: true },
      { key: 'cancellation_policy', label: 'Cancellation policy', type: 'textarea', rows: 2 },
      { key: 'refund_policy', label: 'Refund policy', type: 'textarea', rows: 2 },
      { key: 'weather_policy', label: 'Weather policy', type: 'textarea', rows: 2 },
      { key: 'image_file_ids', label: 'Tour images', type: 'file', category: 'tour_images' }
    ]
  },
  destinations: {
    table: 'destinations', itemLabel: 'Destination', addLabel: '+ Add Destination', min: 0,
    titleKey: 'name',
    fields: [
      { key: 'name', label: 'Destination name', type: 'text', placeholder: 'e.g. Taiwan' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'main_attractions', label: 'Main attractions', type: 'textarea', rows: 2 },
      { key: 'recommended_activities', label: 'Recommended activities', type: 'textarea', rows: 2 },
      { key: 'best_time_to_visit', label: 'Best time to visit', type: 'text', half: true },
      { key: 'travel_tips', label: 'Travel tips', type: 'text', half: true },
      { key: 'image_file_ids', label: 'Destination image', type: 'file', category: 'destination_image' }
    ]
  },
  team: {
    table: 'team_members', itemLabel: 'Team member', addLabel: '+ Add Team Member', min: 0,
    titleKey: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', half: true },
      { key: 'position', label: 'Position', type: 'text', placeholder: 'e.g. Senior Tour Guide', half: true },
      { key: 'photo_file_ids', label: 'Photo', type: 'file', category: 'team_photo' },
      { key: 'languages', label: 'Languages', type: 'text', placeholder: 'e.g. English, Mandarin, Japanese', half: true },
      { key: 'experience', label: 'Experience', type: 'text', placeholder: 'e.g. 8 years guiding in Taiwan', half: true },
      { key: 'biography', label: 'Biography', type: 'textarea' },
      { key: 'special_knowledge', label: 'Special knowledge', type: 'text' }
    ]
  },
  reviews: {
    table: 'reviews', itemLabel: 'Review', addLabel: '+ Add Review', min: 0,
    titleKey: 'customer_name',
    fields: [
      { key: 'platform', label: 'Review platform', type: 'text', placeholder: 'e.g. Google, TripAdvisor', half: true },
      { key: 'customer_name', label: 'Customer name', type: 'text', half: true },
      { key: 'review_text', label: 'Review text', type: 'textarea' },
      { key: 'review_url', label: 'Review URL', type: 'url' },
      { key: 'photo_file_ids', label: 'Customer photo', type: 'file', category: 'review_photo' }
    ]
  },
  faqs: {
    table: 'faqs', itemLabel: 'FAQ', addLabel: '+ Add FAQ', min: 0,
    titleKey: 'question',
    fields: [
      { key: 'question', label: 'Question', type: 'text' },
      { key: 'answer', label: 'Answer', type: 'textarea', rows: 3 }
    ]
  }
};

/* ---------- Steps ----------
   QUICK START (the 4 steps every client does, ~5 minutes) come first.
   Steps marked `optional: true` are "Add more details" sections the client
   can open from the Review page — or skip completely.
   group: label in the progress indicator (quick steps only).
   Items are fields (single values -> client_projects columns),
   { list: 'services', fields: [...] } (a repeater, optionally a subset of its fields),
   { files: 'category' } (an upload zone), or { heading: '…' } (display only).
   Each field key must appear in only one step. */
export const SCHEMA_VERSION = 2;
export const GROUPS = ['About you', 'Look & feel', 'Your business', 'Your website', 'Review', 'Submit'];

export const STYLE_SWATCHES = {
  Modern: ['#0F5E63', '#20C1C4'], Luxury: ['#1F2A44', '#C8A45C'], Minimal: ['#1E1E1E', '#8A8A8A'],
  Professional: ['#17406D', '#2BA3B5'], Elegant: ['#3E3A5C', '#C49A8A'], Friendly: ['#1F6F8B', '#F2A65A'],
  Adventurous: ['#24533A', '#E58E26'], Premium: ['#232B3A', '#B98B4E']
};

export const STEPS = [
  /* ================= QUICK START ================= */
  {
    id: 'about', group: 'About you', title: 'About your company', review: 'About you',
    intro: 'Just the basics. You can skip anything that isn’t marked *.',
    items: [
      { key: 'company_name', label: 'Company name', type: 'text', required: true, half: true, placeholder: 'e.g. WanderAsia' },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true, help: 'We use this to contact you about the project.' },
      { key: 'company_description', label: 'What does your company do?', type: 'textarea', rows: 3, required: true, help: 'One or two sentences is perfect — we’ll polish the wording for you.', placeholder: 'e.g. We run small-group and private tours around Taiwan, led by local guides.' },
      { key: 'phone', label: 'Phone / WhatsApp / LINE', type: 'text', half: true, placeholder: 'Whatever customers should use' },
      { key: 'city', label: 'City', type: 'text', half: true },
      { key: 'country', label: 'Country', type: 'text', required: true, half: true },
      { key: 'existing_links', label: 'Already online? Paste your links', type: 'textarea', rows: 2, help: 'Your current website, Facebook, Instagram or Google Maps page. We’ll collect your photos, reviews and details from there — so you don’t have to type them.', placeholder: 'https://…' }
    ]
  },
  {
    id: 'look', group: 'Look & feel', title: 'Look & feel', review: 'Look & feel',
    intro: 'Not sure? Leave it to us — we’ll suggest something that fits.',
    items: [
      { key: 'logo_status', label: 'Do you have a logo?', type: 'radio', options: LOGO_STATUS, required: true },
      { files: 'logo', help: 'Required if you answered “Yes” above. PNG or SVG with a transparent background is ideal.', requiredIf: { key: 'logo_status', equals: LOGO_STATUS[0] } },
      { key: 'design_styles', label: 'Which style feels like you?', type: 'checkboxes', options: DESIGN_STYLES, swatches: true, help: 'Pick one or two.' },
      { key: 'design_style_other', label: 'Describe your style', type: 'text', showIf: { key: 'design_styles', includes: 'Other' } },
      { key: 'primary_color', label: 'Main brand colour', type: 'color', help: 'Optional — leave empty and we’ll choose one that matches your style.' }
    ]
  },
  {
    id: 'business', group: 'Your business', title: 'What you offer', review: 'What you offer',
    intro: 'Add your main services or tours — two or three is plenty. Name, a short line and a price is all we need for now.',
    items: [
      { list: 'services', fields: ['name', 'short_description', 'starting_price', 'image_file_ids'] },
      { files: 'company_photos', label: 'Your photos', help: 'Drop in any photos you’d like on the website — tours, team, places. Select many at once.' },
      { files: 'brochures', label: 'Brochure or price list (optional)', help: 'Have a PDF brochure or price list? Upload it instead of typing everything out.' }
    ]
  },
  {
    id: 'website', group: 'Your website', title: 'Your new website', review: 'Your website',
    items: [
      { key: 'booking_method', label: 'What should visitors be able to do?', type: 'radio', options: BOOKING_METHODS, required: true },
      { key: 'website_features', label: 'Which features do you need?', type: 'checkboxes', options: FEATURES, help: 'Tick what you know you want — we’ll suggest the rest.' },
      { key: 'website_feature_other', label: 'Other feature(s)', type: 'text', showIf: { key: 'website_features', includes: 'Other' } },
      { key: 'website_languages', label: 'Website languages', type: 'checkboxes', options: LANGUAGES, required: true },
      { key: 'website_language_other', label: 'Other language(s)', type: 'text', showIf: { key: 'website_languages', includes: 'Other' } },
      { key: 'anything_else', label: 'Anything else we should know?', type: 'textarea', rows: 3, placeholder: 'Deadlines, ideas, websites you like…' }
    ]
  },

  /* ================= OPTIONAL — "Add more details" ================= */
  {
    id: 'company_more', optional: true, title: 'More about your company', review: 'More about your company',
    summary: 'Slogan, story, mission, address, opening hours, social media',
    intro: 'All optional. If you skip this, we’ll write a first draft for you to approve.',
    items: [
      { key: 'official_name', label: 'Official company name', type: 'text', half: true, placeholder: 'e.g. WanderAsia Travel Co., Ltd.' },
      { key: 'tagline', label: 'Slogan / tagline', type: 'text', half: true, placeholder: 'e.g. Explore Asia Differently', max: 160 },
      { key: 'year_established', label: 'Year established', type: 'year', half: true },
      { key: 'years_experience', label: 'Years of experience', type: 'text', inputmode: 'numeric', half: true },
      { key: 'founder_background', label: 'Your story / company background', type: 'textarea', rows: 3 },
      { key: 'mission', label: 'Mission', type: 'textarea', rows: 2, half: true },
      { key: 'vision', label: 'Vision', type: 'textarea', rows: 2, half: true },
      { key: 'company_values', label: 'Company values', type: 'textarea', rows: 2, help: 'One per line works well.' },
      { heading: 'Contact & location' },
      { key: 'office_address', label: 'Office address', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp', type: 'tel', half: true },
      { key: 'line_id', label: 'LINE', type: 'text', half: true, placeholder: 'LINE ID or link' },
      { key: 'business_hours', label: 'Business hours', type: 'text', placeholder: 'e.g. Mon–Fri 9:00–18:00' },
      { key: 'google_maps_url', label: 'Google Maps URL', type: 'url' },
      { heading: 'Social media' },
      { key: 'facebook_url', label: 'Facebook URL', type: 'url', half: true },
      { key: 'instagram_url', label: 'Instagram URL', type: 'url', half: true },
      { key: 'tiktok_url', label: 'TikTok URL', type: 'url', half: true },
      { key: 'youtube_url', label: 'YouTube URL', type: 'url', half: true },
      { key: 'other_social', label: 'Other social media', type: 'textarea', rows: 2 }
    ]
  },
  {
    id: 'brand_more', optional: true, title: 'Brand details', review: 'Brand details',
    summary: 'Second colour, fonts, brand guidelines, websites you like',
    items: [
      { key: 'brand_colors', label: 'Brand colours', type: 'text', placeholder: 'e.g. Deep teal, sand, white — or hex codes' },
      { key: 'secondary_color', label: 'Second colour', type: 'color', half: true },
      { key: 'font_style', label: 'Preferred font style', type: 'select', options: FONT_STYLES, half: true },
      { files: 'brand_guidelines' },
      { key: 'websites_like', label: 'Websites you like', type: 'textarea', rows: 3, help: 'Paste links and tell us what you like about each.' },
      { key: 'websites_dislike', label: 'Websites you do not like', type: 'textarea', rows: 2 },
      { key: 'design_notes', label: 'Additional design notes', type: 'textarea', rows: 2 }
    ]
  },
  {
    id: 'business_more', optional: true, title: 'Customers & what makes you different', review: 'Customers & strengths',
    summary: 'Target customers, selling points, competitors',
    items: [
      { key: 'business_type', label: 'Main business type', type: 'text', placeholder: 'e.g. Inbound tour operator, travel agency' },
      { key: 'company_introduction', label: 'Longer company introduction', type: 'textarea', rows: 3 },
      { key: 'target_customers', label: 'Main target customers', type: 'textarea', rows: 2, half: true },
      { key: 'customer_age_range', label: 'Customer age range', type: 'text', placeholder: 'e.g. 25–55', half: true },
      { key: 'customer_countries', label: 'Main customer countries', type: 'text', half: true },
      { key: 'customer_languages', label: 'Main customer languages', type: 'text', half: true },
      { key: 'main_destinations', label: 'Main destinations', type: 'text' },
      { key: 'selling_points', label: 'Main selling points', type: 'textarea', rows: 3, help: 'One per line — these become the “Why choose us” highlights.' },
      { key: 'differentiator', label: 'What makes you different?', type: 'textarea', rows: 2 },
      { key: 'why_choose_us', label: 'Why should customers choose you?', type: 'textarea', rows: 2 },
      { key: 'competitors', label: 'Main competitors', type: 'textarea', rows: 2, half: true },
      { key: 'competitor_urls', label: 'Competitor website URLs', type: 'textarea', rows: 2, half: true },
      { key: 'important_services', label: 'Most important services', type: 'textarea', rows: 2 },
      { key: 'profitable_services', label: 'Most profitable services', type: 'textarea', rows: 2, half: true },
      { key: 'promote_services', label: 'Services to promote more', type: 'textarea', rows: 2, half: true }
    ]
  },
  {
    id: 'tours', optional: true, title: 'Tour package examples', review: 'Tours',
    summary: 'Example tours with itinerary, inclusions and policies',
    intro: 'Add one or two example tours so we understand how your tours are structured.',
    notice: 'This is only for examples. After the website is launched, your team will be able to manage tour packages directly from the website administration system.',
    items: [{ list: 'tours' }]
  },
  {
    id: 'booking_more', optional: true, title: 'Booking & payment details', review: 'Booking & payment',
    summary: 'Payment methods, deposits, cancellation and refunds',
    items: [
      { key: 'payment_methods', label: 'Payment methods', type: 'checkboxes', options: PAYMENT_METHODS },
      { key: 'payment_method_other', label: 'Other payment method', type: 'text', showIf: { key: 'payment_methods', includes: 'Other' } },
      { key: 'current_booking_system', label: 'Current booking system', type: 'text', half: true, placeholder: 'e.g. Bókun, FareHarbor, none' },
      { key: 'current_payment_gateway', label: 'Current payment gateway', type: 'text', half: true, placeholder: 'e.g. Stripe, ECPay, none' },
      { key: 'deposit_required', label: 'Deposit required?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'deposit_details', label: 'Deposit details', type: 'text', placeholder: 'e.g. 30% at booking', showIf: { key: 'deposit_required', equals: 'Yes' } },
      { key: 'booking_cancellation_policy', label: 'Cancellation policy', type: 'textarea', rows: 2 },
      { key: 'booking_refund_policy', label: 'Refund policy', type: 'textarea', rows: 2 },
      { key: 'confirmation_method', label: 'Booking confirmation method', type: 'text', placeholder: 'e.g. Email within 24 hours, WhatsApp' },
      { key: 'special_booking_requirements', label: 'Special booking requirements', type: 'textarea', rows: 2 }
    ]
  },
  {
    id: 'destinations', optional: true, title: 'Destinations', review: 'Destinations',
    summary: 'Places you want featured on the website',
    items: [{ list: 'destinations' }]
  },
  {
    id: 'team', optional: true, title: 'Team / tour guides', review: 'Team',
    summary: 'The people behind your trips',
    items: [{ list: 'team' }]
  },
  {
    id: 'reviews', optional: true, title: 'Customer reviews', review: 'Reviews',
    summary: 'A few real reviews — or we’ll take them from your Google page',
    items: [{ list: 'reviews' }]
  },
  {
    id: 'faq', optional: true, title: 'Frequently asked questions', review: 'FAQ',
    summary: 'Questions customers often ask you',
    items: [{ list: 'faqs' }]
  },
  {
    id: 'media', optional: true, title: 'More photos, videos & documents', review: 'Media',
    summary: 'Tour, team and destination photos, videos, PDFs',
    items: [
      { files: 'tour_photos' },
      { files: 'team_photos' },
      { files: 'destination_photos' },
      { files: 'videos', help: 'Up to 50 MB per file. For longer videos, paste a link below.' },
      { key: 'video_links', label: 'Video links (YouTube, Google Drive, Dropbox…)', type: 'textarea', rows: 2 },
      { files: 'pdf_documents' },
      { files: 'other_files' }
    ]
  },
  {
    id: 'legal', optional: true, title: 'Policies & legal', review: 'Legal',
    summary: 'Privacy, terms, cancellation — or we’ll prepare standard templates',
    intro: 'Paste the text or upload a document. Skip this if you’d like us to prepare standard templates for you to review.',
    items: [
      { key: 'privacy_policy', label: 'Privacy Policy', type: 'textarea', rows: 3 }, { files: 'legal_privacy', compact: true },
      { key: 'terms_conditions', label: 'Terms & Conditions', type: 'textarea', rows: 3 }, { files: 'legal_terms', compact: true },
      { key: 'legal_cancellation_policy', label: 'Cancellation Policy', type: 'textarea', rows: 3 }, { files: 'legal_cancellation', compact: true },
      { key: 'legal_refund_policy', label: 'Refund Policy', type: 'textarea', rows: 3 }, { files: 'legal_refund', compact: true },
      { key: 'cookie_policy', label: 'Cookie Policy', type: 'textarea', rows: 3 }, { files: 'legal_cookie', compact: true },
      { key: 'liability_disclaimer', label: 'Liability disclaimer', type: 'textarea', rows: 3 }, { files: 'legal_liability', compact: true },
      { key: 'travel_insurance', label: 'Travel insurance information', type: 'textarea', rows: 3 }, { files: 'legal_insurance', compact: true }
    ]
  },
  {
    id: 'goals', optional: true, title: 'Goals for the website', review: 'Goals',
    summary: 'What success looks like for you',
    items: [
      { key: 'main_goal', label: 'What is the most important goal of your new website?', type: 'textarea', rows: 2 },
      { key: 'visitor_first_action', label: 'What should visitors do first?', type: 'textarea', rows: 2 },
      { key: 'most_important_feature', label: 'What is the most important feature?', type: 'textarea', rows: 2 },
      { key: 'success_definition', label: 'What would make this website successful for you?', type: 'textarea', rows: 2 },
      { key: 'additional_requirements', label: 'Other requirements', type: 'textarea', rows: 2 }
    ]
  }
];
export const QUICK_STEP_COUNT = STEPS.filter(s => !s.optional).length;

/* ---------- Derived helpers ---------- */
export const FIELDS = STEPS.flatMap(s => s.items.filter(i => i.key));
export const FIELD_KEYS = [...new Set(FIELDS.map(f => f.key))];
export const ARRAY_FIELD_KEYS = FIELDS.filter(f => f.type === 'checkboxes').map(f => f.key);
export const REQUIRED_KEYS = FIELDS.filter(f => f.required).map(f => f.key);
export const URL_FIELD_KEYS = FIELDS.filter(f => f.type === 'url').map(f => f.key);

export function emptyState(lists = LISTS) {
  return {
    version: 1,
    fields: {},
    files: {},                                  // category -> [{id,name,size,type}]
    lists: Object.fromEntries(Object.keys(lists).map(k => [k, []]))
  };
}

export function isFilled(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

export function isVisible(item, fields) {
  if (!item.showIf) return true;
  const v = fields[item.showIf.key];
  if (item.showIf.includes) return Array.isArray(v) && v.includes(item.showIf.includes);
  if (item.showIf.equals) return v === item.showIf.equals;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function validateField(f, v) {
  if (f.required && !isFilled(v)) return `${f.label} is required.`;
  if (!isFilled(v)) return '';
  const s = String(v).trim();
  if (f.type === 'email' && !EMAIL_RE.test(s)) return 'Please enter a valid email address, e.g. name@company.com.';
  if (f.type === 'url' && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s)) return 'Please enter a full web address starting with https://';
  if (f.type === 'year') {
    const n = Number(s), max = new Date().getFullYear();
    if (!/^\d{4}$/.test(s) || n < 1800 || n > max) return `Please enter a year between 1800 and ${max}.`;
  }
  if (f.type === 'color' && !/^#[0-9a-f]{6}$/i.test(s)) return 'Please pick a colour or enter a hex code like #20C1C4.';
  if (f.max && s.length > f.max) return `Please keep this under ${f.max} characters.`;
  return '';
}

/* Returns [{stepIndex, key, message}] for everything blocking submission. */
export function validateAll(state, steps = STEPS, lists = LISTS) {
  const LISTS = lists;
  const errors = [];
  steps.forEach((step, stepIndex) => {
    step.items.forEach(item => {
      if (!item.key || !isVisible(item, state.fields)) return;
      const msg = validateField(item, state.fields[item.key]);
      if (msg) errors.push({ stepIndex, key: item.key, message: msg });
    });
    step.items.filter(i => i.files && i.requiredIf).forEach(item => {
      const need = state.fields[item.requiredIf.key] === item.requiredIf.equals;
      const files = (state.files && state.files[item.files]) || [];
      if (need && !files.length) errors.push({ stepIndex, key: 'files.' + item.files, message: `Please upload your ${FILE_CATEGORIES[item.files].label.toLowerCase()}, or change your answer to “Do you have a logo?”.` });
    });
    step.items.filter(i => i.list).forEach(({ list }) => {
      (state.lists[list] || []).forEach((row, rowIndex) => {
        LISTS[list].fields.forEach(f => {
          const msg = validateField(f, row[f.key]);
          if (msg) errors.push({ stepIndex, key: `${list}.${rowIndex}.${f.key}`, message: `${LISTS[list].itemLabel} ${rowIndex + 1}: ${msg}` });
        });
      });
    });
  });
  return errors;
}

/* =========================================================
   APP PROJECTS
   ---------------------------------------------------------
   Used when the private link was created as an "App" link
   (client_invites.project_type = 'app'). Website links keep
   using STEPS / LISTS above, unchanged.

   Storage: keys that are also website columns (company_name,
   email, phone, country, company_description, logo_status,
   primary_color, anything_else) go to client_projects columns;
   every other app answer is kept in client_projects.app_details
   (jsonb) as { fields: {...}, lists: { app_features: [...] } }.
   ========================================================= */
const APP_PLATFORMS = ['iOS (iPhone / iPad)', 'Android', 'Web app (runs in the browser)', 'Not sure — recommend one'];
const APP_BUILD_TYPES = ['A new app from scratch', 'Improve or rebuild an existing app'];
const APP_LOGIN = ['Email & password', 'Sign in with Google', 'Sign in with Apple', 'Phone number (SMS code)', 'No login needed', 'Not sure'];
const APP_PAYMENTS = ['No payments', 'One-time purchases', 'Subscriptions', 'Both', 'Not sure'];
// Budget ranges — edit freely; the server accepts whatever is listed here.
const APP_BUDGETS = ['Under US$1,000', 'US$1,000 – 3,000', 'US$3,000 – 8,000', 'US$8,000 – 20,000', 'US$20,000 +', 'Not sure yet'];
const APP_YES_NO = ['Yes', 'No', 'Not sure'];
const APP_EXTRA_FEATURES = ['Push notifications', 'Maps & location', 'Chat / messaging', 'Booking / scheduling', 'Photo & file upload',
  'Camera / QR scanning', 'Works offline', 'Calendar sync', 'Social sharing', 'Reviews & ratings', 'Other'];
const APP_STORE_ACCOUNTS = ['I have both (Apple & Google Play)', 'Apple Developer only', 'Google Play only', 'Neither — I need help setting them up', 'Not needed (web app)'];
const APP_CONTENT = ['I’ll provide the text and images', 'I need help with content', 'A mix of both'];
const APP_PRIVACY = ['I already have one', 'I need one', 'Not sure'];
const APP_PRIORITIES = ['Must have', 'Should have', 'Nice to have'];

export const APP_LISTS = {
  app_features: {
    table: null, itemLabel: 'Feature', addLabel: '+ Add Another Feature', min: 0,
    titleKey: 'name',
    fields: [
      { key: 'name', label: 'Feature', type: 'text', placeholder: 'e.g. Book a tour', max: 200 },
      { key: 'priority', label: 'Priority', type: 'select', options: APP_PRIORITIES, half: true },
      { key: 'description', label: 'What should it do?', type: 'textarea', rows: 2, placeholder: 'e.g. Customers pick a date, pay a deposit and get a confirmation.' }
    ]
  }
};

export const APP_GROUPS = ['About you', 'Your app idea', 'Features', 'Budget & timeline', 'Review', 'Submit'];

export const APP_STEPS = [
  /* ================= QUICK START ================= */
  {
    id: 'app_about', group: 'About you', title: 'About you', review: 'About you',
    intro: 'Just the basics. You can skip anything that isn’t marked *.',
    items: [
      { key: 'company_name', label: 'Company or project name', type: 'text', required: true, half: true, placeholder: 'e.g. WanderAsia' },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true, help: 'We use this to contact you about the project.' },
      { key: 'company_description', label: 'What does your business do?', type: 'textarea', rows: 2, required: true, placeholder: 'e.g. We run small-group tours around Taiwan.' },
      { key: 'phone', label: 'Phone / WhatsApp / LINE', type: 'text', half: true },
      { key: 'country', label: 'Country', type: 'text', required: true, half: true }
    ]
  },
  {
    id: 'app_idea', group: 'Your app idea', title: 'Your app idea', review: 'App idea',
    intro: 'Plain words are perfect — no technical language needed.',
    items: [
      { key: 'app_name', label: 'App name (a working title is fine)', type: 'text', half: true, max: 120 },
      { key: 'app_summary', label: 'Describe the app in one or two sentences', type: 'textarea', rows: 2, required: true, max: 600,
        placeholder: 'e.g. An app where our customers can book tours, pay a deposit and chat with their guide.' },
      { key: 'app_problem', label: 'What problem does it solve?', type: 'textarea', rows: 2 },
      { key: 'app_target_users', label: 'Who will use it?', type: 'textarea', rows: 2, help: 'Customers, your own team, or both? Roughly how many?' },
      { key: 'app_similar_apps', label: 'Apps you like (or that are similar)', type: 'textarea', rows: 2, help: 'App names or store links, and what you like about them.' }
    ]
  },
  {
    id: 'app_features', group: 'Features', title: 'Platforms & features', review: 'Platforms & features',
    intro: 'List the features you know you need. We’ll help you decide what goes into the first version.',
    items: [
      { key: 'app_platforms', label: 'Where should the app run?', type: 'checkboxes', options: APP_PLATFORMS, required: true },
      { key: 'app_build_type', label: 'Is this a new app?', type: 'radio', options: APP_BUILD_TYPES },
      { key: 'app_existing_links', label: 'Links to your current app', type: 'textarea', rows: 2, help: 'App Store / Google Play links, and what it’s built with if you know.',
        showIf: { key: 'app_build_type', equals: APP_BUILD_TYPES[1] } },
      { list: 'app_features', fields: ['name', 'priority'] },
      { key: 'app_login_methods', label: 'How should users sign in?', type: 'checkboxes', options: APP_LOGIN },
      { key: 'app_payments', label: 'Will people pay inside the app?', type: 'radio', options: APP_PAYMENTS },
      { key: 'app_ai_features', label: 'Any AI features?', type: 'textarea', rows: 2, placeholder: 'e.g. A chat assistant that answers questions about our tours. Leave empty if none.' }
    ]
  },
  {
    id: 'app_budget', group: 'Budget & timeline', title: 'Budget & timeline', review: 'Budget & timeline',
    intro: 'A rough range helps us suggest the right first version. It’s not a commitment.',
    items: [
      { key: 'app_budget', label: 'Budget range (US dollars)', type: 'select', options: APP_BUDGETS, required: true, half: true,
        help: 'A rough figure is fine. Prefer to talk in your own currency? Add it under “Anything else”.' },
      { key: 'app_launch_date', label: 'When would you like to launch?', type: 'text', half: true, placeholder: 'e.g. March 2027' },
      { key: 'app_deadline_reason', label: 'Is there a fixed deadline? Why?', type: 'text', placeholder: 'e.g. Must be ready for our summer season' },
      { key: 'app_maintenance', label: 'Would you like ongoing support after launch?', type: 'radio', options: APP_YES_NO },
      { key: 'anything_else', label: 'Anything else we should know?', type: 'textarea', rows: 3 }
    ]
  },

  /* ================= OPTIONAL — "Add more details" ================= */
  {
    id: 'app_users', optional: true, title: 'Users, roles & admin', review: 'Users & admin',
    summary: 'User types, admin dashboard, existing data',
    items: [
      { key: 'app_user_roles', label: 'Types of users', type: 'textarea', rows: 2, help: 'e.g. Customers, guides, managers — and what each can do.' },
      { key: 'app_admin_needed', label: 'Do you need an admin dashboard?', type: 'radio', options: APP_YES_NO },
      { key: 'app_admin_manage', label: 'What should your team manage there?', type: 'textarea', rows: 2, placeholder: 'e.g. Bookings, users, content, orders' },
      { key: 'app_existing_data', label: 'Existing data to bring in', type: 'textarea', rows: 2, help: 'Customer lists, products, spreadsheets, another system…' },
      { key: 'app_analytics', label: 'What would you like to measure?', type: 'textarea', rows: 2, placeholder: 'e.g. Downloads, bookings per week, active users' }
    ]
  },
  {
    id: 'app_more_features', optional: true, title: 'More features & integrations', review: 'More features',
    summary: 'Notifications, maps, chat, languages, other services',
    items: [
      { key: 'app_extra_features', label: 'Which of these do you need?', type: 'checkboxes', options: APP_EXTRA_FEATURES },
      { key: 'app_extra_other', label: 'Other feature(s)', type: 'text', showIf: { key: 'app_extra_features', includes: 'Other' } },
      { key: 'app_integrations', label: 'Services it should connect to', type: 'textarea', rows: 2, placeholder: 'e.g. Stripe, Google Calendar, LINE, our booking system' },
      { key: 'app_languages', label: 'App languages', type: 'checkboxes', options: LANGUAGES },
      { key: 'app_language_other', label: 'Other language(s)', type: 'text', showIf: { key: 'app_languages', includes: 'Other' } }
    ]
  },
  {
    id: 'app_design', optional: true, title: 'Look & feel', review: 'Look & feel',
    summary: 'Logo, colours, style, screenshots, sketches',
    intro: 'Not sure? Leave it to us — we’ll suggest something that fits.',
    items: [
      { key: 'logo_status', label: 'Do you have a logo?', type: 'radio', options: LOGO_STATUS },
      { files: 'logo', help: 'PNG or SVG with a transparent background is ideal.', requiredIf: { key: 'logo_status', equals: LOGO_STATUS[0] } },
      { key: 'primary_color', label: 'Main brand colour', type: 'color', half: true },
      { key: 'app_style', label: 'Which style feels like you?', type: 'checkboxes', options: DESIGN_STYLES, swatches: true },
      { key: 'app_design_notes', label: 'Design notes', type: 'textarea', rows: 2, placeholder: 'Apps whose look you like, things to avoid…' },
      { files: 'app_references' },
      { files: 'app_wireframes', help: 'Photos of paper sketches are welcome.' }
    ]
  },
  {
    id: 'app_launch', optional: true, title: 'Content & launch', review: 'Content & launch',
    summary: 'App Store accounts, content, privacy policy',
    items: [
      { key: 'app_store_accounts', label: 'App Store / Google Play developer accounts', type: 'radio', options: APP_STORE_ACCOUNTS },
      { key: 'app_content', label: 'Who provides the text and images?', type: 'radio', options: APP_CONTENT },
      { key: 'app_privacy_policy', label: 'Privacy policy', type: 'radio', options: APP_PRIVACY, help: 'Both app stores require one.' }
    ]
  }
];

/* ---------- One object per project type ---------- */
function buildSchema(type, steps, lists, groups, version) {
  const fields = steps.flatMap(s => s.items.filter(i => i.key));
  const S = {
    type, STEPS: steps, LISTS: lists, GROUPS: groups, SCHEMA_VERSION: version,
    FILE_CATEGORIES, UPLOAD_LIMITS, STYLE_SWATCHES, LOGO_STATUS,
    QUICK_STEP_COUNT: steps.filter(s => !s.optional).length,
    FIELDS: fields,
    FIELD_KEYS: [...new Set(fields.map(f => f.key))],
    ARRAY_FIELD_KEYS: fields.filter(f => f.type === 'checkboxes').map(f => f.key),
    REQUIRED_KEYS: fields.filter(f => f.required).map(f => f.key),
    URL_FIELD_KEYS: fields.filter(f => f.type === 'url').map(f => f.key),
    isFilled, isVisible, validateField,
    emptyState: () => emptyState(lists),
    validateAll: state => validateAll(state, steps, lists)
  };
  return Object.freeze(S);
}

export const PROJECT_TYPES = ['website', 'app'];
export const PROJECT_TYPE_LABELS = { website: 'Website', app: 'App' };
export const SCHEMAS = {
  website: buildSchema('website', STEPS, LISTS, GROUPS, SCHEMA_VERSION),
  app: buildSchema('app', APP_STEPS, APP_LISTS, APP_GROUPS, 1)
};
/* Unknown or missing type (e.g. an older API) → website, which is how every link worked before. */
export function schemaFor(type) { return SCHEMAS[type] || SCHEMAS.website; }
/* Website answer keys are real client_projects columns; anything else from an app form goes to app_details. */
export const COLUMN_KEYS = SCHEMAS.website.FIELD_KEYS;
