// Lightbox compartilhado por todas as páginas.
// Qualquer elemento com [data-lightbox-src="..."] abre a imagem ampliada ao ser clicado.
// Elementos que compartilham o mesmo [data-lightbox-group="nome"] navegam juntos (setas/teclado).
// Para conteúdo renderizado dinamicamente (JS), chame RevoadaLightbox.bind() de novo após inserir os elementos.
(function () {
  let items = [];
  let currentIndex = -1;
  let modalEl, imgEl, captionEl, prevBtn, nextBtn, closeBtn;
  let lastFocused = null;

  function buildModal() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "lightbox";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-label", "Visualização de imagem");
    modalEl.innerHTML = [
      '<div class="lightbox-content">',
      '<button type="button" class="lightbox-close" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>',
      '<button type="button" class="lightbox-nav prev" aria-label="Imagem anterior"><i class="fa-solid fa-chevron-left"></i></button>',
      '<img alt="" />',
      '<p class="lightbox-caption"></p>',
      '<button type="button" class="lightbox-nav next" aria-label="Próxima imagem"><i class="fa-solid fa-chevron-right"></i></button>',
      "</div>",
    ].join("");
    document.body.appendChild(modalEl);

    imgEl = modalEl.querySelector("img");
    captionEl = modalEl.querySelector(".lightbox-caption");
    prevBtn = modalEl.querySelector(".prev");
    nextBtn = modalEl.querySelector(".next");
    closeBtn = modalEl.querySelector(".lightbox-close");

    closeBtn.addEventListener("click", closeLightbox);
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) closeLightbox();
    });
    prevBtn.addEventListener("click", () => showAt(currentIndex - 1));
    nextBtn.addEventListener("click", () => showAt(currentIndex + 1));
    document.addEventListener("keydown", (event) => {
      if (!modalEl.classList.contains("active")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showAt(currentIndex - 1);
      if (event.key === "ArrowRight") showAt(currentIndex + 1);
    });
  }

  function showAt(index) {
    if (!items.length) return;
    currentIndex = (index + items.length) % items.length;
    const item = items[currentIndex];
    imgEl.src = item.src;
    imgEl.alt = item.caption || "";
    captionEl.textContent = item.caption || "";
    captionEl.hidden = !item.caption;
    const multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
  }

  function openLightbox(groupItems, startIndex) {
    if (!groupItems.length) return;
    buildModal();
    items = groupItems;
    lastFocused = document.activeElement;
    showAt(startIndex);
    modalEl.classList.add("active");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeLightbox() {
    if (!modalEl || !modalEl.classList.contains("active")) return;
    modalEl.classList.remove("active");
    document.body.style.overflow = "";
    imgEl.src = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function collectGroup(trigger) {
    const groupName = trigger.getAttribute("data-lightbox-group");
    let candidates;
    if (groupName && window.CSS && CSS.escape) {
      candidates = Array.from(
        document.querySelectorAll(`[data-lightbox-src][data-lightbox-group="${CSS.escape(groupName)}"]`),
      );
    } else {
      candidates = [trigger];
    }
    return candidates.map((el) => ({
      src: el.getAttribute("data-lightbox-src"),
      caption: el.getAttribute("data-lightbox-caption") || "",
      el,
    }));
  }

  function activateTrigger(trigger) {
    const group = collectGroup(trigger);
    const startIndex = group.findIndex((item) => item.el === trigger);
    openLightbox(group, startIndex < 0 ? 0 : startIndex);
  }

  function bindTriggers(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-lightbox-src]").forEach((el) => {
      if (el.dataset.lightboxBound === "true") return;
      el.dataset.lightboxBound = "true";
      if (!el.style.cursor) el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        activateTrigger(el);
      });
    });
  }

  window.RevoadaLightbox = {
    bind: bindTriggers,
    open(src, caption) {
      openLightbox([{ src, caption: caption || "" }], 0);
    },
    close: closeLightbox,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bindTriggers());
  } else {
    bindTriggers();
  }
})();
