export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, COMANDO_GERAL_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !COMANDO_GERAL_IDS) {
    return res.status(500).json({ error: "Configuração faltando no .env" });
  }

  // Separa os IDs da string (removendo espaços extras)
  const ids = COMANDO_GERAL_IDS.split(",").map((id) => id.trim());

  try {
    // Cria uma lista de "promessas" para buscar todos os usuários ao mesmo tempo
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      });

      if (!response.ok) return null; // Se o ID estiver errado, ignora
      const userData = await response.json();

      return {
        username: userData.global_name || userData.username, // Pega o nome global ou usuário
        avatarUrl: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(userData.discriminator) % 5
            }.png`, // Avatar padrão se não tiver foto
      };
    });

    // Espera todos os dados chegarem
    const commanders = await Promise.all(fetchPromises);

    // Retorna filtrando possíveis nulos (erros)
    return res.status(200).json(commanders.filter((c) => c !== null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar comandantes" });
  }
}
