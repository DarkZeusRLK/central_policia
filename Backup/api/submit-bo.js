// api/submit-bo.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Captura os novos campos profissao e sexo
  const {
    nome,
    passaporte,
    telefone,
    profissao,
    sexo,
    ocorrencia,
    itens,
    local,
    horario,
    video_link,
    userId,
    username,
  } = req.body;

  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return res
      .status(500)
      .json({ error: "Erro no Servidor: Bot não configurado." });
  }

  try {
    const anoAtual = new Date().getFullYear();
    const protocolo = Math.floor(1000 + Math.random() * 9000);
    const boNumero = `${anoAtual}-${protocolo}`;

    const dataObj = new Date(horario);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // MONTAGEM DO RELATÓRIO COM OS NOVOS CAMPOS
    const relatorio = `
\`\`\`md
# BOLETIM DE OCORRÊNCIA Nº ${boNumero}
DATA DO FATO: ${dataFormatada}
LOCAL DO FATO: ${local}

# VÍTIMA / COMUNICANTE
NOME: ${nome}
PASSAPORTE: ${passaporte}
TELEFONE: ${telefone}
PROFISSÃO: ${profissao || "Não Informado"}
SEXO: ${sexo || "Não Informado"}

# RELATO INDIVIDUAL
${ocorrencia}

# BENS / OBJETOS
${itens || "Nenhum bem declarado."}

# EVIDÊNCIA
${video_link || "N/A"}
\`\`\``;

    const contentMessage = `👮 **Novo registro enviado por:** <@${userId}> (${username})\n${relatorio}`;

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
      const errorData = await discordResponse.json();
      console.error("Erro Discord:", errorData);
      return res.status(500).json({ error: "Discord recusou a mensagem." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}
