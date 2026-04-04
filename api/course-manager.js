const DISCORD_API_BASE = "https://discord.com/api/v10";

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBr(dateStr) {
  return dateStr ? dateStr.split("-").reverse().join("/") : "N/A";
}

function resolveCourseMentions(data) {
  const courseIds = Array.isArray(data.curso_ids)
    ? data.curso_ids.filter(Boolean)
    : data.curso_id
      ? [data.curso_id]
      : [];

  const courseNames = Array.isArray(data.curso_nomes)
    ? data.curso_nomes.filter(Boolean)
    : data.curso_nome
      ? [data.curso_nome]
      : [];

  if (courseIds.length) {
    return courseIds.map((courseId, index) => `<@&${courseId}>${courseNames[index] ? ` (${courseNames[index]})` : ""}`);
  }

  return courseNames.length ? courseNames : ["N/A"];
}

function textDisplay(content) {
  return {
    type: 10,
    content,
  };
}

function separator(spacing = 1, divider = true) {
  return {
    type: 14,
    spacing,
    divider,
  };
}

function container(accentColor, components) {
  return {
    type: 17,
    accent_color: accentColor,
    components,
  };
}

function linkButton(label, url) {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label,
        url,
      },
    ],
  };
}

function buildAnnouncementMessage(data, env) {
  const courseMentions = resolveCourseMentions(data);
  const mentionMatrizes = parseIdList(env.MATRIZES_ROLE_ID).map((id) => `<@&${id}>`).join(" ");
  const components = [container(0xd4af37, [
    textDisplay([
      "## 📣 Central Policial | Anúncio de Curso",
      data.authorId ? `**👮 Publicado por:** <@${data.authorId}>` : "**👮 Publicado por:** Intranet Policial",
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📚 Cursos",
      courseMentions.map((course) => `- ${course}`).join("\n"),
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👨‍🏫 Escala e Planejamento",
      `- **Instrutores:** ${data.instrutores || "N/A"}`,
      `- **Data:** ${formatBr(data.data)}`,
      `- **Horário:** ${data.horario || "N/A"}`,
      `- **Local:** ${data.local || "N/A"}`,
    ].join("\n")),
    ...(mentionMatrizes ? [separator(), textDisplay(`### 🏛️ Convocação\n${mentionMatrizes}`)] : []),
  ])];

  if (data.call_link) {
    components.push(
      container(0x3b82f6, [
        textDisplay("### 🔊 Acesso à Call\nUse o botão abaixo para entrar na sala de voz do curso."),
      ]),
      linkButton("Entrar na call", data.call_link),
    );
  }

  return {
    flags: 32768,
    allowed_mentions: {
      parse: ["roles", "users"],
    },
    components,
  };
}

function buildFinalMessage(data, factionName, includeMatrizes, env) {
  const mentionMatrizes = parseIdList(env.MATRIZES_ROLE_ID).map((id) => `<@&${id}>`).join(" ");
  const courseMentions = resolveCourseMentions(data);
  const title = includeMatrizes
    ? "## 📘 Central Policial | Registro Geral de Curso"
    : `## 📘 Central Policial | Curso Finalizado ${factionName}`;
  const cardComponents = [
    textDisplay([
      title,
      data.authorId ? `**📝 Relatório enviado por:** <@${data.authorId}>` : "**📝 Relatório enviado por:** Intranet Policial",
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📚 Curso",
      courseMentions.map((course) => `- ${course}`).join("\n"),
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👨‍🏫 Equipe de Ensino",
      `- **Instrutores:** ${data.instrutores || "N/A"}`,
      `- **Auxiliares:** ${data.auxiliares || "Nenhum"}`,
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📅 Data",
      `- **Início:** ${formatBr(data.data_inicio)} às ${data.hora_inicio || "00:00"}`,
      `- **Fim:** ${formatBr(data.data_fim)} às ${data.hora_fim || "00:00"}`,
    ].join("\n")),
    separator(),
    textDisplay([
      "### ✅ Resultado da Turma",
      `- **Aprovados:** ${data.aprovados || "Nenhum"}`,
      `- **Reprovados:** ${data.reprovados || "Nenhum"}`,
    ].join("\n")),
  ];

  if (data.obs) {
    cardComponents.push(
      separator(),
      textDisplay([
        "### 📓 Observações",
        data.obs,
      ].join("\n")),
    );
  }

  const components = [
    container(includeMatrizes ? 0xf59e0b : 0x22c55e, cardComponents),
  ];

  if (includeMatrizes && mentionMatrizes) {
    components.push(
      container(0x5865f2, [
        textDisplay([
        "### 🏛️ Matrizes Envolvidas",
        mentionMatrizes,
        ].join("\n")),
      ]),
    );
  }

  return {
    flags: 32768,
    allowed_mentions: {
      parse: ["roles", "users"],
    },
    components,
  };
}

async function sendDiscordMessage(channelId, botToken, payload) {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord recusou a mensagem: ${text}`);
  }

  return response;
}

function resolveFaction(data, env) {
  const explicitFaction = String(data.faction || "").trim().toUpperCase();
  const userRoles = Array.isArray(data.userRoles) ? data.userRoles.map(String) : [];

  if (explicitFaction === "PCERJ" || userRoles.includes(String(env.ROLE_ID_PCERJ || ""))) {
    return {
      name: "PCERJ",
      channelId: env.CH_PCERJ_FINALIZADOS,
    };
  }

  if (explicitFaction === "PMERJ" || userRoles.includes(String(env.ROLE_ID_PMERJ || ""))) {
    return {
      name: "PMERJ",
      channelId: env.CH_PMERJ_FINALIZADOS,
    };
  }

  if (explicitFaction === "PRF" || userRoles.includes(String(env.ROLE_ID_PRF || ""))) {
    return {
      name: "PRF",
      channelId: env.CH_PRF_FINALIZADOS,
    };
  }

  if (explicitFaction === "PF" || userRoles.includes(String(env.ROLE_ID_PF || ""))) {
    return {
      name: "PF",
      channelId: env.CH_PF_FINALIZADOS,
    };
  }

  return null;
}

export default async function handler(req, res) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  const env = {
    CHANNEL_CURSOS_ANUNCIADOS: process.env.CHANNEL_CURSOS_ANUNCIADOS,
    CHANNEL_CURSOS_FINALIZADOS: process.env.CHANNEL_CURSOS_FINALIZADOS,
    ROLE_ID_PCERJ: process.env.ROLE_ID_PCERJ,
    CH_PCERJ_FINALIZADOS: process.env.CH_PCERJ_FINALIZADOS,
    ROLE_ID_PMERJ: process.env.ROLE_ID_PMERJ,
    CH_PMERJ_FINALIZADOS: process.env.CH_PMERJ_FINALIZADOS,
    ROLE_ID_PRF: process.env.ROLE_ID_PRF,
    CH_PRF_FINALIZADOS: process.env.CH_PRF_FINALIZADOS,
    ROLE_ID_PF: process.env.ROLE_ID_PF,
    CH_PF_FINALIZADOS: process.env.CH_PF_FINALIZADOS,
    MATRIZES_ROLE_ID: process.env.MATRIZES_ROLE_ID,
    INSTRUTORES_ROLE_ID: process.env.INSTRUTORES_ROLE_ID,
    CURSO_BASICO_ID: process.env.CURSO_BASICO_ID,
    CURSO_COMP_ID: process.env.CURSO_COMP_ID,
    CURSO_ACOES_ID: process.env.CURSO_ACOES_ID,
    CALLS_PERMITIDAS: process.env.CALLS_PERMITIDAS,
  };

  if (req.method === "GET") {
    const { action } = req.query;

    if (action === "config" || !action) {
      return res.status(200).json({
        instrutorRoleId: env.INSTRUTORES_ROLE_ID || "",
        factionRoles: {
          pcerj: env.ROLE_ID_PCERJ || "",
          pmerj: env.ROLE_ID_PMERJ || "",
          prf: env.ROLE_ID_PRF || "",
          pf: env.ROLE_ID_PF || "",
        },
      });
    }

    if (action === "discord-data") {
      if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
        return res.status(500).json({ error: "Config ausente" });
      }

      try {
        const headers = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
        const [rolesRes, membersRes, channelsRes] = await Promise.all([
          fetch(`${DISCORD_API_BASE}/guilds/${GUILD_ID}/roles`, { headers }),
          fetch(`${DISCORD_API_BASE}/guilds/${GUILD_ID}/members?limit=1000`, { headers }),
          fetch(`${DISCORD_API_BASE}/guilds/${GUILD_ID}/channels`, { headers }),
        ]);

        if (!rolesRes.ok || !membersRes.ok || !channelsRes.ok) {
          throw new Error("Erro Discord API");
        }

        const roles = await rolesRes.json();
        const members = await membersRes.json();
        const channels = await channelsRes.json();

        const basicoIds = new Set(parseIdList(env.CURSO_BASICO_ID));
        const complementarIds = new Set(parseIdList(env.CURSO_COMP_ID));
        const acoesIds = new Set(parseIdList(env.CURSO_ACOES_ID));

        const resolveTipoCurso = (id) => {
          if (basicoIds.has(id)) return "basico";
          if (complementarIds.has(id)) return "complementar";
          if (acoesIds.has(id)) return "acoes";
          return null;
        };

        const cursos = roles
          .filter((role) => {
            const name = role.name.toLowerCase();
            const blacklist = ["chefe", "instrutor", "diretor", "admin", "bot", "suporte"];
            if (blacklist.some((term) => name.includes(term))) return false;
            return (
              name.includes("curso") ||
              name.includes("treinamento") ||
              name.includes("aula") ||
              name.includes("habilitacao")
            );
          })
          .map((role) => ({
            id: role.id,
            name: role.name,
            tipo: resolveTipoCurso(role.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        const membros = members
          .filter((member) => !member.user.bot)
          .map((member) => ({
            id: member.user.id,
            name: member.nick || member.user.global_name || member.user.username,
            fullLabel: member.nick || member.user.username,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        const callsPermitidas = new Set(parseIdList(env.CALLS_PERMITIDAS));
        const calls = channels
          .filter((channel) => channel.type === 2 || channel.type === 13)
          .filter((channel) => !callsPermitidas.size || callsPermitidas.has(channel.id))
          .map((channel) => ({ id: channel.id, name: channel.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        return res.status(200).json({
          cursos,
          membros,
          calls,
          guildId: GUILD_ID,
        });
      } catch (error) {
        return res.status(500).json({ error: "Falha ao buscar dados." });
      }
    }
  }

  if (req.method === "POST") {
    const data = req.body || {};

    try {
      if (data.type === "anuncio") {
        const hasCourse =
          (Array.isArray(data.curso_ids) && data.curso_ids.length > 0) ||
          (Array.isArray(data.curso_nomes) && data.curso_nomes.length > 0) ||
          data.curso_id ||
          data.curso_nome;

        const missingFields = [];
        if (!hasCourse) missingFields.push("curso");
        if (!data.instrutores) missingFields.push("instrutores");
        if (!data.data) missingFields.push("data");
        if (!data.horario) missingFields.push("horario");

        if (missingFields.length) {
          return res.status(400).json({
            error: `Campos obrigatorios ausentes: ${missingFields.join(", ")}.`,
          });
        }

        const payload = buildAnnouncementMessage(data, env);
        await sendDiscordMessage(env.CHANNEL_CURSOS_ANUNCIADOS, DISCORD_BOT_TOKEN, payload);
        return res.status(200).json({ success: true });
      }

      if (data.type === "final") {
        if (Array.isArray(data.curso_ids) && data.curso_ids.length > 1) {
          return res.status(400).json({
            error: "O relatorio final deve ser enviado com apenas um curso por vez.",
          });
        }

        const faction = resolveFaction(data, env);
        if (!faction) {
          return res.status(400).json({ error: "Faccao nao identificada." });
        }

        const requests = [];

        if (faction.channelId) {
          requests.push(
            sendDiscordMessage(
              faction.channelId,
              DISCORD_BOT_TOKEN,
              buildFinalMessage(data, faction.name, false, env),
            ),
          );
        }

        if (env.CHANNEL_CURSOS_FINALIZADOS) {
          requests.push(
            sendDiscordMessage(
              env.CHANNEL_CURSOS_FINALIZADOS,
              DISCORD_BOT_TOKEN,
              buildFinalMessage(data, faction.name, true, env),
            ),
          );
        }

        await Promise.all(requests);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Tipo de envio invalido." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Erro interno no envio." });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}

