"use client";

import { useEffect } from "react";

export default function PMERJPage() {
  useEffect(() => {
    const loadCommanders = async () => {
      try {
        const req = await fetch("/api/handler?type=get_pmerj");
        const commanders = await req.json();
        const container = document.getElementById("pmerj-leadership");
        if (container && commanders && commanders.length > 0) {
          container.innerHTML = "";
          commanders.forEach((cmd: any, index: number) => {
            const roles = [
              { title: "Comandante", desc: "Responsável pelo batalhão." },
              { title: "Subcomandante", desc: "Gestão da tropa e disciplina." },
              { title: "Subcomandante", desc: "Planejamento de operações." },
            ];
            const role = roles[index] || {
              title: "Oficial Superior",
              desc: "Membro da diretoria.",
            };
            const imagePath = `/images/commanders/pmerj_${index + 1}.png`;
            container.innerHTML += `
              <div class="commander-card">
                <div class="cmd-img-container">
                  <img src="${imagePath}" alt="${cmd.username}">
                </div>
                <h3>${cmd.username}</h3>
                <span class="rank">${role.title}</span>
                <p>${role.desc}</p>
              </div>
            `;
          });
        }
      } catch (e) {
        console.error("Erro ao carregar comandantes:", e);
      }
    };
    loadCommanders();
  }, []);

  return (
    <main>
      <section className="container">
        <div className="glass-panel" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 style={{ color: "white", textTransform: "uppercase" }}>
              <i className="fa-solid fa-star" style={{ color: "#3b82f6" }}></i>{" "}
              POLÍCIA MILITAR{" "}
              <i className="fa-solid fa-star" style={{ color: "#3b82f6" }}></i>
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#94a3b8",
                letterSpacing: "1px",
              }}
            >
              ESTADO DO RIO DE JANEIRO
            </p>
          </div>

          <p
            style={{
              marginBottom: "20px",
              color: "#e2e8f0",
              lineHeight: "1.6",
            }}
          >
            A Polícia Militar do Estado do Rio de Janeiro (PMERJ) é a principal
            força de segurança ostensiva e preservação da ordem pública. Nossa
            missão é proteger os cidadãos, combater o crime e garantir a paz
            social com honra e bravura.
          </p>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 style={{ color: "#3b82f6", marginBottom: "10px" }}>
            Forças Especiais:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#3b82f6" }}
            ></i>
            <strong>BOPE</strong> (Operações Especiais){" "}
            <i className="fa-solid fa-skull-crossbones"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#3b82f6" }}
            ></i>
            <strong>CHOQUE</strong> (Controle de Distúrbios){" "}
            <i className="fa-solid fa-shield-halved"></i>
          </div>

          <h3
            style={{
              color: "#3b82f6",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Grupamentos:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#3b82f6" }}
            ></i>{" "}
            <strong>BTM</strong> (Tático Móvel){" "}
            <i className="fa-solid fa-motorcycle"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#3b82f6" }}
            ></i>{" "}
            <strong>GAM</strong> (Aéreo) <i className="fa-solid fa-helicopter"></i>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 className="gallery-title">📸 Galeria Ostensiva</h3>
          <div className="gallery-grid">
            <div className="gallery-item">
              <img src="/images/CHOQUE.png" alt="choque" />
            </div>
            <div className="gallery-item">
              <img src="/images/GAM.png" alt="GAM" />
            </div>
            <div className="gallery-item">
              <img src="/images/GAM_2.png" alt="GAM Helicóptero" />
            </div>
            <div className="gallery-item">
              <img src="/images/btm_imagem.png" alt="BTM" />
            </div>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <p>
            📢 <span className="discord-highlight">
              Informações sobre recrutamento
            </span>
          </p>
          <ul style={{ marginLeft: "20px", marginTop: "10px", color: "#cbd5e1" }}>
            <li>
              Status: <span style={{ color: "#4ade80", fontWeight: "bold" }}>ABERTO</span>
            </li>
            <li>Horário: Todos os dias.</li>
          </ul>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <p style={{ marginBottom: "5px" }}>
            🚹 <strong>Fardamento masculino:</strong>
          </p>
          <div className="discord-code">
            mascara 0 0; maos 0 0; calca 14 0; mochila 0 0; sapatos 56 0;
            acessorios 0 0; blusa 15 0; colete 0 0; adesivo 0 0; jaqueta 745
            4; oculos -1 0; chapeu -1 0;
          </div>

          <div className="attention-note">
            <i className="fa-solid fa-circle-exclamation fa-lg"></i>
            <div>
              <strong>Atenção ao Regulamento:</strong>
              <br />
              É obrigatório comparecer sem cabelo (corte 51), sem tatuagens
              visíveis e com olhos de cores naturais.
            </div>
          </div>

          <p style={{ marginBottom: "5px" }}>
            🚺 <strong>Fardamento feminino:</strong>
          </p>
          <div className="discord-code">
            mascara 0 0; maos 14 0; calca 33 3; mochila 0 0; sapatos 180 1;
            acessorios 0 0; blusa 14 0; colete 0 0; adesivo 0 0; jaqueta 807
            15; oculos -1 0; chapeu -1 0;
          </div>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <a
              href="https://docs.google.com/document/d/1KMG9T5lIwNzLdEQ2C_-pfU5ZQrYJ1Vjhl4i9Hi-GPYw/edit?usp=sharing"
              target="_blank"
              className="btn-submit"
              style={{
                display: "inline-block",
                textDecoration: "none",
                backgroundColor: "#3b82f6",
                borderColor: "#2563eb",
              }}
            >
              <i className="fa-solid fa-book"></i> Ler Manual do Recrutamento
            </a>
          </div>

          <blockquote
            style={{
              borderLeft: "4px solid #3b82f6",
              paddingLeft: "15px",
              color: "#94a3b8",
              fontStyle: "italic",
              marginTop: "20px",
            }}
          >
            🔎 Se você tem honra, disciplina e deseja servir a sociedade com
            bravura, a PMERJ espera por você!
          </blockquote>
        </div>
      </section>

      <section className="container commanders-section">
        <h2 className="section-title">
          <i className="fa-solid fa-star"></i> Comandantes da Polícia Militar
        </h2>

        <div id="pmerj-leadership" className="commanders-grid">
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
              style={{ color: "#3b82f6", marginBottom: "15px" }}
            ></i>
            <p>Carregando comando...</p>
          </div>
        </div>
      </section>
    </main>
  );
}
