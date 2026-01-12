// api/submit-bo.js
export default async function handler(req, res) {
  // 1. Só aceita POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // 2. Pega os dados do formulário (incluindo o novo video_link)
  const {
    nome,
    passaporte,
    telefone,
    ocorrencia,
    itens,
    local,
    horario,
    video_link,
    userId,
    username,
  } = req.body;

  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  // 3. Verificação de Segurança
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return res
      .status(500)
      .json({ error: "Erro no Servidor: Bot não configurado." });
  }

  try {
    // 4. Formatação de Dados
    // Gera um número de protocolo aleatório (ex: 2024-4921)
    const anoAtual = new Date().getFullYear();
    const protocolo = Math.floor(1000 + Math.random() * 9000);
    const boNumero = `${anoAtual}-${protocolo}`;

    // Formata a data e hora para ficar bonito (DD/MM/AAAA HH:MM)
    const dataObj = new Date(horario);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 5. Monta o Relatório no estilo Markdown (Igual ao seu modelo)
    const relatorio = `
\`\`\`md
# BOLETIM DE OCORRÊNCIA Nº ${boNumero}
DATA DO FATO: ${dataFormatada}
LOCAL DO FATO: ${local}

# VÍTIMA / COMUNICANTE
NOME: ${nome}
PASSAPORTE: ${passaporte}
TELEFONE: ${telefone}
PROFISSÃO: Não Informado
SEXO: Não Informado

# RELATO INDIVIDUAL
${ocorrencia}

# BENS / OBJETOS
${itens || "Nenhum bem declarado."}

# EVIDÊNCIA
${video_link || "N/A"}
\`\`\``;

    // Mensagem final enviada ao Discord
    // Adicionei a menção ao usuário (<@ID>) fora do bloco de código para ele ser notificado/identificado
    const contentMessage = `👮 **Novo registro enviado por:** <@${userId}> (${username})\n${relatorio}`;

    // 6. Envia para o Discord
    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID_BO}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        // Aqui mudamos de 'embeds' para 'content' para suportar o formato de texto
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
