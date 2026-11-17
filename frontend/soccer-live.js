(() => {
  const root = document.getElementById("bc-soccer-live");
  if (!root) return;

  const display = value =>
    value === null || value === undefined ? "—" : String(value);

  async function refresh() {
    try {
      const response = await fetch("/api/live/soccer", {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("NCAA feed unavailable");

      const game = await response.json();
      root.replaceChildren();

      if (game.status === "no_game") {
        root.hidden = true;
        return;
      }

      root.hidden = false;

      const title = document.createElement("h3");
      title.textContent = "BC MEN'S SOCCER · NCAA";

      const score = document.createElement("div");
      score.className = "bc-soccer-score";
      score.textContent =
        "BOSTON COLLEGE " + display(game.bc_score) +
        "  —  " + display(game.opponent_score) +
        " " + display(game.opponent).toUpperCase();

      const status = document.createElement("div");
      status.className = "bc-soccer-status";

      if (game.status === "live") {
        status.textContent =
          "● LIVE · " + display(game.period) +
          " · " + display(game.clock);
      } else if (game.status === "final") {
        status.textContent = "FINAL";
      } else {
        status.textContent = "SCHEDULED";
      }

      const source = document.createElement("small");
      source.textContent =
        "NCAA scoreboard · Refreshes every 30 seconds";

      root.append(title, score, status, source);

    } catch (error) {
      root.hidden = false;
      root.textContent =
        "Soccer scoreboard temporarily unavailable.";
      console.error("BC soccer scoreboard:", error);
    }
  }

  refresh();
  setInterval(refresh, 30000);
})();
