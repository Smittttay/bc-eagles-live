const state = { games: [], sports: [], activeSport: "all" };
const $ = id => document.getElementById(id);

// BC_FAVORITES_129
const bcFavoriteKey = "bc-eagles-live-favorite-sport";
let bcShowAllSports = false;

function bcSavedFavorite() {
  try { return localStorage.getItem(bcFavoriteKey) || ""; }
  catch { return ""; }
}

function bcSelectedSport() {
  return bcShowAllSports ? "" : bcSavedFavorite();
}

function bcSportId(sport) {
  return sport.id || sport.slug || sport.name;
}

function bcFavoriteMatches(game) {
  const favorite = bcSelectedSport();
  if (!favorite) return true;
  const sport = state.sports.find(s => bcSportId(s) === favorite);
  return !!sport && game.sport === sport.name;
}

function bcUpdateFavorites() {
  const favorite = bcSavedFavorite();
  const selected = state.sports.find(s => bcSportId(s) === favorite);
  document.querySelectorAll(".bc-fav-star").forEach(star => {
    const active = star.dataset.sport === favorite;
    star.textContent = active ? "★" : "☆";
    star.classList.toggle("active", active);
    star.setAttribute("aria-pressed", String(active));
  });
  const label = document.getElementById("bc-fav-label");
  const toggle = document.getElementById("bc-fav-toggle");
  if (label) label.textContent = selected
    ? "★ Favorite: " + selected.name +
      (bcShowAllSports ? " · All Sports View" : "")
    : "All BC Sports";
  if (toggle) {
    toggle.hidden = !selected;
    toggle.textContent = bcShowAllSports ? "Show Favorite" : "All Sports";
  }
}

function bcRefreshFavorites() {
  bcUpdateFavorites();
  renderGames();
  if (typeof window.bcRefreshLiveFavorites === "function") {
    window.bcRefreshLiveFavorites();
  }
}

window.bcFavoriteAllowsLive = function(sportId) {
  return !bcSelectedSport() || bcSelectedSport() === sportId;
};


function safeText(value) {
  return String(value ?? "");
}

function dateValue(game) {
  const n = new Date(game.start).getTime();
  return Number.isFinite(n) ? n : Infinity;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", weekday: "short",
    timeZone: "America/New_York"
  }).format(d);
}

function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit",
    hour12: false, timeZone: "America/New_York"
  }).format(d);
  if (hour === "24:00" || hour === "00:00") return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York"
  }).format(d) + " ET";
}

function matchup(game) {
  const away = String(game.home_away || "").toLowerCase() === "away";
  return "BC " + (away ? "@ " : "vs. ") + safeText(game.opponent || "Opponent TBD");
}

function gameUrl(game) {
  try {
    const u = new URL(game.url || "https://bceagles.com", window.location.href);
    return u.hostname === "bceagles.com" || u.hostname.endsWith(".bceagles.com")
      ? u.href : "https://bceagles.com";
  } catch {
    return "https://bceagles.com";
  }
}

function sportIcon(name) {
  const s = String(name).toLowerCase();
  if (s.includes("football")) return "🏈";
  if (s.includes("hockey") && !s.includes("field")) return "🏒";
  if (s.includes("basketball")) return "🏀";
  if (s.includes("lacrosse")) return "🥍";
  if (s.includes("soccer")) return "⚽";
  if (s.includes("field hockey")) return "🏑";
  return "🏆";
}


function bcLiveStatsUrl(game) {
  if (!game.live_stats_url) return null;
  try {
    const url = new URL(game.live_stats_url);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function gameRow(game) {
  const link = document.createElement("a");
  link.className = "dashboard-game-row";
  link.href = gameUrl(game);
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const date = document.createElement("div");
  date.className = "game-date-box";
  date.textContent = formatDate(game.start);

  const icon = document.createElement("div");
  icon.className = "game-sport-icon";
  icon.textContent = sportIcon(game.sport);

  const details = document.createElement("div");
  details.className = "game-row-details";
  const sport = document.createElement("strong");
  sport.textContent = safeText(game.sport).toUpperCase();
  const opponent = document.createElement("div");
  opponent.className = "game-row-opponent";
  opponent.textContent = matchup(game);
  details.append(sport, opponent);

  const time = document.createElement("div");
  time.className = "game-row-time";
  time.textContent = formatTime(game.start);

  const venue = document.createElement("div");
  venue.className = "game-row-venue";
  venue.textContent = "📍 " + (game.location || "Location TBD");

  const action = document.createElement("span");
  action.className = "game-row-action";
  action.textContent = "DETAILS →";

  link.append(date, icon, details, time, venue, action);

  const liveUrl = bcLiveStatsUrl(game);
  if (!liveUrl) return link;

  const wrapper = document.createElement("div");
  wrapper.className = "bc-game-with-stats";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "10px";
  wrapper.style.marginBottom = "6px";

  link.style.flex = "1 1 auto";
  link.style.minWidth = "0";

  const stats = document.createElement("a");
  stats.href = liveUrl;
  stats.target = "_blank";
  stats.rel = "noopener noreferrer";
  stats.textContent = "LIVE STATS";
  stats.setAttribute("aria-label",
    "Live stats for " + matchup(game));
  stats.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:5px 8px",
    "border-radius:8px",
    "background:#8a1538",
    "color:white",
    "font-size:10px",
    "font-weight:800",
    "text-decoration:none",
    "white-space:nowrap",
    "align-self:center"
  ].join(";");

  wrapper.style.width = "100%";
  stats.style.flex = "0 0 auto";
  stats.style.margin = "0";
  stats.style.lineHeight = "1.2";

  wrapper.append(link, stats);
  return wrapper;
}

function upcomingGames() {
  const now = Date.now();
  return state.games
    .filter(g => dateValue(g) >= now && dateValue(g) !== Infinity)
    .sort((a, b) => dateValue(a) - dateValue(b));
}

function showSchedule(sport = state.activeSport) {
  $("full-schedule").hidden = false;
  $("sport-filter").value = sport;
  renderSchedule();
  $("full-schedule").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSchedule() {
  const sport = $("sport-filter").value;
  // STEP 150: Full Schedule shows future games only,
  // sorted by date and time across all sports.
  const games = upcomingGames()
    .filter(g => sport === "all" || g.sport === sport);

  const container = $("schedule");
  container.replaceChildren();
  games.forEach(g => container.append(gameRow(g)));
  if (!games.length) container.textContent = "No games found.";
}

function renderSports() {
  const grid = $("sports-grid");
  const select = $("sport-filter");
  grid.replaceChildren();
  select.replaceChildren(new Option("All Sports", "all"));

  state.sports.forEach(s => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "dashboard-sport-tile";

    // STEP 198: Assign the correct sport photograph.
    const sportNameForPhoto = s.name.toLowerCase();
    const sportPhotoKey =
      sportNameForPhoto.includes("field hockey") ? "field-hockey" :
      sportNameForPhoto.includes("football") ? "football" :
      sportNameForPhoto.includes("basketball") ? "basketball" :
      sportNameForPhoto.includes("hockey") ? "hockey" :
      sportNameForPhoto.includes("lacrosse") ? "lacrosse" :
      sportNameForPhoto.includes("soccer") ? "soccer" : "";

    if (sportPhotoKey) {
      tile.classList.add("bc-photo-" + sportPhotoKey);
    }
    tile.setAttribute("aria-label", "Show " + s.name + " schedule");

    const icon = document.createElement("span");
    icon.className = "tile-icon";
    icon.textContent = sportIcon(s.name);
    const name = document.createElement("strong");
    name.textContent = s.name;
    tile.append(icon);

    // STEP 142: Open the actual sport season on the first click.
    tile.dataset.sportId = bcSportId(s);
    tile.onclick = () => {
      const id = tile.dataset.sportId;
      if (id && typeof window.bcOpenSportSeason === "function") {
        window.bcOpenSportSeason(id);
      } else {
        state.activeSport = s.name;
        showSchedule(s.name);
      }
    };
    const wrap = document.createElement("div");
    wrap.className = "bc-fav-wrap";

    const star = document.createElement("button");
    star.type = "button";
    star.className = "bc-fav-star";
    star.dataset.sport = bcSportId(s);
    star.setAttribute("aria-label", "Set " + s.name + " as favorite");
    star.addEventListener("click", event => {
      event.stopPropagation();
      const id = bcSportId(s);
      try {
        if (bcSavedFavorite() === id) localStorage.removeItem(bcFavoriteKey);
        else localStorage.setItem(bcFavoriteKey, id);
      } catch (error) {
        console.warn("Favorite could not be saved", error);
      }
      bcShowAllSports = false;
      bcRefreshFavorites();
    });

    name.classList.add("bc-circle-sport-name");
    wrap.append(tile, name, star);
    grid.append(wrap);
    select.add(new Option(s.name, s.name));
  });
}

function renderGames() {
  const future = upcomingGames().filter(bcFavoriteMatches);
  const featured = future[0];
  const list = $("games");
  list.replaceChildren();

  future.slice(0, 6).forEach(g => list.append(gameRow(g)));
  if (!future.length) list.textContent = "No upcoming games found.";

  if (featured) {
    $("feature-sport").textContent = safeText(featured.sport).toUpperCase();
    $("feature-matchup").textContent = matchup(featured);
    $("feature-date").textContent =
      "▦ " + formatDate(featured.start) + " · " + formatTime(featured.start);
    $("feature-location").textContent =
      "📍 " + (featured.location || "Location TBD");
    $("feature-link").href = gameUrl(featured);
  } else {
    $("feature-matchup").textContent = "Check back for the next Eagles game";
    $("feature-date").textContent = "";
    $("feature-location").textContent = "";
  }

  // STEP 206: Keep Recent Scores populated on every homepage render.
  renderRecentScores();

  if (!$("full-schedule").hidden) renderSchedule();
}


// STEP 163: Render verified final scores from the last seven days.

function recentScoreRow(game) {
  const row = gameRow(game);

  const link = row.matches(".dashboard-game-row")
    ? row
    : row.querySelector(".dashboard-game-row");

  if (!link) return row;

  const score = link.querySelector(".game-row-time");
  const result = String(game.result || "").trim();
  const match = result.match(/^([WLTD])\s+(\d+)\s*[-–]\s*(\d+)/i);

  if (score) {
    if (match) {
      const outcome = match[1].toUpperCase();

      score.textContent =
        Math.max(Number(match[2]), Number(match[3])) + "-" +
        Math.min(Number(match[2]), Number(match[3])) +
        " " + outcome;

      score.style.fontWeight = "800";
      score.style.color =
        outcome === "W" ? "#187044" :
        outcome === "L" ? "#a12a39" : "#555";
    } else {
      score.textContent = result || "FINAL";
    }
  }

  const boxUrl = String(game.box_score_url || "");

  if (!/^https:\/\/bceagles\.com\/sports\/[^?#]+\/boxscore\/\d+\/?$/i.test(boxUrl)) {
    return row;
  }

  // STEP 212A: BOX SCORE inside the panel.
  const button = document.createElement("a");
  button.href = boxUrl;
  button.target = "_blank";
  button.rel = "noopener noreferrer";
  button.className = "bc-box-score-button";
  button.textContent = "BOX SCORE ↗";

  // STEP 222B: Open native women's lacrosse statistics.
  if (/\/sports\/(?:womens-lacrosse|football)\/stats\//i.test(boxUrl)) {
    const match = boxUrl.match(/\/boxscore\/(\d+)\/?$/i);
    if (match) {
      button.textContent = "BOX SCORE";
      button.addEventListener("click", event => {
        if (typeof window.bcOpenNativeBoxscore !== "function") return;
        event.preventDefault();
        event.stopPropagation();
        window.bcOpenNativeBoxscore(match[1], boxUrl);
      });
    }
  }

  button.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "padding:6px 8px",
    "border-radius:7px",
    "background:#8a1538",
    "color:#fff",
    "font-size:10px",
    "font-weight:800",
    "text-decoration:none",
    "white-space:nowrap",
    "flex:0 0 auto"
  ].join(";");

  // Replace outer link with a clickable card to avoid
  // nesting an anchor inside another anchor.
  const card = document.createElement("div");
  card.className = link.className;
  card.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "width:100%",
    "min-width:0",
    "cursor:pointer"
  ].join(";");

  while (link.firstChild) {
    card.appendChild(link.firstChild);
  }

  const scoreElement = card.querySelector(".game-row-time");
  if (scoreElement) {
    scoreElement.style.marginLeft = "auto";
    scoreElement.style.whiteSpace = "nowrap";
    scoreElement.insertAdjacentElement("afterend", button);
  } else {
    card.appendChild(button);
  }

  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", "View game details");

  const openGame = () => {
    if (typeof window.bcOpenGamePreview === "function") {
      window.bcOpenGamePreview(game.id);
    } else {
      window.open(gameUrl(game), "_blank", "noopener");
    }
  };

  card.addEventListener("click", event => {
    if (event.target.closest(".bc-box-score-button")) return;
    openGame();
  });

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGame();
    }
  });

  return card;
}

function renderRecentScores() {
  const container = $("recent-games");
  if (!container) return;

  const now = Date.now();
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;

  const games = state.games
    .filter(g => {
      const time = new Date(g.start).getTime();
      const result = String(g.result || "").trim();

      return Number.isFinite(time) &&
        time >= cutoff &&
        time <= now &&
        String(g.status || "").toLowerCase() === "final" &&
        /^[WLTD]\s+\d+\s*[-–]\s*\d+/i.test(result);
    })
    .sort((a, b) =>
      new Date(b.start).getTime() - new Date(a.start).getTime()
    );

  container.replaceChildren();

  games.forEach(g => container.append(recentScoreRow(g)));

  if (!games.length) {
    container.textContent = "No games in the last 7 days.";
  }
}


async function loadSports() {
  try {
    const response = await fetch("/api/sports");
    if (!response.ok) throw new Error("Sports list unavailable");
    state.sports = await response.json();
    renderSports();
    bcUpdateFavorites();
    if (state.games.length) {
      renderGames();
      renderRecentScores();
    }
  } catch (error) {
    console.error(error);
    $("sports-grid").textContent = "Unable to load sports.";
  }
}

async function loadGames() {
  $("status").textContent = "Checking official BC schedule…";
  try {
    const response = await fetch("/api/games");
    if (!response.ok) throw new Error("Schedule source unavailable");
    const data = await response.json();
    state.games = Array.isArray(data.games) ? data.games : [];
    $("status").textContent =
      state.games.length + " games loaded · BC Athletics";

    renderGames();
    renderRecentScores();
} catch (error) {
    console.error(error);
    $("status").textContent = "Error: " + error.message;
  }
}

$("refresh").addEventListener("click", loadGames);
$("view-schedule").addEventListener("click", () => showSchedule());
$("nav-schedule").addEventListener("click", () => showSchedule());
$("all-sports").addEventListener("click", () => showSchedule("all"));
$("close-schedule").addEventListener("click", () => {
  $("full-schedule").hidden = true;
});
$("sport-filter").addEventListener("change", renderSchedule);

Promise.allSettled([loadSports(), loadGames()]);



/* ===== GAMES THIS WEEK: MONDAY-SUNDAY ===== */

function bcWeekDates() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(p => [p.type, p.value])
  );

  const today = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day)
  ));

  const monday = new Date(today);
  monday.setUTCDate(
    today.getUTCDate() - ((today.getUTCDay() + 6) % 7)
  );

  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);

  return {
    monday: monday.toISOString().slice(0, 10),
    nextMonday: nextMonday.toISOString().slice(0, 10)
  };
}

function bcGameDay(start) {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(p => [p.type, p.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function bcRenderWeeklyGames() {
  const container = document.getElementById("games");
  if (!container || !state || !Array.isArray(state.games)) return;

  const week = bcWeekDates();

  const weekly = state.games
    .filter(g => {
      const date = bcGameDay(g.start);
      return bcFavoriteMatches(g) &&
        date >= week.monday && date < week.nextMonday;
    })
    .sort((a, b) => {
      const footballA = /football/i.test(a.sport || "") ? 0 : 1;
      const footballB = /football/i.test(b.sport || "") ? 0 : 1;

      if (footballA !== footballB) return footballA - footballB;

      return new Date(a.start) - new Date(b.start);
    });

  container.replaceChildren();

  weekly.forEach(game => {
    if (typeof gameRow === "function") {
      container.appendChild(gameRow(game));
    } else if (typeof makeRow === "function") {
      container.appendChild(makeRow(game));
    }
  });

  if (!weekly.length) {
    container.textContent = "No BC games scheduled this week.";
  }

  const status = document.getElementById("status");
  if (status) {
    status.textContent =
      `${weekly.length} games this week · ${
          bcSelectedSport()
            ? (state.sports.find(s => bcSportId(s) === bcSelectedSport())?.name || "Favorite")
            : "All BC sports"
        }`;
  }
}

// Automatically update after the existing games loader renders.
// Do not overwrite loadGames() or the existing backend calls.
const bcOriginalRenderGames = renderGames;

renderGames = function(...args) {
  const result = bcOriginalRenderGames.apply(this, args);
  bcRenderWeeklyGames();
  return result;
};

document.getElementById("bc-fav-toggle")?.addEventListener("click", () => {
  bcShowAllSports = !bcShowAllSports;
  bcRefreshFavorites();
});
bcUpdateFavorites();
