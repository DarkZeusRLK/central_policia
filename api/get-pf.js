export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, DIRETORES_PF_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !DIRETORES_PF_IDS) {
    return res
      .status(500)
      .json({ error: "Configuração faltando no .env (DIRETORES_PF_IDS)" });
  }

  const ids = DIRETORES_PF_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });

      if (!response.ok) return null;
      const userData = await response.json();

      return {
        username: userData.global_name || userData.username,
        avatarUrl: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(userData.discriminator) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar diretores PF" });
  }
}
