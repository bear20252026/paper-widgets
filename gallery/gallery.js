// The shelf and the workshop share this filter: search by text, and one category at a time.
// The page declares its filter field with data-filter-field on .filters; each section carries that field.
(() => {
  if (new URLSearchParams(location.search).has("embed")) {
    document.documentElement.classList.add("embed");
  }

  const q = document.getElementById("q");
  const cards = [...document.querySelectorAll(".piece")];
  const sections = [...document.querySelectorAll(".section[data-room], .section[data-kind], .section[data-category]")];
  const filters = [...document.querySelectorAll(".chip[data-filter]")];
  const count = document.getElementById("count");
  const empty = document.getElementById("empty");
  const total = Number(document.body.dataset.total ?? cards.length);
  const filterField = document.querySelector(".filters")?.dataset.filterField ?? "category";
  const params = new URLSearchParams(location.search);
  const initial = params.get(filterField);
  let active = filters.some((button) => button.dataset.filter === initial) ? initial : "all";
  if (params.has("q")) q.value = params.get("q");

  const matchesFilter = (section) =>
    active === "all" || section.dataset[filterField] === active;

  const apply = () => {
    const needle = q.value.trim().toLowerCase();
    const sectionMatch = new Map(sections.map((section) => [section, matchesFilter(section)]));
    let shown = 0;

    for (const card of cards) {
      const section = card.closest(".section");
      const hit = sectionMatch.get(section) && (!needle || card.dataset.text.includes(needle));
      card.hidden = !hit;
      if (hit) shown += 1;
    }

    for (const section of sections) {
      const visible = [...section.querySelectorAll(".piece")].some((card) => !card.hidden);
      section.hidden = !sectionMatch.get(section) || !visible;
    }

    for (const button of filters) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === active));
      button.classList.toggle("is-active", button.dataset.filter === active);
    }

    const filtered = Boolean(needle) || active !== "all";
    count.textContent = filtered ? `${shown} of ${total}` : `${total} pieces`;
    empty.style.display = shown ? "none" : "block";
  };

  q.addEventListener("input", apply);
  for (const button of filters) {
    button.addEventListener("click", () => {
      active = button.dataset.filter;
      apply();
    });
  }

  apply();
})();
