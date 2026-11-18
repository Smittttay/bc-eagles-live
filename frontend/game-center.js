(() => {
  const root = document.getElementById("bc-game-center");
  if (!root) return;


  const weeklyPanel = document.getElementById("upcoming");
  const weeklyGames = document.getElementById("games");

  if (weeklyPanel && weeklyGames) {
    const liveSection = document.createElement("section");
    liveSection.id = "bc-live-section";
    liveSection.className = "dashboard-panel";
    liveSection.hidden = true;

    const heading = document.createElement("div");
    heading.className = "panel-heading";

    const title = document.createElement("h2");
    title.textContent = "● LIVE BC GAMES";
    heading.append(title);

    liveSection.append(heading, root);
    weeklyPanel.insertBefore(liveSection, weeklyGames);
  }

  const expanded = new Set();
  const selectedTabs = {};
  const selectedTeams = {};
  const nodes = new Map();
  const value = v => v === null || v === undefined ? "—" : String(v);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function easternDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const get = name => parts.find(p => p.type === name)?.value;
    return `${get("month")}/${get("day")}/${get("year")}`;
  }

  function normalizeSoccer(game) {
    if (!game || game.status === "no_game") return null;
    if (!["live", "final"].includes(game.status)) return null;
    if (game.status === "final") {
      const date = String(game.date || "");
      if (!date || (
        !date.includes(easternDate()) &&
        !date.includes(new Date().toISOString().slice(0, 10))
      )) return null;
    }

    return {
      id: "soccer-" + game.contest_id,
      sport: "MEN'S SOCCER",
      opponent: game.opponent || "Opponent",
      bcScore: game.bc_score,
      opponentScore: game.opponent_score,
      status: game.status,
      period: game.period,
      clock: game.clock,
      teamStats: null,
      playerStats: null,
      plays: null
    };
  }

  function normalizeHockey(game) {
    if (!game || !["live", "final"].includes(game.status)) {
      return null;
    }

    const bcHome = /boston college/i.test(game.home_team || "");
    const bcAway = /boston college/i.test(game.away_team || "");
    if (!bcHome && !bcAway) return null;

    const date = game.date || "";
    if (!date.includes(easternDate()) &&
        !date.includes(new Date().toISOString().slice(0, 10))) {
      return null;
    }

    const home = game.stats?.HomeTeam;
    const away = game.stats?.VisitingTeam;

    return {
      id: "hockey-" + date,
      sport: "MEN'S HOCKEY",
      opponent: shortTeamName(bcHome ? game.away_team : game.home_team),
      bcScore: bcHome ? game.home_score : game.away_score,
      opponentScore: bcHome ? game.away_score : game.home_score,
      status: game.status,
      period: game.period,
      clock: game.clock,
      teamStats: home && away ? {
        bc: bcHome ? home : away,
        opponent: bcHome ? away : home
      } : null,
      playerStats: home && away ? {
        bc: bcHome ? home : away,
        opponent: bcHome ? away : home
      } : null,
      plays: Array.isArray(game.plays) ? game.plays : null
    };
  }


  function normalizeBasketball(game) {
    if (!game || !["live", "final"].includes(game.status)) return null;

    const bcHome = /boston college/i.test(game.home_team || "");
    const bcAway = /boston college/i.test(game.away_team || "");
    if (!bcHome && !bcAway) return null;

    // SIDEARM may retain an older game. Only show today's game.
    if (game.date !== easternDate()) return null;

    const sportId = game.sport;
    if (!["mens-basketball", "womens-basketball"].includes(sportId))
      return null;

    return {
      id: sportId + "-" + game.date,
      sportId,
      sport: sportId === "womens-basketball"
        ? "WOMEN'S BASKETBALL"
        : "MEN'S BASKETBALL",
      opponent: shortTeamName(bcHome ? game.away_team : game.home_team),
      bcScore: bcHome ? game.home_score : game.away_score,
      opponentScore: bcHome ? game.away_score : game.home_score,
      status: game.status,
      period: game.status === "final"
        ? "FINAL"
        : (game.period ? "Q" + game.period : "In Progress"),
      clock: game.status === "final" ? null : game.clock,
      bcHome,
      teamStats: {
        bc: bcHome ? game.team_stats?.home : game.team_stats?.away,
        opponent: bcHome ? game.team_stats?.away : game.team_stats?.home
      },
      playerStats: {
        bc: bcHome ? game.player_stats?.home : game.player_stats?.away,
        opponent: bcHome ? game.player_stats?.away : game.player_stats?.home
      },
      plays: Array.isArray(game.plays) ? game.plays : []
    };
  }

  async function request(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(url + ": " + response.status);
    return response.json();
  }


  function basketballTeamStats(game) {
    const bc = game.teamStats?.bc || {};
    const opp = game.teamStats?.opponent || {};

    const fields = [
      ["Points", "Points"],
      ["Field Goals", "Fgam"],
      ["FG %", "ShootingPercentage"],
      ["3-Pointers", "Tpam"],
      ["3PT %", "Tppercentage"],
      ["Free Throws", "Ftma"],
      ["FT %", "Ftp"],
      ["Rebounds", "TotalRebounds"],
      ["Offensive Rebounds", "OffensiveRebounds"],
      ["Defensive Rebounds", "DefensiveRebounds"],
      ["Assists", "Assists"],
      ["Turnovers", "Turnovers"],
      ["Steals", "Steals"],
      ["Blocks", "Blocks"],
      ["Personal Fouls", "PersonalFouls"],
      ["Points in Paint", "PointsInPaint"],
      ["Fast Break Points", "PointsOffFastBreak"],
      ["Second Chance Points", "PointsOffSecondChance"]
    ];

    const table = element("table", "gc-table");
    const head = element("tr");

    ["STAT", "BC", "OPP"].forEach(label =>
      head.append(element("th", "", label))
    );
    table.append(head);

    let count = 0;

    fields.forEach(([label, key]) => {
      if (bc[key] == null && opp[key] == null) return;

      const row = element("tr");
      row.append(
        element("td", "", label),
        element("td", "", value(bc[key])),
        element("td", "", value(opp[key]))
      );
      table.append(row);
      count++;
    });

    return count ? table : element(
      "p", "gc-empty", "Team statistics are not available yet."
    );
  }

  function basketballPlayerStats(game) {
    const choice = selectedTeams[game.id] || "bc";
    const wrap = element("div");

    const toggle = element("div", "gc-team-toggle");

    [["bc", "BC"], ["opponent", game.opponent]]
      .forEach(([key, label]) => {
        const button = element(
          "button", choice === key ? "active" : "", label
        );
        button.type = "button";
        button.addEventListener("click", () => {
          selectedTeams[game.id] = key;
          renderDetails(game);
        });
        toggle.append(button);
      });

    wrap.append(toggle);

    const players = game.playerStats?.[choice];

    if (!Array.isArray(players) || !players.length) {
      wrap.append(element(
        "p", "gc-empty", "Player statistics are not available yet."
      ));
      return wrap;
    }

    const scroller = element("div");
    scroller.style.overflowX = "auto";

    const table = element("table", "gc-table");

    const columns = [
      ["Name", "PLAYER"],
      ["Minutes", "MIN"],
      ["Points", "PTS"],
      ["TotalRebounds", "REB"],
      ["Assists", "AST"],
      ["Fgam", "FG"],
      ["Tpam", "3PT"],
      ["Ftma", "FT"],
      ["Steals", "STL"],
      ["Blocks", "BLK"],
      ["Turnovers", "TO"]
    ];

    const head = element("tr");
    columns.forEach(([, label]) =>
      head.append(element("th", "", label))
    );
    table.append(head);

    players.forEach(player => {
      if (!player || typeof player !== "object") return;

      const row = element("tr");
      columns.forEach(([key]) =>
        row.append(element("td", "", value(player[key])))
      );
      table.append(row);
    });

    scroller.append(table);
    wrap.append(scroller);
    return wrap;
  }

  function basketballPlayByPlay(game) {
    if (!game.plays?.length) {
      return element(
        "p", "gc-empty", "Play-by-play is not available yet."
      );
    }

    const wrap = element("div");
    wrap.style.maxHeight = "420px";
    wrap.style.overflowY = "auto";

    game.plays.slice(-75).reverse().forEach(play => {
      if (!play?.description) return;

      let team = "";

      if (play.team === "HomeTeam") {
        team = game.bcHome ? "BC" : "OPP";
      } else if (play.team === "VisitingTeam") {
        team = game.bcHome ? "OPP" : "BC";
      }

      const period = play.period ? "Q" + play.period : "";
      const prefix = [period, play.clock, team]
        .filter(Boolean).join(" · ");

      const row = element("p", "gc-play");
      row.textContent = prefix
        ? prefix + " — " + play.description
        : play.description;

      wrap.append(row);
    });

    return wrap;
  }

  function shortTeamName(name) {
    return String(name || "")
      .replace(/Boston College/gi, "BC")
      .replace(/Merrimack College/gi, "Merrimack");
  }

  function statsRows(game) {
    if (game.sportId?.includes("basketball"))
      return basketballTeamStats(game);

    if (!game.teamStats) {
      return element("p", "gc-empty",
        "Detailed team statistics are not available from this feed yet.");
    }

    const bc = game.teamStats.bc?.Totals?.Values || {};
    const opp = game.teamStats.opponent?.Totals?.Values || {};
    const names = ["Goals", "Shots", "ShotsOnGoal", "Saves",
      "Penalties", "FaceoffsWon", "PowerPlayGoals"];

    const table = element("table", "gc-table");
    const header = element("tr");
    ["STAT", "BC", "OPP"].forEach(t =>
      header.append(element("th", "", t))
    );
    table.append(header);

    let count = 0;
    names.forEach(name => {
      if (bc[name] === undefined && opp[name] === undefined) return;
      const row = element("tr");
      row.append(
        element("td", "", name.replace(/([a-z])([A-Z])/g, "$1 $2")),
        element("td", "", value(bc[name])),
        element("td", "", value(opp[name]))
      );
      table.append(row);
      count++;
    });

    return count ? table : element("p", "gc-empty",
      "No verified team stat fields are available.");
  }

  function playerRows(game) {
    if (game.sportId?.includes("basketball"))
      return basketballPlayerStats(game);

    const choice = selectedTeams[game.id] || "bc";
    const wrap = element("div");

    const toggle = element("div", "gc-team-toggle");
    [["bc", "BC"], ["opponent", game.opponent]].forEach(
      ([key, label]) => {
        const button = element("button", key === choice ? "active" : "", label);
        button.type = "button";
        button.addEventListener("click", () => {
          selectedTeams[game.id] = key;
          renderDetails(game);
        });
        toggle.append(button);
      }
    );
    wrap.append(toggle);

    const data = game.playerStats?.[choice];
    const groups = data?.PlayerGroups;

    if (!groups) {
      wrap.append(element("p", "gc-empty",
        "Individual player statistics are not available from this feed yet."));
      return wrap;
    }

    // Only display player records if the feed provides identifiable
    // players and their associated stat values.
    const entries = Array.isArray(groups)
      ? groups
      : Object.values(groups);

    let shown = 0;
    entries.forEach(group => {
      const players = group?.Players || group?.players;
      if (!Array.isArray(players)) return;

      players.slice(0, 35).forEach(player => {
        const name = player.Name || player.FullName ||
          player.name || player.PlayerName;
        const values = player.Values || player.values;
        if (!name || !values || typeof values !== "object") return;

        const row = element("div", "gc-player-row");
        row.append(element("strong", "", name));
        const summary = Object.entries(values)
          .filter(([key, val]) =>
            ["Goals", "Assists", "Shots", "Saves", "Points"]
              .includes(key) && val !== null)
          .map(([key, val]) => key + ": " + val)
          .join(" · ");

        row.append(element("span", "", summary || "Stats unavailable"));
        wrap.append(row);
        shown++;
      });
    });

    if (!shown) {
      wrap.append(element("p", "gc-empty",
        "No individual player records were found in the current feed."));
    }
    return wrap;
  }

  function playRows(game) {
    if (game.sportId?.includes("basketball"))
      return basketballPlayByPlay(game);

    if (!game.plays?.length) {
      return element("p", "gc-empty",
        "Play-by-play is not available from this feed yet.");
    }

    const wrap = element("div");
    game.plays.slice(-25).reverse().forEach(play => {
      const description = play.Description || play.Text ||
        play.description || play.text;
      if (description) {
        wrap.append(element("p", "gc-play", String(description)));
      }
    });

    if (!wrap.children.length) {
      wrap.append(element("p", "gc-empty",
        "No readable play-by-play events were provided."));
    }
    return wrap;
  }

  function renderDetails(game) {
    const card = nodes.get(game.id);
    if (!card) return;

    const details = card.querySelector(".gc-details");
    details.replaceChildren();
    details.hidden = !expanded.has(game.id);
    if (details.hidden) return;

    const tab = selectedTabs[game.id] || "team";
    const tabs = element("div", "gc-tabs");

    [["team", "TEAM"], ["players", "PLAYERS"],
     ["plays", "PLAY-BY-PLAY"]].forEach(([key, label]) => {
      const button = element("button", tab === key ? "active" : "", label);
      button.type = "button";
      button.addEventListener("click", () => {
        selectedTabs[game.id] = key;
        renderDetails(game);
      });
      tabs.append(button);
    });

    details.append(tabs);

    if (tab === "team") details.append(statsRows(game));
    if (tab === "players") details.append(playerRows(game));
    if (tab === "plays") details.append(playRows(game));
  }

  function updateCard(game) {
    let card = nodes.get(game.id);

    if (!card) {
      card = element("article", "gc-card");

      const summary = element("div", "gc-summary");
      summary.append(
        element("div", "gc-sport"),
        element("div", "gc-scoreline"),
        element("div", "gc-scoreline"),
        element("div", "gc-status")
      );

      const button = element("button", "gc-expand", "STATS ▾");
      button.type = "button";
      button.addEventListener("click", () => {
        if (expanded.has(game.id)) expanded.delete(game.id);
        else expanded.add(game.id);
        renderDetails(card.currentGame);
        button.textContent = expanded.has(game.id)
          ? "STATS ▴" : "STATS ▾";
      });

      const details = element("div", "gc-details");
      details.hidden = true;

      card.append(summary, button, details);
      nodes.set(game.id, card);
    }

    card.currentGame = game;

    const fields = card.querySelector(".gc-summary").children;
    fields[0].textContent = game.sport;
    fields[1].textContent = "BC   " + value(game.bcScore);
    fields[2].textContent =
      game.opponent.toUpperCase() + "   " + value(game.opponentScore);

    fields[3].textContent = game.status === "live"
      ? "● LIVE · " + value(game.period) + " · " + value(game.clock)
      : "FINAL";

    card.querySelector(".gc-expand").textContent =
      expanded.has(game.id) ? "STATS ▴" : "STATS ▾";

    renderDetails(game);
    return card;
  }

  async function refresh() {
    const feeds = await Promise.allSettled([
      request("/api/live/soccer"),
      request("/api/live/hockey"),
      request("/api/live/basketball/mens-basketball"),
      request("/api/live/basketball/womens-basketball")
    ]);

    const games = [];

    if (feeds[0].status === "fulfilled") {
      const game = normalizeSoccer(feeds[0].value);
      if (game) games.push(game);
    }

    if (feeds[1].status === "fulfilled") {
      const game = normalizeHockey(feeds[1].value);
      if (game) games.push(game);
    }


    for (const index of [2, 3]) {
      if (feeds[index].status === "fulfilled") {
        const game = normalizeBasketball(feeds[index].value);
        if (game) games.push(game);
      }
    }

    games.sort((a, b) =>
      (a.status === "live" ? 0 : 1) -
      (b.status === "live" ? 0 : 1)
    );

    const shownGames = games.filter(g => {
      const id = g.sportId ||
        (/soccer/i.test(g.sport) ? "mens-soccer"
        : /hockey/i.test(g.sport) ? "mens-ice-hockey" : "");
      return !window.bcFavoriteAllowsLive ||
        window.bcFavoriteAllowsLive(id);
    });
    const visible = new Set(shownGames.map(g => g.id));

    nodes.forEach((node, id) => {
      if (!visible.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    });

    root.replaceChildren();

    // Live games first, followed by today's completed games.
    const displayGames = shownGames.filter(g =>
      g.status === "live" || g.status === "final"
    );

    root.replaceChildren();
    displayGames.forEach(game => root.append(updateCard(game)));

    const section = document.getElementById("bc-live-section");
    if (section) section.hidden = displayGames.length === 0;

    const failures = feeds.filter(f => f.status === "rejected").length;
    if (failures && displayGames.length) {
      root.append(element("p", "gc-warning",
        failures + " live data source(s) unavailable."));
    }
  }

  window.bcRefreshLiveFavorites = refresh;
  refresh();
  setInterval(refresh, 30000);
})();
