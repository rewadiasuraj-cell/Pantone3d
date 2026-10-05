/* Pantone3D — shared page chrome (home + about): navigation, mobile menu,
 * footer contact details and the current year.
 */
import { CONTACT, hasContact } from './data.js';

export function initSite({ getLenis = () => null } = {}) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Contact details only appear when real ones are set in data.js.
  if (hasContact()) {
    $$('[data-contact]').forEach((el) => { el.hidden = false; });
    const list = $('[data-contact-list]');
    const add = (wrap, html) => { wrap.insertAdjacentHTML('beforeend', html); wrap.hidden = false; };
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (list) {
      if (CONTACT.email) add(list, `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>`);
      if (CONTACT.phone) add(list, `<a href="tel:${esc(CONTACT.phone.replace(/[^+\d]/g, ''))}">${esc(CONTACT.phone)}</a>`);
      if (CONTACT.address) add(list, `<p>${esc(CONTACT.address)}</p>`);
    }
    const social = $('[data-social-list]');
    if (social) {
      [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube']].forEach(([k, name]) => {
        if (CONTACT[k]) add(social, `<a href="${esc(CONTACT[k])}" target="_blank" rel="noopener">${name}</a>`);
      });
    }
  }

  // Mobile menu
  const nav = $('.nav');
  const menuBtn = $('.nav__menu');
  const menu = $('#menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    const lenis = getLenis();
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) menu.querySelector('a:not([hidden])').focus();
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  // Transparent over the hero, a soft blurred bar once the page has scrolled.
  const solid = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', solid, { passive: true });
  solid();

  // Current page
  const page = document.body.dataset.page;
  $$(`[data-nav="${page}"]`).forEach((a) => a.setAttribute('aria-current', 'page'));
  $$('.menu a').forEach((a) => { if (a.getAttribute('href') === `${page}.html`) a.setAttribute('aria-current', 'page'); });

  return { nav, menu, setMenu };
}
