// Tema claro/escuro compartilhado por todas as páginas.
// A leitura inicial (antes deste arquivo carregar) já é feita por um snippet
// inline no <head> de cada página, para evitar flash do tema errado.
(function () {
  const STORAGE_KEY = "revoada_theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage indisponível — tema não persiste, mas segue funcionando */
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function updateToggleButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      const nextIsLight = theme === "dark";
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      const label = nextIsLight ? "Ativar modo claro" : "Ativar modo escuro";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-moon", nextIsLight);
        icon.classList.toggle("fa-sun", !nextIsLight);
      }
    });
  }

  function setTheme(theme) {
    applyTheme(theme);
    setStoredTheme(theme);
    updateToggleButtons(theme);
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    return next;
  }

  function initThemeToggle() {
    updateToggleButtons(currentTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      if (btn.dataset.themeBound === "true") return;
      btn.dataset.themeBound = "true";
      btn.addEventListener("click", () => toggleTheme());
    });
  }

  window.RevoadaTheme = {
    get: currentTheme,
    set: setTheme,
    toggle: toggleTheme,
    init: initThemeToggle,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
