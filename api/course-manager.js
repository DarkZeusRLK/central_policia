import WebSocket from "ws";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const COURSE_TYPE_OVERRIDES = {
  "1164557461357867038": "complementar",
};

function parseIdList(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .map((item) => {
      const cleaned = item
        .replace(/^[\[\("'`\s]+/, "")
        .replace(/[\]\)"'`\s]+$/, "");
      const mentionMatch = cleaned.match(/^<@&?(\d+)>$/);
      return mentionMatch ? mentionMatch[1] : cleaned;
    })
    .filter(Boolean);
}

function formatBr(dateStr) {
  return dateStr ? dateStr.split("-").reverse().join("/") : "N/A";
}

function splitCommaSeparatedList(value, maxLength = 1700) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.length) return ["Nenhum"];

  const chunks = [];
  let current = "";

  items.forEach((item) => {
    const candidate = current ? `${current}, ${item}` : item;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = item;
      return;
    }

    current = candidate;
  });

  if (current) chunks.push(current);
  return chunks;
}

function hasAnyRole(userRoles, configuredRoles) {
  const allowed = parseIdList(configuredRoles).map(String);
  if (!allowed.length) return false;
  return Array.isArray(userRoles) && userRoles.map(String).some((roleId) => allowed.includes(roleId));
}

function canUseTeachingTools(data, env) {
  const userRoles = Array.isArray(data.userRoles) ? data.userRoles.map(String) : [];
  const ownerIds = parseIdList(process.env.OWNER).map(String);
  if (ownerIds.includes(String(data.authorId || ""))) return true;

  return (
    hasAnyRole(userRoles, env.INSTRUTORES_ROLE_ID) ||
    hasAnyRole(userRoles, env.ENSINO_PMERJ_ROLES) ||
    hasAnyRole(userRoles, env.COMANDO_GERAL)
  );
}

function resolveCourseTypeById(courseId, env) {
  const id = String(courseId || "").trim();
  if (!id) return "";
  if (COURSE_TYPE_OVERRIDES[id]) return COURSE_TYPE_OVERRIDES[id];
  if (parseIdList(env.CURSO_ACOES_ID).includes(id)) return "acoes";
  if (parseIdList(env.CURSO_COMP_ID).includes(id)) return "complementar";
  if (parseIdList(env.CURSO_BASICO_ID).includes(id)) return "basico";
  return "";
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

function extractMentionedUserIds(value) {
  return Array.from(String(value || "").matchAll(/<@!?(\d+)>/g)).map((match) => match[1]);
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
  const cardComponents = [
    textDisplay("## 📣 Central Policial | Anúncio de Curso"),
    separator(),
    textDisplay([
      "### 📚 Curso",
      courseMentions.map((course) => `- ${course}`).join("\n"),
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👨‍🏫 Equipe de Ensino",
      `- **Instrutores:** ${data.instrutores || "N/A"}`,
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📅 Data",
      `- **Data:** ${formatBr(data.data)}`,
      `- **Horário:** ${data.horario || "N/A"}`,
      `- **Local:** ${data.local || "N/A"}`,
    ].join("\n")),
  ];

  if (mentionMatrizes) {
    cardComponents.push(separator(), textDisplay(`### 🏛️ Convocação\n${mentionMatrizes}`));
  }

  if (data.call_link) {
    cardComponents.push(
      separator(),
      textDisplay("### 🔊 Acesso à Call\nUse o botão abaixo para entrar na sala de voz do curso."),
      linkButton("Entrar na call", data.call_link),
    );
  }

  cardComponents.push(
    separator(),
    textDisplay(data.authorId ? `-# Publicado por: <@${data.authorId}>` : "-# Publicado por: Intranet Policial"),
  );

  return {
    flags: 32768,
    allowed_mentions: {
      parse: ["roles", "users"],
    },
    components: [container(0xd4af37, cardComponents)],
  };
}

function buildFinalMessages(data, factionName, includeMatrizes, env) {
  const mentionMatrizes = parseIdList(env.MATRIZES_ROLE_ID).map((id) => `<@&${id}>`).join(" ");
  const courseMentions = resolveCourseMentions(data);
  const title = includeMatrizes
    ? "## 📘 Central Policial | Registro Geral de Curso"
    : `## 📘 Central Policial | Curso Finalizado ${factionName}`;
  const approvedChunks = splitCommaSeparatedList(data.aprovados);
  const failedChunks = splitCommaSeparatedList(data.reprovados);
  const cardComponents = [
    textDisplay(title),
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
      "### ✅ Aprovados",
      approvedChunks[0] || "Nenhum",
    ].join("\n")),
    separator(),
    textDisplay([
      "### ❌ Reprovados",
      failedChunks[0] || "Nenhum",
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

  if (includeMatrizes && mentionMatrizes) {
    cardComponents.push(
      separator(),
      textDisplay([
        "### 🏛️ Matrizes Envolvidas",
        mentionMatrizes,
      ].join("\n")),
    );
  }

  cardComponents.push(
    separator(),
    textDisplay(data.authorId ? `-# Relatório enviado por: <@${data.authorId}>` : "-# Relatório enviado por: Intranet Policial"),
  );

  const messages = [{
    flags: 32768,
    allowed_mentions: {
      parse: ["roles", "users"],
    },
    components: [container(includeMatrizes ? 0xf59e0b : 0x22c55e, cardComponents)],
  }];

  const continuationComponents = [];
  approvedChunks.slice(1).forEach((chunk, index) => {
    continuationComponents.push(
      container(0x16a34a, [
        textDisplay([
          `## 📘 Continuação | ${includeMatrizes ? "Registro Geral de Curso" : `Curso Finalizado ${factionName}`}`,
          `### ✅ Aprovados ${approvedChunks.length > 2 ? `(${index + 2}/${approvedChunks.length})` : ""}`.trim(),
          chunk,
        ].join("\n")),
      ]),
    );
  });

  failedChunks.slice(1).forEach((chunk, index) => {
    continuationComponents.push(
      container(0xdc2626, [
        textDisplay([
          `## 📘 Continuação | ${includeMatrizes ? "Registro Geral de Curso" : `Curso Finalizado ${factionName}`}`,
          `### ❌ Reprovados ${failedChunks.length > 2 ? `(${index + 2}/${failedChunks.length})` : ""}`.trim(),
          chunk,
        ].join("\n")),
      ]),
    );
  });

  if (continuationComponents.length) {
    continuationComponents.forEach((component) => {
      messages.push({
        flags: 32768,
        allowed_mentions: {
          parse: ["roles", "users"],
        },
        components: [component],
      });
    });
  }

  return messages;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRoleToMemberWithRetry(courseId, userId, botToken, guildId, maxAttempts = 5) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;

    const response = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}/roles/${courseId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 429) {
      const retryPayload = await response.json().catch(() => ({}));
      const retryAfterSeconds = Number(
        retryPayload.retry_after || response.headers.get("retry-after") || 1,
      );
      const retryDelay = Math.max(1000, Math.ceil(retryAfterSeconds * 1000) + 250);
      await sleep(retryDelay);
      continue;
    }

    const text = await response.text();
    throw new Error(`Falha ao aplicar tag do curso no membro ${userId}: ${text}`);
  }

  throw new Error(
    `Falha ao aplicar tag do curso no membro ${userId}: limite de tentativas excedido.`,
  );
}

async function applyCourseRoleToApprovedMembers(courseId, approvedList, botToken, guildId) {
  const normalizedCourseId = String(courseId || "").trim();
  const approvedIds = [...new Set(extractMentionedUserIds(approvedList))];

  if (!normalizedCourseId || !approvedIds.length || !guildId) {
    return { applied: 0, failed: [] };
  }

  const failed = [];
  let applied = 0;

  for (const userId of approvedIds) {
    try {
      await applyRoleToMemberWithRetry(
        normalizedCourseId,
        userId,
        botToken,
        guildId,
      );
      applied += 1;
      await sleep(350);
    } catch (error) {
      failed.push({
        userId,
        reason: error.message || "Falha desconhecida ao aplicar cargo.",
      });
      await sleep(500);
    }
  }

  return {
    applied,
    failed,
  };
}

async function getVoiceChannelMembersFromGateway(guildId, channelId, botToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    let heartbeatTimer = null;
    let timeoutTimer = null;
    let settled = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      try {
        socket.close();
      } catch {}
      handler(value);
    };

    timeoutTimer = setTimeout(() => {
      finish(reject, new Error("Tempo esgotado ao consultar os membros da call."));
    }, 12000);

    socket.on("message", (raw) => {
      try {
        const packet = JSON.parse(raw.toString());

        if (packet.op === 10) {
          const interval = Number(packet.d?.heartbeat_interval || 45000);
          socket.send(JSON.stringify({ op: 1, d: null }));
          heartbeatTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ op: 1, d: null }));
            }
          }, interval);

          socket.send(
            JSON.stringify({
              op: 2,
              d: {
                token: botToken,
                intents: 129,
                properties: {
                  os: "linux",
                  browser: "revoada-central",
                  device: "revoada-central",
                },
              },
            }),
          );
          return;
        }

        if (packet.op !== 0) return;
        if (packet.t !== "GUILD_CREATE") return;
        if (String(packet.d?.id || "") !== String(guildId)) return;

        const voiceStates = Array.isArray(packet.d?.voice_states)
          ? packet.d.voice_states
          : [];
        const members = Array.isArray(packet.d?.members) ? packet.d.members : [];
        const membersById = new Map(
          members
            .filter((member) => member?.user?.id)
            .map((member) => [String(member.user.id), member]),
        );

        const attendees = voiceStates
          .filter((voiceState) => String(voiceState.channel_id || "") === String(channelId))
          .map((voiceState) => {
            const userId = String(voiceState.user_id || "");
            const member = membersById.get(userId);
            return {
              id: userId,
              name:
                member?.nick ||
                member?.user?.global_name ||
                member?.user?.username ||
                `ID ${userId}`,
              roles: Array.isArray(member?.roles) ? member.roles.map(String) : [],
            };
          })
          .filter((member) => member.id);

        finish(resolve, attendees);
      } catch (error) {
        finish(reject, error);
      }
    });

    socket.on("error", (error) => {
      finish(reject, error);
    });

    socket.on("close", () => {
      if (!settled) {
        finish(reject, new Error("A conexão com o Gateway foi encerrada antes da leitura da call."));
      }
    });
  });
}

async function resolveCallIdFromRecentAnnouncements(courseId, channelId, botToken) {
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedCourseId || !channelId || !botToken) return "";

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=50`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  );

  if (!response.ok) {
    return "";
  }

  const messages = await response.json().catch(() => []);
  if (!Array.isArray(messages)) return "";

  for (const message of messages) {
    const serialized = JSON.stringify(message.components || []);
    if (!serialized.includes(`<@&${normalizedCourseId}>`)) {
      continue;
    }

    const buttonUrlMatch = serialized.match(/https:\/\/discord\.com\/channels\/\d+\/(\d+)/i);
    if (buttonUrlMatch?.[1]) {
      return buttonUrlMatch[1];
    }
  }

  return "";
}

function resolveFaction(data, env) {
  const userRoles = Array.isArray(data.userRoles) ? data.userRoles.map(String) : [];
  const explicitFaction = String(data.faction || "").trim().toUpperCase();

  if (hasAnyRole(userRoles, env.ROLE_ID_PCERJ)) {
    return {
      name: "PCERJ",
      channelId: env.CH_PCERJ_FINALIZADOS,
    };
  }

  if (hasAnyRole(userRoles, env.ROLE_ID_PMERJ)) {
    const courseType = resolveCourseTypeById(data.curso_id, env);
    return {
      name: "PMERJ",
      channelId: courseType === "acoes" ? env.CH_PMERJ_FINALIZADOS_ACAO : env.CH_PMERJ_FINALIZADOS,
    };
  }

  if (hasAnyRole(userRoles, env.ROLE_ID_PRF)) {
    return {
      name: "PRF",
      channelId: env.CH_PRF_FINALIZADOS,
    };
  }

  if (hasAnyRole(userRoles, env.ROLE_ID_PF)) {
    return {
      name: "PF",
      channelId: env.CH_PF_FINALIZADOS,
    };
  }

  if (hasAnyRole(userRoles, env.COMANDO_GERAL)) {
    return {
      name: "COMANDO_GERAL",
      channelId: "",
    };
  }

  if (explicitFaction === "PCERJ") {
    return {
      name: "PCERJ",
      channelId: env.CH_PCERJ_FINALIZADOS,
    };
  }

  if (explicitFaction === "PMERJ") {
    const courseType = resolveCourseTypeById(data.curso_id, env);
    return {
      name: "PMERJ",
      channelId: courseType === "acoes" ? env.CH_PMERJ_FINALIZADOS_ACAO : env.CH_PMERJ_FINALIZADOS,
    };
  }

  if (explicitFaction === "PRF") {
    return {
      name: "PRF",
      channelId: env.CH_PRF_FINALIZADOS,
    };
  }

  if (explicitFaction === "PF") {
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
    CH_PMERJ_FINALIZADOS_ACAO: process.env.CH_PMERJ_FINALIZADOS_ACAO,
    ROLE_ID_PRF: process.env.ROLE_ID_PRF,
    CH_PRF_FINALIZADOS: process.env.CH_PRF_FINALIZADOS,
    ROLE_ID_PF: process.env.ROLE_ID_PF,
    CH_PF_FINALIZADOS: process.env.CH_PF_FINALIZADOS,
    MATRIZES_ROLE_ID: process.env.MATRIZES_ROLE_ID,
    INSTRUTORES_ROLE_ID: process.env.INSTRUTORES_ROLE_ID,
    ENSINO_PMERJ_ROLES: process.env.ENSINO_PMERJ_ROLES,
    COMANDO_GERAL: process.env.COMANDO_GERAL || process.env.COMANDO_GERAL_IDS,
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
        ensinoPmerjRoleIds: env.ENSINO_PMERJ_ROLES || "",
        comandoGeralRoleIds: env.COMANDO_GERAL || "",
        ownerIds: process.env.OWNER || "",
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

        const basicoIds = new Set(
          Object.entries(COURSE_TYPE_OVERRIDES)
            .filter(([, tipo]) => tipo === "basico")
            .map(([id]) => id)
            .concat(parseIdList(env.CURSO_BASICO_ID)),
        );
        const complementarIds = new Set(
          Object.entries(COURSE_TYPE_OVERRIDES)
            .filter(([, tipo]) => tipo === "complementar")
            .map(([id]) => id)
            .concat(parseIdList(env.CURSO_COMP_ID)),
        );
        const acoesIds = new Set(
          Object.entries(COURSE_TYPE_OVERRIDES)
            .filter(([, tipo]) => tipo === "acoes")
            .map(([id]) => id)
            .concat(parseIdList(env.CURSO_ACOES_ID)),
        );

        const resolveTipoCurso = (id) => {
          if (basicoIds.has(id)) return "basico";
          if (complementarIds.has(id)) return "complementar";
          if (acoesIds.has(id)) return "acoes";
          return null;
        };

        const configuredCourseIds = new Set([
          ...basicoIds,
          ...complementarIds,
          ...acoesIds,
        ]);

        const cursos = roles
          .filter((role) => {
            const id = String(role.id || "");
            const name = normalize(role.name);
            const blacklist = ["chefe", "instrutor", "diretor", "admin", "bot", "suporte"];

            if (configuredCourseIds.has(id)) return true;
            if (blacklist.some((term) => name.includes(term))) return false;

            return (
              name.includes("curso") ||
              name.includes("treinamento") ||
              name.includes("aula") ||
              name.includes("habilitacao") ||
              name.includes("habilitação")
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
      if (data.action === "voice-attendees") {
        if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
          return res.status(500).json({ error: "Configuração do Discord ausente." });
        }

        if (!canUseTeachingTools(data, env)) {
          return res.status(403).json({ error: "Você não tem permissão para usar a leitura automática da call." });
        }

        let callId = String(data.callId || "").trim();
        if (!callId) {
          callId = await resolveCallIdFromRecentAnnouncements(
            data.courseId,
            env.CHANNEL_CURSOS_ANUNCIADOS,
            DISCORD_BOT_TOKEN,
          );
        }
        if (!callId) {
          return res.status(400).json({ error: "Call não identificada para leitura automática." });
        }

        const attendees = await getVoiceChannelMembersFromGateway(
          GUILD_ID,
          callId,
          DISCORD_BOT_TOKEN,
        );
        const ignoredIds = new Set(
          Array.isArray(data.ignoredIds) ? data.ignoredIds.map((id) => String(id)) : [],
        );
        const selectedCourseId = String(data.courseId || "").trim();
        const selectedCourseBucket = String(data.courseBucket || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        const ignoredRoleIds = new Set([
          selectedCourseId,
          ...(selectedCourseBucket === "basico" ? parseIdList(process.env.CONCLUSAO_CURSOS) : []),
        ].filter(Boolean).map(String));

        return res.status(200).json({
          success: true,
          attendees: attendees.filter((attendee) => {
            const attendeeId = String(attendee.id || "");
            const attendeeRoles = Array.isArray(attendee.roles) ? attendee.roles.map(String) : [];
            const hasBlockedRole = attendeeRoles.some((roleId) => ignoredRoleIds.has(roleId));
            return !ignoredIds.has(attendeeId) && !hasBlockedRole;
          }),
        });
      }

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
        const factionMessages = faction.channelId
          ? buildFinalMessages(data, faction.name, false, env)
          : [];
        const globalMessages = env.CHANNEL_CURSOS_FINALIZADOS
          ? buildFinalMessages(data, faction.name, true, env)
          : [];

        factionMessages.forEach((payload) => {
          requests.push(sendDiscordMessage(faction.channelId, DISCORD_BOT_TOKEN, payload));
        });

        globalMessages.forEach((payload) => {
          requests.push(sendDiscordMessage(env.CHANNEL_CURSOS_FINALIZADOS, DISCORD_BOT_TOKEN, payload));
        });

        await Promise.all(requests);
        const roleSync = await applyCourseRoleToApprovedMembers(
          data.curso_id,
          data.aprovados,
          DISCORD_BOT_TOKEN,
          GUILD_ID,
        );

        return res.status(200).json({
          success: true,
          roleSync,
          warning:
            roleSync.failed.length > 0
              ? `O relatório foi enviado, mas ${roleSync.failed.length} tag(s) de curso não puderam ser aplicadas automaticamente.`
              : undefined,
        });
      }

      return res.status(400).json({ error: "Tipo de envio invalido." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message || "Erro interno no envio.",
      });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
