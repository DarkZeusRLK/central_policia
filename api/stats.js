// api/stats.js
export default async function handler(req, res) {
  // 1. Apenas método GET é permitido
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { DISCORD_BOT_TOKEN, PRISOES_CH_ID, FIANCAS_CH_ID } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot Token não configurado" });
  }

  // Função auxiliar para buscar e contar mensagens do dia
  async function countMessagesFromToday(channelId) {
    if (!channelId) return 0;

    try {
      // Busca as últimas 100 mensagens do canal
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Erro ao ler canal ${channelId}:`, response.status);
        return 0;
      }

      const messages = await response.json();

      // Define o início do dia de hoje (Meia-noite)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Filtra apenas as mensagens que foram criadas DEPOIS da meia-noite de hoje
      const count = messages.filter((msg) => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= hoje;
      }).length;

      return count;
    } catch (error) {
      console.error("Erro na contagem:", error);
      return 0;
    }
  }

  try {
    // 2. Executa as contagens em paralelo (mais rápido)
    const [totalPrisoes, totalFiancas] = await Promise.all([
      countMessagesFromToday(PRISOES_CH_ID),
      countMessagesFromToday(FIANCAS_CH_ID),
    ]);

    // 3. Retorna os dados para o site
    return res.status(200).json({
      prisoes: totalPrisoes,
      fiancas: totalFiancas,
      total: totalPrisoes + totalFiancas,
      status_api: "online",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar estatísticas" });
  }
}
