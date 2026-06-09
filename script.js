document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('accountModal');
  const openBtn = document.getElementById('openAccountDetail');
  const closeBtn = document.getElementById('closeModal');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.classList.add('open');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  // Balance toggle - starts hidden (matches screenshot)
  const toggleBtn = document.getElementById('toggleBalance');
  const balanceEl = document.getElementById('mainBalance');
  let shown = false;

  if (toggleBtn && balanceEl) {
    toggleBtn.addEventListener('click', () => {
      shown = !shown;
      if (shown) {
        balanceEl.classList.remove('hidden');
      } else {
        balanceEl.classList.add('hidden');
      }
    });
  }

  // Nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
});