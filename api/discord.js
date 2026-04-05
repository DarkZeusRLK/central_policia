const DISCORD_API_BASE = "https://discord.com/api/v10";

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function avatarUrlFromUser(user) {
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0, 10) % 5}.png`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchDiscordJson(url, botToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error: ${response.status} ${text}`);
  }

  return response.json();
}

async function resolveMembersByIds(ids, botToken, guildId) {
  const promises = ids.map(async (id) => {
    try {
      const memberData = await fetchDiscordJson(
        `${DISCORD_API_BASE}/guilds/${guildId}/members/${id}`,
        botToken,
      );

      const user = memberData.user;
      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: avatarUrlFromUser(user),
      };
    } catch {
      return null;
    }
  });

  const members = await Promise.all(promises);
  return members.filter(Boolean);
}

async function resolveMembersByRoleIds(roleIds, botToken, guildId) {
  const ids = parseIdList(roleIds);
  if (!ids.length) return [];

  const members = await fetchDiscordJson(
    `${DISCORD_API_BASE}/guilds/${guildId}/members?limit=1000`,
    botToken,
  );

  return members
    .filter((member) => !member.user?.bot)
    .filter(
      (member) => Array.isArray(member.roles) && member.roles.some((roleId) => ids.includes(String(roleId))),
    )
    .map((member) => ({
      username: member.nick || member.user.global_name || member.user.username,
      avatarUrl: avatarUrlFromUser(member.user),
    }))
    .sort((a, b) => a.username.localeCompare(b.username, "pt-BR"));
}

function resolveLeadershipIds(group, env) {
  const map = {
    commanders: env.COMANDO_GERAL || env.COMANDO_GERAL_IDS,
    pcerj: env.DELEGADOS_IDS,
    pmerj: env.COMANDOS_PMERJ_IDS,
    pf: env.DIRETORES_PF_IDS,
    prf: env.DIRETORES_PRF_IDS,
  };

  return parseIdList(map[group]);
}

function resolveRoleId(targetRole, roles) {
  if (!targetRole) return "";

  const exactId = roles.find((role) => role.id === targetRole);
  if (exactId) return exactId.id;

  const normalizedTarget = normalize(targetRole);
  const byName = roles.find((role) => normalize(role.name) === normalizedTarget);
  return byName?.id || "";
}

export default async function handler(req, res) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
  const action = req.query.action;

  if (!action) {
    return res.status(400).json({ error: "AÃ§Ã£o nÃ£o informada." });
  }

  if (!botToken || !guildId) {
    return res.status(500).json({ error: "ConfiguraÃ§Ã£o do Discord ausente." });
  }

  try {
    if (action === "check-access") {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "MÃ©todo nÃ£o permitido." });
      }

      const { userId } = req.body || {};
      const journalistRoleId = process.env.JORNALISTA_ROLE_ID;

      if (!userId) {
        return res.status(400).json({ error: "userId Ã© obrigatÃ³rio." });
      }

      const response = await fetch(
        `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        },
      );

      if (response.status === 404) {
        return res.status(200).json({ isMember: false, isJournalist: false });
      }

      if (!response.ok) {
        throw new Error("Erro na API do Discord.");
      }

      const memberData = await response.json();
      return res.status(200).json({
        isMember: true,
        roles: Array.isArray(memberData.roles) ? memberData.roles : [],
        isJournalist: journalistRoleId
          ? memberData.roles.includes(journalistRoleId)
          : false,
      });
    }

    if (action === "commanders" || action === "leadership") {
      if (req.method !== "GET") {
        return res.status(405).json({ error: "MÃ©todo nÃ£o permitido." });
      }

      const group =
        action === "commanders"
          ? "commanders"
          : normalize(req.query.group || "");

      const ids = resolveLeadershipIds(group, process.env);
      if (!ids.length) {
        return res.status(500).json({ error: "IDs de lideranÃ§a nÃ£o configurados." });
      }

      let members = [];

      if (group === "commanders") {
        members = await resolveMembersByRoleIds(ids, botToken, guildId);
      }

      if (!members.length) {
        members = await resolveMembersByIds(ids, botToken, guildId);
      }

      return res.status(200).json(members);
    }

    if (action === "police-members") {
      if (req.method !== "GET") {
        return res.status(405).json({ error: "MÃ©todo nÃ£o permitido." });
      }

      const configuredRole =
        process.env.CARGO_POLICIAL_REVOADA || req.query.role || "";

      if (!configuredRole) {
        return res.status(500).json({
          error: "A variÃ¡vel CARGO_POLICIAL_REVOADA nÃ£o foi configurada.",
        });
      }

      const [roles, members] = await Promise.all([
        fetchDiscordJson(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, botToken),
        fetchDiscordJson(
          `${DISCORD_API_BASE}/guilds/${guildId}/members?limit=1000`,
          botToken,
        ),
      ]);

      const roleId = resolveRoleId(configuredRole, roles);
      if (!roleId) {
        return res.status(404).json({
          error: "Cargo policial nÃ£o encontrado no servidor do Discord.",
        });
      }

      const filteredMembers = members
        .filter((member) => !member.user?.bot)
        .filter(
          (member) => Array.isArray(member.roles) && member.roles.includes(roleId),
        )
        .map((member) => {
          const label =
            member.nick || member.user.global_name || member.user.username || "";

          return {
            id: member.user.id,
            label,
            mention: `<@${member.user.id}>`,
          };
        })
        .filter((member) => member.label)
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

      return res.status(200).json({
        members: filteredMembers,
        memberNames: filteredMembers.map((member) => member.label),
        roleId,
        roleSource: configuredRole,
      });
    }

    return res.status(400).json({ error: "AÃ§Ã£o invÃ¡lida." });
  } catch (error) {
    console.error("Erro em /api/discord:", error);
    return res.status(500).json({ error: error.message || "Falha na integracao com o Discord." });
  }
}


