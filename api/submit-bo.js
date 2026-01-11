// Recebe o formulário e envia via BOT
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const {
    nome,
    passaporte,
    telefone,
    ocorrencia,
    itens,
    local,
    horario,
    userId,
  } = req.body;
  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  // Validação básica
  if (!nome || !userId)
    return res.status(400).json({ error: "Dados incompletos" });

  try {
    // Monta a mensagem para o Discord API
    const messageBody = {
      content: `🚨 **Novo Boletim de Ocorrência Registrado!**\nEnviado por: <@${userId}>`,
      embeds: [
        {
          title: "📄 Detalhes do B.O.",
          color: 15158332, // Vermelho
          fields: [
            { name: "Nome", value: nome, inline: true },
            { name: "Passaporte", value: passaporte, inline: true },
            { name: "Telefone", value: telefone, inline: true },
            { name: "Local", value: local, inline: false },
            {
              name: "Horário",
              value: horario.replace("T", " "),
              inline: false,
            },
            { name: "Ocorrência", value: ocorrencia, inline: false },
            { name: "Itens Perdidos", value: itens || "Nenhum", inline: false },
          ],
          footer: { text: "Central REVOADA RJ • Sistema Automático" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // Envia para o Discord
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID_BO}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error("Erro Discord:", err);
      throw new Error("Falha ao enviar para o Discord");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
