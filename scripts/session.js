// Gerencia Login e Sessão do Usuário
const Session = {
  user: null,

  init() {
    // Verifica se voltou do login com dados na URL (Query Params)
    const params = new URLSearchParams(window.location.search);
    const userData = params.get("user");

    if (userData) {
      try {
        // Decodifica Base64 e salva no LocalStorage
        const userObj = JSON.parse(atob(userData));
        this.save(userObj);
        // Limpa a URL
        window.history.replaceState({}, document.title, "/");
        Notify.success(`Bem-vindo, ${userObj.username}!`);
      } catch (e) {
        Notify.error("Erro ao processar login.");
      }
    }

    this.load();
    this.updateUI();
  },

  save(user) {
    localStorage.setItem("revoada_police_user", JSON.stringify(user));
    this.user = user;
  },

  load() {
    const stored = localStorage.getItem("revoada_police_user");
    if (stored) this.user = JSON.parse(stored);
  },

  isLoggedIn() {
    return !!this.user;
  },

  updateUI() {
    const userArea = document.getElementById("user-area");
    const formAvatar = document.getElementById("form-avatar");
    const formUser = document.getElementById("form-username");

    if (this.isLoggedIn()) {
      // UI Logado
      userArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="https://cdn.discordapp.com/avatars/${this.user.id}/${this.user.avatar}.png" style="width: 35px; border-radius: 50%;">
                    <span>${this.user.username}</span>
                </div>
            `;

      // Preenche info no form
      if (formAvatar)
        formAvatar.src = `https://cdn.discordapp.com/avatars/${this.user.id}/${this.user.avatar}.png`;
      if (formUser) formUser.innerText = this.user.username;
    } else {
      // UI Não Logado
      userArea.innerHTML = `
                <button id="btn-login" class="btn-login" onclick="window.location.href='/api/auth'">
                    <i class="fa-brands fa-discord"></i> Login Cidadão
                </button>
            `;
    }
  },
};

Session.init();
