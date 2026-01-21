"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { submitBoletimOcorrencia } from "./actions";

// Componente de Modal de Login
function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <i className="fa-solid fa-user-shield"></i>
        </div>
        <h2>Identificação Necessária</h2>
        <p>
          Para registrar um Boletim de Ocorrência ou acessar a Área Policial,
          você precisa se identificar primeiro.
        </p>
        <div className="modal-actions">
          <button className="btn-close-modal" onClick={onClose}>
            Entendi
          </button>
          <button
            className="btn-login-modal"
            onClick={() => (window.location.href = "/api/auth")}
          >
            Fazer Login Agora
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente de Modal de Galeria
function PhotoModal({
  isOpen,
  currentIndex,
  photos,
  onClose,
  onNext,
  onPrev,
}: {
  isOpen: boolean;
  currentIndex: number;
  photos: Array<{ src: string; alt: string }>;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div
      className={`photo-modal ${isOpen ? "active" : ""}`}
      onClick={onClose}
    >
      <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal-close" onClick={onClose}>
          &times;
        </button>
        {photos.length > 1 && (
          <>
            <button
              className="photo-modal-nav prev"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              className="photo-modal-nav next"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </>
        )}
        <img
          src={currentPhoto.src}
          alt={currentPhoto.alt}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect fill='%231e293b' width='800' height='600'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='%23fbbf24' text-anchor='middle' dominant-baseline='middle'%3EImagem não disponível%3C/text%3E%3C/svg%3E";
          }}
        />
      </div>
    </div>
  );
}

// Componente de Formulário de B.O.
function BOForm({
  user,
  onSuccess,
}: {
  user: any;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      nome: formData.get("nome") as string,
      passaporte: formData.get("passaporte") as string,
      telefone: formData.get("telefone") as string,
      profissao: formData.get("profissao") as string,
      sexo: formData.get("sexo") as string,
      ocorrencia: formData.get("ocorrencia") as string,
      itens: formData.get("itens") as string,
      local: formData.get("local") as string,
      horario: formData.get("horario") as string,
      video_link: formData.get("video_link") as string,
      userId: user.id,
      username: user.username,
    };

    const result = await submitBoletimOcorrencia(data);

    setIsSubmitting(false);

    if (result.success) {
      formRef.current?.reset();
      alert(`B.O. Enviado! Protocolo: ${result.protocolo}`);
      onSuccess();
    } else {
      alert(`Erro: ${result.error}`);
    }
  }

  return (
    <form ref={formRef} id="form-bo" onSubmit={handleSubmit}>
      <div className="user-badge">
        <img
          id="form-avatar"
          src={
            user?.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
              : ""
          }
          alt="Avatar"
        />
        <div>
          <span id="form-username">{user?.username || "Usuário"}</span>
          <small>Identidade Confirmada</small>
        </div>
      </div>
      <div className="form-grid">
        <div className="input-group">
          <label>Nome do Cidadão**</label>
          <input
            type="text"
            name="nome"
            required
            placeholder="Ex: João da Silva"
          />
        </div>
        <div className="input-group">
          <label>Passaporte (ID)**</label>
          <input
            type="number"
            name="passaporte"
            required
            placeholder="Ex: 1234"
          />
        </div>
        <div className="input-group">
          <label>Profissão (Opcional)</label>
          <input
            type="text"
            name="profissao"
            placeholder="Ex: Mecânico, Entregador..."
          />
        </div>
        <div className="input-group">
          <label>Sexo**</label>
          <select name="sexo" required>
            <option value="" disabled>
              Selecione...
            </option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div className="input-group">
          <label>Telefone**</label>
          <input
            type="text"
            name="telefone"
            required
            placeholder="Ex: 555-0100"
          />
        </div>
        <div className="input-group">
          <label>Horário Aproximado**</label>
          <input type="datetime-local" name="horario" required />
        </div>
        <div className="input-group full-width">
          <label>Local do Ocorrido**</label>
          <input
            type="text"
            name="local"
            required
            placeholder="Ex: Praça Central, ao lado do banco"
          />
        </div>
        <div className="input-group full-width">
          <label>Ocorrência**</label>
          <input
            type="text"
            name="ocorrencia"
            required
            placeholder="Ex: Roubo de Veículo"
          />
        </div>
        <div className="input-group full-width">
          <label>Itens Perdidos**</label>
          <textarea
            name="itens"
            rows={3}
            placeholder="Ex: R$ 5.000, 1 Celular, Chave do carro..."
          ></textarea>
        </div>
        <div className="input-group full-width">
          <label>
            <i
              className="fa-brands fa-youtube"
              style={{ color: "#ff0000", marginRight: "5px" }}
            ></i>{" "}
            Link de Provas (YouTube/Medal)
          </label>
          <input
            type="url"
            name="video_link"
            placeholder="Cole o link do vídeo aqui (Opcional)"
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-submit" disabled={isSubmitting}>
          <i className="fa-solid fa-paper-plane"></i>{" "}
          {isSubmitting ? "Enviando..." : "Enviar Ocorrência"}
        </button>
      </div>
    </form>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [dateTime, setDateTime] = useState({ date: "--/--/----", time: "00:00" });
  const [news, setNews] = useState<any[]>([]);
  const [stats, setStats] = useState({ prisoes: "--", fiancas: "--", total: "--" });
  const [commanders, setCommanders] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showBOForm, setShowBOForm] = useState(false);
  const [photoModal, setPhotoModal] = useState({ isOpen: false, index: 0 });

  const photoGallery = [
    { src: "/images/instagram_1.png", alt: "Comando Geral 1" },
    { src: "/images/instagram_2.png", alt: "Comando Geral 2" },
    { src: "/images/instagram_3.png", alt: "Comando Geral 3" },
    { src: "/images/instagram_4.png", alt: "Logo Polícia" },
    { src: "/images/instagram_5.png", alt: "Comando Geral 1" },
    { src: "/images/instagram_6.png", alt: "Comando Geral 2" },
    { src: "/images/instagram_7.png", alt: "Comando Geral 3" },
    { src: "/images/instagram_8.png", alt: "Logo Polícia" },
    { src: "/images/instagram_9.png", alt: "Logo Polícia" },
    { src: "/images/instagram_10.png", alt: "Logo Polícia" },
    { src: "/images/instagram_11.png", alt: "Comando Geral 3" },
    { src: "/images/instagram_12.png", alt: "Logo Polícia" },
    { src: "/images/instagram_13.png", alt: "Logo Polícia" },
    { src: "/images/instagram_14.png", alt: "Logo Polícia" },
    { src: "/images/instagram_15.png", alt: "Logo Polícia" },
    { src: "/images/instagram_16.png", alt: "Logo Polícia" },
  ];

  // Atualizar data/hora
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setDateTime({
        date: now.toLocaleDateString("pt-BR"),
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      });
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Carregar dados
  useEffect(() => {
    async function loadData() {
      // Carregar usuário
      if (typeof window !== "undefined") {
        const userJson = localStorage.getItem("revoada_user");
        if (userJson) {
          try {
            setUser(JSON.parse(userJson));
          } catch (e) {
            console.error("Erro ao carregar usuário:", e);
          }
        }

        // Verificar login na URL
        const params = new URLSearchParams(window.location.search);
        if (params.has("username")) {
          const userData = {
            username: params.get("username"),
            id: params.get("id"),
            avatar: params.get("avatar"),
          };
          localStorage.setItem("revoada_user", JSON.stringify(userData));
          setUser(userData);
          window.history.replaceState({}, document.title, "/");
        }
      }

      // Carregar notícias
      try {
        const newsRes = await fetch("/api/handler?type=get_news");
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          setNews(newsData || []);
        }
      } catch (e) {
        console.error("Erro ao carregar notícias:", e);
      }

      // Carregar estatísticas
      try {
        const statsRes = await fetch("/api/handler?type=stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            prisoes: statsData.prisoes || "--",
            fiancas: statsData.fiancas || "--",
            total: statsData.total || "--",
          });
        }
      } catch (e) {
        console.error("Erro ao carregar stats:", e);
      }

      // Carregar comandantes
      try {
        const cmdRes = await fetch("/api/handler?type=get_commanders");
        if (cmdRes.ok) {
          const cmdData = await cmdRes.json();
          setCommanders(cmdData || []);
        }
      } catch (e) {
        console.error("Erro ao carregar comandantes:", e);
      }

      // Simular carregamento
      setTimeout(() => {
        setLoading(false);
        if (typeof window !== "undefined") {
          document.body.classList.remove("loading");
          localStorage.setItem("site_loaded_before", "true");
        }
      }, 1500);
    }

    const hasLoadedBefore =
      typeof window !== "undefined" &&
      localStorage.getItem("site_loaded_before");

    if (hasLoadedBefore) {
      setLoading(false);
      if (typeof window !== "undefined") {
        document.body.classList.remove("loading");
      }
    } else {
      loadData();
    }
  }, []);

  // Máscara de telefone
  useEffect(() => {
    const inputTelefone = document.querySelector('input[name="telefone"]');
    if (inputTelefone) {
      const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        let value = target.value.replace(/\D/g, "");
        if (value.length > 6) value = value.slice(0, 6);
        if (value.length > 3) {
          value = value.replace(/^(\d{3})(\d+)/, "$1-$2");
        }
        target.value = value;
      };
      inputTelefone.addEventListener("input", handleInput);
      return () => inputTelefone.removeEventListener("input", handleInput);
    }
  }, [showBOForm]);

  function handleBOClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) {
      setShowLoginModal(true);
    } else {
      setShowBOForm(true);
      const section = document.getElementById("boletim-section");
      if (section) {
        section.classList.remove("hidden");
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function handlePoliceAccess(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) {
      setShowLoginModal(true);
    } else {
      window.location.href = "/dashboard";
    }
  }

  function openPhotoModal(index: number) {
    setPhotoModal({ isOpen: true, index });
    if (typeof window !== "undefined") {
      document.body.style.overflow = "hidden";
    }
  }

  function closePhotoModal() {
    setPhotoModal({ isOpen: false, index: 0 });
    if (typeof window !== "undefined") {
      document.body.style.overflow = "";
    }
  }

  function nextPhoto() {
    setPhotoModal((prev) => ({
      isOpen: true,
      index: (prev.index + 1) % photoGallery.length,
    }));
  }

  function prevPhoto() {
    setPhotoModal((prev) => ({
      isOpen: true,
      index: (prev.index - 1 + photoGallery.length) % photoGallery.length,
    }));
  }

  return (
    <>
      {/* Tela de Carregamento */}
      {loading && (
        <div className="loading-screen">
          <img
            src="/images/Logo_policia.png"
            alt="Logo"
            className="loading-logo"
          />
          <div className="loading-spinner"></div>
          <div className="loading-text">Carregando...</div>
          <div className="loading-progress">
            <div className="loading-progress-bar" style={{ width: "100%" }}></div>
          </div>
        </div>
      )}

      <nav className="navbar">
        <Link href="/" className="logo">
          <img src="/images/Logo_policia.png" alt="Logo Revoada" />
        </Link>

        <ul className="nav-links">
          <li>
            <Link href="/" className="active">
              <i className="fa-solid fa-house"></i> Início
            </Link>
          </li>
          <li className="dropdown">
            <a href="#">
              <i className="fa-solid fa-user-group"></i> Recrutamentos{" "}
              <i className="fa-solid fa-chevron-down"></i>
            </a>
            <div className="dropdown-content">
              <Link href="/pcerj">
                <img
                  src="/images/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro (1).png"
                  alt="PCERJ"
                  className="nav-icon"
                  style={{ width: "25px", height: "auto" }}
                />{" "}
                PCERJ
              </Link>
              <Link href="/pmerj">
                <img
                  src="/images/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png"
                  alt="PMERJ"
                  className="nav-icon"
                  style={{ width: "25px", height: "auto" }}
                />{" "}
                PMERJ
              </Link>
              <Link href="/prf">
                <img
                  src="/images/PRF_new.png"
                  alt="PRF"
                  className="nav-icon"
                  style={{ width: "25px", height: "auto" }}
                />{" "}
                PRF
              </Link>
              <Link href="/pf">
                <img
                  src="/images/Policia-federal-logo.png"
                  alt="PF"
                  className="nav-icon"
                  style={{ width: "25px", height: "auto" }}
                />{" "}
                PF
              </Link>
            </div>
          </li>
          <li>
            <a href="#boletim-section" id="nav-bo-link" onClick={handleBOClick}>
              <i className="fa-solid fa-clipboard"></i> Boletim de Ocorrência
            </a>
          </li>
          <li>
            <Link href="/jornal">
              <i className="fa-solid fa-newspaper"></i> Jornal Mare
            </Link>
          </li>
          <li>
            <a
              href="https://policia-revoada.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-solid fa-gavel"></i> Código Penal
            </a>
          </li>
          <li>
            <a
              href="https://discord.gg/uCBKjAt2vm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-solid fa-scale-balanced"></i> Corregedoria de
              Polícia
            </a>
          </li>
        </ul>
        <div className="system-status">
          <span className="pulsing-dot"></span>
          <span className="status-text">SISTEMA ONLINE</span>
        </div>
        <div
          className="nav-user-group"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <a
            href="#"
            id="nav-police"
            className="access-link"
            onClick={handlePoliceAccess}
            style={{
              textDecoration: "none",
              color: "#94a3b8",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <i className="fa-solid fa-lock"></i> Acesso Policial
          </a>
          <div id="user-area" className="user-area">
            {user ? (
              <div className="user-profile-nav">
                <div className="avatar-ring">
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                    alt={user.username}
                  />
                </div>
                <span className="username">{user.username}</span>
              </div>
            ) : (
              <button
                id="btn-login"
                className="btn-login"
                onClick={() => (window.location.href = "/api/auth")}
              >
                <i className="fa-brands fa-discord"></i> Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="video-background">
        <video autoPlay muted loop playsInline id="myVideo">
          <source src="/images/videoplayback.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay"></div>
      </div>

      <header className="hero">
        <div className="hero-top-bar"></div>
        <div className="hero-content">
          <h1 className="glitch-effect" data-text="SERVIR E PROTEGER">
            SERVIR E PROTEGER
          </h1>
          <p>Central de Polícia Oficial da Cidade Revoada RJ</p>
          <div className="stats-glass">
            <div className="stat-item">
              <i className="fa-regular fa-calendar-days"></i>
              <span id="date-display">{dateTime.date}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <i className="fa-regular fa-clock"></i>
              <span id="time-display">{dateTime.time}</span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="jornal" className="container">
          <h2 className="section-title">
            <i className="fa-regular fa-newspaper"></i> Jornal da Polícia
          </h2>
          <div id="news-grid" className="news-grid">
            {news.length === 0 ? (
              <div className="loading-placeholder">Carregando notícias...</div>
            ) : (
              news.map((item, idx) => (
                <div key={idx} className="news-card">
                  {item.image && (
                    <img src={item.image} alt={item.title} className="news-img" />
                  )}
                  <div className="news-content">
                    <div className="news-date">{item.date || "Data não disponível"}</div>
                    <h3 className="news-title">{item.title}</h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="container">
          <div className="glass-panel info-grid">
            <div className="info-item">
              <h2>
                <i className="fa-solid fa-scale-balanced"></i> Nossa Missão
              </h2>
              <p>
                Garantir a ordem pública e a segurança de todos os cidadãos de
                Revoada RJ, atuando com integridade, transparência e respeito aos
                direitos humanos. Nossa força está na união e na disciplina.
              </p>
            </div>
            <div className="info-divider"></div>
            <div className="info-item">
              <h2>
                <i className="fa-solid fa-gavel"></i> Como Funcionamos
              </h2>
              <p>
                A Polícia de Revoada opera 24 horas por dia através de
                patrulhamento ostensivo, investigações criminais (PCERJ) e
                operações táticas especiais. Trabalhamos em conjunto com a
                comunidade para prevenir crimes.
              </p>
            </div>
          </div>
        </section>

        {/* Galeria de Fotos */}
        <section className="container" style={{ marginTop: "40px" }}>
          <h2 className="section-title">
            <i className="fa-solid fa-images"></i> Galeria de Fotos
          </h2>
          <div className="photo-gallery-container">
            <div className="photo-gallery-grid">
              {photoGallery.map((photo, idx) => (
                <div
                  key={idx}
                  className="photo-gallery-item"
                  onClick={() => openPhotoModal(idx)}
                >
                  <img src={photo.src} alt={photo.alt} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <PhotoModal
          isOpen={photoModal.isOpen}
          currentIndex={photoModal.index}
          photos={photoGallery}
          onClose={closePhotoModal}
          onNext={nextPhoto}
          onPrev={prevPhoto}
        />

        {/* Banner dos Comandos Gerais */}
        <section className="container" style={{ marginTop: "40px" }}>
          <div className="commanders-banner">
            <div className="commanders-banner-overlay"></div>
            <div className="commanders-banner-content">
              <h2 className="commanders-banner-title">
                <i className="fa-solid fa-shield-halved"></i> COMANDO GERAL
              </h2>
              <p className="commanders-banner-subtitle">
                Liderança da Polícia Revoada RJ
              </p>
            </div>
            <img
              src="/images/commanders/comandantes_gerais.png"
              alt="Comandantes Gerais"
              className="commanders-banner-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          </div>
        </section>

        <section className="container commanders-section">
          <h2 className="section-title">
            <i className="fa-solid fa-star"></i> Comando Geral
          </h2>
          <div className="commanders-grid">
            {commanders.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "50px 20px",
                  color: "#64748b",
                }}
              >
                <i
                  className="fa-solid fa-circle-notch fa-spin fa-3x"
                  style={{
                    color: "var(--accent-gold)",
                    marginBottom: "15px",
                  }}
                ></i>
                <p>Sincronizando dados do comando...</p>
              </div>
            ) : (
              commanders.map((cmd, idx) => (
                <div key={idx} className="commander-card">
                  <div className="cmd-img-container">
                    <img src={cmd.avatar || ""} alt={cmd.name} />
                  </div>
                  <h3>{cmd.name}</h3>
                  <span className="rank">{cmd.rank}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="container" style={{ marginTop: "20px" }}>
          <div className="glass-panel">
            <h3
              style={{
                color: "white",
                marginBottom: "15px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: "10px",
              }}
            >
              <i className="fa-solid fa-chart-line"></i> Estatísticas do Dia
            </h3>
            <div className="stats-live-grid">
              <div className="stat-live-item">
                <div className="icon-box alert">
                  <i className="fa-solid fa-handcuffs"></i>
                </div>
                <div className="stat-text">
                  <h3 id="stat-prisoes">{stats.prisoes}</h3>
                  <p>Prisões Hoje</p>
                </div>
              </div>
              <div className="stat-live-item">
                <div className="icon-box warning">
                  <i className="fa-solid fa-sack-dollar"></i>
                </div>
                <div className="stat-text">
                  <h3 id="stat-fiancas">{stats.fiancas}</h3>
                  <p>Fianças Hoje</p>
                </div>
              </div>
              <div className="stat-live-item">
                <div className="icon-box success">
                  <i className="fa-solid fa-clipboard-check"></i>
                </div>
                <div className="stat-text">
                  <h3 id="stat-total">{stats.total}</h3>
                  <p>Total Registros</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="boletim-section"
          className={`container ${showBOForm ? "" : "hidden"}`}
        >
          <div className="glass-panel form-panel">
            <h2 className="section-title">
              <i className="fa-solid fa-file-signature"></i> Registrar Ocorrência
            </h2>
            {user ? (
              <BOForm
                user={user}
                onSuccess={() => {
                  setShowBOForm(false);
                  const section = document.getElementById("jornal");
                  if (section) {
                    section.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              />
            ) : (
              <p>Por favor, faça login para registrar um B.O.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-col">
            <h4>
              <i className="fa-solid fa-shield-halved"></i> REVOADA RJ
            </h4>
            <p>
              Central oficial de segurança pública. Servindo com honra e coragem.
            </p>
            <p>Developed by Dark and Tonin</p>
          </div>
          <div className="footer-col">
            <h4>Acesso Rápido</h4>
            <ul>
              <li>
                <Link href="/">Início</Link>
              </li>
              <li>
                <Link href="/pcerj">Recrutamentos</Link>
              </li>
              <li>
                <a href="#boletim-section" onClick={handleBOClick}>
                  Registrar B.O.
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Emergência</h4>
            <ul className="emergency-contacts">
              <li>
                <i className="fa-solid fa-phone"></i> 190 - Polícia Militar
              </li>
              <li>
                <i className="fa-solid fa-phone"></i> 191 - Polícia Rodoviária
                Federal
              </li>
              <li>
                <i className="fa-solid fa-phone"></i> 194 - Polícia Federal
              </li>
              <li>
                <i className="fa-solid fa-phone"></i> 197 - Polícia Civil
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Polícia Revoada RJ. Todos os direitos reservados.</p>
        </div>
      </footer>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
}
