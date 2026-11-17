(() => {
  // STEP 201: Use the sport identifier already assigned by app.js.
  const photoMap = {
    "football": "/static/assets/sport-football.jpg",
    "basketball": "/static/assets/sport-basketball.jpg",
    "hockey": "/static/assets/sport-hockey.jpg",
    "lacrosse": "/static/assets/sport-lacrosse.jpg",
    "soccer": "/static/assets/sport-soccer.jpg",
    "field-hockey": "/static/assets/sport-field-hockey.jpg"
  };

  function updatePhotos() {
    document.querySelectorAll(
      "#sports-grid .dashboard-sport-tile"
    ).forEach(tile => {
      const sport = Object.keys(photoMap).find(key =>
        tile.classList.contains("bc-photo-" + key)
      );

      if (!sport) return;

      const photo = photoMap[sport];

      if (tile.dataset.photoApplied === photo) return;

      tile.dataset.photoApplied = photo;

      tile.style.setProperty(
        "background-image",
        'linear-gradient(0deg,rgba(32,0,12,.18),rgba(32,0,12,.03)),url("' +
        photo + '")',
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
