const overlay = document.querySelector("#confirm-overlay");
const dialog = document.querySelector("#confirm-dialog");
const title = document.querySelector("#confirm-title");
const description = document.querySelector("#confirm-description");
const cancelButton = document.querySelector("#confirm-cancel");
const confirmButton = document.querySelector("#confirm-accept");
let resolveCurrent = null;
let lastFocusedElement = null;

function releaseBodyLock() {
  const openModal = document.querySelector("#profile-photo-overlay:not([hidden]), #clear-data-overlay:not([hidden])");
  if (!openModal) document.body.classList.remove("is-modal-open");
}

function closeConfirmation(value) {
  if (!resolveCurrent) return;
  overlay.hidden = true;
  releaseBodyLock();
  const resolve = resolveCurrent;
  resolveCurrent = null;
  if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  resolve(value);
}

export function confirmAction({ title: heading, description: message, confirmLabel = "确认", danger = false }) {
  if (resolveCurrent) closeConfirmation(false);
  lastFocusedElement = document.activeElement;
  title.textContent = heading;
  description.textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle("btn--danger", danger);
  overlay.hidden = false;
  document.body.classList.add("is-modal-open");
  requestAnimationFrame(() => cancelButton.focus());
  return new Promise(resolve => {
    resolveCurrent = resolve;
  });
}

cancelButton?.addEventListener("click", () => closeConfirmation(false));
confirmButton?.addEventListener("click", () => closeConfirmation(true));
overlay?.addEventListener("click", event => {
  if (event.target === overlay) closeConfirmation(false);
});

document.addEventListener("keydown", event => {
  if (overlay.hidden || !resolveCurrent) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeConfirmation(false);
  }
  if (event.key !== "Tab") return;
  event.preventDefault();
  const target = document.activeElement === cancelButton ? confirmButton : cancelButton;
  target.focus();
});
