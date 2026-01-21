// api/submit-recruitment.js
// API para finalizar um recrutamento (roteamento baseado em cargo)
import { getDestinationChannel, sendDiscordMessage } from "../lib/discord-router.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    department,
    candidateName,
    candidatePassport,
    recruitmentDate,
    status,
    observations,
    userId,
    username,
    userRoles, // Array de IDs de cargos do usuário
  } = req.body;

  const {
    DISCORD_BOT_TOKEN,
    MATRIZES_ROLE_ID,
    CHANNEL_RECRUTAMENTOS_MATRIZES,
  } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado.",
    });
  }

  if (!MATRIZES_ROLE_ID || !CHANNEL_RECRUTAMENTOS_MATRIZES) {
    return res.status(500).json({
      error: "Erro no Servidor: Configuração de roteamento não completa.",
    });
  }

  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return res.status(400).json({
      error: "Cargos do usuário não fornecidos. É necessário estar logado.",
    });
  }

  try {
    // Determina o canal de destino baseado no cargo do usuário
    const targetChannel = getDestinationChannel(
      userRoles,
      MATRIZES_ROLE_ID,
      CHANNEL_RECRUTAMENTOS_MATRIZES
    );

    if (!targetChannel) {
      return res.status(400).json({
        error: "Não foi possível determinar o canal de destino. Verifique se o usuário possui um cargo válido.",
      });
    }

    // Formata a data
    const dataFormatada = recruitmentDate
      ? new Date(recruitmentDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleDateString("pt-BR");

    // Monta o relatório de recrutamento
    const relatorio = `
\`\`\`md
# 👮 RELATÓRIO DE RECRUTAMENTO

DEPARTAMENTO: ${department || "Não informado"}
CANDIDATO: ${candidateName || "Não informado"}
PASSAPORTE: ${candidatePassport || "Não informado"}
DATA: ${dataFormatada}
STATUS: ${status || "Não informado"}

# OBSERVAÇÕES
${observations || "Nenhuma observação registrada."}
\`\`\``;

    const contentMessage = `👮 **Recrutamento finalizado por:** <@${userId}> (${username})\n${relatorio}`;

    // Envia para o canal determinado pelo roteamento
    const result = await sendDiscordMessage(
      targetChannel,
      contentMessage,
      DISCORD_BOT_TOKEN
    );

    if (!result.success) {
      console.error("Erro ao enviar relatório de recrutamento:", result.error);
      return res.status(500).json({
        error: "Erro ao enviar relatório para o Discord.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}
