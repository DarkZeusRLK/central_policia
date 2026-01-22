// api/course-manager.js
export default async function handler(req, res) {
  // Pegamos as variáveis. Note que agora tentamos ler GUILD_ID ou DISCORD_GUILD_ID
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  const {
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

    // Ação 1: Configuração simples
    if (action === "config" || !action) {
      return res.status(200).json({
        instrutorRoleId: INSTRUTORES_ROLE_ID,
      });
    }

    // Ação 2: Busca dados do Discord
    if (action === "discord-data") {
      // Debug: Mostra no log da Vercel o que está faltando
      if (!DISCORD_BOT_TOKEN)
        console.error("ERRO: DISCORD_BOT_TOKEN não encontrado no .env");
      if (!GUILD_ID)
        console.error(
          "ERRO: GUILD_ID ou DISCORD_GUILD_ID não encontrado no .env",
        );

      if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
        return res.status(500).json({
          error:
            "Configuração de servidor (Token ou ID) ausente. Verifique o console da Vercel.",
        });
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

        if (!rolesRes.ok) {
          const err = await rolesRes.text();
          throw new Error(`Erro ao buscar cargos: ${rolesRes.status} - ${err}`);
        }
        if (!membersRes.ok) {
          const err = await membersRes.text();
          throw new Error(
            `Erro ao buscar membros: ${membersRes.status} - ${err}`,
          );
        }

        const roles = await rolesRes.json();
        const members = await membersRes.json();

        // --- FILTRO INTELIGENTE DE CURSOS ---
        const cursosFormatados = roles
          .filter((r) => {
            const nome = r.name.toLowerCase();

            // 1. LISTA NEGRA: Se tiver qualquer uma dessas palavras, IGNORA.
            // Isso remove cargos hierárquicos como "Chefe de Cursos", "Instrutor", etc.
            const termosProibidos = [
              "chefe",
              "instrutor",
              "diretor",
              "gerente",
              "lider",
              "líder",
              "coordenador",
              "coord",
              "administrador",
              "moderador",
              "suporte",
              "bot",
            ];

            // Se o nome contiver algum termo proibido, retorna false (remove da lista)
            if (termosProibidos.some((termo) => nome.includes(termo))) {
              return false;
            }

            // 2. LISTA BRANCA: Se passou pelo filtro acima, verifica se é um curso válido
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

        console.log(
          `Cursos filtrados: ${cursosFormatados.length} encontrados.`,
        );

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
        console.error("ERRO DETALHADO:", error);
        return res
          .status(500)
          .json({ error: "Falha ao buscar dados do Discord. Verifique Logs." });
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

    if (data.type === "anuncio") {
      targetChannelId = CHANNEL_CURSOS_ANUNCIADOS;
      title = "📢 Anúncio de Curso";
      embedColor = 3447003; // Azul
      contentMessage = `Atenção: ${mencaoMatriz}`;
    } else if (data.type === "matriz_copy") {
      targetChannelId = MATRIZ_CURSOS_FINALIZADOS;
      title = "📑 Cópia Oficial - Curso Finalizado";
      embedColor = 15105570; // Laranja
      contentMessage = `Cópia enviada por <@${data.authorId}>`;
    } else if (data.type === "final") {
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
