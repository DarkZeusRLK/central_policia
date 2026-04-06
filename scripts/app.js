/* ==========================================================================
   1. GESTÃƒO DE SESSÃƒO
   ========================================================================== */
const Session = {
  user: JSON.parse(localStorage.getItem("revoada_user")) || null,

  isLoggedIn() {
    return this.user !== null;
  },

  login(userData) {
    this.user = userData;
    localStorage.setItem("revoada_user", JSON.stringify(userData));

    // Atualiza a interface se a funÃ§Ã£o existir
    if (typeof updateUI === "function") updateUI();

    // NotificaÃ§Ã£o de boas-vindas
    if (typeof Notify !== "undefined") {
      Notify.success(`Bem-vindo, ${userData.username}!`);
    } else {
      console.log(`Login realizado: ${userData.username}`);
    }
  },

  logout() {
    this.user = null;
    localStorage.removeItem("revoada_user");
    localStorage.removeItem("revoada_is_journalist");
    localStorage.removeItem("revoada_police_role_label");
    localStorage.removeItem("revoada_police_role_key");

    if (typeof updateUI === "function") updateUI();

    if (typeof Notify !== "undefined") Notify.info("Você saiu do sistema.");

    setTimeout(() => (window.location.href = "/"), 1000);
  },
};

/* ==========================================================================
   1.1 PAGE LOADER
   ========================================================================== */
function initPageLoader() {
  if (document.querySelector(".page-loader")) return;

  const isPublicPage = window.location.pathname.includes("/public/");
  const logoPath = isPublicPage
    ? "../public/images/Logo_policia.png"
    : "public/images/Logo_policia.png";

  const loader = document.createElement("div");
  loader.className = "page-loader";
  loader.innerHTML = `
    <div class="page-loader-content">
      <img src="${logoPath}" alt="Logo Policia" class="page-loader-logo">
      <div class="page-loader-ring"></div>
      <div class="page-loader-text">Carregando...</div>
    </div>
  `;

  document.body.appendChild(loader);
}

function hidePageLoader() {
  document.body.classList.add("page-loaded");
  const loader = document.querySelector(".page-loader");
  if (!loader) return;
  setTimeout(() => loader.remove(), 600);
}

document.addEventListener("DOMContentLoaded", () => {
  initPageLoader();
  initInteractionGuards();
  optimizeImages();
  initMobileNavbar();
});

window.addEventListener("load", () => {
  hidePageLoader();
});

/* ==========================================================================
   1.2 INTERACTION GUARDS
   ========================================================================== */
function initInteractionGuards() {
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  document.addEventListener("selectstart", (event) => {
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
    ) {
      return;
    }
    event.preventDefault();
  });

  document.addEventListener("copy", (event) => {
    event.preventDefault();
  });

  document.addEventListener("cut", (event) => {
    event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (
      key === "f12" ||
      (isCtrl && key === "u") ||
      (isCtrl && key === "s") ||
      (isCtrl && isShift && ["i", "j", "c"].includes(key))
    ) {
      event.preventDefault();
    }
  });
}

function optimizeImages() {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    if (
      img.closest(".navbar") ||
      img.closest(".hero") ||
      img.closest(".page-loader")
    ) {
      if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
      if (!img.hasAttribute("loading")) img.setAttribute("loading", "eager");
      return;
    }

    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
    if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
    if (!img.hasAttribute("fetchpriority")) {
      img.setAttribute("fetchpriority", "low");
    }
  });
}

function initMobileNavbar() {
  const navbars = document.querySelectorAll(".navbar");
  if (!navbars.length) return;

  navbars.forEach((navbar) => {
    if (navbar.dataset.mobileNavReady === "true") return;
    navbar.dataset.mobileNavReady = "true";

    const toggle = navbar.querySelector(".nav-toggle");
    const navPrimary = navbar.querySelector(".nav-primary");
    if (!toggle || !navPrimary) return;

    const closeMenu = () => {
      navbar.classList.remove("mobile-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = navbar.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navbar.querySelectorAll(".dropdown > a").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        if (window.innerWidth > 980) return;
        event.preventDefault();
        const item = trigger.parentElement;
        const willOpen = !item.classList.contains("dropdown-open");
        navbar
          .querySelectorAll(".dropdown.dropdown-open")
          .forEach((dropdown) => dropdown.classList.remove("dropdown-open"));
        if (willOpen) item.classList.add("dropdown-open");
      });
    });

    navbar
      .querySelectorAll(".nav-links a, .dropdown-content a, .access-link, .btn-login")
      .forEach((link) => {
        if (link.parentElement?.classList?.contains("dropdown")) return;
        link.addEventListener("click", () => {
          if (window.innerWidth <= 980) closeMenu();
        });
      });

    document.addEventListener("click", (event) => {
      if (!navbar.contains(event.target)) {
        closeMenu();
        navbar
          .querySelectorAll(".dropdown.dropdown-open")
          .forEach((dropdown) => dropdown.classList.remove("dropdown-open"));
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 980) {
        closeMenu();
        navbar
          .querySelectorAll(".dropdown.dropdown-open")
          .forEach((dropdown) => dropdown.classList.remove("dropdown-open"));
      }
    });
  });
}

/* ==========================================================================
   2. CAPTURA DO LOGIN (QUANDO VOLTA DO DISCORD)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Verifica a URL atual
  const params = new URLSearchParams(window.location.search);

  // Se tiver 'username' na URL, Ã© porque o login acabou de acontecer
  if (params.has("username")) {
    // Tenta ler os roles que vieram como texto
    let rolesArray = [];
    const rolesString = params.get("roles");

    if (rolesString) {
      try {
        rolesArray = JSON.parse(rolesString);
      } catch (e) {
        console.error("Erro ao ler cargos:", e);
      }
    }

    // Monta o objeto do usuÃ¡rio completo
    const userData = {
      username: params.get("username"),
      id: params.get("id"),
      avatar: params.get("avatar"),
      roles: rolesArray, // Salva os cargos aqui!
    };

    // Salva na sessÃ£o
    Session.login(userData);

    // Limpa a URL para remover os dados visÃ­veis
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Se tiver funÃ§Ã£o de inicializar UI global, chama ela
  if (typeof updateUI === "function") updateUI();
});
/* ==========================================================================
   2. SISTEMA DE NOTIFICAÃ‡Ã•ES
   ========================================================================== */
const Notify = {
  container: null,
  activeLoadingToast: null,

  init() {
    if (!document.querySelector(".notification-container")) {
      this.container = document.createElement("div");
      this.container.className = "notification-container";
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector(".notification-container");
    }
  },

  show(message, type = "info") {
    if (!this.container) this.init();

    if (type === "loading" && this.activeLoadingToast) {
      this.activeLoadingToast.remove();
      this.activeLoadingToast = null;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-check-circle";
    if (type === "error") icon = "fa-exclamation-triangle";
    if (type === "loading") icon = "fa-spinner fa-spin";

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    this.container.appendChild(toast);

    if (type !== "loading") {
      setTimeout(() => {
        toast.style.animation = "slideIn 0.3s reverse forwards";
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    } else {
      this.activeLoadingToast = toast;
    }

    return toast;
  },

  clearLoading() {
    if (!this.activeLoadingToast) return;
    this.activeLoadingToast.style.animation = "slideIn 0.3s reverse forwards";
    setTimeout(() => {
      this.activeLoadingToast?.remove();
      this.activeLoadingToast = null;
    }, 300);
  },

  success(msg) {
    this.clearLoading();
    this.show(msg, "success");
  },
  error(msg) {
    this.clearLoading();
    this.show(msg, "error");
  },
  info(msg) {
    this.show(msg, "info");
  },
  loading(msg) {
    this.show(msg, "loading");
  },
};

/* ==========================================================================
   3. CONTROLE DOS MODAIS
   ========================================================================== */
function openLoginModal(action) {
  if (action) {
    localStorage.setItem("pending_action", action);
  }

  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeLoginModal() {
  localStorage.removeItem("pending_action");
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.add("hidden");
}

function proceedToLogin() {
  window.location.href = "/api/auth";
}

// Modal DinÃ¢mico de Acesso Negado (Policial)
function openAccessDeniedModal() {
  if (document.getElementById("denied-modal")) return;

  const div = document.createElement("div");
  div.id = "denied-modal";
  div.className = "modal-overlay";
  div.innerHTML = `
        <div class="modal-box" style="border-color: #ef4444;">
            <div class="modal-icon"><i class="fa-solid fa-ban" style="color: #ef4444;"></i></div>
            <h2>Acesso Restrito</h2>
            <p>Você não faz parte da corporação oficial no Discord.</p>
            <div class="modal-actions">
                <button class="btn-close-modal" onclick="document.getElementById('denied-modal').remove()">Fechar</button>
            </div>
        </div>
    `;
  document.body.appendChild(div);
}

/* ==========================================================================
   4. INICIALIZAÃ‡ÃƒO E RELÃ“GIO
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init();
  updateUI();
  checkUrlLogin();
  optimizeMediaLoading();

  // Inicia RelÃ³gio e Data
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Carregamentos AssÃ­ncronos
  loadNews();

  // SÃ³ carrega comandantes gerais se estiver na pÃ¡gina principal (index.html)
  // Nas pÃ¡ginas de departamento, sÃ³ carrega os comandantes especÃ­ficos
  const isMainPage =
    !document.getElementById("pcerj-leadership") &&
    !document.getElementById("pmerj-leadership") &&
    !document.getElementById("pf-leadership") &&
    !document.getElementById("prf-leadership");

  if (isMainPage) {
    loadCommanders();
  }

  loadDepartmentLeadership();
  setupNavigation();

  // Listeners de FormulÃ¡rio e Modal
  const formBO = document.getElementById("form-bo");
  if (formBO) formBO.addEventListener("submit", handleBOSubmit);
  document.addEventListener("click", (e) => {
    const modal = document.getElementById("login-modal");
    if (e.target === modal) closeLoginModal();
  });

  if (window.location.pathname.includes("boletim.html")) {
    if (!Session.isLoggedIn()) {
      openLoginModal("open_boletim");
    } else {
      updateFormAvatar();
    }
  }
});

function optimizeMediaLoading() {
  document.querySelectorAll("img").forEach((img, index) => {
    if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");

    const isCriticalImage =
      index < 3 ||
      img.classList.contains("loading-logo") ||
      img.classList.contains("commanders-banner-logo") ||
      img.closest(".navbar") ||
      img.closest(".sidebar-header") ||
      img.id === "modalImage";

    if (!isCriticalImage && !img.getAttribute("loading")) {
      img.setAttribute("loading", "lazy");
    }
  });

  document
    .querySelectorAll(
      ".photo-gallery-item img, .news-card img, .news-article-image, .commander-card img, .commanders-banner-image, .gallery-item img, .dept-gallery img"
    )
    .forEach((img) => {
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    });

  const heroVideo = document.getElementById("myVideo");
  const delayedSource = heroVideo
    ? heroVideo.querySelector("source[data-src]")
    : null;

  if (heroVideo && delayedSource && !delayedSource.src) {
    const startVideoLoad = () => {
      delayedSource.src = delayedSource.dataset.src;
      heroVideo.load();
      heroVideo.play().catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(startVideoLoad, { timeout: 1500 });
    } else {
      window.setTimeout(startVideoLoad, 600);
    }
  }
}

// FunÃ§Ã£o de Atualizar Data e Hora (Chamada a cada segundo)
function updateDateTime() {
  const now = new Date();

  // Data
  const dateEl = document.getElementById("date-display");
  if (dateEl) dateEl.innerText = now.toLocaleDateString("pt-BR");

  // Hora (Formato 00:00)
  const timeEl = document.getElementById("time-display");
  if (timeEl) {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    timeEl.innerText = `${hours}:${minutes}`;
  }
}

/* ==========================================================================
   5. NAVEGAÃ‡ÃƒO E LINKS
   ========================================================================== */
function setupNavigation() {
  // 1. Link Boletim
  const btnBoletim = document.getElementById("nav-bo");
  if (btnBoletim) {
    const newBtn = btnBoletim.cloneNode(true);
    btnBoletim.parentNode.replaceChild(newBtn, btnBoletim);
    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!Session.isLoggedIn()) {
        openLoginModal("open_boletim");
      } else {
        showSection("boletim-section");
        updateFormAvatar();
      }
    });
  }

  // 2. Link Acesso Policial
  const btnPolice =
    document.getElementById("nav-police") ||
    document.querySelector('a[href="#"].disabled') ||
    document.querySelector(".fa-lock").parentElement;

  if (btnPolice) {
    btnPolice.classList.remove("disabled");
    const newPoliceBtn = btnPolice.cloneNode(true);
    btnPolice.parentNode.replaceChild(newPoliceBtn, btnPolice);
    newPoliceBtn.addEventListener("click", handlePoliceAccess);
  }

  // 3. Link Home
  const btnHome =
    document.querySelector('a[href="#home"]') ||
    document.querySelector('a[href="#"]');
  if (btnHome) {
    btnHome.addEventListener("click", (e) => {
      e.preventDefault();
      showSection("jornal");
    });
  }
}

function showSection(sectionId) {
  const sections = ["jornal", "boletim-section"];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* ==========================================================================
   6. LÃ“GICA DE LOGIN, UI E ACESSO POLICIAL
   ========================================================================== */
function checkUrlLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("username")) {
    let rolesArray = [];
    const rolesString = urlParams.get("roles");

    if (rolesString) {
      try {
        rolesArray = JSON.parse(rolesString);
      } catch (error) {
        console.error("Erro ao ler cargos no checkUrlLogin:", error);
      }
    }

    const userData = {
      username: urlParams.get("username"),
      id: urlParams.get("id"),
      avatar: urlParams.get("avatar"),
      roles: rolesArray,
    };
    Session.login(userData);
    window.history.replaceState({}, document.title, "/");
  }

  if (Session.isLoggedIn()) {
    const pendingAction = localStorage.getItem("pending_action");
    if (!pendingAction) return;

    localStorage.removeItem("pending_action");

    if (pendingAction === "open_boletim") {
      const isBoletimPage = window.location.pathname.includes("boletim.html");
      if (!isBoletimPage) {
        const redirectPath = window.location.pathname.includes("/public/")
          ? "boletim.html"
          : "public/boletim.html";
        window.location.href = redirectPath;
        return;
      }
      closeLoginModal();
      updateFormAvatar();
    } else if (pendingAction === "access_police") {
      handlePoliceAccess({ preventDefault: () => {} });
    }
  }
}

async function handlePoliceAccess(e) {
  e.preventDefault();

  if (!Session.isLoggedIn()) {
    openLoginModal("access_police");
    return;
  }

  Notify.loading("Verificando credenciais...");

  try {
    const response = await fetch("/api/discord?action=check-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Session.user.id }),
    });

    const data = await response.json();

    if (data.isMember) {
      const refreshedUser = {
        ...(Session.user || {}),
        roles: Array.isArray(data.roles) ? data.roles : [],
      };

      Session.login(refreshedUser);
      Notify.success("Acesso Policial Autorizado.");
      localStorage.setItem("revoada_is_journalist", data.isJournalist);
      localStorage.removeItem("revoada_police_role_label");
      localStorage.removeItem("revoada_police_role_key");
      setTimeout(() => {
        // Detecta o caminho correto baseado na pÃ¡gina atual
        const currentPath = window.location.pathname;
        let redirectPath;

        if (
          currentPath.includes("/public/") ||
          currentPath.startsWith("/public")
        ) {
          // Se estiver em uma pÃ¡gina dentro de /public/, usa caminho relativo
          redirectPath = "central_policial.html";
        } else {
          // Se estiver na raiz (index.html), usa caminho com public/
          redirectPath = "public/central_policial.html";
        }

        window.location.href = redirectPath;
      }, 1000);
    } else {
      Notify.error("Acesso Negado.");
      openAccessDeniedModal();
    }
  } catch (error) {
    console.error(error);
    Notify.error("Erro de comunicação com a central.");
  }
}

function updateUI() {
  const navUserGroup = document.querySelector(".nav-user-group");
  const btnLogin = document.getElementById("btn-login");

  if (Session.isLoggedIn()) {
    if (btnLogin) btnLogin.classList.add("hidden");
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();

    const badge = document.createElement("div");
    badge.id = "user-badge-nav";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.gap = "10px";
    badge.style.cursor = "pointer";
    badge.onclick = () => Session.logout();
    badge.innerHTML = `
            <span style="color: white; font-weight: bold;">${Session.user.username}</span>
            <img src="https://cdn.discordapp.com/avatars/${Session.user.id}/${Session.user.avatar}.png" 
                 alt="Avatar" style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--accent-gold);">
        `;
    if (navUserGroup) {
      const userArea = document.getElementById("user-area");
      if (userArea) {
        navUserGroup.insertBefore(badge, userArea);
      } else {
        navUserGroup.appendChild(badge);
      }
    }
    updateFormAvatar();
  } else {
    if (btnLogin) btnLogin.classList.remove("hidden");
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();
  }

}

function updateFormAvatar() {
  const userBadgeForm = document.querySelector(".user-badge img");
  const userBadgeName = document.querySelector(".user-badge span");
  if (userBadgeForm && Session.user) {
    userBadgeForm.src = `https://cdn.discordapp.com/avatars/${Session.user.id}/${Session.user.avatar}.png`;
  }
  if (userBadgeName && Session.user) {
    userBadgeName.innerText = Session.user.username;
  }
}

/* ==========================================================================
   7. DADOS E FORMULÃRIOS
   ========================================================================== */

// --- CARREGAR NOTÃCIAS (API) ---
async function loadNews() {
  const grid = document.getElementById("news-grid");
  if (!grid) return;

  try {
    const req = await fetch("/api/content?action=news");
    if (!req.ok) throw new Error("Falha na API");

    const data = await req.json();
    grid.innerHTML = "";

    if (data.length === 0) {
      grid.innerHTML = `<p style="color: #cbd5e1; grid-column: span 3; text-align: center;">Nenhuma notícia recente no mural.</p>`;
      return;
    }

    grid.innerHTML = data
      .map(
        (news) => `
        <article class="news-card">
            <div class="news-image-container" style="height: 200px; overflow: hidden; position: relative; background: rgba(30, 41, 59, 0.5);">
                <img src="${news.image}" alt="Capa da Notícia" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover; transition: 0.3s;" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'200\'%3E%3Crect fill=\'%231e293b\' width=\'400\' height=\'200\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' font-family=\'Arial\' font-size=\'16\' fill=\'%23fbbf24\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3EImagem Indisponível%3C/text%3E%3C/svg%3E'; this.style.opacity='0.7';">
                <div style="position: absolute; bottom: 0; left: 0; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; font-size: 0.8rem;">
                    <i class="fa-solid fa-camera"></i> ${news.author}
                </div>
            </div>

            <div class="news-content" style="padding: 20px;">
                <div class="news-date" style="color: var(--accent-gold); font-size: 0.85rem; margin-bottom: 10px;">
                    <i class="fa-regular fa-calendar"></i> ${news.date}
                </div>

                <h3 class="news-title" style="color: white; font-size: 1.2rem; margin-bottom: 10px; line-height: 1.4;">
                    ${news.title}
                </h3>

                <p style="color: #94a3b8; font-size: 0.95rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                    ${news.summary}
                </p>
            </div>
        </article>`,
      )
      .join("");
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<p style="color: #cbd5e1; grid-column: span 3; text-align: center;">Erro ao carregar notícias do servidor.</p>`;
  }
}

function loadRecruitment(deptId) {
  const deptFiles = {
    pcerj: "public/departamentopcerj.html",
    pmerj: "public/batalhaopmerj.html",
    prf: "public/departamentoprf.html",
    pf: "public/departamentopf.html",
  };

  const targetFile = deptFiles[deptId];

  if (targetFile) {
    Notify.loading("Redirecionando para o departamento...");
    setTimeout(() => {
      window.location.href = targetFile;
    }, 500);
  } else {
    Notify.error("Página do departamento não encontrada.");
  }
}

async function handleBOSubmit(e) {
  e.preventDefault();
  if (!Session.isLoggedIn()) return Notify.error("Login necessário.");

  Notify.loading("Enviando...");
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  data.userId = Session.user.id;
  data.username = Session.user.username;

  try {
    const response = await fetch("/api/content?action=submit-bo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      Notify.success("B.O. Enviado!");
      e.target.reset();
      setTimeout(() => showSection("jornal"), 2000);
    } else {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Erro ao enviar boletim.");
    }
  } catch (error) {
    Notify.error(error.message || "Erro ao enviar.");
  }
}

/* ==========================================================================
   8. CARREGAR COMANDANTES (DINÃ‚MICO)
   ========================================================================== */
async function loadCommanders() {
  const container = document.querySelector(".commanders-grid");
  if (!container) return;

  try {
    const req = await fetch("/api/discord?action=commanders");
    const commanders = await req.json();

    if (!req.ok || !Array.isArray(commanders) || !commanders.length) {
      console.warn("Não foi possível carregar todos os comandantes.");

      // Remove o Ã­cone de loading se falhar
      const loadingIcon = container.querySelector(".fa-spinner");
      if (loadingIcon && loadingIcon.parentElement)
        loadingIcon.parentElement.innerHTML =
          "<p>Comando indisponível no momento.</p>";

      return;
    }

    // DefiniÃ§Ã£o dos Cargos (Ordem fixa)
    const roles = [
      {
        title: "Comandante Geral",
        desc: "Responsável geral pela Polícia Revoada, com atribuições voltadas à gestão interna, coordenação operacional e supervisão dos setores da corporação, assegurando o cumprimento das normas, a eficiência administrativa e a integridade institucional.",
      },
      {
        title: "Subcomandante Geral",
        desc: "Dirige e fiscaliza a atuação da Corregedoria de Polícia Revoada, coordena a atuação dos comandantes de grupamentos e guarnições especiais, promove e realiza o gerenciamento tático das tropas em campo. Atua como consultor estratégico em pacificações e operações de alto risco.",
      },
      {
        title: "Subcomandante Geral",
        desc: "Supervisionar a atuação da corporação, supervisionar os setores administrativos, o gerenciamento e a liderança das guarnições, participar das decisões do alto comando, bem como coordenar a atuação operacional.",
      },
    ];

    container.innerHTML = ""; // Limpa o loading

    // Cria os cards dinÃ¢micos
    const cards = commanders.flatMap((cmd, index) => {
      if (index >= roles.length) return;

      return `
            <div class="commander-card">
                <div class="cmd-img-container">
                    <img src="${cmd.avatarUrl}" loading="lazy" decoding="async"
                         alt="${cmd.username}">
                </div>
                <h3>${cmd.username}</h3>
                <span class="rank">${roles[index].title}</span>
                <p>${roles[index].desc}</p>
            </div>
        `;
    });
    container.innerHTML = cards.join("");
  } catch (e) {
    console.error("Erro ao carregar comandantes:", e);
    const loadingIcon = container.querySelector(".fa-spinner");
    if (loadingIcon && loadingIcon.parentElement)
      loadingIcon.parentElement.innerHTML =
        "<p>Comando indisponível no momento.</p>";
  }
}
/* ==========================================================================
   9. CARREGAMENTO DE LIDERANÃ‡A DEPARTAMENTAL
   ========================================================================== */

async function loadDepartmentLeadership() {
  // ConfiguraÃ§Ãµes para cada pÃ¡gina (ID do container no HTML : ConfiguraÃ§Ã£o da API)
  const configs = {
    "pcerj-leadership": {
      api: "/api/discord?action=leadership&group=pcerj",
      roles: [
        {
          title: "Delegado Geral",
          desc: "Delegado Investigativo responsável por todos os inquéritos policiais e atividades relacionadas ao âmbito investigativo.",
        },
        {
          title: "Delegado Adjunto",
          desc: "Delegado Operacional, responsável pelas atividades dos Grupamentos e Guarnições especiais, sendo comandante das pacificações.",
        },
        {
          title: "Delegado Adjunto",
          desc: "Delegado Administrativo, responsável pelas atividades de inatividade e escrivães.",
        },
      ],
    },
    "pmerj-leadership": {
      api: "/api/discord?action=leadership&group=pmerj",
      roles: [
        { title: "Comandante", desc: "Responsável pelo batalhão." },
        { title: "Subcomandante", desc: "Gestão da tropa e disciplina." },
        { title: "Subcomandante", desc: "Planejamento de operações." },
      ],
    },
    "pf-leadership": {
      api: "/api/discord?action=leadership&group=pf",
      roles: [
        { title: "Diretor Geral", desc: "Comando supremo da Polícia Federal." },
        {
          title: "Vice-Diretor",
          desc: "Gestão Administrativa - para gestão tática, operacional",
        },
        { title: "Vice-Diretor", desc: "Fiscalização e conduta." },
      ],
    },
    "prf-leadership": {
      api: "/api/discord?action=leadership&group=prf",
      roles: [
        {
          title: "Diretor Geral",
          desc: "Chefe da Polícia Rodoviária Federal.",
        },
        { title: "Vice-Diretor", desc: "Coordenação regional." },
        { title: "Vice-Diretor", desc: "Fiscalização nas rodovias." },
      ],
    },
  };

  // Procura na pÃ¡gina atual se existe algum desses containers
  for (const [containerId, config] of Object.entries(configs)) {
    const container = document.getElementById(containerId);

    if (container) {
      try {
        const req = await fetch(config.api);
        const leaders = await req.json();

        if (!req.ok || !leaders || leaders.length === 0) {
          container.innerHTML =
            "<p style='text-align:center; color:#64748b;'>Liderança não definida.</p>";
          return;
        }

        container.innerHTML = ""; // Limpa o loader

        const cards = leaders.map((leader, index) => {
          // Pega o cargo correspondente ou usa um genÃ©rico se tiver mais gente que cargos
          const role = config.roles[index] || {
            title: "Oficial Superior",
            desc: "Membro da diretoria.",
          };

          return `
                        <div class="commander-card">
                            <div class="cmd-img-container">
                                <img src="${leader.avatarUrl}" loading="lazy" decoding="async" alt="${leader.username}">
                            </div>
                            <h3>${leader.username}</h3>
                            <span class="rank">${role.title}</span>
                            <p>${role.desc}</p>
                        </div>
                    `;
        });
        container.innerHTML = cards.join("");
      } catch (e) {
        console.error(`Erro ao carregar ${containerId}:`, e);
        container.innerHTML = "<p>Erro ao carregar dados.</p>";
      }
    }
  }
}































