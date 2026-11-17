const state = { games: [], sports: [] };

const $ = (id) => document.getElementById(id);

function safeText(value) {
  return String(value ?? "");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York"
  }).format(date) + " ET";
}

function gameCard(game) {
  const link = document.createElement("a");
  link.className = "game";
  const url = new URL(game.url || "https://bceagles.com", window.location.href);
  link.href = url.origin === "https://bceagles.com"
    ? url.href : "https://bceagles.com";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const sport = document.createElement("div");
  sport.className = "sport";
  sport.textContent = safeText(game.sport);
  const opponent = document.createElement("div");
  opponent.className = "opponent";
  const away = String(game.home_away || "").trim().toLowerCase() === "away";
  const neutral = String(game.home_away || "").trim().toLowerCase() === "neutral";
  const prefix = away ? "BC @ " : neutral ? "BC vs. " : "BC vs. ";
  opponent.textContent = prefix + safeText(game.opponent);
  const date = document.createElement("div");
  date.className = "date";
  date.textContent = formatDate(game.start);
  const location = document.createElement("div");
  location.className = "date";
  location.style.marginTop = "7px";
  location.textContent = "📍 " + (game.location || "Location TBD");

  link.append(sport, opponent, date, location);
  return link;
}

function renderGames() {
  const upcoming = $("games");
  const schedule = $("schedule");
  upcoming.replaceChildren();
  schedule.replaceChildren();

  const now = Date.now();
  const ordered = [...state.games].sort(
    (a,b) => new Date(a.start) - new Date(b.start)
  );
  const future = ordered.filter(g => new Date(g.start).getTime() >= now);
  const filter = $("sport-filter").value;
  const selected = filter === "all"
    ? ordered : ordered.filter(g => g.sport === filter);

  future.forEach(g => upcoming.append(gameCard(g)));
  selected.forEach(g => schedule.append(gameCard(g)));

  if (!future.length) upcoming.textContent =
    "No upcoming games found in the official feed.";
  if (!selected.length) schedule.textContent =
    "No games available for this selection.";
}

async function loadSports() {
  const response = await fetch("/api/sports");
  if (!response.ok) throw new Error("Sports list unavailable");
  state.sports = await response.json();
  const grid = $("sports");
  const select = $("sport-filter");
  grid.replaceChildren();
  state.sports.forEach(s => {
    const button = document.createElement("button");
    button.className = "sport-card";
    button.textContent = s.name;
    button.onclick = () => {
      select.value = s.name;
      renderGames();
      document.querySelector("#schedule").scrollIntoView();
    };
    grid.append(button);
    const option = document.createElement("option");
    option.value = s.name;
    option.textContent = s.name;
    select.append(option);
  });
}

async function loadGames() {
  $("status").textContent = "Checking official BC schedule…";
  try {
    const response = await fetch("/api/games");
    if (!response.ok) throw new Error("Schedule source unavailable");
    const data = await response.json();
    state.games = data.games || [];
    $("status").textContent =
      `${state.games.length} games found · Source: BC Athletics`;
    renderGames();
  } catch (error) {
    console.error("BC Eagles Live error:", error);
    $("status").textContent =
      "Error: " + error.message;
  }
}

$("refresh").addEventListener("click", loadGames);
$("sport-filter").addEventListener("change", renderGames);
Promise.allSettled([loadSports(), loadGames()]);
