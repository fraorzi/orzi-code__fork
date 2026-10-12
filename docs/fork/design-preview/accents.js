const body = document.body;
const toast = document.querySelector("#toast");
const stateControl = document.querySelector("#state-control");
const send = document.querySelector("#send");
const menu = document.querySelector("#model-menu");
const modelControl = document.querySelector("#model-control");
const conversation = document.querySelector(".conversation");
const changeToggle = document.querySelector("#changes-toggle");
const changeList = document.querySelector("#change-list");
const fileEntries = [...document.querySelectorAll(".file-entry")];
let anchorAnimation = 0;

function setWorking(working) {
  body.dataset.state = working ? "working" : "idle";
  stateControl.textContent = working ? "Pokaż spoczynek" : "Pokaż pracę agenta";
  send.setAttribute("aria-label", working ? "Zatrzymaj" : "Wyślij");
}

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    body.dataset.look = button.dataset.look;
    document
      .querySelectorAll(".segmented button")
      .forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
  });
});
document.querySelectorAll(".palette-choice").forEach((button) => {
  button.addEventListener("click", () => {
    body.dataset.blue = button.dataset.blue;
    document
      .querySelectorAll(".palette-choice")
      .forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
  });
});
stateControl.addEventListener("click", () => setWorking(body.dataset.state !== "working"));
send.addEventListener("click", () => setWorking(body.dataset.state !== "working"));
document.querySelector("#toast-control").addEventListener("click", () => {
  toast.hidden = !toast.hidden;
});
document.querySelector("#toast-close").addEventListener("click", () => {
  toast.hidden = true;
});
document.querySelector("#toast-action").addEventListener("click", () => {
  toast.hidden = true;
});
document.querySelector(".team").addEventListener("click", (event) => {
  const button = event.currentTarget;
  button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
});
modelControl.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  modelControl.setAttribute("aria-expanded", String(!menu.hidden));
});

function setPanel(panel, open) {
  panel.dataset.open = String(open);
  panel.setAttribute("aria-hidden", String(!open));
  panel.inert = !open;
}
changeToggle.addEventListener("click", () => {
  const open = changeToggle.getAttribute("aria-expanded") !== "true";
  changeToggle.setAttribute("aria-expanded", String(open));
  changeToggle.querySelector(".review-label").textContent = open ? "Zwiń" : "Przejrzyj";
  setPanel(changeList, open);
});

function keepRowVisible(toggle, previousTop) {
  cancelAnimationFrame(anchorAnimation);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now();
  const compensate = () => {
    const displacement = toggle.getBoundingClientRect().top - previousTop;
    if (Math.abs(displacement) > 0.5) conversation.scrollTop += displacement;
    if (!reducedMotion && performance.now() - start < 180)
      anchorAnimation = requestAnimationFrame(compensate);
  };
  anchorAnimation = requestAnimationFrame(compensate);
}
conversation.addEventListener("wheel", () => cancelAnimationFrame(anchorAnimation), {
  passive: true,
});
conversation.addEventListener("touchstart", () => cancelAnimationFrame(anchorAnimation), {
  passive: true,
});
fileEntries.forEach((entry) => {
  const toggle = entry.querySelector(".file-toggle");
  toggle.addEventListener("click", () => {
    const previousTop = toggle.getBoundingClientRect().top;
    const open = toggle.getAttribute("aria-expanded") !== "true";
    fileEntries.forEach((other) => {
      const selected = other === entry && open;
      other.querySelector(".file-toggle").setAttribute("aria-expanded", String(selected));
      setPanel(other.querySelector(".file-diff"), selected);
    });
    keepRowVisible(toggle, previousTop);
  });
  entry.querySelector(".undo-file").addEventListener("click", () => {
    setReverted(entry, entry.dataset.reverted !== "true");
    updateRestoreState();
  });
});
function setReverted(entry, reverted) {
  entry.dataset.reverted = String(reverted);
  const button = entry.querySelector(".undo-file");
  const filename = entry.querySelector(".file-toggle>code").textContent;
  button.setAttribute("aria-label", `${reverted ? "Przywróć" : "Cofnij"} zmiany w ${filename}`);
  button.querySelector("use").setAttribute("href", reverted ? "#redo" : "#undo-icon");
  entry.querySelector(".open-file").disabled = reverted;
}
function updateRestoreState() {
  const allReverted = fileEntries.every((entry) => entry.dataset.reverted === "true");
  document.querySelector("#restore-state").hidden = !allReverted;
  document.querySelector("#undo").disabled = allReverted;
}
document.querySelector("#undo").addEventListener("click", () => {
  fileEntries.forEach((entry) => setReverted(entry, true));
  updateRestoreState();
});
document.querySelector("#restore").addEventListener("click", () => {
  fileEntries.forEach((entry) => setReverted(entry, false));
  updateRestoreState();
});

const tooltip = document.createElement("div");
tooltip.className = "demo-tooltip";
tooltip.id = "demo-tooltip";
tooltip.setAttribute("role", "tooltip");
tooltip.hidden = true;
body.append(tooltip);
let tooltipTimer;
let tooltipTarget;
function hideTooltip() {
  clearTimeout(tooltipTimer);
  tooltip.hidden = true;
  tooltipTarget?.removeAttribute("aria-describedby");
  tooltipTarget = undefined;
}
function showTooltip(button) {
  hideTooltip();
  tooltipTarget = button;
  tooltipTimer = setTimeout(() => {
    tooltip.textContent = button.getAttribute("aria-label");
    tooltip.hidden = false;
    button.setAttribute("aria-describedby", tooltip.id);
    const box = button.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, box.left + box.width / 2 - width / 2))}px`;
    tooltip.style.top = `${Math.max(8, box.top - tooltip.offsetHeight - 7)}px`;
  }, 180);
}
document.querySelectorAll("button[aria-label]").forEach((button) => {
  if (button.textContent.trim()) return;
  button.addEventListener("pointerenter", () => showTooltip(button));
  button.addEventListener("pointerleave", hideTooltip);
  button.addEventListener("focus", () => showTooltip(button));
  button.addEventListener("blur", hideTooltip);
  button.addEventListener("click", hideTooltip);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  hideTooltip();
  menu.hidden = true;
  modelControl.setAttribute("aria-expanded", "false");
});
