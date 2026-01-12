/* ==========================================================================
   1. GESTÃO DE SESSÃO
   ========================================================================== */
const Session = {
  user: JSON.parse(localStorage.getItem("revoada_user")) || null,

  isLoggedIn() {
    return this.user !== null;
  },

  login(userData) {
    this.user = userData;
    localStorage.setItem("revoada_user", JSON.stringify(userData));

    // Atualiza a interface se a função existir
    if (typeof updateUI === "function") updateUI();

    // Notificação de boas-vindas
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

    if (typeof updateUI === "function") updateUI();

    if (typeof Notify !== "undefined") Notify.info("Você saiu do sistema.");

    setTimeout(() => (window.location.href = "/"), 1000);
  },
};

/* ==========================================================================
   2. CAPTURA DO LOGIN (QUANDO VOLTA DO DISCORD)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Verifica a URL atual
  const params = new URLSearchParams(window.location.search);

  // Se tiver 'username' na URL, é porque o login acabou de acontecer
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

    // Monta o objeto do usuário completo
    const userData = {
      username: params.get("username"),
      id: params.get("id"),
      avatar: params.get("avatar"),
      roles: rolesArray, // Salva os cargos aqui!
    };

    // Salva na sessão
    Session.login(userData);

    // Limpa a URL para remover os dados visíveis
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Se tiver função de inicializar UI global, chama ela
  if (typeof updateUI === "function") updateUI();
});
/* ==========================================================================
   2. SISTEMA DE NOTIFICAÇÕES
   ========================================================================== */
const Notify = {
  container: null,

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
    }
  },

  success(msg) {
    this.show(msg, "success");
  },
  error(msg) {
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
function openLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.add("hidden");
}

function proceedToLogin() {
  localStorage.setItem("pending_action", "open_boletim");
  window.location.href = "/api/auth";
}

// Modal Dinâmico de Acesso Negado (Policial)
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
   4. INICIALIZAÇÃO E RELÓGIO
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init();
  updateUI();
  checkUrlLogin();

  // Inicia Relógio e Data
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Carregamentos Assíncronos
  loadNews();
  loadCommanders();
  loadDepartmentLeadership();
  setupNavigation();

  // Listeners de Formulário e Modal
  const formBO = document.getElementById("form-bo");
  if (formBO) formBO.addEventListener("submit", handleBOSubmit);

  document.addEventListener("click", (e) => {
    const modal = document.getElementById("login-modal");
    if (e.target === modal) closeLoginModal();
  });
});

// Função de Atualizar Data e Hora (Chamada a cada segundo)
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
   5. NAVEGAÇÃO E LINKS
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
        openLoginModal();
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
   6. LÓGICA DE LOGIN, UI E ACESSO POLICIAL
   ========================================================================== */
function checkUrlLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("username")) {
    const userData = {
      username: urlParams.get("username"),
      id: urlParams.get("id"),
      avatar: urlParams.get("avatar"),
    };
    Session.login(userData);
    window.history.replaceState({}, document.title, "/");
  }

  if (Session.isLoggedIn()) {
    const pendingAction = localStorage.getItem("pending_action");
    if (pendingAction === "open_boletim") {
      localStorage.removeItem("pending_action");
      showSection("boletim-section");
      updateFormAvatar();
    }
  }
}

async function handlePoliceAccess(e) {
  e.preventDefault();

  if (!Session.isLoggedIn()) {
    openLoginModal();
    return;
  }

  Notify.loading("Verificando credenciais...");

  try {
    const response = await fetch("/api/check-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Session.user.id }),
    });

    const data = await response.json();

    if (data.isMember) {
      Notify.success("Acesso Policial Autorizado.");
      localStorage.setItem("revoada_is_journalist", data.isJournalist);
      setTimeout(() => {
        window.location.href = "public/central_policial.html";
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
  const navRight = document.querySelector(".navbar .nav-links");
  const btnLogin = document.getElementById("btn-login");

  if (Session.isLoggedIn()) {
    if (btnLogin) btnLogin.classList.add("hidden");
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();

    const badge = document.createElement("li");
    badge.id = "user-badge-nav";
    badge.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="Session.logout()">
                <span style="color: white; font-weight: bold;">${Session.user.username}</span>
                <img src="https://cdn.discordapp.com/avatars/${Session.user.id}/${Session.user.avatar}.png" 
                     style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--accent-gold);">
            </div>
        `;
    if (navRight) navRight.appendChild(badge);
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
   7. DADOS E FORMULÁRIOS
   ========================================================================== */

// --- CARREGAR NOTÍCIAS (API) ---
async function loadNews() {
  const grid = document.getElementById("news-grid");
  if (!grid) return;

  try {
    const req = await fetch("/api/get-news");
    if (!req.ok) throw new Error("Falha na API");

    const data = await req.json();
    grid.innerHTML = "";

    if (data.length === 0) {
      grid.innerHTML = `<p style="color: #cbd5e1; grid-column: span 3; text-align: center;">Nenhuma notícia recente no mural.</p>`;
      return;
    }

    data.forEach((news) => {
      grid.innerHTML += `
        <article class="news-card">
            <div class="news-image-container" style="height: 200px; overflow: hidden; position: relative;">
                <img src="${news.image}" alt="Capa da Notícia" style="width: 100%; height: 100%; object-fit: cover; transition: 0.3s;">
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
        </article>`;
    });
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
    const response = await fetch("/api/submit-bo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      Notify.success("B.O. Enviado!");
      e.target.reset();
      setTimeout(() => showSection("jornal"), 2000);
    } else {
      throw new Error("Erro");
    }
  } catch (error) {
    Notify.error("Erro ao enviar.");
  }
}

/* ==========================================================================
   8. CARREGAR COMANDANTES (DINÂMICO)
   ========================================================================== */
async function loadCommanders() {
  const container = document.querySelector(".commanders-grid");
  if (!container) return;

  try {
    const req = await fetch("/api/get-commanders");
    const commanders = await req.json();

    if (!req.ok || !commanders || commanders.length < 3) {
      console.warn("Não foi possível carregar todos os comandantes.");

      // Remove o ícone de loading se falhar
      const loadingIcon = container.querySelector(".fa-spinner");
      if (loadingIcon && loadingIcon.parentElement)
        loadingIcon.parentElement.innerHTML =
          "<p>Comando indisponível no momento.</p>";

      return;
    }

    // Definição dos Cargos (Ordem fixa)
    const roles = [
      {
        title: "Comandante Geral",
        desc: "Responsável pela estratégia global de segurança e diretrizes da corporação.",
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

    // Cria os cards dinâmicos
    commanders.forEach((cmd, index) => {
      if (index >= roles.length) return;

      container.innerHTML += `
            <div class="commander-card">
                <div class="cmd-img-container">
                    <img src="${cmd.avatarUrl}" alt="${cmd.username}">
                </div>
                <h3>${cmd.username}</h3>
                <span class="rank">${roles[index].title}</span>
                <p>${roles[index].desc}</p>
            </div>
        `;
    });
  } catch (e) {
    console.error("Erro ao carregar comandantes:", e);
  }
}
/* ==========================================================================
   9. CARREGAMENTO DE LIDERANÇA DEPARTAMENTAL
   ========================================================================== */

async function loadDepartmentLeadership() {
  // Configurações para cada página (ID do container no HTML : Configuração da API)
  const configs = {
    "pcerj-leadership": {
      api: "/api/get-pcerj",
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
      api: "/api/get-pmerj",
      roles: [
        { title: "Comandante", desc: "Responsável pelo batalhão." },
        { title: "Subcomandante", desc: "Gestão da tropa e disciplina." },
        { title: "Subcomandante", desc: "Planejamento de operações." },
      ],
    },
    "pf-leadership": {
      api: "/api/get-pf",
      roles: [
        { title: "Diretor Geral", desc: "Comando supremo da Polícia Federal." },
        { title: "Vice-Diretor", desc: "Gestão administrativa." },
        { title: "Vice-Diretor", desc: "Fiscalização e conduta." },
      ],
    },
    "prf-leadership": {
      api: "/api/get-prf",
      roles: [
        {
          title: "Diretor Geral",
          desc: "Chefe da Polícia Rodoviária Federal.",
        },
        { title: "Vice-Diretor", desc: "Coordenação regional." },
        { title: "Chefe de Policiamento", desc: "Fiscalização nas rodovias." },
      ],
    },
  };

  // Procura na página atual se existe algum desses containers
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

        leaders.forEach((leader, index) => {
          // Pega o cargo correspondente ou usa um genérico se tiver mais gente que cargos
          const role = config.roles[index] || {
            title: "Oficial Superior",
            desc: "Membro da diretoria.",
          };

          container.innerHTML += `
                        <div class="commander-card">
                            <div class="cmd-img-container">
                                <img src="${leader.avatarUrl}" alt="${leader.username}">
                            </div>
                            <h3>${leader.username}</h3>
                            <span class="rank">${role.title}</span>
                            <p>${role.desc}</p>
                        </div>
                    `;
        });
      } catch (e) {
        console.error(`Erro ao carregar ${containerId}:`, e);
        container.innerHTML = "<p>Erro ao carregar dados.</p>";
      }
    }
  }
}
