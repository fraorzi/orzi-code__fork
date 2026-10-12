const body = document.body;
const toast = document.querySelector("#toast");
const stateControl = document.querySelector("#state-control");
const send = document.querySelector("#send");
const menu = document.querySelector("#model-menu");
const modelControl = document.querySelector("#model-control");

function setWorking(working) {
  body.dataset.state = working ? "working" : "idle";
  stateControl.textContent = working ? "Pokaż spoczynek" : "Pokaż pracę agenta";
  send.setAttribute("aria-label", working ? "Zatrzymaj" : "Wyślij");
}

document.querySelectorAll("[data-look]").forEach((button) => {
  if (button === body) return;
  button.addEventListener("click", () => {
    body.dataset.look = button.dataset.look;
    document
      .querySelectorAll(".segmented button")
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
document.querySelector(".team").addEventListener("click", (event) => {
  const button = event.currentTarget;
  button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
});
modelControl.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  modelControl.setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  menu.hidden = true;
  modelControl.setAttribute("aria-expanded", "false");
});
document.querySelector("#undo").addEventListener("click", () => {
  document.querySelector(".file-row").style.opacity = ".4";
  document.querySelector("#undo").disabled = true;
  document.querySelector("#restore").disabled = false;
});
document.querySelector("#restore").addEventListener("click", () => {
  document.querySelector(".file-row").style.opacity = "1";
  document.querySelector("#undo").disabled = false;
});
