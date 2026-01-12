export default async function handler(req, res) {
  // ADICIONADO: DISCORD_GUILD_ID para saber de qual servidor pegar o apelido
  const { DISCORD_BOT_TOKEN, COMANDO_GERAL_IDS, DISCORD_GUILD_ID } =
    process.env;

  if (!DISCORD_BOT_TOKEN || !COMANDO_GERAL_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({
      error: "Configuração faltando no .env (Verifique DISCORD_GUILD_ID)",
    });
  }

  // Separa os IDs da string
  const ids = COMANDO_GERAL_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      // MUDANÇA: Endpoint de Membros do Servidor (traz o apelido)
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (!response.ok) return null;

      const memberData = await response.json();
      const user = memberData.user; // Os dados globais ficam dentro de .user

      return {
        // PRIORIDADE: Nick (Apelido) -> Global Name -> Username
        username: memberData.nick || user.global_name || user.username,

        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    // Espera todos os dados chegarem
    const commanders = await Promise.all(fetchPromises);

    // Retorna filtrando possíveis nulos
    return res.status(200).json(commanders.filter((c) => c !== null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar comandantes" });
  }
}
