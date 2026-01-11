// api/publish-news.js
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { title, content, imageUrl, author } = req.body;
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID, MATRIZES_ROLE_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID) {
    return res.status(500).json({ error: "Configuração incompleta." });
  }

  try {
    // Formatação "Jornalística" em Markdown do Discord
    // <@&ID> menciona o cargo
    // # Título deixa grande
    // > Citação para o autor
    const messageContent = `
<@&${MATRIZES_ROLE_ID}>

# 📰 ${title.toUpperCase()}

${content}

> ✍️ *Reportagem por: ${author}*

${imageUrl}
    `.trim();

    const response = await fetch(
      `https://discord.com/api/v10/channels/${JORNAL_CH_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: messageContent,
        }),
      }
    );

    if (!response.ok) throw new Error("Falha ao enviar para o Discord");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao publicar notícia." });
  }
}
