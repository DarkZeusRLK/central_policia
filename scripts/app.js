document.addEventListener("DOMContentLoaded", () => {
  // 1. Data Atual
  document.getElementById("date-display").innerText =
    new Date().toLocaleDateString("pt-BR");

  // 2. Carregar Notícias
  loadNews();

  // 3. Event Listeners do Form
  const formBO = document.getElementById("form-bo");
  if (formBO) {
    formBO.addEventListener("submit", handleBOSubmit);
  }

  // 4. Controle de Acesso ao BO
  document.getElementById("nav-bo").addEventListener("click", (e) => {
    if (!Session.isLoggedIn()) {
      e.preventDefault();
      Notify.error("Você precisa fazer Login para registrar um B.O.");
      setTimeout(() => (window.location.href = "/api/auth"), 2000);
    } else {
      // Mostrar seção de BO
      document
        .querySelectorAll("main > section")
        .forEach((el) => el.classList.add("hidden"));
      document.getElementById("boletim-section").classList.remove("hidden");
    }
  });
});

async function loadNews() {
  try {
    const req = await fetch("public/data/news.json");
    const data = await req.json();
    const grid = document.getElementById("news-grid");
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
    Notify.error("Não foi possível carregar as notícias.");
  }
}

async function loadRecruitment(deptId) {
  try {
    Notify.loading("Carregando dados do departamento...");
    const req = await fetch("public/data/recruitment.json");
    const data = await req.json();
    const dept = data[deptId];

    if (!dept) throw new Error("Departamento não encontrado");

    // Preenche UI
    document.getElementById("dept-name").innerText = dept.name;
    document.getElementById("dept-desc").innerText = dept.description;
    document.getElementById("dept-img").src = dept.logo;
    document.getElementById("uniform-img").src = dept.uniform;
    document.getElementById("dept-link").href = dept.studyMaterial;

    // Mostra Seção
    document
      .querySelectorAll("main > section")
      .forEach((el) => el.classList.add("hidden"));
    document.getElementById("recrutamento").classList.remove("hidden");
    Notify.success(`Departamento ${dept.name} carregado.`);
  } catch (e) {
    Notify.error("Erro ao carregar recrutamento.");
  }
}

function closeRecruitment() {
  document.getElementById("recrutamento").classList.add("hidden");
  document.getElementById("jornal").classList.remove("hidden");
}

async function handleBOSubmit(e) {
  e.preventDefault();

  if (!Session.isLoggedIn())
    return Notify.error("Sessão expirada. Faça login novamente.");

  Notify.loading("Enviando Boletim de Ocorrência...");
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  // Adiciona ID do usuário logado para o Backend validar
  data.userId = Session.user.id;

  try {
    const response = await fetch("/api/submit-bo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      Notify.success("B.O. Registrado com Sucesso! A polícia foi notificada.");
      e.target.reset();
      setTimeout(() => (window.location.href = "/"), 3000);
    } else {
      throw new Error("Falha no envio");
    }
  } catch (error) {
    Notify.error("Erro ao enviar B.O. Tente novamente.");
  }
}
