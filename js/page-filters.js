(function () {
  const list = document.querySelector("[data-filter-list]");
  if (!list) return;
  const items = Array.from(list.querySelectorAll("[data-state], [data-status], [data-year]"));
  const uniqueItems = Array.from(new Set(items));
  const fState = document.getElementById("f-state");
  const fYear = document.getElementById("f-year");
  const fStatus = document.getElementById("f-status");
  const countEl = document.getElementById("count");
  const total = uniqueItems.length;

  function render() {
    let n = 0;
    uniqueItems.forEach((el) => {
      const okState = !fState || !fState.value || el.getAttribute("data-state") === fState.value;
      const okYear = !fYear || !fYear.value || el.getAttribute("data-year") === fYear.value;
      const okStatus = !fStatus || !fStatus.value || el.getAttribute("data-status") === fStatus.value;
      const show = okState && okYear && okStatus;
      el.classList.toggle("is-hidden", !show);
      if (show) n += 1;
    });
    if (countEl) {
      const noun = list.classList.contains("comment-list") ? "comment periods" : "incidents";
      countEl.textContent = "Showing " + n + " of " + total + " " + noun + ".";
    }
  }

  [fState, fYear, fStatus].forEach((el) => {
    if (el) el.addEventListener("change", render);
  });
  render();
})();
