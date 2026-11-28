const THEME_KEY = "fuen-catalog:theme:v1";
const THEME_COLORS = { light: "#FBF9F7", dark: "#2E2B2C" };
const root = document.documentElement;
const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
const mobileQuery = window.matchMedia("(max-width: 767px)");
const choices = document.querySelectorAll("[data-theme-choice]");
let preference = root.dataset.themePreference || "light";

function effectiveTheme() {
  return preference === "dark" || (preference === "system" && systemQuery.matches) ? "dark" : "light";
}

function syncArtwork() {
  const theme = effectiveTheme();
  document.querySelectorAll("#title-artwork source[data-artwork-theme]").forEach(source => {
    const themeMatches = source.dataset.artworkTheme === theme;
    const viewportMatches = source.dataset.viewport === "mobile" ? mobileQuery.matches : !mobileQuery.matches;
    source.media = themeMatches && viewportMatches ? "all" : "not all";
  });
}

function applyTheme() {
  const theme = effectiveTheme();
  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  document.querySelector("#theme-color")?.setAttribute("content", THEME_COLORS[theme]);
  choices.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === preference));
  });
  syncArtwork();
}

function setPreference(value, persist = true) {
  if (!["light", "dark", "system"].includes(value)) return;
  preference = value;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch (error) {
      console.warn("显示模式暂时无法保存", error);
    }
  }
  applyTheme();
}

choices.forEach(button => {
  button.addEventListener("click", () => setPreference(button.dataset.themeChoice));
});

systemQuery.addEventListener("change", () => {
  if (preference === "system") applyTheme();
});
mobileQuery.addEventListener("change", syncArtwork);
window.addEventListener("storage", event => {
  if (event.key !== THEME_KEY) return;
  setPreference(event.newValue || "light", false);
});
applyTheme();
