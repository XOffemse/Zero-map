document.addEventListener("DOMContentLoaded", () => {
  const modeButtons = document.querySelectorAll("#attack-menu-left-section .mode-btn");
  const screens = document.querySelectorAll("#right-side .mode-screen");

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      modeButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const selectedMode = button.getAttribute("data-mode");

      screens.forEach((screen) => {
        if (screen.id === `${selectedMode}-screen`) {
          screen.classList.add("active");
          screen.style.display = "block";
        } else {
          screen.classList.remove("active");
          screen.style.display = "none";
        }
      });
    });
  });
});
