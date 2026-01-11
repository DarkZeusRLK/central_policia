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
    updateUI();
    Notify.success(`Bem-vindo, ${userData.username}!`);
  },

  logout() {
    this.user = null;
    localStorage.removeItem("revoada_user");
    localStorage.removeItem("revoada_is_journalist"); // Limpa permissão extra
    updateUI();
    Notify.info("Você saiu do sistema.");
    setTimeout(() => (window.location.href = "/"), 1000);
  },
};

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
  if (modal) {
    modal.classList.remove("hidden");
  }
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
   4. INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init();
  updateUI();
  checkUrlLogin();

  const dateEl = document.getElementById("date-display");
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString("pt-BR");

  loadNews(); // Agora chama a versão nova que busca da API
  setupNavigation();
  loadCommanders();

  const formBO = document.getElementById("form-bo");
  if (formBO) formBO.addEventListener("submit", handleBOSubmit);

  document.addEventListener("click", (e) => {
    const modal = document.getElementById("login-modal");
    if (e.target === modal) closeLoginModal();
  });
});

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

// --- FUNÇÃO DE NOTÍCIAS ATUALIZADA (API + NOVO VISUAL) ---
async function loadNews() {
  const grid = document.getElementById("news-grid");
  if (!grid) return;

  // Estado de carregamento opcional
  // grid.innerHTML = '<p style="color: #64748b;">Carregando...</p>';

  try {
    // Agora chama a API, não o JSON local
    const req = await fetch("/api/get-news");
    if (!req.ok) throw new Error("Falha na API");

    const data = await req.json();
    grid.innerHTML = "";

    if (data.length === 0) {
      grid.innerHTML = `<p style="color: #cbd5e1; grid-column: span 3; text-align: center;">Nenhuma notícia recente no mural.</p>`;
      return;
    }

    data.forEach((news) => {
      // Cria o card da notícia dinamicamente com o estilo "Capa de Jornal"
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
   8. FUNÇÕES DO INDEX (ADICIONE ESTA NOVA SEÇÃO NO FINAL)
   ========================================================================== */

async function loadCommanders() {
  const container = document.querySelector(".commanders-grid");
  if (!container) return; // Se não estiver na home, sai

  try {
    const req = await fetch("/api/get-commanders");
    const commanders = await req.json();

    if (!req.ok || !commanders || commanders.length < 3) {
      console.warn("Não foi possível carregar todos os comandantes.");
      return; // Mantém o HTML original (fallback) se der erro
    }

    // Títulos fixos baseados na ordem do .env
    const roles = [
      {
        title: "Comandante Geral",
        desc: "Responsável pela estratégia global de segurança e diretrizes da corporação.",
      },
      {
        title: "Subcomandante",
        desc: "Coordena a logística e o gerenciamento tático das tropas em campo.",
      },
      {
        title: "Chefe de Operações",
        desc: "Líder das forças especiais e operações de alto risco na cidade.",
      },
    ];

    container.innerHTML = ""; // Limpa os cards estáticos

    // Cria os cards dinâmicos
    commanders.forEach((cmd, index) => {
      // Se houver mais IDs que cargos, usa um genérico, ou para no 3º
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
