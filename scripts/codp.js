document.addEventListener("DOMContentLoaded", () => {
  document.title = "CODP | Curso Operacional de Direção Policial";
  const progressBar = document.getElementById("codp-progress-bar");
  const railCounter = document.getElementById("codp-rail-counter");
  const slideButtons = Array.from(document.querySelectorAll("[data-section-target]"));
  const slides = Array.from(document.querySelectorAll(".codp-slide-section"));
  const prevButton = document.getElementById("codp-prev-section");
  const nextButton = document.getElementById("codp-next-section");
  const presentationToggles = Array.from(document.querySelectorAll("[data-presentation-toggle]"));
  const cover = document.getElementById("hero");
  const startCourseButton = document.getElementById("codp-start-course");
  const backToCoverButton = document.getElementById("codp-back-to-cover");
  const heroParallax = document.querySelector(".codp-hero-parallax");
  const revealElements = Array.from(document.querySelectorAll(".codp-reveal"));
  const isMobile = () => window.innerWidth <= 720;
  let activeSlideIndex = 0;
  let transitionLocked = false;
  let wheelLocked = false;
  let coverVisible = true;

  function hydrateHeroCover() {
    if (!cover) return;
    const copy = cover.querySelector(".codp-hero-copy");
    if (!copy) return;

    copy.innerHTML = `
      <span class="codp-kicker"><i class="fa-solid fa-car-burst"></i> Formação Operacional</span>
      <div class="codp-hero-title-lockup">
        <p class="codp-cover-code">CODP</p>
        <h1>Curso de Direção Policial</h1>
      </div>
      <p class="codp-subtitle">Treinamento obrigatório para todos os oficiais, do novato ao veterano, com foco em padronização, domínio técnico e consciência operacional.</p>
      <p class="codp-description">Uma apresentação pensada para aula ao vivo, com progressão cinematográfica, leitura fluida e base doutrinária voltada à condução segura, eficiente e profissional da viatura policial.</p>
      <div class="codp-hero-actions">
        <button type="button" class="codp-button codp-button-primary" id="codp-start-course"><i class="fa-solid fa-arrow-down"></i><span>Iniciar curso</span></button>
        <button type="button" class="codp-button codp-button-ghost" data-presentation-toggle><i class="fa-solid fa-expand"></i><span>Modo apresentação</span></button>
      </div>
    `;
  }

  function formatSlideNumber(value) {
    return String(value).padStart(2, "0");
  }

  function updateProgressBar() {
    if (!progressBar || !slides.length) return;
    const progress = coverVisible ? 0 : ((activeSlideIndex + 1) / slides.length) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function updateRailCounter() {
    if (!railCounter || !slides.length) return;
    railCounter.textContent = coverVisible
      ? "Capa"
      : `${formatSlideNumber(activeSlideIndex + 1)} / ${formatSlideNumber(slides.length)}`;
  }

  function updateButtons() {
    if (prevButton) prevButton.disabled = activeSlideIndex <= 0;
    if (nextButton) nextButton.disabled = activeSlideIndex >= slides.length - 1;
  }

  function updateSidebar() {
    const activeId = slides[activeSlideIndex]?.id;
    slideButtons.forEach((button) => {
      const isCoverButton = button.dataset.sectionTarget === "hero";
      const shouldActivate = isCoverButton
        ? coverVisible
        : !coverVisible && button.dataset.sectionTarget === activeId;
      button.classList.toggle("is-active", shouldActivate);
    });
  }

  function updatePresentationButtons() {
    const isFullscreen = Boolean(document.fullscreenElement);
    document.querySelectorAll("[data-presentation-toggle]").forEach((button) => {
      button.innerHTML = isFullscreen
        ? '<i class="fa-solid fa-compress"></i><span>Sair do modo apresentação</span>'
        : '<i class="fa-solid fa-expand"></i><span>Modo apresentação</span>';
    });
  }

  function showCover() {
    coverVisible = true;
    document.body.classList.add("codp-cover-active");
    if (cover) cover.classList.remove("is-hidden");
    updateSidebar();
    updateRailCounter();
    updateButtons();
    updateProgressBar();
    document.dispatchEvent(new CustomEvent("codp:slidechange", {
      detail: {
        slideId: "hero",
        slideIndex: -1,
        coverVisible: true,
      },
    }));
  }

  function hideCover() {
    coverVisible = false;
    document.body.classList.remove("codp-cover-active");
    if (cover) cover.classList.add("is-hidden");
    updateSidebar();
    updateProgressBar();
  }

  function revealActiveSlide() {
    const activeSlide = slides[activeSlideIndex];
    if (!activeSlide) return;

    activeSlide.querySelectorAll(".codp-reveal").forEach((element, index) => {
      element.classList.remove("is-visible");
      window.setTimeout(() => {
        element.classList.add("is-visible");
      }, Math.min(index * 45, 220));
    });
  }

  function updateSlideClasses() {
    slides.forEach((slide, index) => {
      slide.classList.remove("active", "prev", "next");
      if (index === activeSlideIndex) slide.classList.add("active");
      else if (index < activeSlideIndex) slide.classList.add("prev");
      else slide.classList.add("next");
      slide.setAttribute("aria-hidden", index === activeSlideIndex ? "false" : "true");
    });
  }

  function resetActiveSlideScroll() {
    const container = slides[activeSlideIndex]?.querySelector(".container");
    if (container) container.scrollTop = 0;
  }

  function setSlide(index, options = {}) {
    if (!slides.length) return;

    const boundedIndex = Math.max(0, Math.min(slides.length - 1, index));
    if (boundedIndex === activeSlideIndex && !options.force) return;

    activeSlideIndex = boundedIndex;
    updateSlideClasses();
    updateSidebar();
    updateRailCounter();
    updateButtons();
    updateProgressBar();

    if (options.resetScroll !== false) resetActiveSlideScroll();
    revealActiveSlide();
    document.dispatchEvent(new CustomEvent("codp:slidechange", {
      detail: {
        slideId: slides[activeSlideIndex]?.id || null,
        slideIndex: activeSlideIndex,
        coverVisible,
      },
    }));
  }

  function goToSlide(index) {
    if (transitionLocked) return;
    if (index < 0 || index >= slides.length || index === activeSlideIndex) return;

    transitionLocked = true;
    hideCover();
    setSlide(index);

    window.setTimeout(() => {
      transitionLocked = false;
    }, 700);
  }

  function nextSlide() {
    if (coverVisible) {
      hideCover();
      setSlide(0, { force: true });
      return;
    }
    goToSlide(activeSlideIndex + 1);
  }

  function prevSlide() {
    if (coverVisible) return;
    goToSlide(activeSlideIndex - 1);
  }

  function setupRailNavigation() {
    slideButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (button.dataset.sectionTarget === "hero") {
          showCover();
          return;
        }

        const targetIndex = slides.findIndex((slide) => slide.id === button.dataset.sectionTarget);
        if (targetIndex >= 0) {
          hideCover();
          if (targetIndex === activeSlideIndex) {
            setSlide(targetIndex, { force: true });
          } else {
            goToSlide(targetIndex);
          }
        }
      });
    });
  }

  function setupArrowButtons() {
    if (prevButton) prevButton.addEventListener("click", prevSlide);
    if (nextButton) nextButton.addEventListener("click", nextSlide);
  }

  function setupKeyboardNavigation() {
    document.addEventListener("keydown", (event) => {
      const tagName = document.activeElement?.tagName;
      const isTypingContext = ["INPUT", "TEXTAREA", "SELECT"].includes(tagName) || document.activeElement?.isContentEditable;
      if (isTypingContext) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        nextSlide();
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        prevSlide();
      }
    });
  }

  function setupWheelNavigation() {
    document.addEventListener("wheel", (event) => {
      const activeContainer = slides[activeSlideIndex]?.querySelector(".container");
      if (!activeContainer) return;

      const canScrollDown = activeContainer.scrollTop + activeContainer.clientHeight < activeContainer.scrollHeight - 2;
      const canScrollUp = activeContainer.scrollTop > 2;

      if (isMobile()) return;

      if (event.deltaY > 0) {
        if (coverVisible) {
          event.preventDefault();
          if (wheelLocked) return;
          wheelLocked = true;
          nextSlide();
          window.setTimeout(() => {
            wheelLocked = false;
          }, 760);
          return;
        }
        if (canScrollDown) return;
        event.preventDefault();
        if (wheelLocked) return;
        wheelLocked = true;
        nextSlide();
      }

      if (event.deltaY < 0) {
        if (coverVisible) {
          event.preventDefault();
          return;
        }
        if (canScrollUp) return;
        event.preventDefault();
        if (wheelLocked) return;
        wheelLocked = true;
        prevSlide();
      }

      window.setTimeout(() => {
        wheelLocked = false;
      }, 760);
    }, { passive: false });
  }

  function setupPresentationMode() {
    const toggles = Array.from(document.querySelectorAll("[data-presentation-toggle]"));
    if (!toggles.length) return;

    toggles.forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            document.body.classList.add("codp-presentation");
          } else {
            await document.exitFullscreen();
          }
        } catch (error) {
          console.error("Falha ao alternar tela cheia:", error);
        }
      });
    });

    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      document.body.classList.toggle("codp-presentation", isFullscreen);
      updatePresentationButtons();
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

  function setupCoverControls() {
    const currentStartCourseButton = document.getElementById("codp-start-course");

    if (currentStartCourseButton) {
      currentStartCourseButton.addEventListener("click", () => {
        hideCover();
        setSlide(0, { force: true });
      });
    }

    if (backToCoverButton) {
      backToCoverButton.addEventListener("click", () => {
        showCover();
      });
    }
  }

  hydrateHeroCover();
  revealElements.forEach((element) => element.classList.remove("is-visible"));
  setupAccordions();
  setupRailNavigation();
  setupArrowButtons();
  setupKeyboardNavigation();
  setupWheelNavigation();
  setupPresentationMode();
  setupCoverControls();
  setupParallax();
  setSlide(0, { force: true });
  showCover();
  updatePresentationButtons();
});
