const INTRO_DURATION = 4200;

const view = document.querySelector("#title-view");
const artwork = document.querySelector("#title-artwork");
const artworkImage = artwork?.querySelector("img");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let introTimer;

function showArtwork() {
  if (artworkImage?.naturalWidth) artwork.hidden = false;
}

artworkImage?.addEventListener("load", showArtwork);
artworkImage?.addEventListener("error", () => { artwork.hidden = true; });
if (artworkImage?.complete) showArtwork();

export function showTitleStatic() {
  clearTimeout(introTimer);
  document.body.classList.remove("is-title-booting");
  view?.classList.remove("is-booting");
  view?.classList.add("is-ready");
}

export function playTitleIntro() {
  clearTimeout(introTimer);
  if (!view || reducedMotion.matches) {
    showTitleStatic();
    return;
  }
  view.classList.remove("is-ready", "is-booting");
  void view.offsetWidth;
  view.classList.add("is-booting");
  document.body.classList.add("is-title-booting");
  introTimer = window.setTimeout(showTitleStatic, INTRO_DURATION);
}

view?.addEventListener("click", event => {
  if (!view.classList.contains("is-booting") || event.target.closest("a, button")) return;
  showTitleStatic();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && view?.classList.contains("is-booting")) showTitleStatic();
});
