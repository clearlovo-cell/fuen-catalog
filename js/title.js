const TITLE_VISIT_KEY = "fuen-catalog:title-visited:v1";
const INTRO_DURATION = 2100;

const view = document.querySelector("#title-view");
const artwork = document.querySelector("#title-artwork");
const artworkImage = artwork?.querySelector("img");
const logo = document.querySelector("#title-logo-image");
const logoFallback = document.querySelector("#title-logo-fallback");
const skipButton = document.querySelector("#title-skip");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let introTimer;

export function hasTitleVisited() {
  try {
    return localStorage.getItem(TITLE_VISIT_KEY) === "1";
  } catch (error) {
    console.warn("标题页访问状态暂时无法读取", error);
    return false;
  }
}

export function markTitleVisited() {
  try {
    localStorage.setItem(TITLE_VISIT_KEY, "1");
  } catch (error) {
    console.warn("标题页访问状态暂时无法保存", error);
  }
}

function showArtwork() {
  if (artworkImage?.naturalWidth) artwork.hidden = false;
}

function showLogo() {
  if (!logo?.naturalWidth) return;
  logo.hidden = false;
  logoFallback.hidden = true;
}

artworkImage?.addEventListener("load", showArtwork);
artworkImage?.addEventListener("error", () => { artwork.hidden = true; });
logo?.addEventListener("load", showLogo);
logo?.addEventListener("error", () => {
  logo.hidden = true;
  logoFallback.hidden = false;
});
if (artworkImage?.complete) showArtwork();
if (logo?.complete) showLogo();

export function showTitleStatic() {
  clearTimeout(introTimer);
  document.body.classList.remove("is-title-booting");
  view?.classList.remove("is-booting");
  view?.classList.add("is-ready");
  if (skipButton) skipButton.hidden = true;
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
  skipButton.hidden = false;
  introTimer = window.setTimeout(showTitleStatic, INTRO_DURATION);
}

skipButton?.addEventListener("click", showTitleStatic);
view?.addEventListener("click", event => {
  if (!view.classList.contains("is-booting") || event.target.closest("a, button")) return;
  showTitleStatic();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && view?.classList.contains("is-booting")) showTitleStatic();
});
