const DISCORD_API_BASE = "https://discord.com/api/v10";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function fetchDiscordJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error: ${response.status} ${text}`);
  }

  return response.json();
}

function resolveRoleId(targetRole, roles) {
  if (!targetRole) return "";

  const normalizedTarget = normalize(targetRole);
  const byId = roles.find((role) => role.id === targetRole);
  if (byId) return byId.id;

  const byName = roles.find((role) => normalize(role.name) === normalizedTarget);
  return byName?.id || "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
  const configuredRole = process.env.CARGO_POLICIAL_REVOADA || req.query.role || "";

  if (!botToken || !guildId) {
    return res.status(500).json({ error: "Discord não configurado no servidor." });
  }

  if (!configuredRole) {
    return res.status(500).json({
      error: "A variável CARGO_POLICIAL_REVOADA não foi configurada.",
    });
  }

  try {
    const [roles, members] = await Promise.all([
      fetchDiscordJson(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, botToken),
      fetchDiscordJson(`${DISCORD_API_BASE}/guilds/${guildId}/members?limit=1000`, botToken),
    ]);

    const roleId = resolveRoleId(configuredRole, roles);
    if (!roleId) {
      return res.status(404).json({
        error: "Cargo policial não encontrado no servidor do Discord.",
      });
    }

    const filteredMembers = members
      .filter((member) => !member.user?.bot)
      .filter((member) => Array.isArray(member.roles) && member.roles.includes(roleId))
      .map((member) => member.nick || member.user.global_name || member.user.username)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    return res.status(200).json({
      members: filteredMembers,
      roleId,
      roleSource: configuredRole,
    });
  } catch (error) {
    console.error("Erro em /api/police-members:", error);
    return res.status(500).json({ error: "Falha ao buscar membros policiais." });
  }
}
