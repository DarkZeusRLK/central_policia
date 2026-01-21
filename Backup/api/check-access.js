// api/check-access.js
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, JORNALISTA_ROLE_ID } =
    process.env;

  if (!userId || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração ou UserID faltando" });
  }

  try {
    // 1. Pergunta ao Discord se o usuário está no servidor (Guild)
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (response.status === 404) {
      // Usuário NÃO está no servidor
      return res.status(200).json({ isMember: false, isJournalist: false });
    }

    if (!response.ok) throw new Error("Erro na API do Discord");

    const memberData = await response.json();

    // 2. Verifica se tem o cargo de Jornalista
    const hasJournalistRole = memberData.roles.includes(JORNALISTA_ROLE_ID);

    return res.status(200).json({
      isMember: true, // Está no servidor (Policial/Cidadão ativo)
      isJournalist: hasJournalistRole,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
