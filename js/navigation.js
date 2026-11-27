const toggle = document.querySelector("#menu-toggle");
const menu = document.querySelector("#mobile-menu");
const flash = document.querySelector("#page-flash");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastFocusedElement = null;
let flashTimer;

function focusableLinks() {
  return [...menu.querySelectorAll("a[href]")];
}

function closeMenu({ restoreFocus = true } = {}) {
  if (menu.hidden) return;
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "打开导航菜单");
  document.body.classList.remove("is-menu-open");
  if (restoreFocus && lastFocusedElement?.isConnected) lastFocusedElement.focus();
}

function openMenu() {
  lastFocusedElement = document.activeElement;
  menu.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "关闭导航菜单");
  document.body.classList.add("is-menu-open");
  requestAnimationFrame(() => focusableLinks()[0]?.focus());
}

function playPageFlash() {
  if (reducedMotion.matches) return;
  clearTimeout(flashTimer);
  flash.classList.remove("is-active");
  void flash.offsetWidth;
  flash.classList.add("is-active");
  flashTimer = window.setTimeout(() => flash.classList.remove("is-active"), 300);
}

toggle.addEventListener("click", () => {
  if (menu.hidden) openMenu();
  else closeMenu();
});
menu.addEventListener("click", event => {
  if (event.target === menu || event.target.closest("[data-route-link]")) closeMenu({ restoreFocus: false });
});
document.addEventListener("keydown", event => {
  if (menu.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [toggle, ...focusableLinks()];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
window.addEventListener("hashchange", () => {
  closeMenu({ restoreFocus: false });
  playPageFlash();
});
window.matchMedia("(min-width: 768px)").addEventListener("change", event => {
  if (event.matches) closeMenu({ restoreFocus: false });
});
