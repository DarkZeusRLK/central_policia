"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const response = await fetch("/api/handler?type=get_news");
      if (!response.ok) throw new Error("API Offline");
      const newsData = await response.json();
      setNews(newsData || []);
    } catch (error) {
      console.error("Erro ao carregar notícias:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dashboard-content">
      <div className="dashboard-header">
        <div className="system-status">
          <span className="pulsing-dot"></span>
          <span className="status-text">SISTEMA ONLINE</span>
        </div>
      </div>

      <section id="sec-home" className="dash-section">
        <h1 style={{ color: "white", marginBottom: "10px" }}>
          Painel Operacional
        </h1>
        <p style={{ color: "#94a3b8" }}>
          Bem-vindo à área restrita, oficial.
        </p>

        <div
          style={{
            marginTop: "20px",
            background: "rgba(251, 191, 36, 0.1)",
            padding: "20px",
            borderRadius: "12px",
            borderLeft: "5px solid var(--accent-gold)",
          }}
        >
          <h4 style={{ color: "var(--accent-gold)", margin: 0 }}>
            <i className="fa-solid fa-triangle-exclamation"></i> Aviso do
            Comando
          </h4>
          <p
            style={{
              color: "#cbd5e1",
              marginTop: "5px",
              fontSize: "0.9rem",
            }}
          >
            Lembre-se de entrar na call de patrulha do Discord antes de iniciar
            o patrulhamento. O uso desta intranet é monitorado.
          </p>
        </div>

        <div className="dashboard-grid">
          <div className="widget-card">
            <div className="widget-title">
              <i className="fa-regular fa-newspaper"></i> Último Informativo
            </div>
            <div id="latest-news-container">
              {loading ? (
                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  Buscando notícias...
                </p>
              ) : news.length > 0 ? (
                <div
                  className="news-widget-content"
                  style={{
                    backgroundImage: `url('${
                      news[0].image ||
                      "https://static.vecteezy.com/system/resources/thumbnails/006/299/370/original/world-breaking-news-digital-earth-hud-rotating-globe-rotating-free-video.jpg"
                    }')`,
                  }}
                >
                  <div className="news-overlay">
                    <h4 style={{ margin: 0, fontSize: "1rem" }}>
                      {news[0].title}
                    </h4>
                    <small style={{ color: "#cbd5e1" }}>
                      {news[0].date || "Data não disponível"}
                    </small>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  Nenhuma notícia disponível
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
