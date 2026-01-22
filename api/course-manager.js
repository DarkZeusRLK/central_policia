// api/course-manager.js
export default async function handler(req, res) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  const {
    CHANNEL_CURSOS_ANUNCIADOS,
    CHANNEL_CURSOS_FINALIZADOS, // Canal Geral
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

  // --- MODO GET: Buscar Dados (Mantido igual) ---
  if (req.method === "GET") {
    const { action } = req.query;

    if (action === "config" || !action) {
      return res.status(200).json({ instrutorRoleId: INSTRUTORES_ROLE_ID });
    }

    if (action === "discord-data") {
      if (!DISCORD_BOT_TOKEN || !GUILD_ID)
        return res.status(500).json({ error: "Config ausente" });

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

        if (!rolesRes.ok || !membersRes.ok) throw new Error("Erro Discord API");

        const roles = await rolesRes.json();
        const members = await membersRes.json();

        // Filtra Cursos
        const cursosFormatados = roles
          .filter((r) => {
            const nome = r.name.toLowerCase();
            const blacklist = [
              "chefe",
              "instrutor",
              "diretor",
              "admin",
              "bot",
              "suporte",
            ];
            if (blacklist.some((t) => nome.includes(t))) return false;
            return (
              nome.includes("curso") ||
              nome.includes("treinamento") ||
              nome.includes("aula") ||
              nome.includes("habilitacao")
            );
          })
          .map((r) => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Filtra Membros e envia ID para o front fazer a menção
        const membrosFormatados = members
          .filter((m) => !m.user.bot)
          .map((m) => ({
            id: m.user.id,
            name: m.nick || m.user.global_name || m.user.username,
            fullLabel: `${m.nick || m.user.username}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return res
          .status(200)
          .json({ cursos: cursosFormatados, membros: membrosFormatados });
      } catch (error) {
        return res.status(500).json({ error: "Falha ao buscar dados." });
      }
    }
  }

  // --- MODO POST: Envio do Relatório ---
  if (req.method === "POST") {
    const data = req.body;

    // Formatação de Datas (Início e Fim)
    const formatBr = (dateStr) =>
      dateStr ? dateStr.split("-").reverse().join("/") : "N/A";
    const dataInicio = formatBr(data.data_inicio);
    const dataFim = formatBr(data.data_fim);

    // String composta de horário
    const horarioTexto = `**Início:** ${dataInicio} às ${data.hora_inicio || "00:00"}\n**Fim:** ${dataFim} às ${data.hora_fim || "00:00"}`;

    // Menção das Matrizes (Apenas para uso no Embed Geral)
    let mencaoMatriz = "";
    if (MATRIZES_ROLE_ID) {
      mencaoMatriz = MATRIZES_ROLE_ID.split(",")
        .map((id) => `<@&${id.trim()}>`)
        .join(" ");
    }

    // Menção do Curso
    const cursoDisplay = data.curso_id
      ? `<@&${data.curso_id}>`
      : data.curso_nome || "N/A";

    // --- FUNÇÃO GERADORA DE EMBED ---
    // param: includeMatriz (boolean) -> Se true, adiciona o campo de "Matrizes Envolvidas"
    const createEmbed = (title, color, description, footer, includeMatriz) => {
      const fields = [
        { name: "📚 Curso", value: cursoDisplay, inline: true },
        // Instrutores agora vem como string de menções "<@123>, <@456>"
        {
          name: "🧑‍🏫 Instrutores",
          value: data.instrutores || "N/A",
          inline: true,
        },
      ];

      // Matrizes (Aparece só se for solicitado, ex: Canal Geral)
      if (includeMatriz && mencaoMatriz) {
        fields.push({
          name: "🏢 Matrizes Envolvidas",
          value: mencaoMatriz,
          inline: false,
        });
      }

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
        { name: "🗓️ Período", value: horarioTexto, inline: false },
      );

      if (data.obs)
        fields.push({ name: "📝 Observações", value: data.obs, inline: false });

      return {
        content: description || null, // Mensagem fora do embed (opcional)
        embeds: [
          {
            title: title,
            color: color,
            fields: fields,
            footer: { text: footer },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    };

    try {
      // 1. ANÚNCIO
      if (data.type === "anuncio") {
        const payload = createEmbed(
          "📢 Anúncio de Curso",
          3447003,
          `Atenção: ${mencaoMatriz}`,
          "Intranet Policial",
          true,
        );
        // Sobrescreve campos específicos de anúncio se necessário, mas usando a base acima
        // Para simplificar, vou manter a estrutura padrão, mas anúncio geralmente tem "Local" e "Call"
        // Se quiser personalizar, pode editar aqui.

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

      // 2. RELATÓRIO FINAL
      else if (data.type === "final") {
        let factionChannelId = "";
        let factionName = "";
        const userRoles = data.userRoles || [];

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
        } else
          return res.status(400).json({ error: "Facção não identificada." });

        const requestOptions = {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        };
        const promises = [];

        // A) Envio para a FACÇÃO (SEM marcar Matrizes)
        if (factionChannelId) {
          const factionPayload = createEmbed(
            `📑 Relatório Finalizado - ${factionName}`,
            5763719, // Verde
            `Relatório por <@${data.authorId}>`, // Content fora do embed
            `Sistema ${factionName}`,
            false, // <--- FALSE: Não inclui Matrizes no Embed
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

        // B) Envio para o GERAL (COM marcação de Matrizes)
        if (CHANNEL_CURSOS_FINALIZADOS) {
          const geralPayload = createEmbed(
            "📑 Registro Geral de Curso",
            15105570, // Laranja
            null, // Sem mensagem externa ou pode por mencaoMatriz aqui se quiser notificar
            "Log Global de Cursos",
            true, // <--- TRUE: Inclui Matrizes no Embed
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
      return res.status(500).json({ error: "Erro interno no envio." });
    }
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
