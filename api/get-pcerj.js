export default async function handler(req, res) {
  // Adicionei DISCORD_GUILD_ID aqui
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DELEGADOS_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !DELEGADOS_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({
      error:
        "Configuração faltando no .env (Verifique GUILD_ID e DELEGADOS_IDS)",
    });
  }

  const ids = DELEGADOS_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      // MUDANÇA PRINCIPAL: Buscando do endpoint de MEMBROS (Guilds) e não Users
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) {
        console.error(`Erro ao buscar ID ${id}: ${response.status}`);
        return null;
      }

      const memberData = await response.json();
      const user = memberData.user;

      return {
        // AQUI ESTÁ A MÁGICA:
        // Tenta pegar o 'nick' (Apelido no server). Se não tiver, pega o global_name, senão o username.
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
    console.error("Erro API PCERJ:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
