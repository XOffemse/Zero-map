
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('adapter-list');
  const closeBtn = document.getElementById('close-sidebar-btn');

  function openSidebar() {
    sidebar.style.transform = 'translateX(0)';
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.style.transform = 'translateX(-100%)';
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  closeBtn.addEventListener('click', () => {
    closeSidebar();
  });

  // Optional: On window resize, keep sidebar hidden by default on small screens
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  });
});
