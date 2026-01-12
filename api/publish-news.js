// api/publish-news.js
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Agora esperamos 'userId' (o ID do discord) vindo do frontend, não apenas o nome
  const { title, content, imageUrl, userId, fontFamily } = req.body;

  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID, MATRIZES_ROLE_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID || !MATRIZES_ROLE_ID) {
    return res.status(500).json({ error: "Configuração incompleta (.env)." });
  }

  try {
    // 1. Processa os Cargos (Permite múltiplos IDs separados por vírgula no .env)
    // Ex no .env: MATRIZES_ROLE_ID=123456,789012,345678
    const rolesToMention = MATRIZES_ROLE_ID.split(",")
      .map((id) => `<@&${id.trim()}>`) // Cria a menção <@&ID> para cada um
      .join(" "); // Junta com espaço

    // 2. Aplica formatação de fonte ao conteúdo baseado na seleção
    let formattedContent = content;
    if (fontFamily === "bold") {
      formattedContent = `**${content}**`;
    } else if (fontFamily === "italic") {
      formattedContent = `*${content}*`;
    } else if (fontFamily === "bold-italic") {
      formattedContent = `***${content}***`;
    } else if (fontFamily === "code") {
      formattedContent = `\`\`\`\n${content}\n\`\`\``;
    }
    // Se for "normal", mantém o conteúdo sem formatação

    // 3. ID do usuário policial a ser mencionado
    const POLICIAL_USER_ID = "&1447056982371602526";

    // 4. Monta a Mensagem
    // <@${userId}> cria a menção clicável ao autor
    const messageContent = `
${rolesToMention}
<@${POLICIAL_USER_ID}>

# 📰 ${title.toUpperCase()}

${formattedContent}

> ✍️ *Reportagem por:* <@${userId}>

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

    if (!response.ok) {
      const err = await response.text();
      console.error("Discord Error:", err);
      throw new Error("Falha ao enviar para o Discord");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao publicar notícia." });
  }
}
