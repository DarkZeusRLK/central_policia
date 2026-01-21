// api/submit-course.js
// API para finalizar um curso (envia log resumido + relatório detalhado com roteamento)
import { getDestinationChannel, sendDiscordMessage } from "../lib/discord-router.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    courseName,
    courseDate,
    participants,
    instructor,
    observations,
    userId,
    username,
    userRoles, // Array de IDs de cargos do usuário
  } = req.body;

  const {
    DISCORD_BOT_TOKEN,
    CHANNEL_CURSOS_FINALIZADOS,
    MATRIZES_ROLE_ID,
    CHANNEL_CURSOS_RELATORIOS,
  } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado.",
    });
  }

  if (!CHANNEL_CURSOS_FINALIZADOS) {
    return res.status(500).json({
      error: "Erro no Servidor: Canal de cursos finalizados não configurado.",
    });
  }

  try {
    // Formata a data
    const dataFormatada = courseDate
      ? new Date(courseDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleDateString("pt-BR");

    // 1. LOG RESUMIDO (Canal padrão para todos)
    const logResumido = `
\`\`\`md
# ✅ CURSO FINALIZADO

CURSO: ${courseName || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${instructor || "Não informado"}
PARTICIPANTES: ${participants || "Não informado"}
\`\`\``;

    const logMessage = `📋 **Log de curso finalizado por:** <@${userId}> (${username})\n${logResumido}`;

    // Envia o log resumido para o canal padrão
    const logResult = await sendDiscordMessage(
      CHANNEL_CURSOS_FINALIZADOS,
      logMessage,
      DISCORD_BOT_TOKEN
    );

    if (!logResult.success) {
      console.error("Erro ao enviar log resumido:", logResult.error);
      // Continua mesmo se falhar o log, pois o relatório é mais importante
    }

    // 2. RELATÓRIO DETALHADO (Roteamento baseado em cargo)
    if (MATRIZES_ROLE_ID && CHANNEL_CURSOS_RELATORIOS && userRoles) {
      const targetChannel = getDestinationChannel(
        userRoles,
        MATRIZES_ROLE_ID,
        CHANNEL_CURSOS_RELATORIOS
      );

      if (targetChannel) {
        const relatorioDetalhado = `
\`\`\`md
# 📊 RELATÓRIO DETALHADO DE CURSO

CURSO: ${courseName || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${instructor || "Não informado"}
PARTICIPANTES: ${participants || "Não informado"}

# OBSERVAÇÕES
${observations || "Nenhuma observação registrada."}
\`\`\``;

        const relatorioMessage = `📊 **Relatório detalhado enviado por:** <@${userId}> (${username})\n${relatorioDetalhado}`;

        const relatorioResult = await sendDiscordMessage(
          targetChannel,
          relatorioMessage,
          DISCORD_BOT_TOKEN
        );

        if (!relatorioResult.success) {
          console.error("Erro ao enviar relatório detalhado:", relatorioResult.error);
          // Retorna sucesso parcial se o log foi enviado
          return res.status(200).json({
            success: true,
            warning: "Relatório detalhado não pôde ser enviado, mas o log foi registrado.",
          });
        }
      } else {
        console.warn(
          "Não foi possível determinar o canal de destino para o relatório detalhado."
        );
      }
    } else {
      console.warn(
        "Variáveis de ambiente ou cargos do usuário não configurados para roteamento de relatórios."
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}
