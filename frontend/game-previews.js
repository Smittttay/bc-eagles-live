
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
    overlay.querySelector(".bc-preview-sheet").scrollTop = 0;
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
    const sportId = game.sport_id;

    if (sportNames[sportId]) {
      actions.append(button(
        "← " + sportNames[sportId] + " Season",
        () => seasonPage(sportId),
        "secondary"
      ));
      actions.append(rosterButton(sportId));
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


  // BC_ALL_SPORTS_136
  const sportNames = {
    "football": "Football",
    "womens-lacrosse": "Women's Lacrosse",
    "mens-ice-hockey": "Men's Hockey",
    "womens-ice-hockey": "Women's Hockey",
    "mens-soccer": "Men's Soccer",
    "womens-soccer": "Women's Soccer",
    "field-hockey": "Women's Field Hockey",
    "mens-basketball": "Men's Basketball",
    "womens-basketball": "Women's Basketball"
  };

  const sportEmoji = {
    "football": "🏈",
    "womens-lacrosse": "🥍",
    "mens-ice-hockey": "🏒",
    "womens-ice-hockey": "🏒",
    "mens-soccer": "⚽",
    "womens-soccer": "⚽",
    "field-hockey": "🏑",
    "mens-basketball": "🏀",
    "womens-basketball": "🏀"
  };

  function sportGames(id) {
    return games.filter(g => g.sport_id === id)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function seasonLabel(list) {
    if (!list.length) return "SEASON";
    const years = [...new Set(
      list.map(g => new Date(g.start).getFullYear())
        .filter(Number.isFinite)
    )].sort();
    return years.join("–") + " SEASON";
  }

  function rosterButton(id) {
    return button("👥 ROSTER", () => {
      if (typeof window.bcOpenRoster === "function") {
        window.bcOpenRoster(id, sportNames[id] || "BC");
      } else {
        alert("Roster viewer is still loading. Please try again.");
      }
    }, "secondary");
  }


  // STEP 224E — Native box scores for completed Lacrosse games.
  function appendSeasonBoxscoreRow(schedule, row, game) {
    const url = String(game.box_score_url || "");

    const match = url.match(
      /^https:\/\/bceagles\.com\/sports\/womens-lacrosse\/stats\/[^?#]+\/boxscore\/(\d+)\/?$/i
    );

    if (
      game.sport_id !== "womens-lacrosse" ||
      !isFinal(game) ||
      !match
    ) {
      schedule.append(row);
      return;
    }

    // Separate sibling buttons, never nested buttons.
    const wrapper = document.createElement("div");
    wrapper.className = "bc-season-boxscore-row";

    wrapper.style.cssText = [
      "display:flex",
      "align-items:stretch",
      "gap:7px",
      "width:100%",
      "min-width:0"
    ].join(";");

    row.style.flex = "1 1 auto";
    row.style.minWidth = "0";
    row.style.width = "auto";

    const box = document.createElement("button");
    box.type = "button";
    box.className = "bc-season-boxscore";
    box.textContent = "BOX SCORE";

    box.setAttribute(
      "aria-label",
      "View box score for " + (game.opponent || "this game")
    );

    box.style.cssText = [
      "flex:0 0 auto",
      "align-self:center",
      "padding:10px 9px",
      "border:0",
      "border-radius:7px",
      "background:#8a1538",
      "color:#fff",
      "font-size:10px",
      "font-weight:800",
      "white-space:nowrap",
      "cursor:pointer"
    ].join(";");

    box.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      if (typeof window.bcOpenNativeBoxscore === "function") {
        window.bcOpenNativeBoxscore(match[1], url);
      } else {
        window.open(url, "_blank", "noopener");
      }
    });

    wrapper.append(row, box);
    schedule.append(wrapper);
  }

  function seasonPage(id) {
    const list = sportGames(id);
    const name = sportNames[id] || id;
    const page = el("div", "bc-preview-page");

    page.append(heading(
      seasonLabel(list),
      `${sportEmoji[id] || "🏆"} ${name}`,
      "Official BC Athletics schedule and results"
    ));

    const actions = el("div", "bc-preview-actions bc-preview-top-actions");
    actions.append(rosterButton(id));
    page.append(actions);

    if (!list.length) {
      page.append(el("p", "bc-preview-note",
        "No published schedule is currently available in the app."));
      open(page);
      return;
    }


    // BC_LACROSSE_137
    // During fall 2026, the next Women's Lacrosse season is 2027.
    // Keep official 2026 results accessible, but do not present
    // those games as the upcoming season.
    if (id === "womens-lacrosse" &&
        new Date().getFullYear() === 2026 &&
        new Date().getMonth() >= 6) {

      const previous = list.filter(g => {
        const d = new Date(g.start);
        return !Number.isNaN(d.getTime()) &&
          d.getFullYear() === 2026;
      });

      const upcoming = list.filter(g => {
        const d = new Date(g.start);
        return !Number.isNaN(d.getTime()) &&
          d.getFullYear() === 2027;
      });

      // If the new schedule has been published, show it normally.
      if (!upcoming.length) {
        const title = page.querySelector(".bc-preview-heading");
        if (title) {
          title.replaceChildren(
            el("div", "bc-preview-kicker", "2027 SEASON"),
            el("h2", "", "🥍 Women's Lacrosse"),
            el("p", "", "Official Boston College Athletics")
          );
        }

        const coming = el("div", "bc-season-coming-soon");
        coming.append(
          el("div", "bc-season-coming-icon", "📅"),
          el("h3", "", "2027 Schedule Coming Soon"),
          el("p", "",
            "Boston College has not published the 2027 " +
            "Women's Lacrosse schedule yet.")
        );
        page.append(coming);

        if (previous.length) {
          const details = document.createElement("details");
          details.className = "bc-previous-season";

          const summary = document.createElement("summary");
          summary.textContent = "2026 Previous Season — Results";
          details.append(summary);

          const previousStats = stats(previous);
          const record = el("p", "bc-preview-note",
            "2026 Overall Record: " + previousStats.overall
          );
          details.append(record);

          const schedule = el("div", "bc-preview-schedule");

          previous.forEach(game => {
            const row = button(
              "",
              () => gamePreview(game),
              "bc-preview-game"
            );

            const date = el("span", "bc-preview-game-date",
              eastern(game.start, {
                month: "short", day: "numeric"
              })
            );

            const opponent = el(
              "span",
              "bc-preview-game-opponent",
              (/away/i.test(game.home_away || "")
                ? "at " : "") +
              (game.opponent || "Opponent TBD")
            );

            const result = el(
              "span",
              "bc-preview-game-result",
              isFinal(game) ? game.result : "—"
            );

            if (isFinal(game)) {
              result.classList.add(
                /^W\b/i.test(game.result) ? "win" : "loss"
              );
            }

            row.append(date, opponent, result);
            appendSeasonBoxscoreRow(schedule, row, game);
          });

          details.append(schedule);
          page.append(details);
        }

        open(page);
        return;
      }
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
      card.append(
        el("small", "", label),
        el("strong", "", value)
      );
      metrics.append(card);
    });
    page.append(metrics);

    const next = list.find(g =>
      !isFinal(g) &&
      new Date(g.start).getTime() >= Date.now()
    );

    if (next) {
      page.append(el("h3", "bc-preview-section-title", "NEXT GAME"));
      page.append(button(
        `${/away/i.test(next.home_away || "") ? "at " : "vs. "}` +
        `${next.opponent} · ${dateLabel(next)} · ${timeLabel(next)} →`,
        () => gamePreview(next),
        "bc-preview-next"
      ));
    }

    page.append(el("h3", "bc-preview-section-title", "SCHEDULE"));

    const schedule = el("div", "bc-preview-schedule");
    list.forEach(game => {
      const row = button(
        "", () => gamePreview(game), "bc-preview-game"
      );
      const date = el("span", "bc-preview-game-date",
        eastern(game.start, {
          month: "short", day: "numeric"
        })
      );
      const opponent = el("span", "bc-preview-game-opponent",
        `${/away/i.test(game.home_away || "") ? "at " : ""}` +
        `${game.opponent}`
      );
      const result = el("span", "bc-preview-game-result",
        isFinal(game) ? game.result : timeLabel(game)
      );
      if (isFinal(game)) {
        result.classList.add(
          /^W\b/i.test(game.result) ? "win" : "loss"
        );
      }
      row.append(date, opponent, result);
      appendSeasonBoxscoreRow(schedule, row, game);
    });
    page.append(schedule);

    page.append(el("p", "bc-preview-note",
      "Records reflect completed games in the current schedule feed. " +
      "Conference standings are not yet available."
    ));

    open(page);
  }

  function footballPage() {
    seasonPage("football");
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

    // STEP 142: Sport tiles are handled by app.js.
    // Game rows continue to use the preview handler below.

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
  window.bcOpenSportSeason = async id => {
    if (!sportNames[id]) return;
    if (!games.length && !(await load())) return;
    seasonPage(id);
  };
  window.bcOpenGamePreview = openGameById;
  load();
})();
