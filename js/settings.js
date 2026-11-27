import { escapeHtml } from "./render.js";

const siteCard = document.querySelector("#settings-site-card");
const contact = document.querySelector("#settings-contact");
const updatedAt = document.querySelector("#settings-updated-at");
const loading = document.querySelector("#settings-loading");
const errorState = document.querySelector("#settings-error");
const sectionsContainer = document.querySelector("#settings-sections");
let loaded = false;
let request = 0;

async function fetchJson(url) {
  const res = await fetch(`${url}?_=${Date.now()}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function text(value) {
  return escapeHtml(String(value || "")).replace(/\n/g, "<br>");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderSite(site, meta) {
  siteCard.querySelector(":scope > p").textContent = site.siteName || "FUEN ATLAS";
  siteCard.querySelector(":scope > strong").textContent = site.signature || "💜 CLEARLOVO";
  const email = String(site.email || "").trim();
  const xiaohongshu = safeExternalUrl(site.xiaohongshu);
  contact.innerHTML = [
    email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "",
    xiaohongshu ? `<a href="${escapeHtml(xiaohongshu)}" target="_blank" rel="noopener noreferrer">小红书</a>` : ""
  ].filter(Boolean).join("<span aria-hidden=\"true\"> · </span>");
  updatedAt.textContent = `数据更新日期：${meta?.updatedAt ? String(meta.updatedAt).slice(0, 10) : "暂无记录"}`;
  siteCard.querySelector(":scope > small").textContent = site.disclaimer || "本站仅供图鉴参考，图片版权归官方所有";
}

function renderSections(sections) {
  sectionsContainer.innerHTML = sections.map((section, sectionIndex) => {
    const isQa = section.kind === "qa";
    const entries = isQa ? section.qa : section.items;
    if (!Array.isArray(entries) || !entries.length) return "";
    const content = entries.map((entry, index) => isQa
      ? `<article class="settings-qa"><h3><span aria-hidden="true">Q</span>${text(entry.question)}</h3><p>${text(entry.answer)}</p></article>`
      : `<article class="settings-item"><h3><span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>${text(entry.title)}</h3><p>${text(entry.body)}</p></article>`
    ).join("");
    return `<details class="settings-section" data-section-index="${sectionIndex}"><summary>${text(section.title)}<span aria-hidden="true"></span></summary><div class="settings-section__content">${content}</div></details>`;
  }).join("");
}

export async function loadSettings({ force = false } = {}) {
  if (loaded && !force) return;
  const currentRequest = ++request;
  loading.hidden = false;
  errorState.hidden = true;
  try {
    const [site, guide, meta] = await Promise.all([
      fetchJson("./data/site.json"),
      fetchJson("./data/guide.json"),
      fetchJson("./data/meta.json").catch(() => null)
    ]);
    if (currentRequest !== request) return;
    renderSite(site, meta);
    renderSections(Array.isArray(guide.sections) ? guide.sections : []);
    loaded = true;
    loading.hidden = true;
  } catch (error) {
    if (currentRequest !== request) return;
    console.warn("设置内容加载失败", error);
    loading.hidden = true;
    errorState.hidden = false;
  }
}

document.querySelector("#settings-retry").addEventListener("click", () => loadSettings({ force: true }));
sectionsContainer.addEventListener("toggle", event => {
  const current = event.target;
  if (!(current instanceof HTMLDetailsElement) || !current.open) return;
  sectionsContainer.querySelectorAll("details[open]").forEach(section => {
    if (section !== current) section.open = false;
  });
}, true);
