(() => {
  const $ = (id) => document.getElementById(id);

  const settingsButton = document.getElementById("open-alert-settings");
  const settingsPanel = document.getElementById("alerts");

  if (settingsButton && settingsPanel) {
    settingsButton.addEventListener("click", () => {
      settingsPanel.hidden = !settingsPanel.hidden;
      settingsButton.setAttribute(
        "aria-expanded", String(!settingsPanel.hidden)
      );
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !settingsPanel.hidden) {
        settingsPanel.hidden = true;
        settingsButton.setAttribute("aria-expanded", "false");
        settingsButton.focus();
      }
    });
  }
  const soundSelect = $("alert-sound");
  const enabled = $("alert-enabled");
  const vibrate = $("alert-vibrate");
  const overlay = $("score-celebration");

  if (!soundSelect || !enabled || !vibrate || !overlay) return;

  const storageKey = "bc-eagles-live-alerts-v1";
  let audioContext = null;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (["horn", "siren", "chime", "fight", "silent"].includes(saved.sound)) {
      soundSelect.value = saved.sound;
    }
    if (typeof saved.enabled === "boolean") enabled.checked = saved.enabled;
    if (typeof saved.vibrate === "boolean") vibrate.checked = saved.vibrate;
  } catch (error) {
    console.warn("Could not read alert preferences:", error);
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        sound: soundSelect.value,
        enabled: enabled.checked,
        vibrate: vibrate.checked
      }));
    } catch (error) {
      console.warn("Could not save alert preferences:", error);
    }
  }

  function tone(ctx, frequency, start, duration, type = "sine", volume = .12) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + .025);
    gain.gain.setValueAtTime(volume, start + Math.max(.03, duration - .09));
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .01);
    return oscillator;
  }


  async function playForBostonExcerpt() {
    const audio = new Audio(
      "/static/assets/bc-for-boston.mp3?v=87"
    );
    audio.preload = "auto";
    audio.volume = 0.9;

    await new Promise((resolve, reject) => {
      if (audio.readyState >= 1) {
        resolve();
        return;
      }
      audio.addEventListener("loadedmetadata", resolve, {
        once: true
      });
      audio.addEventListener("error", () => {
        reject(new Error("Could not load For Boston recording"));
      }, { once: true });
    });

    if (audio.duration < 9) {
      throw new Error("For Boston recording is shorter than 9 seconds");
    }

    audio.currentTime = 3;

    audio.addEventListener("timeupdate", () => {
      if (audio.currentTime >= 9) {
        audio.pause();
      }
    });

    await audio.play();

    // Backup stop in case timeupdate fires late.
    setTimeout(() => {
      audio.pause();
    }, 6100);
  }

  async function playSound(choice) {
  // FOR BOSTON MP3 PLAYBACK V73
  if (choice === "fight") {
    await playForBostonExcerpt();
    return;
  }

    if (choice === "silent") return;
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;

    audioContext ||= new AudioClass();
    await audioContext.resume();
    const ctx = audioContext;
    const t = ctx.currentTime + .03;

    if (choice === "horn") {
      [220, 277.18, 329.63].forEach(f =>
        tone(ctx, f, t, 1.2, "sawtooth", .045)
      );
    } else if (choice === "siren") {
      const osc = tone(ctx, 440, t, 1.7, "sine", .13);
      osc.frequency.setValueAtTime(440, t);
      for (let i = 0; i < 5; i++) {
        osc.frequency.linearRampToValueAtTime(
          i % 2 === 0 ? 850 : 440,
          t + (i + 1) * .28
        );
      }

    } else if (choice === "fight") {
      // User-provided 12-note melody in a brass-like synthesizer.
      const notes = [
        493.88, 587.33, 493.88, 392.00,
        440.00, 493.88, 587.33, 659.25,
        587.33, 493.88, 440.00, 392.00
      ];
      const lengths = [
        .16, .18, .22, .16,
        .18, .22, .18, .20,
        .18, .22, .18, .45
      ];
      let offset = 0;
      notes.forEach((frequency, i) => {
        tone(ctx, frequency, t + offset, lengths[i], "triangle", .16);
        offset += lengths[i] + .025;
      });
    } else if (choice === "chime") {
      [659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ctx, f, t + i * .19, .45, "sine", .12)
      );
    }
  }

  function closeCelebration() {
    overlay.hidden = true;
  }

  function celebrate(title = "EAGLES SCORE!") {
    if (!enabled.checked) return;

    $("celebration-title").textContent = title;
    overlay.hidden = false;

    // Audio is started by the test button's user interaction.
    playSound(soundSelect.value).catch(console.warn);

    if (vibrate.checked && navigator.vibrate) {
      navigator.vibrate([180, 100, 180]);
    }
  }

  soundSelect.addEventListener("change", save);
  enabled.addEventListener("change", save);
  vibrate.addEventListener("change", save);

  $("test-score").addEventListener("click", () => celebrate());
  $("close-celebration").addEventListener("click", closeCelebration);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeCelebration();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCelebration();
  });

  // Available for future live-score integration.

  window.BCTestSound = async function(choice) {
    try {
      if (choice === "fight") {
        await playForBostonExcerpt();
        return;
      }

      if (choice === "trombone") {
        const AudioClass =
          window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioClass();
        await ctx.resume();

        const startTime = ctx.currentTime + 0.05;

        [196, 155.56, 116.54].forEach((f, i) => {
          const start = startTime + i * 0.42;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(f * 1.08, start);
          osc.frequency.exponentialRampToValueAtTime(
            f * 0.88, start + 0.52
          );

          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(
            0.07, start + 0.03
          );
          gain.gain.exponentialRampToValueAtTime(
            0.001, start + 0.54
          );

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.55);
        });
        return;
      }

      await playSound(choice);
    } catch (error) {
      console.error("Audio test failed:", error);
      alert("Audio test failed: " + error.message);
    }
  };

  const oldTestButton = document.getElementById("test-score");
  if (oldTestButton) {
    const newTestButton = oldTestButton.cloneNode(true);
    oldTestButton.replaceWith(newTestButton);
    newTestButton.addEventListener("click", () => {
      window.BCTestSound(soundSelect.value);
    });
  }

  window.BCEaglesAlerts = { celebrate };
})();
