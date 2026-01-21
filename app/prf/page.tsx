"use client";

import { useEffect } from "react";

export default function PRFPage() {
  useEffect(() => {
    const loadCommanders = async () => {
      try {
        const req = await fetch("/api/handler?type=get_prf");
        const commanders = await req.json();
        const container = document.getElementById("prf-leadership");
        if (container && commanders && commanders.length > 0) {
          container.innerHTML = "";
          commanders.forEach((cmd: any, index: number) => {
            const roles = [
              {
                title: "Diretor Geral",
                desc: "Chefe da Polícia Rodoviária Federal.",
              },
              { title: "Vice-Diretor", desc: "Coordenação regional." },
              {
                title: "Chefe de Policiamento",
                desc: "Fiscalização nas rodovias.",
              },
            ];
            const role = roles[index] || {
              title: "Oficial Superior",
              desc: "Membro da diretoria.",
            };
            const imagePath = `/images/commanders/prf_${index + 1}.png`;
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
        console.error("Erro ao carregar inspetores:", e);
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
              <i
                className="fa-solid fa-car-on"
                style={{ color: "var(--prf-yellow)" }}
              ></i>{" "}
              PRF - Departamento Rodoviário
            </h2>
          </div>

          <p
            style={{
              marginBottom: "20px",
              color: "#e2e8f0",
              lineHeight: "1.6",
            }}
          >
            A Polícia Rodoviária Federal (PRF) é a autoridade máxima nas
            rodovias e fronteiras da cidade. Nossa missão é combater o tráfico,
            recuperar veículos roubados e garantir a livre circulação com
            segurança.
          </p>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 style={{ color: "var(--prf-yellow)", marginBottom: "10px" }}>
            Força Especial:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--prf-yellow)" }}
            ></i>
            <strong>GRR</strong> (Grupo de Resposta Rápida){" "}
            <i className="fa-solid fa-bolt"></i>
          </div>

          <h3
            style={{
              color: "var(--prf-yellow)",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Grupamentos:
          </h3>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--prf-yellow)" }}
            ></i>{" "}
            <strong>BATEDOR</strong> (Escolta/Motos){" "}
            <i className="fa-solid fa-motorcycle"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--prf-yellow)" }}
            ></i>{" "}
            <strong>DOA</strong> (Operações Aéreas){" "}
            <i className="fa-solid fa-helicopter"></i>
          </div>
          <div className="list-item">
            <i
              className="fa-solid fa-caret-right"
              style={{ color: "var(--prf-yellow)" }}
            ></i>{" "}
            <strong>SPEED</strong> (Perseguição){" "}
            <i className="fa-solid fa-gauge-high"></i>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <h3 className="gallery-title">📸 Galeria Rodoviária</h3>
          <div className="gallery-grid">
            <div className="gallery-item">
              <img
                src="https://static.poder360.com.br/2021/12/prf-viatura-848x477.jpg"
                alt="Viatura PRF"
              />
            </div>
            <div className="gallery-item">
              <img
                src="https://agenciaja.com/wp-content/uploads/2019/07/Harley-Davidson-Road-King-Police-PRF-696x464.jpg"
                alt="Motos Batedor"
              />
            </div>
            <div className="gallery-item">
              <img
                src="https://www.gov.br/prf/pt-br/noticias/estaduais/rio-grande-do-sul/2022/junho/prf-realiza-transporte-aeromedico-de-orgao-para-transplante/0b5107e3-5182-41ba-ac77-96a12b69472e.jpg/@@images/image"
                alt="DOA Helicóptero"
              />
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
            acessorios 0 0; blusa 15 0; colete 0 0; adesivo 0 0; jaqueta 181 0;
            oculos -1 0; chapeu -1 0;
          </div>

          <div className="attention-note">
            <i className="fa-solid fa-circle-exclamation fa-lg"></i>
            <div>
              <strong>Padrão Visual:</strong>
              <br />
              É exigido cabelo na régua (corte 51), sem tatuagens visíveis e
              olhos naturais.
            </div>
          </div>

          <p style={{ marginBottom: "5px" }}>
            🚺 <strong>Fardamento feminino:</strong>
          </p>
          <div className="discord-code">
            mascara 0 0; maos 14 0; calca 33 3; mochila 0 0; sapatos 50 0;
            acessorios 0 0; blusa 14 0; colete 0 0; adesivo 0 0; jaqueta 553 2;
            oculos -1 0; chapeu -1 0;
          </div>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <a
              href="https://docs.google.com/document/d/1dii7sJSNBR4YLAbFO89pU6hU-s2K21_nLvyoQW57rZQ/edit?usp=sharing"
              target="_blank"
              className="btn-submit"
              style={{
                display: "inline-block",
                textDecoration: "none",
                backgroundColor: "var(--prf-blue)",
                borderColor: "#172554",
              }}
            >
              <i className="fa-solid fa-book"></i> Manual do Conscrito
            </a>
          </div>

          <blockquote
            style={{
              borderLeft: "4px solid var(--prf-yellow)",
              paddingLeft: "15px",
              color: "#94a3b8",
              fontStyle: "italic",
              marginTop: "20px",
            }}
          >
            🔎 Se você tem disciplina, coragem e deseja fazer parte da elite
            rodoviária, essa é sua chance!
          </blockquote>
        </div>
      </section>

      <section className="container commanders-section">
        <h2 className="section-title">
          <i className="fa-solid fa-star"></i> Diretoria da Polícia Rodoviária
          Federal
        </h2>

        <div id="prf-leadership" className="commanders-grid">
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
              style={{ color: "var(--prf-yellow)", marginBottom: "15px" }}
            ></i>
            <p>Carregando inspetores...</p>
          </div>
        </div>
      </section>
    </main>
  );
}
