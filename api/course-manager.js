// api/course-manager.js
export default async function handler(req, res) {
  const {
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID, // Necessário adicionar no .env para buscar membros
    // Canais Genéricos
    CHANNEL_CURSOS_ANUNCIADOS,
    MATRIZ_CURSOS_FINALIZADOS,

    // Configurações de Cargos e Canais Específicos
    ROLE_ID_PCERJ,
    CH_PCERJ_FINALIZADOS,
    ROLE_ID_PMERJ,
    CH_PMERJ_FINALIZADOS,
    ROLE_ID_PRF,
    CH_PRF_FINALIZADOS,
    ROLE_ID_PF,
    CH_PF_FINALIZADOS,

    MATRIZES_ROLE_ID,
    INSTRUTORES_ROLE_ID,
  } = process.env;

  // =====================================================================
  // MODO GET: Buscar Dados (Configuração ou Lista do Discord)
  // =====================================================================
  if (req.method === "GET") {
    const { action } = req.query;

    // Ação 1: Retorna apenas a configuração de permissão (Leve e rápido)
    if (action === "config" || !action) {
      return res.status(200).json({
        instrutorRoleId: INSTRUTORES_ROLE_ID,
      });
    }

    // Ação 2: Busca a lista completa de membros e cursos do Discord
    if (action === "discord-data") {
      if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
        return res
          .status(500)
          .json({ error: "Configuração de servidor (GUILD_ID) ausente." });
      }

      try {
        const headers = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };

        // Busca Cargos e Membros em paralelo
        const [rolesRes, membersRes] = await Promise.all([
          fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
            headers,
          }),
          fetch(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
            { headers },
          ),
        ]);

        if (!rolesRes.ok || !membersRes.ok) {
          throw new Error("Erro ao comunicar com o Discord API");
        }

        const roles = await rolesRes.json();
        const members = await membersRes.json();

        // Filtra Cargos: Começam com "Curso" ou "Formação"
        const cursosFormatados = roles
          .filter(
            (r) =>
              r.name.toLowerCase().startsWith("curso") ||
              r.name.toLowerCase().startsWith("formação"),
          )
          .map((r) => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Filtra Membros: Remove bots e formata
        const membrosFormatados = members
          .filter((m) => !m.user.bot)
          .map((m) => ({
            id: m.user.id,
            name: m.nick || m.user.global_name || m.user.username,
            fullLabel: `${m.nick || m.user.username} (${m.user.username})`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Cacheia por 60s
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

        return res.status(200).json({
          cursos: cursosFormatados,
          membros: membrosFormatados,
        });
      } catch (error) {
        console.error(error);
        return res
          .status(500)
          .json({ error: "Falha ao buscar dados do Discord." });
      }
    }
  }

  // =====================================================================
  // MODO POST: Envio do Relatório
  // =====================================================================
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

    // Caso 1: ANÚNCIO
    if (data.type === "anuncio") {
      targetChannelId = CHANNEL_CURSOS_ANUNCIADOS;
      title = "📢 Anúncio de Curso";
      embedColor = 3447003; // Azul
      contentMessage = `Atenção: ${mencaoMatriz}`;
    }

    // Caso 2: CÓPIA PARA MATRIZ
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

      const userRoles = data.userRoles || [];

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
        console.warn("Usuário sem facção definida tentou enviar relatório.");
        return res.status(400).json({
          error: "Sua facção não foi identificada pelos seus cargos.",
        });
      }
    }

    if (!targetChannelId) {
      return res
        .status(500)
        .json({ error: "Canal de destino não configurado no servidor." });
    }

    // --- MONTAGEM DO EMBED ---
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
