
(function () {
  const PHOTO = '/static/assets/bc-football-action.jpg';

  function fixFootballPhoto() {
    document.querySelectorAll(
      '.dashboard-sport-tile, [class*="sport-tile"], [class*="sport-card"]'
    ).forEach(tile => {
      const label = (tile.innerText || '').trim().toLowerCase();

      if (!/^football(?:\s|$)/.test(label)) return;

      tile.style.setProperty(
        'background-image',
        'linear-gradient(0deg, rgba(35,0,14,.80), transparent 65%), url("' + PHOTO + '")',
        'important'
      );
      tile.style.setProperty('background-size', 'cover', 'important');
      tile.style.setProperty('background-position', 'center 35%', 'important');

      tile.querySelectorAll('img').forEach(img => {
        if (img.closest('a') === tile) return;
        img.style.setProperty('opacity', '0', 'important');
      });
    });
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fixFootballPhoto();
    });
  });

  function start() {
    fixFootballPhoto();
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
