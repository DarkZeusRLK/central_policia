export default async function handler(req, res) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN;
  const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return res.status(500).json({
      error: "Configuração faltando no .env",
      ranking: [],
    });
  }

  try {
    // Busca o canal de ranking de recrutamentos (ajuste o ID do canal conforme necessário)
    // Por enquanto, retorna dados mockados até a integração completa com o bot
    // O bot Discord deve ter um comando ou endpoint que retorna o ranking

    // Exemplo de estrutura esperada do bot:
    // O bot deve ter um sistema que armazena os recrutamentos e retorna um ranking
    // Por enquanto, retornamos um array vazio para não quebrar a interface

    // TODO: Integrar com a API do bot Discord quando estiver disponível
    // A integração deve buscar os dados do bot através de uma API REST ou WebSocket

    return res.status(200).json({
      ranking: [],
      message: "Aguardando integração com o bot Discord",
    });
  } catch (error) {
    console.error("Erro API Ranking Recrutamentos:", error);
    return res.status(500).json({
      error: "Erro interno",
      ranking: [],
    });
  }
}
