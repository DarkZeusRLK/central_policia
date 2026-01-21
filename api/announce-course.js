// api/announce-course.js
// API para anunciar um curso publicamente
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    courseName,
    courseDescription,
    courseDate,
    courseInstructor,
    courseLink,
    userId,
    username,
  } = req.body;

  const { DISCORD_BOT_TOKEN, CHANNEL_CURSOS_ANUNCIADOS } = process.env;

  if (!DISCORD_BOT_TOKEN || !CHANNEL_CURSOS_ANUNCIADOS) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado ou canal de anúncios não definido.",
    });
  }

  try {
    // Formata a data
    const dataFormatada = courseDate
      ? new Date(courseDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "A definir";

    // Monta a mensagem de anúncio
    const anuncio = `
\`\`\`md
# 📚 ANÚNCIO DE CURSO

NOME: ${courseName || "Não informado"}
DESCRIÇÃO: ${courseDescription || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${courseInstructor || "Não informado"}
LINK: ${courseLink || "N/A"}
\`\`\``;

    const contentMessage = `🎓 **Novo curso anunciado por:** <@${userId}> (${username})\n${anuncio}`;

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_CURSOS_ANUNCIADOS}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: contentMessage }),
      }
    );

    if (!discordResponse.ok) {
      const errorData = await discordResponse.json();
      console.error("Erro Discord:", errorData);
      return res.status(500).json({ error: "Discord recusou a mensagem." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar anúncio." });
  }
}
