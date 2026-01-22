// api/course-manager.js
export default async function handler(req, res) {
  const {
    DISCORD_BOT_TOKEN,
    CHANNEL_CURSOS_FINALIZADOS,
    CHANNEL_CURSOS_ANUNCIADOS,
    MATRIZ_CURSOS_FINALIZADOS,
    MATRIZES_ROLE_ID,
    INSTRUTORES_ROLE_ID, // ID que o frontend precisa ler
  } = process.env;

  // ======================================================
  // MODO 1: GET (Serve para o site ler o ID do cargo)
  // ======================================================
  if (req.method === "GET") {
    return res.status(200).json({
      instrutorRoleId: INSTRUTORES_ROLE_ID,
    });
  }

  // ======================================================
  // MODO 2: POST (Serve para enviar o relatório/anúncio)
  // ======================================================
  if (req.method === "POST") {
    const data = req.body;

    // Decide para qual canal enviar baseado no tipo
    let targetChannelId = "";
    let embedColor = 0;
    let title = "";
    let contentMessage = "";

    const dateFormatted = data.data
      ? data.data.split("-").reverse().join("/")
      : "N/A";
    const mencaoMatriz = MATRIZES_ROLE_ID
      ? `<@&${MATRIZES_ROLE_ID}>`
      : "@Matriz";

    if (data.type === "final") {
      targetChannelId = CHANNEL_CURSOS_FINALIZADOS;
      title = "📑 Relatório de Curso Finalizado";
      embedColor = 5763719; // Verde escuro
      contentMessage = `Relatório enviado por <@${data.authorId}>\nEnvolvidos: ${mencaoMatriz}`;
    } else if (data.type === "anuncio") {
      targetChannelId = CHANNEL_CURSOS_ANUNCIADOS;
      title = "📢 Anúncio de Curso";
      embedColor = 3447003; // Azul
      contentMessage = `Atenção: ${mencaoMatriz}`;
    } else if (data.type === "matriz_copy") {
      targetChannelId = MATRIZ_CURSOS_FINALIZADOS;
      title = "📑 Cópia para Matriz - Curso Finalizado";
      embedColor = 15105570; // Laranja
      contentMessage = `Cópia oficial enviada por <@${data.authorId}>`;
    }

    // Montagem dos Campos do Embed
    let fields = [];
    fields.push({
      name: "📚 Curso",
      value: data.curso_nome || "N/A",
      inline: true,
    });
    fields.push({
      name: "🧑‍🏫 Instrutor",
      value: data.instrutores || "N/A",
      inline: true,
    });

    if (data.auxiliares) {
      fields.push({
        name: "🧑‍🏫 Auxiliares",
        value: data.auxiliares,
        inline: false,
      });
    }

    if (data.type === "final" || data.type === "matriz_copy") {
      fields.push({
        name: "👥 Participantes",
        value: data.participantes || "Nenhum",
        inline: false,
      });
      fields.push({
        name: "✅ Aprovados",
        value: data.aprovados || "Nenhum",
        inline: true,
      });
      fields.push({
        name: "❌ Reprovados",
        value: data.reprovados || "Nenhum",
        inline: true,
      });
      fields.push({
        name: "🗓️ Data/Hora",
        value: `${dateFormatted} às ${data.horario}`,
        inline: true,
      });

      if (data.obs) {
        fields.push({ name: "📝 Observações", value: data.obs, inline: false });
      }
    }

    if (data.type === "anuncio") {
      fields.push({
        name: "👥 Envolvidos",
        value: mencaoMatriz,
        inline: false,
      });
      fields.push({ name: "🗓️ Data", value: dateFormatted, inline: true });
      fields.push({ name: "🕙 Horário", value: data.horario, inline: true });
      fields.push({
        name: "📍 Local",
        value: data.local || "N/A",
        inline: false,
      });
      fields.push({
        name: "🗣️ Call",
        value: data.call_link || "N/A",
        inline: false,
      });
    }

    const payload = {
      content: contentMessage,
      embeds: [
        {
          title: title,
          color: embedColor,
          fields: fields,
          footer: { text: "Sistema de Intranet Policial • Revoada RJ" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${targetChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Discord Error:", errText);
        throw new Error(`Discord API Error: ${response.status}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Falha ao enviar para o Discord" });
    }
  }

  // Se não for nem GET nem POST
  return res.status(405).json({ error: "Method Not Allowed" });
}
