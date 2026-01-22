// api/course-manager.js
export default async function handler(req, res) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  const {
    // Canal de Anúncios
    CHANNEL_CURSOS_ANUNCIADOS,

    // Canal GERAL (Log Global de todos os cursos)
    CHANNEL_CURSOS_FINALIZADOS,

    // Canais Específicos por Facção (Matriz da Facção)
    ROLE_ID_PCERJ,
    CH_PCERJ_FINALIZADOS,
    ROLE_ID_PMERJ,
    CH_PMERJ_FINALIZADOS,
    ROLE_ID_PRF,
    CH_PRF_FINALIZADOS,
    ROLE_ID_PF,
    CH_PF_FINALIZADOS,

    MATRIZES_ROLE_ID, // Lista de IDs: "123, 456, 789"
    INSTRUTORES_ROLE_ID,
  } = process.env;

  // =====================================================================
  // MODO GET: Buscar Dados
  // =====================================================================
  if (req.method === "GET") {
    const { action } = req.query;

    if (action === "config" || !action) {
      return res.status(200).json({ instrutorRoleId: INSTRUTORES_ROLE_ID });
    }

    if (action === "discord-data") {
      if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
        return res
          .status(500)
          .json({ error: "Configuração de servidor ausente." });
      }

      try {
        const headers = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
        const [rolesRes, membersRes] = await Promise.all([
          fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
            headers,
          }),
          fetch(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
            { headers },
          ),
        ]);

        if (!rolesRes.ok || !membersRes.ok)
          throw new Error("Erro na API do Discord");

        const roles = await rolesRes.json();
        const members = await membersRes.json();

        // Filtra Cursos (Blacklist e Whitelist)
        const cursosFormatados = roles
          .filter((r) => {
            const nome = r.name.toLowerCase();
            const blacklist = [
              "chefe",
              "instrutor",
              "diretor",
              "gerente",
              "lider",
              "líder",
              "coord",
              "admin",
              "suporte",
              "bot",
            ];
            if (blacklist.some((t) => nome.includes(t))) return false;

            return (
              nome.includes("curso") ||
              nome.includes("formação") ||
              nome.includes("treinamento") ||
              nome.includes("aula") ||
              nome.includes("instrução") ||
              nome.includes("estágio") ||
              nome.includes("habilitacao") ||
              nome.includes("habilitação")
            );
          })
          .map((r) => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const membrosFormatados = members
          .filter((m) => !m.user.bot)
          .map((m) => ({
            id: m.user.id,
            name: m.nick || m.user.global_name || m.user.username,
            fullLabel: `${m.nick || m.user.username} (${m.user.username})`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        return res
          .status(200)
          .json({ cursos: cursosFormatados, membros: membrosFormatados });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Falha ao buscar dados." });
      }
    }
  }

  // =====================================================================
  // MODO POST: Envio do Relatório
  // =====================================================================
  if (req.method === "POST") {
    const data = req.body;
    const dateFormatted = data.data
      ? data.data.split("-").reverse().join("/")
      : "N/A";

    // 1. CORREÇÃO ENVOLVIDOS (Separa os IDs e cria menções individuais)
    let mencaoMatriz = "@Matriz";
    if (MATRIZES_ROLE_ID) {
      // Transforma "123,456" em "<@&123> <@&456>"
      mencaoMatriz = MATRIZES_ROLE_ID.split(",")
        .map((id) => `<@&${id.trim()}>`)
        .join(" ");
    }

    // 2. CORREÇÃO CURSO (Usa o ID para mencionar o cargo)
    // Se o front enviar curso_id, usa <@&ID>, senão usa o texto
    const cursoDisplay = data.curso_id
      ? `<@&${data.curso_id}>`
      : data.curso_nome || "N/A";

    // Função para criar o Payload do Embed
    const createPayload = (title, color, description, footerText) => {
      const fields = [
        { name: "📚 Curso", value: cursoDisplay, inline: true },
        // Aceita múltiplos instrutores (string vinda do front)
        {
          name: "🧑‍🏫 Instrutor(es)",
          value: data.instrutores || "N/A",
          inline: true,
        },
      ];

      if (data.auxiliares)
        fields.push({
          name: "👮 Auxiliares",
          value: data.auxiliares,
          inline: false,
        });

      fields.push(
        {
          name: "👥 Participantes",
          value: data.participantes || "Nenhum",
          inline: false,
        },
        {
          name: "✅ Aprovados",
          value: data.aprovados || "Nenhum",
          inline: true,
        },
        {
          name: "❌ Reprovados",
          value: data.reprovados || "Nenhum",
          inline: true,
        },
        {
          name: "🗓️ Data/Hora",
          value: `${dateFormatted} às ${data.horario}`,
          inline: true,
        },
      );

      if (data.obs)
        fields.push({ name: "📝 Observações", value: data.obs, inline: false });

      return {
        content: description,
        embeds: [
          {
            title: title,
            color: color,
            fields: fields,
            footer: {
              text: footerText || "Sistema de Intranet Policial • Revoada RJ",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    };

    try {
      // === CASO 1: ANÚNCIO ===
      if (data.type === "anuncio") {
        const payload = {
          content: `Atenção: ${mencaoMatriz}`,
          embeds: [
            {
              title: "📢 Anúncio de Curso",
              color: 3447003, // Azul
              fields: [
                { name: "📚 Curso", value: cursoDisplay, inline: true },
                { name: "🧑‍🏫 Instrutor", value: data.instrutores, inline: true },
                { name: "👥 Envolvidos", value: mencaoMatriz, inline: false },
                { name: "🗓️ Data", value: dateFormatted, inline: true },
                { name: "🕙 Horário", value: data.horario, inline: true },
                { name: "📍 Local", value: data.local || "N/A", inline: false },
                {
                  name: "🗣️ Call",
                  value: data.call_link || "N/A",
                  inline: false,
                },
              ],
              footer: { text: "Sistema de Intranet Policial" },
              timestamp: new Date().toISOString(),
            },
          ],
        };

        await fetch(
          `https://discord.com/api/v10/channels/${CHANNEL_CURSOS_ANUNCIADOS}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
      }

      // === CASO 2: RELATÓRIO FINAL (FACÇÃO + GERAL) ===
      else if (data.type === "final") {
        let factionChannelId = "";
        let factionName = "";

        const userRoles = data.userRoles || [];

        // Identifica Facção
        if (userRoles.includes(ROLE_ID_PCERJ)) {
          factionChannelId = CH_PCERJ_FINALIZADOS;
          factionName = "PCERJ";
        } else if (userRoles.includes(ROLE_ID_PMERJ)) {
          factionChannelId = CH_PMERJ_FINALIZADOS;
          factionName = "PMERJ";
        } else if (userRoles.includes(ROLE_ID_PRF)) {
          factionChannelId = CH_PRF_FINALIZADOS;
          factionName = "PRF";
        } else if (userRoles.includes(ROLE_ID_PF)) {
          factionChannelId = CH_PF_FINALIZADOS;
          factionName = "PF";
        } else {
          return res
            .status(400)
            .json({ error: "Facção não identificada pelos cargos." });
        }

        const promises = [];
        const requestOptions = {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        };

        // 1. Envio para Canal da Facção (Matriz Específica)
        if (factionChannelId) {
          const factionPayload = createPayload(
            `📑 Relatório de Curso Finalizado (${factionName})`,
            5763719, // Verde
            `Relatório enviado por <@${data.authorId}>\nEnvolvidos: ${mencaoMatriz}`,
            `Sistema de Intranet Policial • ${factionName}`,
          );
          promises.push(
            fetch(
              `https://discord.com/api/v10/channels/${factionChannelId}/messages`,
              {
                ...requestOptions,
                body: JSON.stringify(factionPayload),
              },
            ),
          );
        }

        // 2. Envio para Canal Geral (CHANNEL_CURSOS_FINALIZADOS)
        if (CHANNEL_CURSOS_FINALIZADOS) {
          const geralPayload = createPayload(
            "📑 Registro Geral - Curso Finalizado",
            15105570, // Laranja
            `Cópia Global enviada por <@${data.authorId}>`,
            "Registro Global de Cursos",
          );
          promises.push(
            fetch(
              `https://discord.com/api/v10/channels/${CHANNEL_CURSOS_FINALIZADOS}/messages`,
              {
                ...requestOptions,
                body: JSON.stringify(geralPayload),
              },
            ),
          );
        }

        await Promise.all(promises);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Erro ao enviar mensagens." });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
