
(() => {
  const tiles = () => document.querySelectorAll(
    ".dashboard-sport-tile, .sport-tile"
  );

  function photoFor(label) {
    const name = label.toLowerCase();

    if (name.includes("field hockey")) {
      return "/static/assets/sport-field-hockey.jpg?v=48";
    }
    if (name.includes("hockey")) {
      return "/static/assets/conte-hockey.jpg";
    }
    if (name.includes("basketball")) {
      return "/static/assets/conte-basketball.jpg";
    }
    if (name.includes("football")) {
      return "/static/assets/alumni-stadium.jpg";
    }
    if (name.includes("lacrosse")) {
      return "/static/assets/sport-lacrosse.jpg?v=48";
    }
    if (name.includes("soccer")) {
      return "/static/assets/sport-soccer.jpg";
    }
    return "/static/assets/alumni-stadium.jpg";
  }

  function cleanEmoji(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.textContent || "";
        child.textContent = value.replace(
          /[🏈🏒🏀🥍⚽🏑🏆]/gu, ""
        );
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const text = (child.textContent || "").trim();
        if (/^[🏈🏒🏀🥍⚽🏑🏆]+$/u.test(text)) {
          child.remove();
        } else {
          cleanEmoji(child);
        }
      }
    }
  }

  function update() {
    tiles().forEach(tile => {
      const label = tile.textContent || "";
      const photo = photoFor(label);

      if (tile.dataset.photoApplied === photo) return;
      tile.dataset.photoApplied = photo;

      tile.style.setProperty(
        "background-image",
        `linear-gradient(0deg,rgba(32,0,12,.75),rgba(32,0,12,.08)),url("${photo}")`,
        "important"
      );

      cleanEmoji(tile);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    update();

    const grid = document.getElementById("sports-grid");
    if (grid) {
      new MutationObserver(update).observe(grid, {
        childList: true,
        subtree: true
      });
    }
  });
})();
