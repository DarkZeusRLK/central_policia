import { getMongoDatabase } from "./mongodb.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const arrestsCountCache = globalThis.__revoadaArrestsCountCache || new Map();
globalThis.__revoadaArrestsCountCache = arrestsCountCache;

// Schema Mongo em leitura:
// 1. Estatísticas policiais por usuário:
//    { discordId, nome, blitz, fiancas, prisoes, bancoDados, operacoesCat, acoesMarcadas }
// 2. Contagem de recrutamentos:
//    { userId, recrutamentos }
//
// Regras do painel:
// - Total de prisões = quantidade de registros/mensagens no canal de prisões do Discord.
// - Ranking de prisões = campo "prisoes" consolidado na base Mongo em modo leitura.
// - Recrutamentos = base Mongo em modo leitura.
// - Demais métricas seguem vindo do MongoDB em modo somente leitura.

function parseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
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

async function detectPoliceStatsCollection(db) {
  if (process.env.MONGODB_COLLECTION_POLICE_STATS) {
    return db.collection(process.env.MONGODB_COLLECTION_POLICE_STATS);
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();

  for (const info of collections) {
    const collection = db.collection(info.name);
    const sample = await collection.findOne(
      {
        discordId: { $exists: true },
        nome: { $exists: true },
        blitz: { $exists: true },
        acoesMarcadas: { $exists: true },
      },
      {
        projection: {
          discordId: 1,
          nome: 1,
          blitz: 1,
          fiancas: 1,
          prisoes: 1,
          bancoDados: 1,
          operacoesCat: 1,
          acoesMarcadas: 1,
        },
      },
    );

    if (sample) {
      return collection;
    }
  }

  return null;
}

async function detectRecruitmentsCollection(db) {
  if (process.env.MONGODB_COLLECTION_RECRUITMENTS) {
    return db.collection(process.env.MONGODB_COLLECTION_RECRUITMENTS);
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();

  for (const info of collections) {
    const collection = db.collection(info.name);
    const sample = await collection.findOne(
      {
        userId: { $exists: true },
        recrutamentos: { $exists: true },
      },
      {
        projection: {
          userId: 1,
          recrutamentos: 1,
        },
      },
    );

    if (sample) {
      return collection;
    }
  }

  return null;
}

async function getPoliceStatsMetrics(collection) {
  if (!collection) {
    return {
      available: false,
      sourceCollection: null,
      totals: {
        prisoes: null,
        blitz: null,
        acoesMarcadas: null,
        operacoesCat: null,
        fiancas: null,
        bancoDados: null,
      },
      rankings: {
        prisoes: [],
        blitz: [],
        acoesMarcadas: [],
        operacoesCat: [],
      },
      officersCount: 0,
    };
  }

  const totalsRaw =
    (await collection
      .aggregate([
        {
          $project: {
            prisoes: { $toDouble: { $ifNull: ["$prisoes", 0] } },
            blitz: { $toDouble: { $ifNull: ["$blitz", 0] } },
            acoesMarcadas: { $toDouble: { $ifNull: ["$acoesMarcadas", 0] } },
            operacoesCat: { $toDouble: { $ifNull: ["$operacoesCat", 0] } },
            fiancas: { $toDouble: { $ifNull: ["$fiancas", 0] } },
            bancoDados: { $toDouble: { $ifNull: ["$bancoDados", 0] } },
          },
        },
        {
          $group: {
            _id: null,
            prisoes: { $sum: "$prisoes" },
            blitz: { $sum: "$blitz" },
            acoesMarcadas: { $sum: "$acoesMarcadas" },
            operacoesCat: { $sum: "$operacoesCat" },
            fiancas: { $sum: "$fiancas" },
            bancoDados: { $sum: "$bancoDados" },
          },
        },
      ])
      .toArray())[0] || {};

  const buildRanking = async (field) =>
    collection
      .aggregate([
        {
          $project: {
            officer: { $ifNull: ["$nome", "$discordId"] },
            value: { $toDouble: { $ifNull: [`$${field}`, 0] } },
            discordId: { $ifNull: ["$discordId", ""] },
          },
        },
        { $match: { value: { $gt: 0 } } },
        { $sort: { value: -1, officer: 1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            officer: 1,
            value: 1,
            discordId: 1,
          },
        },
      ])
      .toArray();

  const [rankingPrisoes, rankingBlitz, rankingAcoesMarcadas, rankingOperacoesCat, officersCount] =
    await Promise.all([
      buildRanking("prisoes"),
      buildRanking("blitz"),
      buildRanking("acoesMarcadas"),
      buildRanking("operacoesCat"),
      collection.countDocuments({}),
    ]);

  return {
    available: true,
    sourceCollection: collection.collectionName,
    totals: {
      prisoes: parseNumber(totalsRaw.prisoes),
      blitz: parseNumber(totalsRaw.blitz),
      acoesMarcadas: parseNumber(totalsRaw.acoesMarcadas),
      operacoesCat: parseNumber(totalsRaw.operacoesCat),
      fiancas: parseNumber(totalsRaw.fiancas),
      bancoDados: parseNumber(totalsRaw.bancoDados),
    },
    rankings: {
      prisoes: rankingPrisoes,
      blitz: rankingBlitz,
      acoesMarcadas: rankingAcoesMarcadas,
      operacoesCat: rankingOperacoesCat,
    },
    officersCount,
  };
}

async function getRecruitmentMetrics(collection) {
  if (!collection) {
    return {
      available: false,
      sourceCollection: null,
      total: null,
      ranking: [],
      documentsCount: 0,
    };
  }

  const totalRaw =
    (await collection
      .aggregate([
        {
          $project: {
            recrutamentos: { $toDouble: { $ifNull: ["$recrutamentos", 0] } },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$recrutamentos" },
          },
        },
      ])
      .toArray())[0] || {};

  const ranking = await collection
    .aggregate([
      {
        $project: {
          officer: { $ifNull: ["$userId", "Não identificado"] },
          value: { $toDouble: { $ifNull: ["$recrutamentos", 0] } },
        },
      },
      { $match: { value: { $gt: 0 } } },
      { $sort: { value: -1, officer: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          officer: 1,
          value: 1,
        },
      },
    ])
    .toArray();

  const documentsCount = await collection.countDocuments({});

  return {
    available: true,
    sourceCollection: collection.collectionName,
    total: parseNumber(totalRaw.total),
    ranking,
    documentsCount,
  };
}

async function countChannelMessages(channelId, botToken, maxPages = 100) {
  if (!channelId || !botToken) return 0;

  const cacheKey = `${channelId}`;
  const cached = arrestsCountCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 120000) {
    return cached.total;
  }

  let total = 0;
  let beforeId = "";
  let page = 0;

  while (page < maxPages) {
    const query = new URLSearchParams({ limit: "100" });
    if (beforeId) query.set("before", beforeId);

    const messages = await fetchDiscordJson(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?${query.toString()}`,
      botToken,
    );

    if (!Array.isArray(messages) || !messages.length) {
      break;
    }

    total += messages.length;
    beforeId = messages[messages.length - 1].id;
    page += 1;

    if (messages.length < 100) {
      break;
    }
  }

  arrestsCountCache.set(cacheKey, {
    total,
    createdAt: Date.now(),
  });

  return total;
}

async function getArrestMetricsFromDiscord() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const arrestsChannelId = process.env.PRISOES_CH_ID;

  if (!botToken || !arrestsChannelId) {
    return {
      available: false,
      sourceChannelId: arrestsChannelId || null,
      totalArrests: null,
    };
  }

  const totalArrests = await countChannelMessages(arrestsChannelId, botToken, 100);

  return {
    available: true,
    sourceChannelId: arrestsChannelId,
    totalArrests,
  };
}

export async function getOperationalDashboardData() {
  const db = await getMongoDatabase();
  const [policeStatsCollection, recruitmentsCollection] = await Promise.all([
    detectPoliceStatsCollection(db),
    detectRecruitmentsCollection(db),
  ]);

  const [policeStats, recruitments, arrestMetrics] = await Promise.all([
    getPoliceStatsMetrics(policeStatsCollection),
    getRecruitmentMetrics(recruitmentsCollection),
    getArrestMetricsFromDiscord(),
  ]);

  const warnings = [];
  if (!policeStats.available) {
    warnings.push(
      "A base de estatísticas policiais não foi encontrada automaticamente. Ajuste MONGODB_COLLECTION_POLICE_STATS se necessário.",
    );
  }
  if (!recruitments.available) {
    warnings.push(
      "A base de recrutamentos não foi encontrada automaticamente. Ajuste MONGODB_COLLECTION_RECRUITMENTS se necessário.",
    );
  }
  if (!arrestMetrics.available) {
    warnings.push(
      "O canal de prisões não pôde ser lido. Verifique PRISOES_CH_ID e as permissões de leitura do bot no Discord.",
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseName: db.databaseName,
    sources: {
      policeStats: policeStats.sourceCollection,
      recruitments: recruitments.sourceCollection,
      arrestsChannelId: arrestMetrics.sourceChannelId,
    },
    metrics: {
      totalArrests: arrestMetrics.totalArrests,
      totalBlitz: policeStats.totals.blitz,
      totalMarkedActions: policeStats.totals.acoesMarcadas,
      totalCatOperations: policeStats.totals.operacoesCat,
      totalBail: policeStats.totals.fiancas,
      totalDatabaseActions: policeStats.totals.bancoDados,
      totalRecruitments: recruitments.total,
      totalTrackedOfficers: policeStats.officersCount,
      topArrestOfficers: policeStats.rankings.prisoes,
      topBlitzOfficers: policeStats.rankings.blitz,
      topMarkedActionOfficers: policeStats.rankings.acoesMarcadas,
      topCatOperationOfficers: policeStats.rankings.operacoesCat,
      topRecruitmentOfficers: recruitments.ranking,
    },
    collections: [
      policeStats.available
        ? {
            name: policeStats.sourceCollection,
            type: "Estatísticas policiais",
            fields: [
              "discordId",
              "nome",
              "blitz",
              "fiancas",
              "prisoes",
              "bancoDados",
              "operacoesCat",
              "acoesMarcadas",
            ],
          }
        : null,
      recruitments.available
        ? {
            name: recruitments.sourceCollection,
            type: "Contagem de recrutamentos",
            fields: ["userId", "recrutamentos"],
          }
        : null,
    ].filter(Boolean),
    warnings,
  };
}
