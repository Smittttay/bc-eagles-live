(() => {
  "use strict";

  let overlay = null;
  let content = null;
  let previousFocus = null;
  let requestNumber = 0;

  const css = `
    .bc-native-overlay {
      position:fixed; inset:0; z-index:99999;
      background:rgba(12,15,25,.78);
      display:flex; align-items:center; justify-content:center;
      padding:14px; box-sizing:border-box;
    }
    .bc-native-panel {
      background:#fff; color:#20232b; width:100%;
      max-width:920px; max-height:94dvh; overflow-y:auto;
      border-radius:16px; box-shadow:0 20px 70px #0006;
      font-family:Arial,Helvetica,sans-serif;
      overscroll-behavior:contain;
    }
    .bc-native-header {
      background:#8a1538; color:white;
      padding:18px 20px; display:flex;
      justify-content:space-between; align-items:center;
      gap:12px; position:sticky; top:0; z-index:2;
    }
    .bc-native-header strong {font-size:18px;letter-spacing:.3px}
    .bc-native-close {
      border:1px solid #ffffff70; background:#ffffff20;
      color:white; font-size:25px; border-radius:8px;
      width:40px; height:40px; cursor:pointer; flex-shrink:0;
    }
    .bc-native-body {padding:18px}
    .bc-native-score {
      display:flex; justify-content:space-around;
      align-items:center; gap:12px; text-align:center;
      background:#f7f3f4; border-radius:12px; padding:22px 10px;
    }
    .bc-native-team {flex:1; min-width:0; font-weight:800}
    .bc-native-team-name {font-size:13px; overflow-wrap:anywhere}
    .bc-native-number {font-size:40px; color:#8a1538; margin-top:7px}
    .bc-native-final {font-size:12px; font-weight:800;color:#555}
    .bc-native-section {margin-top:25px}
    .bc-native-section h3 {
      font-size:17px; color:#8a1538;
      margin:0 0 10px; border-bottom:2px solid #d8b45c;
      padding-bottom:7px;
    }
    .bc-native-scroll {overflow-x:auto; max-width:100%}
    .bc-native-table {
      border-collapse:collapse; width:100%;
      font-size:12px; white-space:nowrap;
    }
    .bc-native-table th {
      background:#8a1538; color:#fff;
      padding:10px 9px; text-align:left;
    }
    .bc-native-table td {
      padding:9px; border-bottom:1px solid #e9e9e9;
    }
    .bc-native-table tbody tr:nth-child(even) {background:#f7f7f8}
    .bc-native-table th:first-child,
    .bc-native-table td:first-child {
      position:sticky; left:0; z-index:1;
      background:#f4eef0;
    }
    .bc-native-table th:first-child {background:#8a1538}
    .bc-native-footer {margin:24px 0 5px; text-align:center}
    .bc-native-official {
      display:inline-block; padding:11px 17px;
      background:#8a1538; color:white !important;
      text-decoration:none; border-radius:8px; font-weight:800;
      font-size:13px;
    }
    .bc-native-note {font-size:12px; color:#666; margin-top:12px}
    @media(max-width:600px) {
      .bc-native-overlay {padding:0}
      .bc-native-panel {
        height:100dvh; max-height:100dvh;
        border-radius:0;
      }
      .bc-native-body {padding:13px}
      .bc-native-number {font-size:34px}
    }
  `;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function section(title) {
    const wrapper = el("section", null, "bc-native-section");
    wrapper.appendChild(el("h3", title));
    content.appendChild(wrapper);
    return wrapper;
  }

  function table(headers, rows) {
    const scroller = el("div", null, "bc-native-scroll");
    const tbl = el("table", null, "bc-native-table");
    const thead = el("thead");
    const tr = el("tr");

    headers.forEach(header => tr.appendChild(el("th", header)));
    thead.appendChild(tr);
    tbl.appendChild(thead);

    const tbody = el("tbody");
    rows.forEach(values => {
      const row = el("tr");
      values.forEach(value => row.appendChild(el("td", value ?? "—")));
      tbody.appendChild(row);
    });

    tbl.appendChild(tbody);
    scroller.appendChild(tbl);
    return scroller;
  }

  function officialLink(url) {
    const footer = el("div", null, "bc-native-footer");
    const a = el("a", "OFFICIAL BC ATHLETICS BOX SCORE ↗",
                 "bc-native-official");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    footer.appendChild(a);
    content.appendChild(footer);
  }

  function close() {
    requestNumber++;
    if (overlay) overlay.remove();
    overlay = null;
    content = null;
    document.body.style.overflow = overlayOldOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  let overlayOldOverflow = "";

  function openShell() {
    if (overlay) close();
    previousFocus = document.activeElement;
    overlayOldOverflow = document.body.style.overflow;

    overlay = el("div", null, "bc-native-overlay");
    overlay.setAttribute("role", "presentation");

    const panel = el("div", null, "bc-native-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "BC Eagles Live box score");

    const header = el("div", null, "bc-native-header");
    header.appendChild(el("strong", "BC EAGLES LIVE | BOX SCORE"));

    const x = el("button", "×", "bc-native-close");
    x.type = "button";
    x.setAttribute("aria-label", "Close box score");
    x.addEventListener("click", close);
    header.appendChild(x);

    content = el("div", null, "bc-native-body");
    panel.append(header, content);
    overlay.appendChild(panel);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) close();
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    x.focus();
  }

  document.addEventListener("keydown", event => {
    if (!overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      const focusable = Array.from(
        overlay.querySelectorAll("button,a[href]")
      ).filter(node => !node.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });


  function renderFootball(data, url) {
    content.replaceChildren();

    const bcName = "Boston College";
    const opponent = data.opponent;
    const bc = data.scoring[bcName];
    const other = data.scoring[opponent];

    if (!bc || !other) {
      throw new Error("Missing football scores");
    }

    const score = el("div", null, "bc-native-score");

    for (const [name, total] of [
      [bcName, bc.total],
      [opponent, other.total]
    ]) {
      const team = el("div", null, "bc-native-team");

      team.appendChild(el(
        "div", name.toUpperCase(), "bc-native-team-name"
      ));

      team.appendChild(el(
        "div", total, "bc-native-number"
      ));

      score.appendChild(team);

      if (name === bcName) {
        score.appendChild(el(
          "div", "FINAL", "bc-native-final"
        ));
      }
    }

    content.appendChild(score);

    const quarters = section("Scoring by Quarter");

    const periods = bc.periods.map(
      (_, index) => "Q" + (index + 1)
    );

    quarters.appendChild(table(
      ["Team", ...periods, "Total"],
      [
        [bcName, ...bc.periods, bc.total],
        [opponent, ...other.periods, other.total]
      ]
    ));

    if (data.scoring_plays?.length) {
      const plays = section("Scoring Plays");

      const rows = data.scoring_plays.map(play => [
        play["Quarter"] ?? "—",
        play["Time"] ?? "—",
        play["Team abbreviation"] ?? "—",
        play["Scoring play"] ?? "—"
      ]);

      plays.appendChild(table(
        ["Quarter", "Time", "Team", "Scoring Play"],
        rows
      ));
    }

    if (data.team_stats?.length) {
      const stats = section("Team Statistics");
      const rows = [];
      let category = "";

      for (const values of data.team_stats.slice(1)) {
        if (values.length === 1) {
          category = values[0];
        } else if (values.length >= 3) {
          const label = category
            ? category + " — " + values[0]
            : values[0];

          rows.push([
            label,
            values[1],
            values[2]
          ]);
        }
      }

      stats.appendChild(table(
        [
          "Statistic",
          data.team_stats[0]?.[1] ?? "Away",
          data.team_stats[0]?.[2] ?? "Home"
        ],
        rows
      ));
    }

    const categories = [
      ["passing", "Passing"],
      ["rushing", "Rushing"],
      ["receiving", "Receiving"],
      ["defense", "Defense"],
      ["punting", "Punting"],
      ["field_goals", "Field Goals"],
      ["kickoffs", "Kickoffs"],
      ["returns", "Returns"],
      ["extra_points", "Extra Points"]
    ];

    for (const teamName of [bcName, opponent]) {
      const teamData = data.players?.[teamName] || {};

      for (const [key, label] of categories) {
        const stats = teamData[key];

        if (!stats?.headers?.length || !stats.rows?.length) {
          continue;
        }

        const validRows = stats.rows.filter(
          row => row.length === stats.headers.length
        );

        if (!validRows.length) continue;

        section(teamName + " — " + label)
          .appendChild(table(stats.headers, validRows));
      }
    }

    officialLink(url);

    content.appendChild(el(
      "p",
      "Football statistics sourced from the official " +
      "Boston College Athletics box score.",
      "bc-native-note"
    ));
  }

  function render(data, url) {
    content.replaceChildren();

    const bc = data.scoring["Boston College"];
    const opponent = data.opponent;
    const other = data.scoring[opponent];

    const score = el("div", null, "bc-native-score");
    for (const [name, total] of [
      ["BOSTON COLLEGE", bc.total],
      [opponent.toUpperCase(), other.total]
    ]) {
      const team = el("div", null, "bc-native-team");
      team.appendChild(el("div", name, "bc-native-team-name"));
      team.appendChild(el("div", total, "bc-native-number"));
      score.appendChild(team);
      if (name === "BOSTON COLLEGE") {
        score.appendChild(el("div", "FINAL", "bc-native-final"));
      }
    }
    content.appendChild(score);

    const quarters = section("Scoring by Quarter");
    const periods = bc.periods.map((_, i) => "Q" + (i + 1));
    quarters.appendChild(table(
      ["Team", ...periods, "Total"],
      [
        ["Boston College", ...bc.periods, bc.total],
        [opponent, ...other.periods, other.total]
      ]
    ));

    for (const name of ["Boston College", opponent]) {
      const players = data.players[name] || [];
      const fields = ["Player", "G", "A", "P", "SH", "SOG",
                      "GB", "TO", "CT", "DC", "FPS", "FOULS"];
      const rows = players.map(player =>
        fields.map(field => player[field] ?? "—")
      );
      section(name + " — Player Statistics")
        .appendChild(table(fields, rows));
    }

    const stats = section("Team Statistics");
    const rows = Object.entries(data.team_stats).map(([name, teams]) => [
      name,
      teams["Boston College"]?.total ?? "—",
      teams[opponent]?.total ?? "—"
    ]);
    stats.appendChild(table(["Statistic", "BC", opponent], rows));

    officialLink(url);
    content.appendChild(el(
      "p",
      "Statistics sourced from the official Boston College Athletics box score.",
      "bc-native-note"
    ));
  }

  window.bcOpenNativeBoxscore = async function(id, officialUrl) {
    if (!/^\d{1,12}$/.test(String(id))) return;

    openShell();
    const request = ++requestNumber;
    content.appendChild(el("p", "Loading official game statistics…"));

    try {
      const response = await fetch(
        "/api/boxscore/" + encodeURIComponent(id),
        {headers: {"Accept": "application/json"}}
      );
      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();
      if (request !== requestNumber || !overlay) return;

      if (!data.scoring || !data.players || !data.team_stats) {
        throw new Error("Incomplete statistics");
      }
      if (data.sport === "football") {
        renderFootball(data, officialUrl);
      } else {
        render(data, officialUrl);
      }
    } catch (error) {
      if (request !== requestNumber || !overlay) return;
      content.replaceChildren();
      content.appendChild(el(
        "p",
        "Native statistics are temporarily unavailable. " +
        "You can still view the official box score."
      ));
      officialLink(officialUrl);
    }
  };

  const style = el("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
