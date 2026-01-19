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
      },
    );

    if (!response.ok) throw new Error("Erro ao buscar notícias");

    const messages = await response.json();

    const newsData = messages
      .map((msg) => {
        const content = msg.content;

        // Filtro básico: só processa se tiver o emoji do jornal
        if (!content.includes("# 📰")) return null;

        // 1. Extrair Título
        const titleMatch = content.match(/# 📰 (.*)/);
        const title = titleMatch ? titleMatch[1] : "Manchete Policial";

        // 2. Extrair Autor
        const authorMatch = content.match(/> ✍️.*?Reportagem por:.*?<@(\d+)>/);
        let author = "Redação";

        if (authorMatch) {
          // Tenta achar o usuário na lista de menções para pegar o nome real
          const mentioned = msg.mentions.find((u) => u.id === authorMatch[1]);
          author = mentioned
            ? mentioned.global_name || mentioned.username
            : "Repórter";
        }

        // --- CORREÇÃO PRINCIPAL AQUI ---
        // 3. Extrair Imagem (Prioridade: Anexo > Embed > Link Externo)
        let image = "https://via.placeholder.com/400x200?text=Sem+Imagem";

        // Caso 1: O usuário fez UPLOAD do arquivo (Anexo)
        if (msg.attachments && msg.attachments.length > 0) {
          image = msg.attachments[0].url;
        }
        // Caso 2: O usuário COLOU um link e o Discord gerou um Embed (Isso corrige o erro 403)
        // A API renova o link dentro de msg.embeds, mas não dentro de msg.content
        else if (msg.embeds && msg.embeds.length > 0 && msg.embeds[0].image) {
          image = msg.embeds[0].image.url; // Link fresco gerado pela API
        } else if (
          msg.embeds &&
          msg.embeds.length > 0 &&
          msg.embeds[0].thumbnail
        ) {
          image = msg.embeds[0].thumbnail.url; // Às vezes o Discord joga no thumbnail
        }
        // Caso 3: Fallback (Links externos que não geraram embed, ex: imgur antigo)
        else {
          const urls = content.match(/https?:\/\/\S+/g);
          // Só usamos o link do texto se NÃO for um link do Discord (cdn.discordapp), pois esses expiram
          if (urls && urls.length > 0) {
            const lastUrl = urls[urls.length - 1];
            if (!lastUrl.includes("discordapp")) {
              image = lastUrl;
            }
          }
        }

        // 4. Limpar o corpo do texto
        let cleanBody = content
          .replace(/<@&\d+>/g, "")
          .replace(/<@\d+>/g, "")
          .replace(/# 📰 .*\n?/g, "")
          .replace(/> ✍️.*\n?/g, "")
          .replace(/https?:\/\/\S+/g, "") // Remove as URLs do texto para ficar limpo
          .replace(/\n\n+/g, "\n")
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
      .filter((item) => item !== null);

    // Cache-Control: Importante para Serverless não bater no limite do Discord
    // Diz para o Vercel/Navegador: "Pode guardar essa resposta por 60 segundos"
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json(newsData);
  } catch (error) {
    console.error(error);
    return res.status(500).json([]);
  }
}
