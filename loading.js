document.addEventListener('DOMContentLoaded', function() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const appContent = document.getElementById('appContent');
  const loginCard = document.querySelector('.login-card');

  if (!loadingOverlay || !appContent || !loginCard) return;

  // Hide app content initially
  appContent.style.display = 'none';
  appContent.classList.add('opacity-0', 'transition-opacity', 'duration-700');

  // Keep loader visible for a short delay
  setTimeout(() => {
    // Fade out loader manually
    loadingOverlay.style.opacity = '0';

    // After fade duration, hide loader and show content
    setTimeout(() => {
      loadingOverlay.style.display = 'none';

      // Show app content
      appContent.style.display = '';
      setTimeout(() => {
        appContent.classList.remove('opacity-0');
        appContent.classList.add('opacity-100');

        // Animate login card
        loginCard.classList.add('show');
      }, 20);

    }, 700); // match your CSS transition duration

  }, 1500); // loader visible duration
});


window.addEventListener('DOMContentLoaded', () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const appContent = document.getElementById('appContent'); // target by ID

  // If no main content, exit early to avoid affecting other pages
  if (!appContent) return;

  appContent.style.opacity = 0; // ensure hidden initially

  // small delay to show loading
  setTimeout(() => {
    // hide overlay
    if (loadingOverlay) {
      loadingOverlay.style.opacity = 0;
      loadingOverlay.style.pointerEvents = 'none';
      setTimeout(() => loadingOverlay.style.display = 'none', 700); // remove from layout
    }

    // show main content
    appContent.style.opacity = 1;
  }, 1000); // adjust delay if needed
});
