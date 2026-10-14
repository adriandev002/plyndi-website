# plyndi.com

The Plyndi website, built with [Astro](https://astro.build) and deployed to Cloudflare Workers.
Astro turns the files in `src/` into plain HTML in `dist/`; only `dist/` is published.

## Run it on your Mac

```bash
npm install        # first time only
npm run dev        # live preview at http://localhost:4321
npm run build      # build the real site into dist/
```

## Where things live

| You want to change…                         | Edit this                                   |
|---------------------------------------------|---------------------------------------------|
| The top menu (every page)                   | `src/data/nav.ts`                           |
| The header / footer (every page)            | `src/components/Header.astro`, `Footer.astro` |
| A page's text and layout                    | `src/page-content/<page>.html`              |
| A page's title, description, schema         | `src/page-content/<page>.head.html`         |
| CSS, images, JS, affiliate links            | `public/` (`style.css`, `assets/`, `config.js`) |
| Pages that stay as standalone HTML          | `public/client-form.html`, `public/client-preview.html`, `public/admin/` |

## Add a new page (e.g. a new guide)

1. Copy `src/page-content/blog-tokyo.html` and `blog-tokyo.head.html` to `blog-newcity.html` / `blog-newcity.head.html` and edit them.
2. Copy `src/pages/blog-tokyo.astro` to `src/pages/blog-newcity.astro` and change the two file names inside.
3. Link it from `blog.html`. The sitemap updates itself on build.

The URL is the file name: `src/pages/blog-newcity.astro` → `https://plyndi.com/blog-newcity.html`.

## Not part of the website

`plyndi-client-backend/` (the client-system Worker and Supabase schema) and `plyndi-cms.zip` stay in the repo but are never deployed.
