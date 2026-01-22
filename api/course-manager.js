// api/course-manager.js
export default async function handler(req, res) {
  const {
    DISCORD_BOT_TOKEN,
    // Canais Genéricos
    CHANNEL_CURSOS_ANUNCIADOS,
    MATRIZ_CURSOS_FINALIZADOS, // Canal genérico de matriz (cópia)

    // Configurações de Cargos e Canais Específicos
    ROLE_ID_PCERJ,
    CH_PCERJ_FINALIZADOS,
    ROLE_ID_PMERJ,
    CH_PMERJ_FINALIZADOS,
    ROLE_ID_PRF,
    CH_PRF_FINALIZADOS,
    ROLE_ID_PF,
    CH_PF_FINALIZADOS,

    MATRIZES_ROLE_ID, // Para menção no texto
    INSTRUTORES_ROLE_ID,
  } = process.env;

  // GET: Retorna configuração para o Frontend
  if (req.method === "GET") {
    return res.status(200).json({
      instrutorRoleId: INSTRUTORES_ROLE_ID,
    });
  }

  // POST: Envio do Relatório
  if (req.method === "POST") {
    const data = req.body;

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

    // --- LÓGICA DE DECISÃO DE CANAL ---

    // Caso 1: ANÚNCIO (Vai para o canal geral de anúncios)
    if (data.type === "anuncio") {
      targetChannelId = CHANNEL_CURSOS_ANUNCIADOS;
      title = "📢 Anúncio de Curso";
      embedColor = 3447003; // Azul
      contentMessage = `Atenção: ${mencaoMatriz}`;
    }

    // Caso 2: CÓPIA PARA MATRIZ (Botão específico)
    else if (data.type === "matriz_copy") {
      targetChannelId = MATRIZ_CURSOS_FINALIZADOS;
      title = "📑 Cópia Oficial - Curso Finalizado";
      embedColor = 15105570; // Laranja
      contentMessage = `Cópia enviada por <@${data.authorId}>`;
    }

    // Caso 3: RELATÓRIO FINAL (Lógica Automática por Facção)
    else if (data.type === "final") {
      title = "📑 Relatório de Curso Finalizado";
      embedColor = 5763719; // Verde escuro
      contentMessage = `Relatório enviado por <@${data.authorId}>\nEnvolvidos: ${mencaoMatriz}`;

      // AQUI ESTÁ A MÁGICA: Verifica os cargos do usuário para escolher o canal
      const userRoles = data.userRoles || []; // Recebe os cargos do frontend

      if (userRoles.includes(ROLE_ID_PCERJ)) {
        targetChannelId = CH_PCERJ_FINALIZADOS;
        title += " (PCERJ)";
      } else if (userRoles.includes(ROLE_ID_PMERJ)) {
        targetChannelId = CH_PMERJ_FINALIZADOS;
        title += " (PMERJ)";
      } else if (userRoles.includes(ROLE_ID_PRF)) {
        targetChannelId = CH_PRF_FINALIZADOS;
        title += " (PRF)";
      } else if (userRoles.includes(ROLE_ID_PF)) {
        targetChannelId = CH_PF_FINALIZADOS;
        title += " (PF)";
      } else {
        // Fallback: Se o cara não tiver cargo de nenhuma facção, manda pro canal de anúncios ou log de erro
        // Ou você pode definir um canal "Geral" de finalizados
        console.warn("Usuário sem facção definida tentou enviar relatório.");
        return res.status(400).json({
          error: "Sua facção não foi identificada pelos seus cargos.",
        });
      }
    }

    // Se não definiu canal (erro de config), para tudo
    if (!targetChannelId) {
      return res
        .status(500)
        .json({ error: "Canal de destino não configurado no servidor." });
    }

    // --- MONTAGEM DO EMBED (Igual ao anterior) ---
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

  return res.status(405).json({ error: "Method Not Allowed" });
}
