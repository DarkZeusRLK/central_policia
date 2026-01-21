"use server";

/**
 * Server Actions para o sistema de Boletim de Ocorrência
 */

interface BOSubmitData {
  nome: string;
  passaporte: string;
  telefone: string;
  profissao?: string;
  sexo: string;
  ocorrencia: string;
  itens?: string;
  local: string;
  horario: string;
  video_link?: string;
  userId?: string;
  username?: string;
}

export async function submitBoletimOcorrencia(data: BOSubmitData) {
  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return {
      success: false,
      error: "Erro no Servidor: Bot não configurado.",
    };
  }

  try {
    const anoAtual = new Date().getFullYear();
    const protocolo = Math.floor(1000 + Math.random() * 9000);
    const boNumero = `${anoAtual}-${protocolo}`;

    const dataObj = new Date(data.horario);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const relatorio = `
\`\`\`md
# BOLETIM DE OCORRÊNCIA Nº ${boNumero}
DATA DO FATO: ${dataFormatada}
LOCAL DO FATO: ${data.local}

# VÍTIMA / COMUNICANTE
NOME: ${data.nome}
PASSAPORTE: ${data.passaporte}
TELEFONE: ${data.telefone}
PROFISSÃO: ${data.profissao || "Não Informado"}
SEXO: ${data.sexo || "Não Informado"}

# RELATO INDIVIDUAL
${data.ocorrencia}

# BENS / OBJETOS
${data.itens || "Nenhum bem declarado."}

# EVIDÊNCIA
${data.video_link || "N/A"}
\`\`\``;

    const contentMessage = `👮 **Novo registro enviado por:** ${data.userId ? `<@${data.userId}>` : ""} ${data.username ? `(${data.username})` : ""}\n${relatorio}`;

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID_BO}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: contentMessage }),
      }
    );

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Erro ao enviar para Discord:", errorText);
      return {
        success: false,
        error: "Erro ao enviar para Discord.",
      };
    }

    return {
      success: true,
      protocolo: boNumero,
    };
  } catch (error) {
    console.error("Erro ao processar B.O.:", error);
    return {
      success: false,
      error: "Erro ao processar solicitação.",
    };
  }
}
