// api/stats.js
export default async function handler(req, res) {
  // 1. Apenas método GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { DISCORD_BOT_TOKEN, PRISOES_CH_ID, FIANCAS_CH_ID } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot Token não configurado" });
  }

  // --- Função para buscar mensagens com Paginação (Busca até 500 msgs) ---
  async function fetchMessagesFromChannel(channelId) {
    let allMessages = [];
    let lastId = null;
    let keepFetching = true;
    let loops = 0;

    // Tenta buscar até 5 páginas (500 mensagens) ou até sair do dia de hoje
    // Isso garante que pegue todas as 50+ prisões
    while (keepFetching && loops < 5) {
      try {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (lastId) {
          url += `&before=${lastId}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        });

        if (!response.ok) break;

        const messages = await response.json();

        if (messages.length === 0) {
          keepFetching = false;
          break;
        }

        allMessages = allMessages.concat(messages);
        lastId = messages[messages.length - 1].id;
        loops++;
      } catch (e) {
        console.error("Erro no fetch loop:", e);
        keepFetching = false;
      }
    }
    return allMessages;
  }

  // --- Função para contar ---
  async function countMessagesFromToday(channelId) {
    if (!channelId) return 0;

    try {
      const messages = await fetchMessagesFromChannel(channelId);

      // 1. Define "Hoje" no Horário de Brasília (UTC-3)
      // O servidor pode estar em UTC, então convertemos a string para data BR
      const now = new Date();
      const brazilDateString = now.toLocaleDateString("en-US", {
        timeZone: "America/Sao_Paulo",
      });
      const hojeBrasilia = new Date(brazilDateString);
      // Zera as horas para pegar desde a meia-noite de hoje
      hojeBrasilia.setHours(0, 0, 0, 0);

      // 2. Filtra as mensagens
      const count = messages.filter((msg) => {
        // Converte o timestamp da mensagem para objeto Date
        const msgDate = new Date(msg.timestamp);

        // Ajusta o timestamp da mensagem para comparar corretamente com Brasília
        // (Apenas subtraindo o offset para garantir comparação justa se necessário,
        // mas comparar timestamps brutos UTC >= UTC da meia noite BR funciona melhor)

        // Lógica Simplificada e Robusta:
        // Verifica se a mensagem é MAIOR ou IGUAL a meia-noite de hoje (horário BR)
        return msgDate.getTime() >= hojeBrasilia.getTime();
      }).length;

      return count;
    } catch (error) {
      console.error(`Erro ao processar canal ${channelId}:`, error);
      return 0;
    }
  }

  try {
    // Executa em paralelo
    const [totalPrisoes, totalFiancas] = await Promise.all([
      countMessagesFromToday(PRISOES_CH_ID),
      countMessagesFromToday(FIANCAS_CH_ID),
    ]);

    return res.status(200).json({
      prisoes: totalPrisoes,
      fiancas: totalFiancas,
      total: totalPrisoes + totalFiancas,
      status: "online",
    });
  } catch (error) {
    console.error("Erro geral na API stats:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar estatísticas" });
  }
}
