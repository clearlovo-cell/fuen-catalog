const VISITOR_ID_KEY = "fuen-catalog:visitor-id:v1";
const EXPORT_SCALE = 2;
const MAX_CANVAS_AREA = 16000000;
const MAX_CANVAS_DIMENSION = 12000;
const HTML2CANVAS_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

const grid = document.querySelector("#goods-grid");
const startButton = document.querySelector("[data-screenshot-start]");
const visitorIdInput = document.querySelector("#visitor-id");
const toolbar = document.querySelector("#screenshot-toolbar");

if (grid && startButton && visitorIdInput && toolbar) {
  initialiseScreenshotFeature();
}

function initialiseScreenshotFeature() {
  const state = {
    selecting: false,
    exporting: false,
    cards: [],
    selected: new Set()
  };

  let toastTimer;
  let html2canvasPromise;

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3600);
  }

  function routeKind() {
    const route = document.body.dataset.route;
    if (route === "warehouse") return { label: "仓库" };
    if (route === "wishlist") return { label: "心愿单" };
    return null;
  }

  function currentCards() {
    return [...grid.querySelectorAll(".card[data-goods-id]")];
  }

  function updateStartButton() {
    startButton.disabled =
      state.exporting || !routeKind() || currentCards().length === 0;
  }

  function loadVisitorId() {
    try {
      visitorIdInput.value = localStorage.getItem(VISITOR_ID_KEY) || "";
    } catch (error) {
      console.warn("访客 ID 暂时无法读取", error);
    }
  }

  function saveVisitorId() {
    // 按用户看到的字符计数，避免 emoji 被拆成半个字符。
    const value = Array.from(visitorIdInput.value).slice(0, 16).join("");

    if (visitorIdInput.value !== value) {
      visitorIdInput.value = value;
    }

    try {
      localStorage.setItem(VISITOR_ID_KEY, value.trim());
    } catch (error) {
      console.warn("访客 ID 暂时无法保存", error);
      showToast("访客 ID 仅在本次页面中有效");
    }
  }

  function exportTitle() {
    const route = routeKind();
    const id = visitorIdInput.value.trim();
    return `${id ? `${id}的` : ""}${route?.label || "仓库"}`;
  }

  function cardName(card) {
    return card.querySelector(".card__title")?.textContent.trim() || "未命名制品";
  }

  function updateCard(card) {
    const id = card.dataset.goodsId;
    const selected = state.selected.has(id);

    card.setAttribute("aria-pressed", String(selected));
    card.setAttribute(
      "aria-label",
      `${selected ? "取消选择" : "选择"}${cardName(card)}`
    );
  }

  function updateToolbar() {
    const count = toolbar.querySelector("[data-screenshot-count]");
    const exportButton = toolbar.querySelector(
      '[data-screenshot-action="export"]'
    );

    count.textContent = `已选 ${state.selected.size} 件`;
    exportButton.textContent = state.exporting ? "生成中…" : "导出";
    exportButton.disabled = state.exporting || state.selected.size === 0;

    toolbar.querySelectorAll("button").forEach(button => {
      if (button !== exportButton) {
        button.disabled = state.exporting;
      }
    });
  }

  function setPageLocked(locked) {
    document
      .querySelectorAll(".filter-section, .series-section, #reverse-order")
      .forEach(element => {
        element.inert = locked;
      });
  }

  function decorateCards() {
    state.cards.forEach(card => {
      if (!card.querySelector(".screenshot-check")) {
        const check = document.createElement("span");
        check.className = "screenshot-check";
        check.setAttribute("aria-hidden", "true");
        card.append(check);
      }

      card.dataset.screenshotOriginalAria =
        card.getAttribute("aria-label") || "";

      updateCard(card);
    });
  }

  function enterSelection() {
    const cards = currentCards();

    if (!routeKind() || !cards.length || state.exporting) return;

    state.cards = cards;
    state.selected = new Set(
      cards.map(card => String(card.dataset.goodsId))
    );
    state.selecting = true;

    document.body.classList.add("is-screenshot-selecting");
    toolbar.hidden = false;

    setPageLocked(true);
    decorateCards();
    updateToolbar();

    toolbar.querySelector('[data-screenshot-action="export"]')?.focus();
  }

  function exitSelection({ restoreFocus = true } = {}) {
    if (!state.selecting) return;

    state.selecting = false;

    state.cards.forEach(card => {
      card.querySelector(".screenshot-check")?.remove();
      card.removeAttribute("aria-pressed");

      if (card.dataset.screenshotOriginalAria) {
        card.setAttribute(
          "aria-label",
          card.dataset.screenshotOriginalAria
        );
      }

      delete card.dataset.screenshotOriginalAria;
    });

    state.cards = [];
    state.selected.clear();

    document.body.classList.remove("is-screenshot-selecting");
    toolbar.hidden = true;

    setPageLocked(false);
    updateStartButton();

    if (
      restoreFocus &&
      startButton.isConnected &&
      !startButton.disabled
    ) {
      startButton.focus();
    }
  }

  function ensureHtml2Canvas() {
    if (window.html2canvas) {
      return Promise.resolve(window.html2canvas);
    }

    if (html2canvasPromise) return html2canvasPromise;

    html2canvasPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HTML2CANVAS_URL;

      script.onload = () => {
        if (window.html2canvas) {
          resolve(window.html2canvas);
        } else {
          reject(new Error("截图组件加载失败"));
        }
      };

      script.onerror = () => {
        reject(new Error("截图组件加载失败，请检查网络后重试"));
      };

      document.head.append(script);
    });

    return html2canvasPromise;
  }

  // 返回的宽高均为 CSS px，导出时再固定放大 2 倍。
  function chooseExportLayout(count) {
    if (count === 1) {
      return {
        width: 600,
        columns: 1,
        height: 770
      };
    }

    const width = 1000;
    const contentWidth = 920;
    const gap = 12;
    const fixedHeight = 188;
    const nameHeight = 43.5;

    let best = null;

    for (let columns = 1; columns <= 6; columns += 1) {
      const cardWidth =
        (contentWidth - gap * (columns - 1)) / columns;

      if (cardWidth < 140) continue;

      const rows = Math.ceil(count / columns);
      const cardHeight = cardWidth + nameHeight;

      const height =
        fixedHeight +
        rows * cardHeight +
        (rows - 1) * gap;

      const ratio = width / height;

      // 淘汰横向长方形。
      if (ratio > 1) continue;

      const remainder = count % columns;
      const fullness =
        remainder === 0 ? 1 : remainder / columns;

      const aspectScore =
        ratio >= 0.55 ? ratio : ratio * 0.7;

      const orphanPenalty =
        count > columns && remainder === 1 ? 0.2 : 0;

      const score =
        aspectScore * 0.75 +
        fullness * 0.25 -
        orphanPenalty;

      if (!best || score > best.score) {
        best = {
          width,
          columns,
          height,
          score
        };
      }
    }

    if (!best) {
      throw new Error("无法计算导出排版");
    }

    return best;
  }

  function maxCssHeight(width) {
    const byDimension =
      MAX_CANVAS_DIMENSION / EXPORT_SCALE;

    const byArea =
      MAX_CANVAS_AREA /
      (width * EXPORT_SCALE * EXPORT_SCALE);

    // 预留 4% 安全空间，覆盖边框和小数像素误差。
    return Math.floor(
      Math.min(byDimension, byArea) * 0.96
    );
  }

  function partitionCards(cards) {
    const batches = [];
    let start = 0;

    while (start < cards.length) {
      const remaining = cards.length - start;

      const fits = count => {
        const layout = chooseExportLayout(count);
        return layout.height <= maxCssHeight(layout.width);
      };

      if (fits(remaining)) {
        batches.push(cards.slice(start));
        break;
      }

      let low = 1;
      let high = remaining - 1;
      let best = 0;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);

        if (fits(middle)) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (!best) {
        throw new Error("单张图片超出浏览器导出能力");
      }

      // 多页尽量均分，避免最后一页只有零星几件。
      const pageCount = Math.ceil(remaining / best);
      const take = Math.ceil(remaining / pageCount);

      batches.push(cards.slice(start, start + take));
      start += take;
    }

    return batches;
  }

  function cleanCardForExport(original) {
    const card = original.cloneNode(true);

    card.removeAttribute("aria-pressed");
    card.removeAttribute("aria-label");
    card.setAttribute("tabindex", "-1");

    card
      .querySelectorAll(
        ".screenshot-check, .badge, .card__personal-badges, .card__size, .card__meta, .card__platform"
      )
      .forEach(element => element.remove());

    card.querySelectorAll("img").forEach(image => {
      const source = original.querySelector("img");
      const currentSource = source?.currentSrc || source?.src;

      if (currentSource) {
        image.src = currentSource;
      }

      image.removeAttribute("srcset");
      image.loading = "eager";
      image.decoding = "sync";
    });

    return card;
  }

  function fitExportText(element) {
    const characters = Array.from(element.textContent || "");
    element.textContent = characters.join("");
    if (element.scrollWidth <= element.clientWidth + 1) return;

    let low = 0;
    let high = characters.length - 1;

    while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    element.textContent = `${characters.slice(0, middle).join("")}…`;

    if (element.scrollWidth <= element.clientWidth + 1) low = middle;
    else high = middle - 1;
  }

  element.textContent = `${characters.slice(0, low).join("")}…`;
}
  
  function buildExportSheet(cards, title, layout) {
    const host = document.createElement("div");
    host.className = "screenshot-export-host";
    host.setAttribute("aria-hidden", "true");

    const sheet = document.createElement("section");

    sheet.className =
      `screenshot-export-sheet${
        cards.length === 1
          ? " screenshot-export-sheet--single"
          : ""
      }`;

    sheet.style.width = `${layout.width}px`;

    const header = document.createElement("header");
    header.className = "screenshot-export-header";

    const heading = document.createElement("h1");
    heading.textContent = title;

// 左右两段虚线夹住透明星星，不再用矩形色块遮住背景。
const rule = document.createElement("div");
rule.className = "screenshot-export-rule";
rule.setAttribute("aria-hidden", "true");

const leftRule = document.createElement("span");
const star = document.createElement("i");
star.textContent = "✦";
const rightRule = document.createElement("span");

rule.append(leftRule, star, rightRule);
header.append(heading, rule);

    const exportGrid = document.createElement("div");
    exportGrid.className = "screenshot-export-grid";
    exportGrid.style.setProperty(
      "--export-columns",
      String(layout.columns)
    );

    cards
      .map(cleanCardForExport)
      .forEach(card => exportGrid.append(card));

    sheet.append(header, exportGrid);
    host.append(sheet);
    document.body.append(host);
    fitExportText(heading);
    sheet.querySelectorAll(".card__title").forEach(fitExportText);
    return { host, sheet };
  }

  async function waitForImages(scope) {
    const images = [...scope.querySelectorAll("img")];

    await Promise.all(
      images.map(async image => {
        try {
          if (!image.complete) {
            await new Promise(resolve => {
              image.addEventListener("load", resolve, {
                once: true
              });
              image.addEventListener("error", resolve, {
                once: true
              });
            });
          }

          if (
            image.naturalWidth === 0 &&
            !image.dataset.exportFallback
          ) {
            image.dataset.exportFallback = "true";
            image.src = "./assets/img/placeholder.png";

            await new Promise(resolve => {
              image.addEventListener("load", resolve, {
                once: true
              });
              image.addEventListener("error", resolve, {
                once: true
              });
            });
          }

          if (image.naturalWidth > 0) {
            await image.decode().catch(() => {});
          }
        } catch (error) {
          console.warn(
            "一张卡片图片未能完整加载，将使用兜底图",
            error
          );
        }
      })
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  }

  async function renderBatch(cards, title) {
    const layout = chooseExportLayout(cards.length);

    const { host, sheet } = buildExportSheet(
      cards,
      title,
      layout
    );

    try {
      await waitForImages(sheet);

      const actualHeight = Math.ceil(
        sheet.getBoundingClientRect().height
      );

      if (
        actualHeight * EXPORT_SCALE >
        maxCssHeight(layout.width) * EXPORT_SCALE + 4
      ) {
        throw new Error(
          "自动拆图后图片仍然过高，请减少单次选择的制品"
        );
      }

      const html2canvas = await ensureHtml2Canvas();

      const canvas = await html2canvas(sheet, {
        backgroundColor: "#FDFCF7",
        scale: EXPORT_SCALE,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 20000,
        width: layout.width,
        height: actualHeight,
        windowWidth: layout.width,
        windowHeight: actualHeight
      });

      if (
        canvas.width > 2000 ||
        canvas.height > MAX_CANVAS_DIMENSION ||
        canvas.width * canvas.height >
          MAX_CANVAS_AREA + 100000
      ) {
        throw new Error("图片尺寸超出浏览器安全范围");
      }

      return canvas;
    } finally {
      host.remove();
    }
  }

  function localDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  async function downloadCanvas(canvas, filename) {
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error(
        "图片生成失败，可能是图片来源限制了导出"
      );
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  async function exportSelection() {
    const route = routeKind();

    if (!route || !state.selected.size || state.exporting) {
      return;
    }

    state.exporting = true;
    updateToolbar();
    updateStartButton();

    try {
      const cards = state.cards.filter(card =>
        state.selected.has(String(card.dataset.goodsId))
      );

      const batches = partitionCards(cards);
      const baseName = `${route.label}_${localDate()}`;

      for (let index = 0; index < batches.length; index += 1) {
        const canvas = await renderBatch(
          batches[index],
          exportTitle()
        );

        const suffix =
          batches.length > 1
            ? `_${String(index + 1).padStart(2, "0")}`
            : "";

        await downloadCanvas(
          canvas,
          `${baseName}${suffix}.png`
        );

        if (batches.length > 1) {
          await new Promise(resolve => {
            window.setTimeout(resolve, 250);
          });
        }
      }

      showToast(
        batches.length > 1
          ? `已导出 ${batches.length} 张图片，请允许浏览器下载多个文件`
          : "图片已导出"
      );

      exitSelection({ restoreFocus: false });
    } catch (error) {
      console.error("截图导出失败", error);
      showToast(error.message || "图片生成失败，请稍后重试");
    } finally {
      state.exporting = false;

      if (state.selecting) {
        updateToolbar();
      }

      updateStartButton();
    }
  }

  visitorIdInput.addEventListener("input", saveVisitorId);
  startButton.addEventListener("click", enterSelection);

  // 用捕获阶段拦截原卡片的“打开详情”点击行为。
  grid.addEventListener(
    "click",
    event => {
      if (!state.selecting) return;

      const card = event.target.closest(
        ".card[data-goods-id]"
      );

      if (!card) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const id = String(card.dataset.goodsId);

      if (state.selected.has(id)) {
        state.selected.delete(id);
      } else {
        state.selected.add(id);
      }

      updateCard(card);
      updateToolbar();
    },
    true
  );

  toolbar.addEventListener("click", event => {
    const button = event.target.closest(
      "[data-screenshot-action]"
    );

    if (!button || state.exporting) return;

    const action = button.dataset.screenshotAction;

    if (action === "all") {
      state.selected = new Set(
        state.cards.map(card => String(card.dataset.goodsId))
      );
    }

    if (action === "clear") {
      state.selected.clear();
    }

    if (action === "cancel") {
      exitSelection();
      return;
    }

    if (action === "export") {
      exportSelection();
      return;
    }

    state.cards.forEach(updateCard);
    updateToolbar();
  });

  document.addEventListener("keydown", event => {
    if (
      state.selecting &&
      !state.exporting &&
      event.key === "Escape"
    ) {
      event.preventDefault();
      exitSelection();
    }
  });

  window.addEventListener("hashchange", () => {
    exitSelection({ restoreFocus: false });
    window.setTimeout(updateStartButton, 0);
  });

  // 数据加载、筛选和排序会重绘列表，这里同步按钮状态。
  const observer = new MutationObserver(() => {
    if (
      state.selecting &&
      state.cards.some(card => !card.isConnected)
    ) {
      exitSelection({ restoreFocus: false });
    }

    updateStartButton();
  });

  observer.observe(grid, { childList: true });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-route"]
  });

  loadVisitorId();
  updateStartButton();
}
