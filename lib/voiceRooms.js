import Ably from "ably";
import { getMongoDatabase } from "./mongodb.js";

// Compartilhado entre api/voice.js (as salas de chamada em si) e api/course-manager.js
// (leitura de presença para preencher relatórios de curso automaticamente).

const DEFAULT_ROOM_COUNT = 5;
const DEFAULT_MEMBER_LIMIT = 20;

export async function getRoomsCollection() {
  const db = await getMongoDatabase();
  return db.collection("voiceRooms");
}

export async function ensureDefaultRooms(collection) {
  const count = await collection.countDocuments({});
  if (count > 0) return;

  const now = new Date();
  const docs = Array.from({ length: DEFAULT_ROOM_COUNT }, (_, index) => ({
    slug: `sala-${index + 1}`,
    name: `Sala de Curso ${index + 1}`,
    memberLimit: DEFAULT_MEMBER_LIMIT,
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    kickedUntil: {},
    lockedUntil: null,
  }));

  try {
    await collection.insertMany(docs, { ordered: false });
  } catch (error) {
    // Duas invocações podem tentar semear ao mesmo tempo; ignora só o erro de chave duplicada.
    if (error?.code !== 11000) throw error;
  }
}

export function isRoomLocked(room) {
  const until = room?.lockedUntil ? new Date(room.lockedUntil) : null;
  return Boolean(until && !Number.isNaN(until.getTime()) && until.getTime() > Date.now());
}

export function getAblyRest(env) {
  if (!env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY não configurada no servidor.");
  }
  return new Ably.Rest({ key: env.ABLY_API_KEY });
}

export function signalingChannelName(slug) {
  return `voice:${slug}:signaling`;
}

// O cliente REST (usado só no servidor) devolve um PaginatedResult (com `.items`), diferente do
// cliente Realtime do navegador, que devolve o array direto.
export async function fetchPresenceMembers(ably, slug, params) {
  const channel = ably.channels.get(signalingChannelName(slug));
  const result = await channel.presence.get(params);
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.items)) return result.items;
  return [];
}

// Consultado com a chave completa do Ably (não a do navegador do usuário), então funciona mesmo
// pra salas em que quem está consultando não está presente.
export async function getRoomPresenceMembers(ably, slug) {
  try {
    const members = await fetchPresenceMembers(ably, slug);
    return members.map((member) => ({
      id: String(member.clientId),
      displayName: member.data?.displayName || "Policial",
      avatarUrl: member.data?.avatarUrl || "",
      factionLabel: member.data?.factionLabel || "",
      micMuted: Boolean(member.data?.micMuted),
      deafened: Boolean(member.data?.deafened),
      presenting: Boolean(member.data?.presenting),
      isModerator: Boolean(member.data?.isModerator),
    }));
  } catch {
    return [];
  }
}
