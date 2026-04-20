document.addEventListener("DOMContentLoaded", () => {
  const progressBar = document.getElementById("codp-progress-bar");
  const summaryLinks = Array.from(document.querySelectorAll("[data-section-target]"));
  const sections = Array.from(document.querySelectorAll(".codp-slide-section"));
  const revealElements = Array.from(document.querySelectorAll(".codp-reveal"));
  const prevButton = document.getElementById("codp-prev-section");
  const nextButton = document.getElementById("codp-next-section");
  const presentationToggle = document.getElementById("presentation-toggle");
  const heroParallax = document.querySelector(".codp-hero-parallax");
  const railCounter = document.getElementById("codp-rail-counter");
  let activeSectionIndex = 0;

  function updateProgressBar() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }

  function formatSlideNumber(value) {
    return String(value).padStart(2, "0");
  }

  function updateRailCounter() {
    if (!railCounter || !sections.length) return;
    railCounter.textContent = `${formatSlideNumber(activeSectionIndex + 1)} / ${formatSlideNumber(sections.length)}`;
  }

  function updateNavButtons() {
    if (prevButton) prevButton.disabled = activeSectionIndex <= 0;
    if (nextButton) nextButton.disabled = activeSectionIndex >= sections.length - 1;
  }

  function activateSummaryLink(sectionId) {
    summaryLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.sectionTarget === sectionId);
    });
  }

  function updateSlideStates(currentSectionId) {
    const currentIndex = sections.findIndex((section) => section.id === currentSectionId);
    if (currentIndex >= 0) activeSectionIndex = currentIndex;

    sections.forEach((section, index) => {
      section.classList.remove("is-before", "is-after", "is-focused");
      if (index < activeSectionIndex) section.classList.add("is-before");
      else if (index > activeSectionIndex) section.classList.add("is-after");
      else section.classList.add("is-focused");
    });

    updateRailCounter();
    updateNavButtons();
  }

  function goToSection(index) {
    const target = sections[index];
    if (!target) return;
    activeSectionIndex = index;
    activateSummaryLink(target.id);
    updateSlideStates(target.id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setupAccordions() {
    document.querySelectorAll("[data-expandable]").forEach((card) => {
      const toggle = card.querySelector(".codp-card-toggle");
      if (!toggle) return;

      toggle.addEventListener("click", () => {
        const willOpen = !card.classList.contains("is-open");
        card.classList.toggle("is-open", willOpen);
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });
  }

  function setupRevealObserver() {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });

    revealElements.forEach((element) => {
      if (element.classList.contains("is-visible")) return;
      revealObserver.observe(element);
    });
  }

  function setupSectionObserver() {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      const sectionId = visible.target.id;
      activateSummaryLink(sectionId);
      updateSlideStates(sectionId);
    }, {
      threshold: [0.3, 0.55, 0.8],
      rootMargin: "-20% 0px -25% 0px",
    });

    sections.forEach((section) => sectionObserver.observe(section));
  }

  function setupSummaryNavigation() {
    summaryLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(link.dataset.sectionTarget);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function setupSlideButtons() {
    if (prevButton) {
      prevButton.addEventListener("click", () => {
        goToSection(Math.max(0, activeSectionIndex - 1));
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        goToSection(Math.min(sections.length - 1, activeSectionIndex + 1));
      });
    }
  }

  function setupKeyboardNavigation() {
    document.addEventListener("keydown", (event) => {
      const tagName = document.activeElement?.tagName;
      const isTypingContext = ["INPUT", "TEXTAREA", "SELECT"].includes(tagName) || document.activeElement?.isContentEditable;
      if (isTypingContext) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goToSection(Math.min(sections.length - 1, activeSectionIndex + 1));
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToSection(Math.max(0, activeSectionIndex - 1));
      }
    });
  }

  function setupPresentationMode() {
    if (!presentationToggle) return;

    presentationToggle.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          document.body.classList.add("codp-presentation");
          presentationToggle.innerHTML = '<i class="fa-solid fa-compress"></i><span>Sair do modo apresentação</span>';
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.error("Falha ao alternar tela cheia:", error);
      }
    });

    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      document.body.classList.toggle("codp-presentation", isFullscreen);
      presentationToggle.innerHTML = isFullscreen
        ? '<i class="fa-solid fa-compress"></i><span>Sair do modo apresentação</span>'
        : '<i class="fa-solid fa-expand"></i><span>Modo apresentação</span>';
    });
  }

  function setupParallax() {
    if (!heroParallax) return;

    const updateParallax = () => {
      if (window.innerWidth <= 720) {
        heroParallax.style.transform = "translate3d(0, 0, 0) scale(1.04)";
        return;
      }

      const offset = Math.min(window.scrollY * 0.12, 80);
      heroParallax.style.transform = `translate3d(0, ${offset}px, 0) scale(1.04)`;
    };

    updateParallax();
    window.addEventListener("scroll", updateParallax, { passive: true });
  }

  updateProgressBar();
  activateSummaryLink(sections[0]?.id || "introducao");
  updateSlideStates(sections[0]?.id || "introducao");
  setupAccordions();
  setupRevealObserver();
  setupSectionObserver();
  setupSummaryNavigation();
  setupSlideButtons();
  setupKeyboardNavigation();
  setupPresentationMode();
  setupParallax();

  window.addEventListener("scroll", updateProgressBar, { passive: true });
});
