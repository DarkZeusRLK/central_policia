document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("codp-reference-map");
  const legendElement = document.getElementById("codp-map-legend");
  const modal = document.getElementById("codp-map-modal");
  if (!mapElement || !legendElement || !modal || typeof L === "undefined") return;

  const modalTitle = document.getElementById("codp-map-modal-title");
  const modalDescription = document.getElementById("codp-map-modal-description");
  const modalImage = document.getElementById("codp-map-modal-image");
  const modalCaption = document.getElementById("codp-map-image-caption");
  const modalCounter = document.getElementById("codp-map-image-counter");
  const viewMoreButton = document.getElementById("codp-map-view-more");
  const prevImageButton = document.getElementById("codp-map-prev-image");
  const nextImageButton = document.getElementById("codp-map-next-image");
  const closeTriggers = modal.querySelectorAll("[data-map-close]");

  const fallbackImage = "../public/images/image.png";
  const mapImageUrl = "../public/images/image.png";
  const mapWidth = 1250;
  const mapHeight = 793;

  const locations = [
    {
      name: "CinzÃ£o",
      coords: [530, 320],
      description: "Ãrea urbana com mÃºltiplas rotas de fuga, saÃ­das laterais e grande valor tÃ¡tico para atualizaÃ§Ãµes rÃ¡pidas no rÃ¡dio.",
      images: ["../public/images/instagram_10.png", "../public/images/instagram_11.png"],
    },
    {
      name: "PraÃ§a Central",
      coords: [615, 420],
      description: "Ponto de referÃªncia aberto e de fÃ¡cil visualizaÃ§Ã£o, ideal para marcaÃ§Ã£o de QTH e organizaÃ§Ã£o de apoio prÃ³ximo.",
      images: ["../public/images/instagram_12.png", "../public/images/instagram_13.png"],
    },
    {
      name: "Banco Central",
      coords: [700, 350],
      description: "RegiÃ£o com grande fluxo e acessos rÃ¡pidos. Requer comunicaÃ§Ã£o limpa para orientar SPEEDS e unidades de contenÃ§Ã£o.",
      images: ["../public/images/instagram_14.png", "../public/images/instagram_15.png"],
    },
    {
      name: "Acesso Norte",
      coords: [395, 180],
      description: "Trecho importante para leitura de rota e antecipaÃ§Ã£o de fuga longa. Bom ponto para cortes e cerco progressivo.",
      images: ["../public/images/instagram_16.png", "../public/images/instagram_8.png"],
    },
    {
      name: "Retorno Sul",
      coords: [860, 610],
      description: "RegiÃ£o de retorno e redistribuiÃ§Ã£o de viaturas, Ãºtil para reorganizar cerco sem congestionar a linha principal.",
      images: ["../public/images/instagram_9.png", "../public/images/instagram_1.png"],
    },
  ];

  let activeLocation = locations[0];
  let activeImageIndex = 0;
  let galleryExpanded = false;

  const map = L.map(mapElement, {
    crs: L.CRS.Simple,
    minZoom: -1.5,
    maxZoom: 1,
    zoomControl: false,
    attributionControl: false,
  });

  const bounds = [[0, 0], [mapHeight, mapWidth]];
  L.imageOverlay(mapImageUrl, bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds);

  const markers = [];

  function updateLegendState() {
    legendElement.querySelectorAll(".codp-map-legend-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.locationName === activeLocation?.name);
    });
  }

  function updateImage() {
    const images = activeLocation?.images?.length ? activeLocation.images : [fallbackImage];
    const currentImage = images[activeImageIndex] || fallbackImage;
    modalImage.src = currentImage;
    modalImage.alt = `Visual do local ${activeLocation.name}`;
    modalCaption.textContent = galleryExpanded ? "Visualização da rua" : "Imagem principal";
    modalCounter.textContent = `${activeImageIndex + 1} / ${images.length}`;
    prevImageButton.disabled = images.length <= 1;
    nextImageButton.disabled = images.length <= 1;
  }

  function renderModal() {
    if (!activeLocation) return;
    modalTitle.textContent = activeLocation.name;
    modalDescription.textContent = activeLocation.description;
    modal.classList.toggle("is-gallery-expanded", galleryExpanded);
    viewMoreButton.innerHTML = galleryExpanded
      ? '<i class="fa-solid fa-eye-slash"></i><span>Recolher visualização</span>'
      : '<i class="fa-solid fa-images"></i><span>Ver mais</span>';
    updateImage();
  }

  function openLocation(location) {
    activeLocation = location;
    activeImageIndex = 0;
    galleryExpanded = false;
    renderModal();
    updateLegendState();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("codp-map-modal-open");
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("codp-map-modal-open");
  }

  function shiftImage(direction) {
    const images = activeLocation?.images?.length ? activeLocation.images : [fallbackImage];
    activeImageIndex = (activeImageIndex + direction + images.length) % images.length;
    updateImage();
  }

  locations.forEach((location) => {
    const icon = L.divIcon({
      className: "",
      html: '<div class="codp-map-marker" aria-hidden="true"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker(location.coords, { icon, keyboard: true }).addTo(map);
    marker.bindTooltip(location.name, {
      direction: "top",
      offset: [0, -10],
      opacity: 0.92,
      className: "codp-map-tooltip",
    });
    marker.on("click", () => openLocation(location));
    markers.push({ marker, location });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "codp-map-legend-button";
    button.dataset.locationName = location.name;
    button.innerHTML = `
      <span class="codp-map-legend-badge"></span>
      <span>
        <strong>${location.name}</strong>
        <small>${location.description}</small>
      </span>
    `;
    button.addEventListener("click", () => {
      map.flyTo(location.coords, map.getZoom(), { duration: 0.5 });
      openLocation(location);
    });
    legendElement.appendChild(button);
  });

  closeTriggers.forEach((trigger) => {
    trigger.addEventListener("click", closeModal);
  });

  prevImageButton.addEventListener("click", () => shiftImage(-1));
  nextImageButton.addEventListener("click", () => shiftImage(1));

  viewMoreButton.addEventListener("click", () => {
    galleryExpanded = !galleryExpanded;
    renderModal();
  });

  document.addEventListener("keydown", (event) => {
    if (modal.classList.contains("hidden")) return;

    if (event.key === "Escape") closeModal();
    if (event.key === "ArrowLeft") shiftImage(-1);
    if (event.key === "ArrowRight") shiftImage(1);
  });

  document.addEventListener("codp:slidechange", (event) => {
    const isReferenceSlide = event.detail?.slideId === "referencias";
    if (!isReferenceSlide) return;
    window.setTimeout(() => map.invalidateSize(), 240);
  });

  updateLegendState();
});
