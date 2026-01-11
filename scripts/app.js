/* ==========================================================================
   1. GESTÃO DE SESSÃO (Session Manager)
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
    updateUI();
    Notify.info("Você saiu do sistema.");
    setTimeout(() => (window.location.href = "/"), 1000);
  },
};

/* ==========================================================================
   2. SISTEMA DE NOTIFICAÇÕES (Toasts)
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
   3. CONTROLE DO MODAL DE LOGIN
   ========================================================================== */
function openLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.add("hidden");
}

// Função chamada pelo botão "Login Cidadão" de dentro do Modal
function proceedToLogin() {
  // Salva a intenção de abrir o B.O. na volta
  localStorage.setItem("pending_action", "open_boletim");
  // Redireciona
  window.location.href = "/api/auth";
}

// Fecha modal ao clicar fora
document.addEventListener("click", (e) => {
  const modal = document.getElementById("login-modal");
  if (e.target === modal) closeLoginModal();
});

/* ==========================================================================
   4. INICIALIZAÇÃO E EVENTOS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init();
  updateUI();
  checkUrlLogin();

  // Data
  const dateEl = document.getElementById("date-display");
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString("pt-BR");

  // Notícias
  loadNews();

  // Navegação e Formulário
  setupNavigation();
  const formBO = document.getElementById("form-bo");
  if (formBO) formBO.addEventListener("submit", handleBOSubmit);
});

/* ==========================================================================
   5. LÓGICA DE LOGIN E UI
   ========================================================================== */
function checkUrlLogin() {
  const urlParams = new URLSearchParams(window.location.search);

  // Login vindo da API
  if (urlParams.has("username")) {
    const userData = {
      username: urlParams.get("username"),
      id: urlParams.get("id"),
      avatar: urlParams.get("avatar"),
    };
    Session.login(userData);
    window.history.replaceState({}, document.title, "/");
  }

  // Verifica Ação Pendente (abrir B.O. automaticamente)
  if (Session.isLoggedIn()) {
    const pendingAction = localStorage.getItem("pending_action");
    if (pendingAction === "open_boletim") {
      localStorage.removeItem("pending_action");
      Notify.success("Identidade confirmada. Acesso liberado.");
      showSection("boletim-section");

      // Atualiza avatar no form
      updateFormAvatar();
    }
  }
}

function updateUI() {
  const navRight = document.querySelector(".navbar .nav-links");
  const btnLogin = document.getElementById("btn-login"); // Botão Navbar

  if (Session.isLoggedIn()) {
    // Esconde botão login navbar
    if (btnLogin) btnLogin.classList.add("hidden");

    // Remove badge antigo se houver
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();

    // Cria badge novo
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
   6. NAVEGAÇÃO
   ========================================================================== */
function setupNavigation() {
  // Home
  document.querySelector('a[href="#home"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    showSection("jornal");
  });

  // BOTÃO B.O. (Com Modal)
  document.getElementById("nav-bo")?.addEventListener("click", (e) => {
    e.preventDefault();

    if (!Session.isLoggedIn()) {
      // Se não tá logado, abre o MODAL em vez de redirecionar direto
      openLoginModal();
    } else {
      showSection("boletim-section");
      updateFormAvatar();
    }
  });

  // Recrutamento
  document.querySelectorAll(".dropdown-content a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const deptName = e.target.getAttribute("data-dept") || "gate";
      loadRecruitment(deptName);
    });
  });
}

function showSection(sectionId) {
  const sections = [
    "jornal",
    "boletim-section",
    "recrutamento",
    "comando-geral",
  ];
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
   7. DADOS & BACKEND
   ========================================================================== */
async function loadNews() {
  try {
    const req = await fetch("public/data/news.json");
    if (!req.ok) throw new Error("Falha");
    const data = await req.json();
    const grid = document.getElementById("news-grid");
    if (!grid) return;
    grid.innerHTML = "";
    data.forEach((news) => {
      grid.innerHTML += `
                <article class="news-card">
                    <img src="${news.image}" alt="Notícia" class="news-img">
                    <div class="news-content">
                        <div class="news-date">${news.date}</div>
                        <h3 class="news-title">${news.title}</h3>
                        <p>${news.summary}</p>
                    </div>
                </article>`;
    });
  } catch (e) {
    const grid = document.getElementById("news-grid");
    if (grid)
      grid.innerHTML = `<p style="color: #cbd5e1;">Nenhuma notícia encontrada.</p>`;
  }
}

async function loadRecruitment(deptId) {
  // ... (Mantive igual ao seu código anterior)
  // ... (Código omitido para brevidade, mas você já tem ele)
  // Se quiser, posso reenviar, mas a lógica é a mesma
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
