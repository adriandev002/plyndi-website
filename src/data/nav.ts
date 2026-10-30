// Site navigation — edit this one file to change the menu on every page.
// App first (Oct 2026 audit): the app, then the guides that bring readers in, then the studio.
// "Studio" is the Services page (our work + Website / App Development); URL unchanged.
export const nav = [
  { key: 'home', label: 'Home', href: '/index.html' },
  { key: 'app', label: 'The App', href: '/app.html' },
  { key: 'guides', label: 'Travel Guides', href: '/blog.html' },
  { key: 'services', label: 'Studio', href: '/services/' },
  { key: 'about', label: 'About', href: '/about.html' },
  { key: 'contact', label: 'Contact', href: '/contact.html' },
];
export const navCta = { label: 'Join the launch list', href: '/index.html#join' };
