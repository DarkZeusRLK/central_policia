/* ==========================================================================
   1. GESTÃO DE SESSÃO (Session Manager)
   Salva o usuário no navegador para ele não deslogar ao atualizar a página.
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
   Cria os alertas bonitos no canto da tela.
   ========================================================================== */
const Notify = {
  container: null,

  init() {
    // Cria o container se não existir
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

    // Ícones baseados no tipo
    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-check-circle";
    if (type === "error") icon = "fa-exclamation-triangle";
    if (type === "loading") icon = "fa-spinner fa-spin";

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

    this.container.appendChild(toast);

    // Remove após 4 segundos (se não for loading)
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
   3. INICIALIZAÇÃO E EVENTOS (Main)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init(); // Inicia sistema de notificação
  updateUI(); // Atualiza botões de login/logout
  checkUrlLogin(); // Verifica se voltou do Login do Discord

  // 1. Data Atual no Topo
  const dateEl = document.getElementById("date-display");
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString("pt-BR");

  // 2. Carregar Notícias
  loadNews();

  // 3. Botão de Login (Redireciona para nossa API)
  const btnLogin = document.getElementById("btn-login");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      Notify.loading("Redirecionando para o Discord...");
      // IMPORTANTE: Aqui vai para a API que criamos no passo anterior
      window.location.href = "/api/auth";
    });
  }

  // 4. Navegação do Menu (Boletim, Home, etc)
  setupNavigation();

  // 5. Formulário de B.O.
  const formBO = document.getElementById("form-bo");
  if (formBO) {
    formBO.addEventListener("submit", handleBOSubmit);
  }
});

/* ==========================================================================
   4. LÓGICA DE LOGIN E UI
   ========================================================================== */

// Verifica se a URL tem ?username=... (Retorno da API)
function checkUrlLogin() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has("username")) {
    const userData = {
      username: urlParams.get("username"),
      id: urlParams.get("id"),
      avatar: urlParams.get("avatar"),
    };

    // Salva na sessão
    Session.login(userData);

    // Limpa a URL para ficar "bonita" (sem mostrar os dados)
    window.history.replaceState({}, document.title, "/");
  }
}

// Atualiza a barra superior (Mostra botão Login ou Avatar do Usuário)
function updateUI() {
  const navRight = document.querySelector(".navbar .nav-links"); // Ajuste conforme seu HTML
  // Ou se o botão estiver solto na navbar:
  const btnLogin = document.getElementById("btn-login");

  if (Session.isLoggedIn()) {
    if (btnLogin) btnLogin.classList.add("hidden");

    // Remove badge antigo se existir
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();

    // Cria badge do usuário
    const badge = document.createElement("li");
    badge.id = "user-badge-nav";
    badge.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="Session.logout()">
                <span style="color: white; font-weight: bold;">${Session.user.username}</span>
                <img src="https://cdn.discordapp.com/avatars/${Session.user.id}/${Session.user.avatar}.png" 
                     style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--accent-gold);">
            </div>
        `;
    // Adiciona na lista de links ou substitui o botão
    if (navRight) navRight.appendChild(badge);
  } else {
    if (btnLogin) btnLogin.classList.remove("hidden");
    const oldBadge = document.getElementById("user-badge-nav");
    if (oldBadge) oldBadge.remove();
  }
}

/* ==========================================================================
   5. NAVEGAÇÃO (SPA - Single Page Application)
   ========================================================================== */
function setupNavigation() {
  // Link Home
  document.querySelector('a[href="#home"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    showSection("jornal");
  });

  // Link Boletim
  document.getElementById("nav-bo")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!Session.isLoggedIn()) {
      Notify.error("Faça Login para registrar um B.O.");
    } else {
      showSection("boletim-section");
      // Preenche o avatar do usuário no formulário automaticamente
      const userBadgeForm = document.querySelector(".user-badge img");
      if (userBadgeForm && Session.user) {
        userBadgeForm.src = `https://cdn.discordapp.com/avatars/${Session.user.id}/${Session.user.avatar}.png`;
      }
    }
  });

  // Links de Recrutamento (Dropdown)
  // Supondo que no HTML os links sejam: <a href="#" onclick="loadRecruitment('gate')">GATE</a>
  // Vamos fazer via classe para ficar mais limpo: class="dept-link" data-dept="gate"
  document.querySelectorAll(".dropdown-content a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      // Pega o nome do departamento do texto ou de um atributo data
      const deptName = e.target.getAttribute("data-dept") || "gate"; // Exemplo padrão
      loadRecruitment(deptName);
    });
  });
}

function showSection(sectionId) {
  // Esconde todas as seções principais
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

  // Mostra a desejada
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* ==========================================================================
   6. CARREGAMENTO DE DADOS (News & Recrutamento)
   ========================================================================== */

async function loadNews() {
  try {
    // Tenta carregar. Se falhar, usa dados fictícios para não quebrar o layout
    const req = await fetch("public/data/news.json");
    // OBS: Na Vercel, se 'data' está na raiz, use "/data/news.json"

    if (!req.ok) throw new Error("Falha no fetch");

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
                </article>
            `;
    });
  } catch (e) {
    console.warn("Usando notícias de fallback...");
    // Fallback visual caso o JSON falhe
    const grid = document.getElementById("news-grid");
    if (grid)
      grid.innerHTML = `<p style="color: #cbd5e1; grid-column: span 3;">Nenhuma notícia recente encontrada.</p>`;
  }
}

async function loadRecruitment(deptId) {
  try {
    Notify.loading("Acessando banco de dados...");

    // Simulação de delay para parecer "hacker/sistema"
    await new Promise((r) => setTimeout(r, 800));

    const req = await fetch("public/data/recruitment.json"); // Ajuste o caminho se necessário
    const data = await req.json();
    const dept = data[deptId];

    if (!dept) throw new Error("Departamento não encontrado");

    // Preenche UI
    document.getElementById("dept-name").innerText = dept.name;
    document.getElementById("dept-desc").innerText = dept.description;
    document.getElementById("dept-img").src = dept.logo;

    // Seção específica para botão de material
    const btnLink = document.getElementById("dept-link");
    if (btnLink) btnLink.href = dept.studyMaterial;

    showSection("recrutamento");
    Notify.success(`Acesso autorizado: ${dept.name}`);
  } catch (e) {
    Notify.error("Erro ao carregar dados do departamento.");
    console.error(e);
  }
}

/* ==========================================================================
   7. ENVIO DE FORMULÁRIOS (Backend)
   ========================================================================== */
async function handleBOSubmit(e) {
  e.preventDefault();

  if (!Session.isLoggedIn())
    return Notify.error("Sessão expirada. Faça login novamente.");

  Notify.loading("Enviando Boletim à Central...");

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  // Anexa dados de autenticação seguros
  data.userId = Session.user.id;
  data.username = Session.user.username;

  try {
    // Envia para a API Serverless (que você criará depois, ou apenas simula por enquanto)
    const response = await fetch("/api/submit-bo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      Notify.success("B.O. Registrado! Uma viatura foi notificada.");
      e.target.reset();
      setTimeout(() => showSection("jornal"), 3000);
    } else {
      throw new Error("Erro no servidor");
    }
  } catch (error) {
    // Se não tiver backend de BO ainda, avisa:
    Notify.error("Erro de conexão com a central (API não encontrada).");
  }
}
