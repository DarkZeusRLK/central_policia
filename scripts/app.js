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
   3. CONTROLE DO MODAL DE LOGIN
   ========================================================================== */
function openLoginModal() {
  console.log("Tentando abrir modal..."); // Debug
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.remove("hidden");
    console.log("Classe hidden removida.");
  } else {
    console.error("ERRO: Modal não encontrado no HTML");
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

/* ==========================================================================
   4. INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  console.log("App iniciado.");
  Notify.init();
  updateUI();
  checkUrlLogin();

  const dateEl = document.getElementById("date-display");
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString("pt-BR");

  loadNews();
  setupNavigation(); // Configura os cliques

  const formBO = document.getElementById("form-bo");
  if (formBO) formBO.addEventListener("submit", handleBOSubmit);

  // Evento global para fechar modal
  document.addEventListener("click", (e) => {
    const modal = document.getElementById("login-modal");
    if (e.target === modal) closeLoginModal();
  });
});

/* ==========================================================================
   5. NAVEGAÇÃO (AQUI ESTÁ A CORREÇÃO PRINCIPAL)
   ========================================================================== */
function setupNavigation() {
  // 1. Link Boletim (CAPTURA O CLIQUE)
  const btnBoletim = document.getElementById("nav-bo");

  if (btnBoletim) {
    console.log("Botão de B.O. encontrado. Adicionando evento.");

    // Removemos clones antigos para garantir
    const newBtn = btnBoletim.cloneNode(true);
    btnBoletim.parentNode.replaceChild(newBtn, btnBoletim);

    newBtn.addEventListener("click", (e) => {
      console.log("Clicou no Boletim!");
      e.preventDefault(); // <--- ISSO IMPEDE O LINK DE MUDAR A URL

      if (!Session.isLoggedIn()) {
        console.log("Não logado. Abrindo modal.");
        openLoginModal();
      } else {
        console.log("Logado. Abrindo seção.");
        showSection("boletim-section");
        updateFormAvatar();
      }
    });
  } else {
    console.error("Botão nav-bo não encontrado!");
  }

  // 2. Link Home
  const btnHome =
    document.querySelector('a[href="#home"]') ||
    document.querySelector('a[href="#"]');
  if (btnHome) {
    btnHome.addEventListener("click", (e) => {
      e.preventDefault();
      showSection("jornal");
    });
  }

  // 3. Dropdowns
  document.querySelectorAll(".dropdown-content a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const deptName = e.target.getAttribute("data-dept") || "pmerj";
      loadRecruitment(deptName);
    });
  });
}

function showSection(sectionId) {
  const sections = ["jornal", "boletim-section", "recrutamento"];
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
   6. UI & LOGIN
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
   7. DADOS & BACKEND (PREENCHIDO AGORA)
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
  try {
    Notify.loading("Carregando departamento...");
    // Simulando dados para não precisar do JSON por enquanto
    const deptData = {
      pcerj: {
        name: "Polícia Civil (PCERJ)",
        desc: "Investigação e Inteligência.",
        logo: "https://upload.wikimedia.org/wikipedia/commons/2/23/Bras%C3%A3o_da_Pol%C3%ADcia_Civil_do_Estado_do_Rio_de_Janeiro.svg",
        link: "#",
      },
      pmerj: {
        name: "Polícia Militar (PMERJ)",
        desc: "Patrulhamento Ostensivo.",
        logo: "https://upload.wikimedia.org/wikipedia/commons/6/66/Bras%C3%A3o_da_Pol%C3%ADcia_Militar_do_Estado_do_Rio_de_Janeiro.svg",
        link: "#",
      },
      prf: {
        name: "Polícia Rodoviária Federal",
        desc: "Patrulhamento de Rodovias.",
        logo: "https://upload.wikimedia.org/wikipedia/commons/2/24/Logo_Pol%C3%ADcia_Rodovi%C3%A1ria_Federal_-_Brasil.svg",
        link: "#",
      },
      pf: {
        name: "Polícia Federal",
        desc: "Crimes Federais e Fronteiras.",
        logo: "https://upload.wikimedia.org/wikipedia/commons/d/df/Simbolo_da_Pol%C3%ADcia_Federal.svg",
        link: "#",
      },
    };

    const dept = deptData[deptId];
    if (!dept) throw new Error("Dept não encontrado");

    document.getElementById("dept-name").innerText = dept.name;
    document.getElementById("dept-desc").innerText = dept.desc;
    document.getElementById("dept-img").src = dept.logo;
    showSection("recrutamento");
    Notify.success(dept.name);
  } catch (e) {
    console.error(e);
    Notify.error("Erro ao carregar.");
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
