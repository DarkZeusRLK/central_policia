import WebSocket from "ws";
import { readFile, writeFile } from "node:fs/promises";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ANNOUNCEMENT_MAPPINGS_PATH = new URL("../announcementMappings.json", import.meta.url);
const ANNOUNCEMENT_MAPPING_TTL_MS = 48 * 60 * 60 * 1000;
const SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS = process.env.VERCEL !== "1";
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

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCourseBucket(value) {
  const normalized = normalize(value);
  if (!normalized) return "";
  if (normalized.startsWith("bas")) return "basico";
  if (normalized.startsWith("complement")) return "complementar";
  if (normalized.startsWith("acao") || normalized.includes("acoes")) return "acoes";
  return normalized;
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
    hasAnyRole(userRoles, env.AUXILIARES_ROLE_ID) ||
    hasAnyRole(userRoles, env.AUXILIARES_ROLES) ||
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

  return await response.json();
}

function extractCallIdFromLink(callLink) {
  const match = String(callLink || "").match(/discord\.com\/channels\/\d+\/(\d+)/i);
  return match?.[1] || "";
}

function extractCallLinkFromDiscordMessage(message) {
  const stack = Array.isArray(message?.components) ? [...message.components] : [];

  while (stack.length) {
    const current = stack.shift();
    if (!current || typeof current !== "object") continue;

    if (current.url && typeof current.url === "string") {
      return current.url;
    }

    if (Array.isArray(current.components)) {
      stack.push(...current.components);
    }

    if (Array.isArray(current.children)) {
      stack.push(...current.children);
    }

    if (Array.isArray(current.sections)) {
      stack.push(...current.sections);
    }
  }

  return "";
}

async function fetchDiscordMessage(channelId, messageId, botToken) {
  if (!channelId || !messageId || !botToken) return null;

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  );

  if (!response.ok) return null;
  return response.json();
}

function isAnnouncementMappingFresh(mapping) {
  const createdAt = new Date(mapping?.createdAt || "");
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() <= ANNOUNCEMENT_MAPPING_TTL_MS;
}

async function readAnnouncementMappings() {
  if (!SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS) {
    return [];
  }

  try {
    const raw = await readFile(ANNOUNCEMENT_MAPPINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAnnouncementMappingFresh) : [];
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("[CALL MAP]", "Falha ao ler o arquivo de mapeamentos.", error);
    }
    return [];
  }
}

async function writeAnnouncementMappings(mappings) {
  if (!SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS) {
    return;
  }

  await writeFile(
    ANNOUNCEMENT_MAPPINGS_PATH,
    `${JSON.stringify(mappings, null, 2)}\n`,
    "utf8",
  );
}

async function isDiscordMessageAvailable(channelId, messageId, botToken) {
  return Boolean(await fetchDiscordMessage(channelId, messageId, botToken));
}

function normalizeAnnouncementInstructorIds(value) {
  const values = Array.isArray(value) ? value : [value];
  const ids = values.flatMap((item) => {
    if (Array.isArray(item)) {
      return item;
    }

    if (typeof item === "string") {
      const mentionedIds = extractMentionedUserIds(item);
      if (mentionedIds.length) return mentionedIds;
      return String(item).match(/\b\d{15,}\b/g) || [];
    }

    return [];
  });

  return [...new Set(ids.map((item) => String(item).trim()).filter(Boolean))];
}

async function removeOldMappings() {
  if (!SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS) {
    return [];
  }

  const mappings = await readAnnouncementMappings();
  if (!mappings.length) {
    return [];
  }

  await writeAnnouncementMappings(mappings);
  return mappings;
}

async function saveAnnouncementMapping(mapping) {
  if (!SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS) {
    console.log("[CALL MAP]", "skipped save in production", {
      announcementMessageId: String(mapping?.announcementMessageId || "").trim(),
      courseId: String(mapping?.courseId || "").trim(),
      callId: String(mapping?.callId || "").trim(),
      horario: String(mapping?.horario || "").trim(),
    });
    return {
      announcementMessageId: String(mapping?.announcementMessageId || "").trim(),
      courseId: String(mapping?.courseId || "").trim(),
      callId: String(mapping?.callId || "").trim(),
      horario: String(mapping?.horario || "").trim(),
      channelId: String(mapping?.channelId || "").trim() || String(process.env.CHANNEL_CURSOS_ANUNCIADOS || "").trim(),
      instrutorIds: normalizeAnnouncementInstructorIds(mapping?.instrutores),
      createdAt: String(mapping?.createdAt || new Date().toISOString()),
    };
  }

  const normalizedMapping = {
    announcementMessageId: String(mapping?.announcementMessageId || "").trim(),
    courseId: String(mapping?.courseId || "").trim(),
    callId: String(mapping?.callId || "").trim(),
    horario: String(mapping?.horario || "").trim(),
    channelId: String(mapping?.channelId || "").trim() || String(process.env.CHANNEL_CURSOS_ANUNCIADOS || "").trim(),
    instrutorIds: normalizeAnnouncementInstructorIds(mapping?.instrutores),
    createdAt: String(mapping?.createdAt || new Date().toISOString()),
  };

  if (
    !normalizedMapping.announcementMessageId ||
    !normalizedMapping.courseId ||
    !normalizedMapping.callId ||
    !normalizedMapping.horario ||
    !normalizedMapping.channelId
  ) {
    return null;
  }

  const mappings = await readAnnouncementMappings();
  const updatedMappings = [
    ...mappings.filter((entry) => entry.announcementMessageId !== normalizedMapping.announcementMessageId),
    normalizedMapping,
  ];

  await writeAnnouncementMappings(updatedMappings);
  console.log("[CALL MAP]", "saved", normalizedMapping);
  return normalizedMapping;
}

async function removeAnnouncementMapping(options = {}) {
  if (!SHOULD_PERSIST_ANNOUNCEMENT_MAPPINGS) {
    return null;
  }

  const {
    announcementMessageId,
    courseId,
    horario,
    instructorIds,
    instrutorIds,
    selectedInstructorIds,
  } = options;
  const mappings = await readAnnouncementMappings();
  const normalizedAnnouncementMessageId = String(announcementMessageId || "").trim();
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedHorario = String(horario || "").trim();
  const normalizedInstructorIds = normalizeAnnouncementInstructorIds(
    instructorIds || instrutorIds || selectedInstructorIds || [],
  );

  if (!mappings.length) return null;

  let matchIndex = -1;

  if (normalizedAnnouncementMessageId) {
    matchIndex = mappings.findIndex(
      (mapping) => mapping.announcementMessageId === normalizedAnnouncementMessageId,
    );
  } else {
    const matchingMappings = mappings.filter(
      (mapping) =>
        mapping.courseId === normalizedCourseId &&
        (!normalizedHorario || mapping.horario === normalizedHorario),
    );

    if (normalizedInstructorIds.length) {
      const scoredMappings = matchingMappings
        .map((mapping, index) => {
          const mappingInstructorIds = Array.isArray(mapping.instrutorIds)
            ? mapping.instrutorIds.map(String)
            : [];
          const overlapCount = normalizedInstructorIds.filter((instructorId) =>
            mappingInstructorIds.includes(String(instructorId)),
          ).length;

          return {
            index: mappings.findIndex((entry) => entry.announcementMessageId === mapping.announcementMessageId),
            overlapCount,
          };
        })
        .filter((entry) => entry.index >= 0 && entry.overlapCount > 0)
        .sort((left, right) => {
          if (right.overlapCount !== left.overlapCount) return right.overlapCount - left.overlapCount;
          return left.index - right.index;
        });

      matchIndex = scoredMappings[0]?.index ?? -1;
    }

    if (matchIndex < 0 && matchingMappings.length) {
      matchIndex = mappings.findIndex(
        (entry) => entry.announcementMessageId === matchingMappings[0].announcementMessageId,
      );
    }
  }

  if (matchIndex < 0) return null;

  const removed = mappings.splice(matchIndex, 1)[0] || null;
  await writeAnnouncementMappings(mappings);
  console.log("[CALL MAP]", "removed", removed);
  return removed;
}

async function getAnnouncementMapping(options = {}) {
  const {
    announcementMessageId,
    courseId,
    horario,
    instructorIds,
    instrutorIds,
    selectedInstructorIds,
  } = options;
  const mappings = await removeOldMappings();
  const normalizedAnnouncementMessageId = String(announcementMessageId || "").trim();
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedHorario = String(horario || "").trim();
  const normalizedInstructorIds = normalizeAnnouncementInstructorIds(
    instructorIds || instrutorIds || selectedInstructorIds || [],
  );

  if (normalizedAnnouncementMessageId) {
    const directMatch = mappings.find(
      (mapping) => mapping.announcementMessageId === normalizedAnnouncementMessageId,
    );
    if (directMatch) {
      const isAlive = await isDiscordMessageAvailable(
        directMatch.channelId || process.env.CHANNEL_CURSOS_ANUNCIADOS,
        directMatch.announcementMessageId,
        process.env.DISCORD_BOT_TOKEN,
      );
      if (!isAlive) {
        await removeAnnouncementMapping({ announcementMessageId: normalizedAnnouncementMessageId });
        return null;
      }
      return directMatch;
    }

    const liveAnnouncementMessage = await fetchDiscordMessage(
      process.env.CHANNEL_CURSOS_ANUNCIADOS,
      normalizedAnnouncementMessageId,
      process.env.DISCORD_BOT_TOKEN,
    );

    if (!liveAnnouncementMessage) {
      return null;
    }

    const callLink = extractCallLinkFromDiscordMessage(liveAnnouncementMessage);
    const callId = extractCallIdFromLink(callLink);

    if (!callId) {
      return null;
    }

    return {
      announcementMessageId: normalizedAnnouncementMessageId,
      courseId: normalizedCourseId,
      horario: normalizedHorario,
      callId,
      channelId: process.env.CHANNEL_CURSOS_ANUNCIADOS || "",
      createdAt: new Date().toISOString(),
    };
  }

  const matchingMappings = mappings.filter(
    (mapping) =>
      mapping.courseId === normalizedCourseId &&
      (!normalizedHorario || mapping.horario === normalizedHorario),
  );

  if (!matchingMappings.length) {
    return null;
  }

  if (normalizedInstructorIds.length) {
    const scoredMappings = matchingMappings
      .map((mapping) => {
        const mappingInstructorIds = Array.isArray(mapping.instrutorIds)
          ? mapping.instrutorIds.map(String)
          : [];
        const overlapCount = normalizedInstructorIds.filter((instructorId) =>
          mappingInstructorIds.includes(String(instructorId)),
        ).length;

        return {
          mapping,
          overlapCount,
        };
      })
      .filter((entry) => entry.overlapCount > 0)
      .sort((left, right) => {
        if (right.overlapCount !== left.overlapCount) return right.overlapCount - left.overlapCount;
        return new Date(left.mapping.createdAt).getTime() - new Date(right.mapping.createdAt).getTime();
      });

    if (scoredMappings.length) {
      const candidate = scoredMappings[0].mapping;
      const isAlive = await isDiscordMessageAvailable(
        candidate.channelId || process.env.CHANNEL_CURSOS_ANUNCIADOS,
        candidate.announcementMessageId,
        process.env.DISCORD_BOT_TOKEN,
      );
      if (!isAlive) {
        await removeAnnouncementMapping({ announcementMessageId: candidate.announcementMessageId });
        return getAnnouncementMapping({
          courseId: normalizedCourseId,
          horario: normalizedHorario,
          instructorIds: normalizedInstructorIds,
        });
      }
      return candidate;
    }
  }

  const oldestCandidate = matchingMappings.sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )[0] || null;

  if (!oldestCandidate) return null;

  const oldestAlive = await isDiscordMessageAvailable(
    oldestCandidate.channelId || process.env.CHANNEL_CURSOS_ANUNCIADOS,
    oldestCandidate.announcementMessageId,
    process.env.DISCORD_BOT_TOKEN,
  );
  if (!oldestAlive) {
    await removeAnnouncementMapping({ announcementMessageId: oldestCandidate.announcementMessageId });
    return getAnnouncementMapping({
      courseId: normalizedCourseId,
      horario: normalizedHorario,
      instructorIds: normalizedInstructorIds,
    });
  }

  return oldestCandidate;
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

async function resolveCallIdFromRecentAnnouncements(courseId, horario, channelId, botToken, instructorIds = []) {
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedCourseId || !channelId || !botToken) return "";
  const normalizedHorario = String(horario || "").trim();
  const normalizedInstructorIds = normalizeAnnouncementInstructorIds(instructorIds);

  let before = "";
  const candidates = [];

  for (let page = 0; page < 2; page += 1) {
    const url = new URL(`${DISCORD_API_BASE}/channels/${channelId}/messages`);
    url.searchParams.set("limit", "100");
    if (before) {
      url.searchParams.set("before", before);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      return "";
    }

    const messages = await response.json().catch(() => []);
    if (!Array.isArray(messages) || !messages.length) return "";

    for (const message of messages) {
      const serialized = JSON.stringify(message);
      if (!serialized.includes(`<@&${normalizedCourseId}>`)) {
        continue;
      }

      if (normalizedHorario && !serialized.includes(normalizedHorario)) {
        continue;
      }

      const buttonUrlMatch = serialized.match(/https:\/\/discord\.com\/channels\/\d+\/(\d+)/i);
      if (buttonUrlMatch?.[1]) {
        candidates.push({
          callId: buttonUrlMatch[1],
          timestamp: message.timestamp || "",
          text: serialized,
        });
      }
    }

    before = String(messages[messages.length - 1]?.id || "");
    if (!before) break;
  }

  if (!candidates.length) return "";

  if (normalizedInstructorIds.length) {
    const scoredCandidates = candidates
      .map((candidate) => {
        const candidateInstructorIds = Array.from(
          candidate.text.matchAll(/<@!?(\d+)>/g),
        ).map((match) => match[1]);
        const overlapCount = normalizedInstructorIds.filter((instructorId) =>
          candidateInstructorIds.includes(String(instructorId)),
        ).length;

        return {
          ...candidate,
          overlapCount,
        };
      })
      .filter((candidate) => candidate.overlapCount > 0)
      .sort((left, right) => {
        if (right.overlapCount !== left.overlapCount) return right.overlapCount - left.overlapCount;
        return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
      });

    if (scoredCandidates.length) {
      return scoredCandidates[0].callId;
    }
  }

  return candidates.sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  )[0]?.callId || "";
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
    AUXILIARES_ROLE_ID: process.env.AUXILIARES_ROLE_ID,
    AUXILIARES_ROLES: process.env.AUXILIARES_ROLES,
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
        auxiliaresRoleIds: env.AUXILIARES_ROLE_ID || env.AUXILIARES_ROLES || "",
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
          const mappedCall = await getAnnouncementMapping({
            announcementMessageId: data.announcementMessageId,
            courseId: data.courseId,
            horario: data.horario,
            instructorIds: data.instructorIds || data.instrutorIds || data.selectedInstructorIds,
          });

          if (mappedCall?.callId) {
            console.log("[CALL MAP]", "resolved from stored mapping", {
              announcementMessageId: mappedCall.announcementMessageId,
              courseId: mappedCall.courseId,
              horario: mappedCall.horario,
              callId: mappedCall.callId,
            });
            callId = mappedCall.callId;
          }
        }

        if (!callId) {
          callId = await resolveCallIdFromRecentAnnouncements(
            data.courseId,
            data.horario,
            env.CHANNEL_CURSOS_ANUNCIADOS,
            DISCORD_BOT_TOKEN,
            data.instructorIds || data.instrutorIds || data.selectedInstructorIds,
          );
          if (callId) {
            console.log("[CALL MAP]", "resolved from recent announcements", {
              courseId: data.courseId,
              horario: data.horario,
              callId,
            });
          }
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
        const selectedCourseBucket =
          resolveCourseTypeById(selectedCourseId, env) ||
          normalizeCourseBucket(data.courseBucket);
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
        const sentMessage = await sendDiscordMessage(
          env.CHANNEL_CURSOS_ANUNCIADOS,
          DISCORD_BOT_TOKEN,
          payload,
        );
        const courseIds = Array.isArray(data.curso_ids)
          ? data.curso_ids.filter(Boolean)
          : data.curso_id
            ? [data.curso_id]
            : [];
        const callId = String(data.callId || extractCallIdFromLink(data.call_link) || "").trim();

        if (sentMessage?.id && callId && courseIds.length) {
          for (const courseId of courseIds) {
            await saveAnnouncementMapping({
              announcementMessageId: sentMessage.id,
              courseId,
              callId,
              horario: data.horario,
              channelId: env.CHANNEL_CURSOS_ANUNCIADOS,
              instrutores: data.instrutores || "",
            });
          }
        }

        return res.status(200).json({ success: true, sentMessage });
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
        if (String(data.announcementMessageId || "").trim()) {
          await removeAnnouncementMapping({
            announcementMessageId: data.announcementMessageId,
            courseId: data.curso_id,
            horario: data.horario,
            instructorIds: data.instructorIds || data.instrutores || "",
          });
        }

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
