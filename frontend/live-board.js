(() => {
  const root = document.getElementById("bc-live-board");
  if (!root) return;

  const text = (value) => value == null ? "—" : String(value);

  async function refresh() {
    try {
      const response = await fetch("/api/live/hockey", {
        cache: "no-store"
      });

      if (!response.ok) throw new Error("Live feed unavailable");

      const game = await response.json();

      const validTeams =
        /boston college/i.test(game.home_team || "") ||
        /boston college/i.test(game.away_team || "");

      if (!validTeams) {
        root.textContent = "BC hockey game data unavailable.";
        return;
      }

      root.replaceChildren();

      const title = document.createElement("h3");
      title.textContent = "BC HOCKEY · SIDEARM";

      const matchup = document.createElement("div");
      matchup.className = "bc-live-matchup";

      const away = document.createElement("div");
      away.textContent =
        text(game.away_team) + "  " + text(game.away_score);

      const home = document.createElement("div");
      home.textContent =
        text(game.home_team) + "  " + text(game.home_score);

      matchup.append(away, home);

      const status = document.createElement("div");
      status.className = "bc-live-status";

      if (game.status === "live") {
        status.textContent =
          "● LIVE · Period " +
          text(game.period) +
          " · " +
          text(game.clock);
      } else if (game.status === "final") {
        status.textContent = "FINAL";
      } else {
        status.textContent =
          "SCHEDULED · " + text(game.date);
      }

      const source = document.createElement("small");
      source.textContent =
        "Official SIDEARM data · Updates every 30 seconds";

      root.append(title, matchup, status, source);

    } catch (error) {
      root.textContent = "Hockey live scores temporarily unavailable.";
      console.error("BC live scoreboard:", error);
    }
  }

  refresh();
  setInterval(refresh, 30000);
})();
