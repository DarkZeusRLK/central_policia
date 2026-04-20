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
  const mapImageUrl = "../public/images/map/gta_map.webp";

  // Adicione novos pontos duplicando um objeto deste array.
  // Para cada novo ponto, crie uma pasta em /public/images/locations/<id-do-local>/
  // e inclua ao menos um arquivo *_mapa e um arquivo *_rua do local.
  // As coordenadas usam o formato [y, x] em pixels reais da imagem gta_map.webp.
  const locations = [
    {
      id: "arcadius",
      name: "Arcadius",
      coords: [466  , 1290],
      description: "Região corporativa e densa do centro. Bom ponto para leitura de cruzamentos, entradas laterais e chamadas rápidas de apoio.",
      mapImage: "../public/images/locations/Arcadius/Arcadius_mapa.png",
      images: [
        "../public/images/locations/Arcadius/Arcadius_rua.png",
      ],
    },
    {
      id: "banco_central",
      name: "Banco Central",
      coords: [498, 1200],
      description: "Área comercial estratégica no centro urbano. Exige boa atualização de QTH e atenção a rotas de contenção e fuga limpa.",
      mapImage: "../public/images/locations/Banco_central/Banco_central_mapa.png",
      images: [
        "../public/images/locations/Banco_central/Banco_central_rua.png",
      ],
    },
    {
      id: "cinzinha",
      name: "Cinzinha",
      coords: [470, 1190],
      description: "Trecho alto com vias sinuosas e transição rápida para a malha urbana. Importante para orientar SPEEDS e motocicletas com antecedência.",
      mapImage: "../public/images/locations/Cinzinha/Cinzinha_mapa.png",
      images: [
        "../public/images/locations/Cinzinha/Cinzinha_rua.png",
      ],
    },
    {
      id: "cinzao",
      name: "Cinzão",
      coords: [310, 1280],
      description: "Região urbana de forte circulação, com cruzamentos curtos e múltiplas saídas. Ideal para treinar leitura de rota e coordenação por rádio.",
      mapImage: "../public/images/locations/Cinzão/Cinzao_mapa.png",
      images: [
        "../public/images/locations/Cinzão/Cinzao_rua.png",
      ],
    },
    {
      id: "life_invader",
      name: "Life Invader",
      coords: [368, 1250],
      description: "Ponto de referência clássico em área mista entre avenida larga e miolo urbano. Útil para orientar aproximação, contenção e perseguição curta.",
      mapImage: "../public/images/locations/Life_Invader/Life_Invader_mapa.png",
      images: [
        "../public/images/locations/Life_Invader/Life_Invader_rua.png",
      ],
    },
  ];

  const fallbackImage = "../public/images/Logo_policia.png";
  const map = L.map(mapElement, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 1,
    zoomControl: false,
    attributionControl: false,
  });

  let activeLocation = locations[0] || null;
  let activeImageIndex = 0;
  let galleryExpanded = false;

  function buildGalleryItems(location) {
    const items = [];

    if (location?.mapImage) {
      items.push({
        src: location.mapImage,
        caption: "Posição do local no mapa",
      });
    }

    (location?.images || []).forEach((src, index) => {
      items.push({
        src,
        caption: `Visual da rua e da construção ${index + 1}`,
      });
    });

    if (!items.length) {
      items.push({
        src: fallbackImage,
        caption: "Imagem indisponível",
      });
    }

    return items;
  }

  function updateLegendState() {
    legendElement.querySelectorAll(".codp-map-legend-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.locationId === activeLocation?.id);
    });
  }

  function updateImage() {
    const galleryItems = buildGalleryItems(activeLocation);
    const currentItem = galleryItems[activeImageIndex] || galleryItems[0];

    modalImage.loading = "lazy";
    modalImage.decoding = "async";
    modalImage.src = currentItem.src;
    modalImage.alt = `${activeLocation?.name || "Local"} - ${currentItem.caption}`;
    modalCaption.textContent = currentItem.caption;
    modalCounter.textContent = `${activeImageIndex + 1} / ${galleryItems.length}`;
    prevImageButton.disabled = galleryItems.length <= 1;
    nextImageButton.disabled = galleryItems.length <= 1;
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
    modalImage.removeAttribute("src");
  }

  function shiftImage(direction) {
    const galleryItems = buildGalleryItems(activeLocation);
    activeImageIndex = (activeImageIndex + direction + galleryItems.length) % galleryItems.length;
    updateImage();
  }

  function mountMarkers() {
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

      const button = document.createElement("button");
      button.type = "button";
      button.className = "codp-map-legend-button";
      button.dataset.locationId = location.id;
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
  }

  function initializeMap() {
    const loader = new Image();
    loader.onload = () => {
      const bounds = [[0, 0], [loader.naturalHeight, loader.naturalWidth]];
      L.imageOverlay(mapImageUrl, bounds).addTo(map);
      map.fitBounds(bounds);
      map.setMaxBounds(bounds);
      mountMarkers();
      updateLegendState();
    };

    loader.onerror = () => {
      const fallbackBounds = [[0, 0], [1000, 2000]];
      L.imageOverlay(mapImageUrl, fallbackBounds).addTo(map);
      map.fitBounds(fallbackBounds);
      map.setMaxBounds(fallbackBounds);
      mountMarkers();
      updateLegendState();
    };

    loader.src = mapImageUrl;
  }

  initializeMap();

  closeTriggers.forEach((trigger) => trigger.addEventListener("click", closeModal));
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
});
