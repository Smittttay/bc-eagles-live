
/* BC Eagles Live — Mobile game previews, Step 134 */
(() => {
  "use strict";

  const SPORT = "Football";
  let games = [];
  let overlay = null;
  let previousFocus = null;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function eastern(value, options) {
    if (!value) return "TBD";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "TBD";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      ...options
    }).format(date);
  }

  function dateLabel(game) {
    return eastern(game.start, {
      weekday: "short", month: "short", day: "numeric",
      year: "numeric"
    });
  }

  function timeLabel(game) {
    if (!game.start) return "Time TBD";
    const date = new Date(game.start);
    if (Number.isNaN(date.getTime())) return "Time TBD";
    // The schedule API represents unknown kickoff times as midnight.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const hour = Number(parts.find(p => p.type === "hour")?.value);
    const minute = Number(parts.find(p => p.type === "minute")?.value);
    if (hour === 0 && minute === 0) return "Time TBD";
    return eastern(game.start, {
      hour: "numeric", minute: "2-digit"
    }) + " ET";
  }

  function isFinal(game) {
    return String(game.status || "").toLowerCase() === "final" &&
      /^[WL]\s+\d+\s*[-–]\s*\d+/i.test(game.result || "");
  }

  function footballGames() {
    return games.filter(g => g.sport_id === "football")
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function stats(list) {
    const finals = list.filter(isFinal);
    const wins = finals.filter(g => /^W\b/i.test(g.result)).length;
    const losses = finals.length - wins;
    const home = finals.filter(g => /home/i.test(g.home_away || ""));
    const away = finals.filter(g => /away/i.test(g.home_away || ""));
    const record = rows => {
      const w = rows.filter(g => /^W\b/i.test(g.result)).length;
      return `${w}–${rows.length - w}`;
    };
    let streak = 0;
    let direction = "";
    for (const g of [...finals].reverse()) {
      const next = /^W\b/i.test(g.result) ? "W" : "L";
      if (direction && next !== direction) break;
      direction = next;
      streak++;
    }
    return {
      overall: `${wins}–${losses}`,
      home: record(home),
      away: record(away),
      streak: direction ? `${direction}${streak}` : "—"
    };
  }

  function button(label, action, cls = "") {
    const b = el("button", "bc-preview-button " + cls, label);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  }

  function safeOfficialUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" &&
          (url.hostname === "bceagles.com" ||
           url.hostname.endsWith(".bceagles.com"))) return url.href;
    } catch {}
    return null;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = el("div", "bc-preview-overlay");
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="bc-preview-backdrop"></div>
      <section class="bc-preview-sheet"
        role="dialog" aria-modal="true"
        aria-label="BC Eagles game information">
        <div class="bc-preview-topbar">
          <span>BC EAGLES LIVE</span>
          <button class="bc-preview-close" type="button"
            aria-label="Close preview">✕</button>
        </div>
        <div class="bc-preview-body"></div>
      </section>
    `;
    document.body.append(overlay);
    overlay.querySelector(".bc-preview-close").onclick = close;
    overlay.querySelector(".bc-preview-backdrop").onclick = close;
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("bc-preview-open");
    previousFocus?.focus?.();
  }

  function open(content) {
    ensureOverlay();
    previousFocus = document.activeElement;
    const body = overlay.querySelector(".bc-preview-body");
    body.replaceChildren(content);
    body.scrollTop = 0;
    overlay.hidden = false;
    document.body.classList.add("bc-preview-open");
    overlay.querySelector(".bc-preview-close").focus();
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay && !overlay.hidden) close();
  });

  function heading(kicker, title, subtitle) {
    const box = el("div", "bc-preview-heading");
    box.append(
      el("div", "bc-preview-kicker", kicker),
      el("h2", "", title),
      el("p", "", subtitle)
    );
    return box;
  }

  function info(label, value) {
    const box = el("div", "bc-preview-info");
    box.append(el("small", "", label), el("strong", "", value || "TBD"));
    return box;
  }

  function gamePreview(game) {
    const page = el("div", "bc-preview-page");
    const away = /away/i.test(game.home_away || "");
    const status = isFinal(game) ? "FINAL" : "GAME PREVIEW";

    page.append(heading(
      `${game.sport} · ${status}`,
      away ? `BC at ${game.opponent}` : `BC vs. ${game.opponent}`,
      `${dateLabel(game)} · ${timeLabel(game)}`
    ));

    const matchup = el("div", "bc-preview-matchup");
    matchup.append(
      el("div", "bc-preview-team", "BOSTON COLLEGE"),
      el("div", "bc-preview-vs", isFinal(game) ? game.result : "VS"),
      el("div", "bc-preview-team", game.opponent || "Opponent TBD")
    );
    page.append(matchup);

    const details = el("div", "bc-preview-info-grid");
    details.append(
      info("DATE", dateLabel(game)),
      info("TIME", timeLabel(game)),
      info("HOME / AWAY", game.home_away),
      info("LOCATION", game.location),
      info("RESULT", isFinal(game) ? game.result : "Not played")
    );
    page.append(details);

    const actions = el("div", "bc-preview-actions");

    if (game.sport_id === "football") {
      actions.append(button("← Football Season", footballPage, "secondary"));
    }

    const official = safeOfficialUrl(game.url);
    if (official) {
      const link = el("a", "bc-preview-button secondary",
        "Official BC Page ↗");
      link.href = official;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      actions.append(link);
    }

    if (game.live_stats_url) {
      try {
        const u = new URL(game.live_stats_url);
        if (["https:", "http:"].includes(u.protocol)) {
          const link = el("a", "bc-preview-button", "Live Stats ↗");
          link.href = u.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          actions.append(link);
        }
      } catch {}
    }

    page.append(actions);
    open(page);
  }

  function footballPage() {
    const list = footballGames();
    const page = el("div", "bc-preview-page");

    page.append(heading(
      "2026 SEASON · ACC",
      "🏈 BC Football",
      "Season schedule, verified results and upcoming games"
    ));

    if (!list.length) {
      page.append(el("p", "", "Football schedule is not available yet."));
      open(page);
      return;
    }

    const s = stats(list);
    const metrics = el("div", "bc-preview-metrics");
    [
      ["OVERALL", s.overall],
      ["HOME", s.home],
      ["AWAY", s.away],
      ["STREAK", s.streak]
    ].forEach(([label, value]) => {
      const card = el("div", "bc-preview-metric");
      card.append(el("small", "", label), el("strong", "", value));
      metrics.append(card);
    });
    page.append(metrics);

    const upcoming = list.find(g => !isFinal(g) &&
      new Date(g.start).getTime() >= Date.now());

    if (upcoming) {
      page.append(el("h3", "bc-preview-section-title", "NEXT GAME"));
      const next = button(
        `${/away/i.test(upcoming.home_away || "") ? "at " : "vs. "}` +
        `${upcoming.opponent} · ${dateLabel(upcoming)} · ${timeLabel(upcoming)} →`,
        () => gamePreview(upcoming),
        "bc-preview-next"
      );
      page.append(next);
    }

    page.append(el("h3", "bc-preview-section-title", "2026 SCHEDULE"));

    const schedule = el("div", "bc-preview-schedule");
    list.forEach(game => {
      const row = button("", () => gamePreview(game), "bc-preview-game");
      const date = el("span", "bc-preview-game-date",
        eastern(game.start, {month: "short", day: "numeric"}));
      const opponent = el("span", "bc-preview-game-opponent",
        `${/away/i.test(game.home_away || "") ? "at " : ""}${game.opponent}`);
      const result = el("span", "bc-preview-game-result",
        isFinal(game) ? game.result : timeLabel(game));
      if (isFinal(game)) {
        result.classList.add(/^W\b/i.test(game.result) ? "win" : "loss");
      }
      row.append(date, opponent, result);
      schedule.append(row);
    });
    page.append(schedule);

    const note = el("p", "bc-preview-note",
      "Records are calculated from final results in the BC Athletics " +
      "schedule feed. Conference records will be added when verified " +
      "conference-game classifications are available.");
    page.append(note);

    open(page);
  }

  async function load() {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) throw new Error("Schedule unavailable");
      const data = await response.json();
      games = Array.isArray(data.games) ? data.games : [];
      return true;
    } catch (error) {
      console.warn("Game preview schedule:", error);
      return false;
    }
  }

  async function openFootball() {
    if (!games.length && !(await load())) return;
    footballPage();
  }

  async function openGameById(id) {
    if (!games.length && !(await load())) return;
    const game = games.find(g => g.id === id);
    if (game) gamePreview(game);
  }

  // Intercept only the existing dashboard game links.
  // Preserve LIVE STATS, ROSTER and other controls.
  document.addEventListener("click", async event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const sportTile = target.closest(".dashboard-sport-tile");
    if (sportTile && /football/i.test(sportTile.textContent || "")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openFootball();
      return;
    }

    const link = target.closest("a.dashboard-game-row, a#feature-link");
    if (!link) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!games.length && !(await load())) {
      window.open(link.href, "_blank", "noopener");
      return;
    }

    const rows = [...document.querySelectorAll("a.dashboard-game-row")];
    const index = rows.indexOf(link);

    // Match using the displayed matchup and date, then use the
    // original URL only as an optional external action.
    const text = link.textContent || "";
    const candidates = games.filter(g => {
      const name = String(g.opponent || "").toLowerCase();
      return name && text.toLowerCase().includes(name);
    });

    let selected = candidates.find(g =>
      text.includes(
        eastern(g.start, {
          month: "short", day: "numeric", weekday: "short"
        })
      )
    );

    if (!selected && candidates.length === 1) {
      selected = candidates[0];
    }

    if (!selected && link.id === "feature-link") {
      const featured = document.getElementById("feature-matchup")?.textContent || "";
      selected = games.find(g =>
        featured.toLowerCase().includes(
          String(g.opponent || "").toLowerCase()
        ) && g.opponent
      );
    }

    if (selected) {
      gamePreview(selected);
    } else {
      // Don't display incorrect game details on ambiguous matches.
      window.open(link.href, "_blank", "noopener");
    }
  }, true);

  window.bcOpenFootballSeason = openFootball;
  window.bcOpenGamePreview = openGameById;
  load();
})();
