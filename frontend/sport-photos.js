(() => {
  const photos = {
    football: "/static/assets/bc-football-action.jpg",
    basketball: "/static/assets/conte-basketball.jpg",
    hockey: "/static/assets/conte-hockey.jpg",
    lacrosse: "/static/assets/sport-lacrosse.jpg",
    soccer: "/static/assets/sport-soccer.jpg",
    "field-hockey": "/static/assets/sport-field-hockey.jpg"
  };

  function updatePhotos() {
    document.querySelectorAll(
      "#sports-grid .dashboard-sport-tile"
    ).forEach(tile => {
      const sport = Object.keys(photos).find(key =>
        tile.classList.contains("bc-photo-" + key)
      );

      if (!sport) return;

      tile.style.setProperty(
        "background-image",
        'url("' + photos[sport] + '")',
        "important"
      );
      tile.style.setProperty(
        "background-size", "cover", "important"
      );
      tile.style.setProperty(
        "background-position", "center", "important"
      );
    });
  }

  function start() {
    updatePhotos();
    const grid = document.getElementById("sports-grid");
    if (grid) {
      new MutationObserver(updatePhotos).observe(grid, {
        childList: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
