export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DIRETORES_PF_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !DIRETORES_PF_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração faltando no .env" });
  }

  const ids = DIRETORES_PF_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) return null;
      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    return res.status(500).json({ error: "Erro interno" });
  }
}
