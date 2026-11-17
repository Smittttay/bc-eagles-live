/* STEP 119 — Browse Sports and Live Game roster access */
(() => {
  const sports = {
    football: ["football"],
    "womens-lacrosse": ["women's lacrosse", "womens lacrosse"],
    "mens-ice-hockey": ["men's ice hockey", "mens ice hockey", "men's hockey", "mens hockey"],
    "womens-ice-hockey": ["women's ice hockey", "womens ice hockey", "women's hockey", "womens hockey"],
    "mens-soccer": ["men's soccer", "mens soccer"],
    "womens-soccer": ["women's soccer", "womens soccer"],
    "field-hockey": ["field hockey"],
    "mens-basketball": ["men's basketball", "mens basketball"],
    "womens-basketball": ["women's basketball", "womens basketball"]
  };

  function sportId(label) {
    const value = String(label || "")
      .toLowerCase()
      .replace(/[’]/g, "'")
      .trim();

    if (sports[value]) return value;

    for (const [id, names] of Object.entries(sports)) {
      if (names.some(name => value === name || value.includes(name))) {
        return id;
      }
    }
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "bc-roster-overlay";
  overlay.hidden = true;

  const dialog = document.createElement("section");
  dialog.className = "bc-roster-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Boston College roster");

  const heading = document.createElement("div");
  heading.className = "bc-roster-heading";

  const title = document.createElement("h2");
  title.textContent = "BC ROSTER";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "bc-roster-close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close roster");

  const body = document.createElement("div");
  body.className = "bc-roster-body";

  heading.append(title, close);
  dialog.append(heading, body);
  overlay.append(dialog);
  document.body.append(overlay);

  let requestNumber = 0;

  function dismiss() {
    requestNumber++;
    overlay.hidden = true;
  }

  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) dismiss();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) dismiss();
  });

  async function openRoster(id, label) {
    if (!id) return;

    const current = ++requestNumber;
    title.textContent = `${label || "BC"} ROSTER`;
    body.replaceChildren();
    body.textContent = "Loading official BC Athletics roster…";
    overlay.hidden = false;

    try {
      const response = await fetch(
        `/api/rosters/${encodeURIComponent(id)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Roster unavailable");
      }

      if (current !== requestNumber) return;

      body.replaceChildren();

      const table = document.createElement("table");
      table.className = "bc-roster-table";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      ["#", "Name", "Position", "Year"].forEach(value => {
        const th = document.createElement("th");
        th.textContent = value;
        headerRow.append(th);
      });
      thead.append(headerRow);

      const tbody = document.createElement("tbody");

      data.players.forEach(player => {
        const row = document.createElement("tr");

        [
          player.number,
          player.name,
          player.position,
          player.year
        ].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = value || "—";
          row.append(cell);
        });

        tbody.append(row);
      });

      table.append(thead, tbody);
      body.append(table);

      const source = document.createElement("a");
      source.href = data.source_url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.className = "bc-roster-source";
      source.textContent = `Official BC Athletics · ${data.count} players`;
      body.append(source);

    } catch (error) {
      if (current !== requestNumber) return;
      body.textContent = error.message;
    }
  }

  // The Browse Sports tiles already open the filtered schedule.
  // Place the roster button in that selected-sport schedule header.
  function updateBrowseButton() {
    const panel = document.getElementById("full-schedule");
    const filter = document.getElementById("sport-filter");
    const heading = panel?.querySelector(".panel-heading");
    if (!panel || !filter || !heading) return;

    let button = document.getElementById("bc-sport-roster");
    if (!button) {
      button = document.createElement("button");
      button.id = "bc-sport-roster";
      button.type = "button";
      button.className = "bc-roster-button";
      button.textContent = "ROSTER";
      heading.append(button);

      button.addEventListener("click", () => {
        const option = filter.selectedOptions[0];
        openRoster(sportId(filter.value), option?.textContent);
      });
    }

    const selected = sportId(filter.value);
    button.hidden = !selected;
  }

  document.getElementById("sport-filter")
    ?.addEventListener("change", updateBrowseButton);

  // Live Game Center redraws cards every 30 seconds.
  // Insert the button only once per card.
  function updateGameButtons() {
    document.querySelectorAll("#bc-game-center .gc-card")
      .forEach(card => {
        const stats = card.querySelector(".gc-expand");
        const sportLabel = card.querySelector(".gc-sport");
        if (!stats || !sportLabel) return;

        const id = sportId(sportLabel.textContent);
        let button = card.querySelector(".bc-live-roster-button");

        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "gc-expand bc-live-roster-button";
          button.textContent = "ROSTER";
          stats.insertAdjacentElement("afterend", button);

          button.addEventListener("click", () => {
            const label = card.querySelector(".gc-sport")?.textContent;
            openRoster(sportId(label), label);
          });
        }

        button.hidden = !id;
      });
  }

  const gameCenter = document.getElementById("bc-game-center");
  if (gameCenter) {
    new MutationObserver(updateGameButtons).observe(gameCenter, {
      childList: true,
      subtree: true
    });
  }

  updateBrowseButton();
  updateGameButtons();

  // The existing app loads sports asynchronously.
  const schedulePanel = document.getElementById("full-schedule");
  if (schedulePanel) {
    new MutationObserver(updateBrowseButton).observe(schedulePanel, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }
})();
