// api/get-news.js
export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID) {
    return res.status(500).json({ error: "Configuração faltando" });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${JORNAL_CH_ID}/messages?limit=10`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      }
    );

    if (!response.ok) throw new Error("Erro ao buscar notícias");

    const messages = await response.json();

    // Filtra e processa as mensagens (Parsing Manual do Texto)
    const newsData = messages
      .map((msg) => {
        const content = msg.content;

        // Se a mensagem não tiver o formato padrão (ex: msg de sistema), ignora ou retorna null
        if (!content.includes("# 📰")) return null;

        // 1. Extrair Título (Tudo depois de "# 📰 " até a quebra de linha)
        const titleMatch = content.match(/# 📰 (.*)/);
        const title = titleMatch ? titleMatch[1] : "Manchete Policial";

        // 2. Extrair Autor (Tudo depois de "Reportagem por: ")
        const authorMatch = content.match(/Reportagem por: (.*)\*/);
        const author = authorMatch ? authorMatch[1] : "Redação";

        // 3. Extrair Imagem (A última linha que parece um link)
        // Se o Discord gerou anexo (imagem upada), usamos ele. Se não, tentamos achar url no texto.
        let image = "https://via.placeholder.com/400x200?text=Sem+Imagem";

        if (msg.attachments && msg.attachments.length > 0) {
          image = msg.attachments[0].url;
        } else {
          // Pega a última "palavra" da mensagem que começa com http
          const urls = content.match(/https?:\/\/\S+/g);
          if (urls && urls.length > 0) {
            image = urls[urls.length - 1]; // Assume que a imagem é o último link
          }
        }

        // 4. Limpar o corpo do texto (Remove titulo, autor, imagem e menção)
        let cleanBody = content
          .replace(/<@&\d+>/g, "") // Remove menção
          .replace(/# 📰 .*/, "") // Remove titulo
          .replace(/> ✍️.*/, "") // Remove autor linha
          .replace(image, "") // Remove url da imagem
          .trim();

        return {
          id: msg.id,
          title: title,
          summary: cleanBody,
          image: image,
          date: new Date(msg.timestamp).toLocaleDateString("pt-BR"),
          author: author,
        };
      })
      .filter((item) => item !== null); // Remove itens inválidos

    return res.status(200).json(newsData);
  } catch (error) {
    console.error(error);
    return res.status(500).json([]);
  }
}
