"use client";

import { useEffect } from "react";

export default function PFPage() {
  useEffect(() => {
    const loadCommanders = async () => {
      try {
        const req = await fetch("/api/handler?type=get_pf");
        const commanders = await req.json();
        const container = document.getElementById("pf-leadership");
        if (container && commanders && commanders.length > 0) {
          container.innerHTML = "";
          commanders.forEach((cmd: any, index: number) => {
            const roles = [
              { title: "Diretor Geral", desc: "Comando supremo da Polícia Federal." },
              { title: "Vice-Diretor", desc: "Gestão administrativa." },
              { title: "Vice-Diretor", desc: "Fiscalização e conduta." },
            ];
            const role = roles[index] || {
              title: "Oficial Superior",
              desc: "Membro da diretoria.",
            };
            const imagePath = `/images/commanders/pf_${index + 1}.png`;
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
        console.error("Erro ao carregar diretores:", e);
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
              <i className="fa-solid fa-globe" style={{ color: "#94a3b8" }}></i>{" "}
              DEPARTAMENTO DE POLÍCIA FEDERAL{" "}
              <i className="fa-solid fa-globe" style={{ color: "#94a3b8" }}></i>
            </h2>
          </div>

          <p
            style={{
              marginBottom: "20px",
              color: "#e2e8f0",
              lineHeight: "1.6",
            }}
          >
            A Polícia Federal (PF) é a elite investigativa, atuando
            diretamente em crimes contra a União, corrupção, lavagem de dinheiro,
            tráfico internacional de drogas e terrorismo. Nossa missão é garantir
            a lei acima de tudo.
          </p>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 style={{ color: "#94a3b8", marginBottom: "10px" }}>
            Força Especial:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#94a3b8" }}
            ></i>
            <strong>COT</strong> (Comando de Operações Táticas){" "}
            <i className="fa-solid fa-user-ninja"></i>
          </div>

          <h3
            style={{
              color: "#94a3b8",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Grupamentos:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#94a3b8" }}
            ></i>{" "}
            <strong>GPI</strong> (Pronta Intervenção){" "}
            <i className="fa-solid fa-gun"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "#94a3b8" }}
            ></i>{" "}
            <strong>CAOP</strong> (Comando Aéreo){" "}
            <i className="fa-solid fa-plane"></i>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 className="gallery-title">📸 Arquivo Federal</h3>
          <div className="gallery-grid">
            <div className="gallery-item">
              <img
                src="https://static.poder360.com.br/2022/10/viaturas-policia-federal-pf-848x477.jpg"
                alt="Viatura PF"
              />
            </div>
            <div className="gallery-item">
              <img
                src="https://www.cnnbrasil.com.br/wp-content/uploads/sites/12/2021/06/25015_82F57813134D8A99.jpg"
                alt="COT em ação"
              />
            </div>
            <div className="gallery-item">
              <img
                src="https://gov.br/pf/pt-br/assuntos/noticias/2022/08/policia-federal-realiza-exercicio-simulado-de-ameaca-de-bomba-no-aeroporto-de-belem/WhatsAppImage20220818at14.39.05.jpeg/@@images/image"
                alt="Esquadrão Antibombas"
              />
            </div>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <p>
            📢 <span className="discord-highlight">Processo Seletivo</span>
          </p>
          <ul style={{ marginLeft: "20px", marginTop: "10px", color: "#cbd5e1" }}>
            <li>
              Status: <span style={{ color: "#facc15", fontWeight: "bold" }}>SOB ANÁLISE</span>
            </li>
            <li>Método: Indicação ou Concurso Público.</li>
          </ul>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <p style={{ marginBottom: "5px" }}>
            🚹 <strong>Fardamento masculino:</strong>
          </p>
          <div className="discord-code">
            mascara 0 0; maos 0 0; calca 35 0; mochila 0 0; sapatos 10 0;
            acessorios 0 0; blusa 15 0; colete 55 0; jaqueta 42 0; oculos -1 0;
          </div>

          <p style={{ marginBottom: "5px" }}>
            🚺 <strong>Fardamento feminino:</strong>
          </p>
          <div className="discord-code">
            mascara -1 0; maos 0 0; calca 36 0; mochila -1 0; sapatos 11 0;
            acessorios -1 0; blusa 15 0; colete 54 0; jaqueta 43 0; oculos -1 0;
          </div>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <a
              href="#"
              className="btn-submit"
              style={{
                display: "inline-block",
                textDecoration: "none",
                backgroundColor: "#475569",
                borderColor: "#334155",
              }}
            >
              <i className="fa-solid fa-book"></i> Ver Edital
            </a>
          </div>

          <blockquote
            style={{
              borderLeft: "4px solid #94a3b8",
              paddingLeft: "15px",
              color: "#94a3b8",
              fontStyle: "italic",
              marginTop: "20px",
            }}
          >
            ⚖️ Integridade, honra e competência técnica. A excelência é o nosso
            padrão.
          </blockquote>
        </div>
      </section>

      <section className="container commanders-section">
        <h2 className="section-title">
          <i className="fa-solid fa-star"></i> Diretoria da Polícia Federal
        </h2>

        <div id="pf-leadership" className="commanders-grid">
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
              style={{ color: "#94a3b8", marginBottom: "15px" }}
            ></i>
            <p>Carregando diretores...</p>
          </div>
        </div>
      </section>
    </main>
  );
}
