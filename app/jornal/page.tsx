"use client";

import { useEffect, useState } from "react";

export default function JornalPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMareNews();
    const interval = setInterval(loadMareNews, 300000); // Atualiza a cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  async function loadMareNews() {
    try {
      const response = await fetch("/api/handler?type=get_news");
      if (!response.ok) throw new Error("Erro ao carregar notícias");
      const newsData = await response.json();
      setNews(newsData || []);
    } catch (error) {
      console.error("Erro ao carregar notícias:", error);
    } finally {
      setLoading(false);
    }
  }

  const uniqueAuthors = new Set(news.map((n) => n.author || "Redação"));
  const now = new Date();
  const thisMonth = news.filter((n) => {
    try {
      let articleDate;
      if (n.date) {
        if (typeof n.date === "string" && n.date.includes("/")) {
          const parts = n.date.split("/");
          if (parts.length === 3) {
            articleDate = new Date(parts[2], parts[1] - 1, parts[0]);
          } else {
            articleDate = new Date(n.date);
          }
        } else {
          articleDate = new Date(n.date);
        }
      } else {
        articleDate = new Date();
      }
      return (
        articleDate.getMonth() === now.getMonth() &&
        articleDate.getFullYear() === now.getFullYear()
      );
    } catch (e) {
      return false;
    }
  }).length;

  return (
    <main>
      <header className="news-header">
        <h1>
          <i className="fa-solid fa-newspaper"></i> JORNAL MARE
        </h1>
        <p className="subtitle">Últimas Notícias da Polícia | Revoada RJ</p>
      </header>

      <div className="news-container">
        <div className="news-about-section">
          <h2>
            <i className="fa-solid fa-newspaper"></i> Sobre o Jornal Mare
          </h2>
          <p>
            O Jornal Mare é a publicação oficial da Central de Polícia de
            Revoada RJ. Nossa missão é manter a comunidade informada sobre as
            operações policiais, eventos importantes e notícias relevantes da
            corporação.
          </p>
          <p>
            Publicamos regularmente reportagens sobre operações, recrutamentos,
            promoções e demais acontecimentos que fazem parte do dia a dia da
            polícia.
          </p>

          <div className="news-features">
            <div className="news-feature">
              <i className="fa-solid fa-shield-halved"></i>
              <h3>Notícias Oficiais</h3>
              <p>
                Informações verificadas e autorizadas pela alta cúpula da polícia
              </p>
            </div>
            <div className="news-feature">
              <i className="fa-solid fa-clock"></i>
              <h3>Atualizações Diárias</h3>
              <p>Conteúdo atualizado regularmente para manter você informado</p>
            </div>
            <div className="news-feature">
              <i className="fa-solid fa-users"></i>
              <h3>Comunidade</h3>
              <p>Conectando policiais e cidadãos através da informação</p>
            </div>
          </div>
        </div>

        <div className="news-stats-section">
          <h2
            style={{
              color: "var(--accent-gold)",
              fontSize: "1.8rem",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <i className="fa-solid fa-chart-line"></i> Estatísticas do Jornal
          </h2>
          <div className="news-stats-grid">
            <div className="news-stat-item">
              <i className="fa-solid fa-newspaper"></i>
              <h3>{news.length}</h3>
              <p>Notícias Publicadas</p>
            </div>
            <div className="news-stat-item">
              <i className="fa-solid fa-user-pen"></i>
              <h3>{uniqueAuthors.size}</h3>
              <p>Repórteres Ativos</p>
            </div>
            <div className="news-stat-item">
              <i className="fa-solid fa-calendar-days"></i>
              <h3>{thisMonth}</h3>
              <p>Este Mês</p>
            </div>
          </div>
        </div>

        <div id="news-content">
          {loading ? (
            <div className="loading-state">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <p>Carregando últimas notícias...</p>
            </div>
          ) : news.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-newspaper"></i>
              <h3 style={{ color: "white", marginTop: "20px" }}>
                Nenhuma notícia disponível
              </h3>
              <p>
                As últimas notícias da polícia aparecerão aqui em breve.
              </p>
            </div>
          ) : (
            news.map((article, index) => {
              let articleDate;
              try {
                if (article.date) {
                  if (
                    typeof article.date === "string" &&
                    article.date.includes("/")
                  ) {
                    const parts = article.date.split("/");
                    if (parts.length === 3) {
                      articleDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    } else {
                      articleDate = new Date(article.date);
                    }
                  } else {
                    articleDate = new Date(article.date);
                  }
                } else {
                  articleDate = new Date();
                }
              } catch (e) {
                articleDate = new Date();
              }

              const formattedDate = articleDate.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={article.id || index}>
                  <article className="news-article">
                    <div className="news-article-header">
                      <div className="news-article-date">
                        <i className="fa-regular fa-calendar"></i>
                        {formattedDate}
                      </div>
                      <div className="news-article-category">
                        <i className="fa-solid fa-bullhorn"></i> Notícia Oficial
                      </div>
                    </div>

                    <div className="news-article-content">
                      <h2 className="news-article-title">{article.title}</h2>

                      {article.image && (
                        <img
                          src={article.image}
                          alt={article.title}
                          className="news-article-image"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='400'%3E%3Crect fill='%231e293b' width='800' height='400'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='20' fill='%23fbbf24' text-anchor='middle' dominant-baseline='middle'%3EImagem Indisponível%3C/text%3E%3C/svg%3E";
                            target.style.opacity = "0.7";
                          }}
                        />
                      )}

                      <div className="news-article-text">
                        {article.summary || article.content || "Conteúdo não disponível."}
                      </div>
                    </div>

                    <div className="news-article-footer">
                      <div className="news-author">
                        <i className="fa-solid fa-user-shield"></i>
                        <span>
                          Por: {article.author || "Redação Jornal Mare"}
                        </span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                        <i className="fa-solid fa-eye"></i> Notícia Oficial
                      </div>
                    </div>
                  </article>
                  {index < news.length - 1 && (
                    <div className="news-divider"></div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
