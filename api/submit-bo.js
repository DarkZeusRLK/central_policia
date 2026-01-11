// api/submit-bo.js
export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    nome,
    passaporte,
    telefone,
    ocorrencia,
    itens,
    local,
    horario,
    userId,
    username,
  } = req.body;
  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  // Verificação de Segurança
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return res
      .status(500)
      .json({ error: "Erro no Servidor: Bot não configurado." });
  }

  try {
    // Monta o Embed (Visual Bonito do Discord)
    const embed = {
      title: "🚨 Novo Boletim de Ocorrência",
      color: 15158332, // Vermelho Policial
      description: `Registrado por: **${username}** (<@${userId}>)`,
      fields: [
        { name: "📋 Cidadão", value: nome, inline: true },
        { name: "🆔 Passaporte", value: passaporte, inline: true },
        { name: "📞 Telefone", value: telefone, inline: true },
        { name: "📍 Local", value: local, inline: false },
        { name: "⏰ Horário", value: horario.replace("T", " "), inline: false },
        { name: "📝 Ocorrência", value: ocorrencia, inline: false },
        { name: "📦 Itens Perdidos", value: itens || "Nenhum", inline: false },
      ],
      footer: { text: "Sistema Central Revoada RJ" },
      timestamp: new Date().toISOString(),
    };

    // Envia para o Discord
    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID_BO}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
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
