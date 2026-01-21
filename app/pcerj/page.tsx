"use client";

import { useEffect } from "react";

export default function PCERJPage() {
  useEffect(() => {
    const loadCommanders = async () => {
      try {
        const req = await fetch("/api/handler?type=get_pcerj");
        const commanders = await req.json();
        const container = document.getElementById("pcerj-leadership");
        if (container && commanders && commanders.length > 0) {
          container.innerHTML = "";
          commanders.forEach((cmd: any, index: number) => {
            const roles = [
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
            ];
            const role = roles[index] || {
              title: "Oficial Superior",
              desc: "Membro da diretoria.",
            };
            const imagePath = `/images/commanders/pcerj_${index + 1}.png`;
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
        console.error("Erro ao carregar delegados:", e);
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
              <i className="fa-solid fa-shield-cat"></i> Departamento de Polícia Civil
            </h2>
          </div>

          <p
            style={{
              marginBottom: "20px",
              color: "#e2e8f0",
              lineHeight: "1.6",
            }}
          >
            A Polícia Civil é responsável pela investigação de crimes,
            inteligência policial, cumprimento de mandados e manutenção da ordem
            pública através de inquéritos rigorosos.
          </p>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 style={{ color: "var(--accent-gold)", marginBottom: "10px" }}>
            Força Especial:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--accent-gold)" }}
            ></i>
            <strong>CORE</strong>{" "}
            <span style={{ fontSize: "0.8em", opacity: 0.7 }}>
              (Coordenadoria de Recursos Especiais)
            </span>{" "}
            <i className="fa-solid fa-skull"></i>
          </div>

          <h3
            style={{
              color: "var(--accent-gold)",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Grupamentos:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--accent-gold)" }}
            ></i>{" "}
            <strong>SAER</strong> (Serviço Aeropolicial){" "}
            <i className="fa-solid fa-helicopter"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--accent-gold)" }}
            ></i>{" "}
            <strong>GEM</strong> (Grupamento Especial de Motocicletas){" "}
            <i className="fa-solid fa-motorcycle"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--accent-gold)" }}
            ></i>{" "}
            <strong>CGPC</strong> (Controladoria Geral da Polícia Civil){" "}
            <i className="fa-solid fa-clipboard-list"></i>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 className="gallery-title">📸 Galeria Operacional</h3>
          <div className="gallery-grid">
            <div className="gallery-item">
              <img src="/images/COMANDOS_CORE.png" alt="Viatura" />
            </div>
            <div className="gallery-item">
              <img src="/images/CGPC.png" alt="Helicóptero" />
            </div>
            <div className="gallery-item">
              <img src="/images/Gem_mural.png" alt="Equipe" />
            </div>
            <div className="gallery-item">
              <img src="/images/REC_CORE_VIATURA.png" alt="Viatura" />
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
            mascara 0 0; maos 0 0; calca 246 0; mochila 0 0; sapatos 181 0;
            acessorios 0 0; blusa 15 0; colete 94 0; adesivo 0 0; jaqueta 745
            4; oculos -1 0; chapeu -1 0;
          </div>

          <p style={{ marginBottom: "5px" }}>
            🚺 <strong>Fardamento feminino:</strong>
          </p>
          <div className="discord-code">
            mascara -1 0; maos 0 0; calca 250 0; mochila -1 0; sapatos 50 0;
            acessorios -1 0; blusa 14 0; colete -1 0; adesivo 0 0; jaqueta 288
            0; oculos -1 0; chapeu -1 0;
          </div>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <a
              href="https://docs.google.com/document/d/11uoLQKCkghNV-yLZVZrGwgSx-DmFjJr6SvUTgR1Ld3A/edit?tab=t.0"
              target="_blank"
              className="btn-submit"
              style={{
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-book"></i> Ler Manual do Conscrito
            </a>
          </div>

          <blockquote
            style={{
              borderLeft: "4px solid var(--accent-gold)",
              paddingLeft: "15px",
              color: "#94a3b8",
              fontStyle: "italic",
              marginTop: "20px",
            }}
          >
            🔎 Se você tem inteligência, disciplina e deseja fazer parte da
            elite investigativa da cidade, essa é sua chance!
          </blockquote>
        </div>
      </section>

      <section className="container commanders-section">
        <h2 className="section-title">
          <i className="fa-solid fa-star"></i> Delegados da Polícia Civil
        </h2>

        <div id="pcerj-leadership" className="commanders-grid">
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
              style={{ color: "var(--accent-gold)", marginBottom: "15px" }}
            ></i>
            <p>Carregando delegados...</p>
          </div>
        </div>
      </section>
    </main>
  );
}
