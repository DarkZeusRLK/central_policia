import {
  getRoomsCollection,
  ensureDefaultRooms,
  isRoomLocked,
  getAblyRest,
  signalingChannelName,
  fetchPresenceMembers,
  getRoomPresenceMembers,
} from "../lib/voiceRooms.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

const DEFAULT_TOKEN_TTL_SECONDS = 600;
const DEFAULT_KICK_COOLDOWN_SECONDS = 30;
const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302"];
// Credenciais públicas e gratuitas do Open Relay Project (openrelay.metered.ca) — usadas
// apenas se TURN_URL/TURN_USERNAME/TURN_CREDENTIAL não forem configurados no ambiente.
const DEFAULT_TURN_URLS = "turn:openrelay.metered.ca:80,turns:openrelay.metered.ca:443";
const DEFAULT_TURN_USERNAME = "openrelayproject";
const DEFAULT_TURN_CREDENTIAL = "openrelayproject";

const MODERATION_ACTIONS = new Set(["mute", "unmute", "deafen", "undeafen", "disconnect", "move"]);
const ROOM_ADMIN_ACTIONS = new Set(["create-room", "rename-room", "delete-room", "set-limit"]);

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

function hasAnyRole(userRoles, configuredRoles) {
  const allowed = parseIdList(configuredRoles).map(String);
  if (!allowed.length) return false;
  return Array.isArray(userRoles) && userRoles.map(String).some((roleId) => allowed.includes(roleId));
}

function slugify(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `sala-${Date.now().toString(36)}`;
}

function modChannelName(slug) {
  return `voice:${slug}:mod`;
}

function buildIceServers(env) {
  const servers = [{ urls: DEFAULT_STUN_URLS }];
  const turnUrls = String(env.TURN_URLS || DEFAULT_TURN_URLS)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const turnUsername = env.TURN_USERNAME || DEFAULT_TURN_USERNAME;
  const turnCredential = env.TURN_CREDENTIAL || DEFAULT_TURN_CREDENTIAL;
  if (turnUrls.length) {
    servers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
  }
  return servers;
}

async function fetchMemberRoles(userId, guildId, botToken) {
  if (!userId || !guildId || !botToken) return { isMember: false, roles: [] };

  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (response.status === 404) return { isMember: false, roles: [] };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao consultar membro no Discord: ${response.status} ${text}`);
  }

  const memberData = await response.json();
  return {
    isMember: true,
    roles: Array.isArray(memberData.roles) ? memberData.roles.map(String) : [],
  };
}

function isVoiceInstructor(userRoles, env) {
  return (
    hasAnyRole(userRoles, env.INSTRUTOR_PCERJ_ROLE_ID) ||
    hasAnyRole(userRoles, env.INSTRUTOR_PMERJ_ROLE_ID) ||
    hasAnyRole(userRoles, env.INSTRUTOR_PRF_ROLE_ID)
  );
}

function isVoiceAdmin(userId, userRoles, env) {
  const ownerIds = parseIdList(env.OWNER);
  return (
    ownerIds.includes(String(userId || "")) ||
    hasAnyRole(userRoles, env.COMANDO_GERAL) ||
    hasAnyRole(userRoles, env.VOICE_ADMIN_ROLE_IDS)
  );
}

async function resolveActingPermissions(userId, env) {
  const guildId = env.DISCORD_GUILD_ID || env.GUILD_ID;
  const { isMember, roles } = await fetchMemberRoles(userId, guildId, env.DISCORD_BOT_TOKEN);
  const isAdmin = isMember && isVoiceAdmin(userId, roles, env);
  const isInstructor = isMember && (isAdmin || isVoiceInstructor(roles, env));
  return { isMember, roles, isAdmin, isInstructor, canModerate: isInstructor };
}

function serializeRoom(room, membersBySlug) {
  const members = membersBySlug?.[room.slug] || [];
  return {
    slug: room.slug,
    name: room.name,
    memberLimit: room.memberLimit ?? null,
    createdAt: room.createdAt,
    occupants: members.length,
    members,
    locked: isRoomLocked(room),
  };
}

async function getRoomOccupancy(ably, slug) {
  try {
    const members = await fetchPresenceMembers(ably, slug);
    return members.length;
  } catch {
    return 0;
  }
}

async function isUserPresent(ably, slug, userId) {
  try {
    const members = await fetchPresenceMembers(ably, slug, { clientId: String(userId) });
    return members.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const env = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    GUILD_ID: process.env.GUILD_ID,
    OWNER: process.env.OWNER,
    COMANDO_GERAL: process.env.COMANDO_GERAL || process.env.COMANDO_GERAL_IDS,
    INSTRUTOR_PCERJ_ROLE_ID: process.env.INSTRUTOR_PCERJ_ROLE_ID,
    INSTRUTOR_PMERJ_ROLE_ID: process.env.INSTRUTOR_PMERJ_ROLE_ID,
    INSTRUTOR_PRF_ROLE_ID: process.env.INSTRUTOR_PRF_ROLE_ID,
    VOICE_ADMIN_ROLE_IDS: process.env.VOICE_ADMIN_ROLE_IDS,
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    TURN_URLS: process.env.TURN_URLS,
    TURN_USERNAME: process.env.TURN_USERNAME,
    TURN_CREDENTIAL: process.env.TURN_CREDENTIAL,
    VOICE_TOKEN_TTL_SECONDS: Number(process.env.VOICE_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS,
    VOICE_KICK_COOLDOWN_SECONDS: Number(process.env.VOICE_KICK_COOLDOWN_SECONDS) || DEFAULT_KICK_COOLDOWN_SECONDS,
  };

  const action = req.query.action;

  try {
    if (action === "config") {
      if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });
      return res.status(200).json({
        instrutorRoleIds: {
          pcerj: env.INSTRUTOR_PCERJ_ROLE_ID || "",
          pmerj: env.INSTRUTOR_PMERJ_ROLE_ID || "",
          prf: env.INSTRUTOR_PRF_ROLE_ID || "",
        },
        voiceAdminRoleIds: env.VOICE_ADMIN_ROLE_IDS || "",
        comandoGeralRoleIds: env.COMANDO_GERAL || "",
        ownerIds: env.OWNER || "",
      });
    }

    if (action === "rooms") {
      if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

      const collection = await getRoomsCollection();
      await ensureDefaultRooms(collection);
      const rooms = await collection.find({}).sort({ createdAt: 1 }).toArray();

      const membersBySlug = {};
      if (env.ABLY_API_KEY && rooms.length) {
        const ably = getAblyRest(env);
        const memberLists = await Promise.all(rooms.map((room) => getRoomPresenceMembers(ably, room.slug)));
        rooms.forEach((room, index) => {
          membersBySlug[room.slug] = memberLists[index];
        });
      }

      return res.status(200).json({ rooms: rooms.map((room) => serializeRoom(room, membersBySlug)) });
    }

    if (action === "token") {
      if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

      const { userId, roomSlug } = req.body || {};
      if (!userId || !roomSlug) {
        return res.status(400).json({ error: "userId e roomSlug são obrigatórios." });
      }

      const { isMember } = await fetchMemberRoles(userId, env.DISCORD_GUILD_ID || env.GUILD_ID, env.DISCORD_BOT_TOKEN);
      if (!isMember) {
        return res.status(403).json({ error: "Você precisa estar no servidor do Discord da corporação." });
      }

      const collection = await getRoomsCollection();
      await ensureDefaultRooms(collection);
      const room = await collection.findOne({ slug: roomSlug });
      if (!room) return res.status(404).json({ error: "Sala não encontrada." });

      const kickedUntilIso = room.kickedUntil?.[String(userId)];
      if (kickedUntilIso && new Date(kickedUntilIso).getTime() > Date.now()) {
        return res.status(423).json({ error: "Você foi desconectado desta sala recentemente. Tente novamente em instantes." });
      }

      const ably = getAblyRest(env);

      if (isRoomLocked(room)) {
        const alreadyPresent = await isUserPresent(ably, room.slug, userId);
        if (!alreadyPresent) {
          return res.status(423).json({ error: "Esta sala está temporariamente trancada para novas entradas. Fale com o instrutor responsável." });
        }
      }

      if (room.memberLimit) {
        const [occupancy, alreadyIn] = await Promise.all([
          getRoomOccupancy(ably, room.slug),
          isUserPresent(ably, room.slug, userId),
        ]);
        if (!alreadyIn && occupancy >= room.memberLimit) {
          return res.status(409).json({ error: "Sala cheia." });
        }
      }

      const tokenRequest = await ably.auth.createTokenRequest({
        clientId: String(userId),
        ttl: env.VOICE_TOKEN_TTL_SECONDS * 1000,
        capability: {
          [signalingChannelName(room.slug)]: ["subscribe", "publish", "presence"],
          [modChannelName(room.slug)]: ["subscribe"],
        },
      });

      return res.status(200).json({
        tokenRequest,
        room: serializeRoom(room, {}),
        iceServers: buildIceServers(env),
      });
    }

    if (MODERATION_ACTIONS.has(action)) {
      if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

      const { userId, targetUserId, roomSlug, toRoomSlug } = req.body || {};
      if (!userId || !targetUserId || !roomSlug) {
        return res.status(400).json({ error: "userId, targetUserId e roomSlug são obrigatórios." });
      }

      const permissions = await resolveActingPermissions(userId, env);
      if (!permissions.canModerate) {
        return res.status(403).json({ error: "Você não tem permissão para moderar chamadas." });
      }

      const collection = await getRoomsCollection();
      const room = await collection.findOne({ slug: roomSlug });
      if (!room) return res.status(404).json({ error: "Sala não encontrada." });

      const ably = getAblyRest(env);
      const payload = { type: action, target: String(targetUserId), by: String(userId), ts: Date.now() };

      if (action === "disconnect") {
        const kickedUntil = new Date(Date.now() + env.VOICE_KICK_COOLDOWN_SECONDS * 1000).toISOString();
        await collection.updateOne(
          { slug: roomSlug },
          { $set: { [`kickedUntil.${targetUserId}`]: kickedUntil, updatedAt: new Date() } },
        );
      }

      if (action === "move") {
        if (!toRoomSlug) return res.status(400).json({ error: "toRoomSlug é obrigatório." });
        const destination = await collection.findOne({ slug: toRoomSlug });
        if (!destination) return res.status(404).json({ error: "Sala de destino não encontrada." });
        payload.toRoomSlug = toRoomSlug;
      }

      await ably.channels.get(modChannelName(roomSlug)).publish(action, payload);
      return res.status(200).json({ success: true });
    }

    if (ROOM_ADMIN_ACTIONS.has(action)) {
      if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId é obrigatório." });

      const permissions = await resolveActingPermissions(userId, env);
      if (!permissions.isAdmin) {
        return res.status(403).json({ error: "Somente administradores podem gerenciar salas." });
      }

      const collection = await getRoomsCollection();
      const ably = env.ABLY_API_KEY ? getAblyRest(env) : null;
      const now = new Date();

      if (action === "create-room") {
        const { name, memberLimit } = req.body || {};
        const trimmedName = String(name || "").trim();
        if (!trimmedName) return res.status(400).json({ error: "Informe um nome para a sala." });

        let slug = slugify(trimmedName);
        if (await collection.findOne({ slug })) {
          slug = `${slug}-${Date.now().toString(36)}`;
        }

        const doc = {
          slug,
          name: trimmedName,
          memberLimit: memberLimit ? Math.max(2, Math.min(200, Number(memberLimit))) : null,
          createdBy: String(userId),
          createdAt: now,
          updatedAt: now,
          kickedUntil: {},
        };
        await collection.insertOne(doc);
        return res.status(200).json({ room: serializeRoom(doc, {}) });
      }

      if (action === "rename-room") {
        const { slug, name } = req.body || {};
        const trimmedName = String(name || "").trim();
        if (!slug || !trimmedName) return res.status(400).json({ error: "slug e name são obrigatórios." });

        const result = await collection.findOneAndUpdate(
          { slug },
          { $set: { name: trimmedName, updatedAt: now } },
          { returnDocument: "after" },
        );
        if (!result) return res.status(404).json({ error: "Sala não encontrada." });
        if (ably) await ably.channels.get(modChannelName(slug)).publish("room-renamed", { target: "*", name: trimmedName });
        return res.status(200).json({ room: serializeRoom(result, {}) });
      }

      if (action === "set-limit") {
        const { slug, memberLimit } = req.body || {};
        if (!slug) return res.status(400).json({ error: "slug é obrigatório." });

        const normalizedLimit = memberLimit ? Math.max(2, Math.min(200, Number(memberLimit))) : null;
        const result = await collection.findOneAndUpdate(
          { slug },
          { $set: { memberLimit: normalizedLimit, updatedAt: now } },
          { returnDocument: "after" },
        );
        if (!result) return res.status(404).json({ error: "Sala não encontrada." });
        if (ably) await ably.channels.get(modChannelName(slug)).publish("limit-changed", { target: "*", memberLimit: normalizedLimit });
        return res.status(200).json({ room: serializeRoom(result, {}) });
      }

      if (action === "delete-room") {
        const { slug } = req.body || {};
        if (!slug) return res.status(400).json({ error: "slug é obrigatório." });

        const result = await collection.findOneAndDelete({ slug });
        if (!result) return res.status(404).json({ error: "Sala não encontrada." });
        if (ably) await ably.channels.get(modChannelName(slug)).publish("room-deleted", { target: "*" });
        return res.status(200).json({ success: true });
      }
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    console.error("Erro em /api/voice:", error);
    return res.status(500).json({ error: error.message || "Falha no sistema de chamadas." });
  }
}
