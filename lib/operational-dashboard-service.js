import { getMongoDatabase } from "./mongodb.js";

// Ajuste estes grupos de palavras-chave se o schema real do seu MongoDB
// usar nomes de coleções ou campos muito diferentes dos termos abaixo.
// A integração permanece 100% em leitura: nenhuma operação de escrita é usada.
const COLLECTION_KEYWORDS = {
  arrests: ["pris", "prisa", "prisao", "prisoes", "prisões", "arrest", "detenc", "detenção", "detencao"],
  patrol: ["patrul", "patrol", "ronda", "turno", "servico", "serviço"],
  actions: ["abord", "apreen", "operac", "operação", "operacao", "atividade", "acao", "ação", "blitz"],
};

const FIELD_KEYWORDS = {
  arrest: ["pris", "prisao", "prisoes", "prisões", "arrest", "detenc", "detenção", "detencao"],
  officer: ["policial", "agente", "autor", "responsavel", "responsável", "servidor", "nome", "usuario", "user", "member", "owner"],
  date: ["data", "date", "created", "createdat", "created_at", "timestamp", "horario", "hora", "inicio", "start", "registrado"],
  patrolHours: ["horas", "hora", "hours", "duracao", "duração", "tempo", "totalhoras", "tempo_patrulhado"],
  activityType: ["tipo", "categoria", "natureza", "acao", "ação", "atividade", "event"],
  quantity: ["quantidade", "qtd", "count", "total", "numero", "número", "amount"],
  description: ["descricao", "descrição", "relato", "observacao", "observação", "resumo", "details"],
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function keywordScore(text, keywords) {
  const normalized = normalize(text);
  return keywords.reduce((score, keyword) => {
    return score + (normalized.includes(normalize(keyword)) ? 1 : 0);
  }, 0);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function flattenDocument(document, prefix = "", output = []) {
  if (!isPlainObject(document)) return output;

  for (const [key, value] of Object.entries(document)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      output.push({ path, type: "array", value });
      if (value.length && isPlainObject(value[0])) {
        flattenDocument(value[0], path, output);
      }
      continue;
    }

    if (isPlainObject(value)) {
      output.push({ path, type: "object", value });
      flattenDocument(value, path, output);
      continue;
    }

    output.push({ path, type: inferValueType(value), value });
  }

  return output;
}

function inferValueType(value) {
  if (value instanceof Date) return "date";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (value === null || value === undefined) return "null";
  return typeof value;
}

function pathToExpression(path) {
  return `$${path}`;
}

function chooseField(fields, keywords, allowedTypes = []) {
  const ranked = fields
    .map((field) => ({
      ...field,
      score: keywordScore(field.path, keywords),
    }))
    .filter((field) => field.score > 0)
    .filter((field) => !allowedTypes.length || allowedTypes.includes(field.type));

  ranked.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, "pt-BR"));
  return ranked[0] || null;
}

function summarizeFields(fields) {
  return fields.slice(0, 20).map((field) => ({
    path: field.path,
    type: field.type,
  }));
}

async function sampleCollection(collection, size = 8) {
  try {
    return await collection.aggregate([{ $sample: { size } }]).toArray();
  } catch {
    return await collection.find({}).limit(size).toArray();
  }
}

async function discoverCollection(db, collectionInfo) {
  const collection = db.collection(collectionInfo.name);
  const samples = await sampleCollection(collection, 8);
  const flattenedFields = samples.flatMap((sample) => flattenDocument(sample));

  const collectionName = collectionInfo.name;
  const nameScores = {
    arrests: keywordScore(collectionName, COLLECTION_KEYWORDS.arrests),
    patrol: keywordScore(collectionName, COLLECTION_KEYWORDS.patrol),
    actions: keywordScore(collectionName, COLLECTION_KEYWORDS.actions),
  };

  const metrics = {
    arrestScore:
      nameScores.arrests +
      keywordScore(flattenedFields.map((field) => field.path).join(" "), FIELD_KEYWORDS.arrest),
    patrolScore:
      nameScores.patrol +
      keywordScore(flattenedFields.map((field) => field.path).join(" "), FIELD_KEYWORDS.patrolHours),
    actionScore:
      nameScores.actions +
      keywordScore(flattenedFields.map((field) => field.path).join(" "), FIELD_KEYWORDS.activityType),
  };

  return {
    name: collectionName,
    estimatedDocumentCount: await collection.estimatedDocumentCount(),
    fields: summarizeFields(flattenedFields),
    inferred: {
      officerField: chooseField(flattenedFields, FIELD_KEYWORDS.officer, ["string"])?.path || "",
      dateField:
        chooseField(flattenedFields, FIELD_KEYWORDS.date, ["date"])?.path ||
        chooseField(flattenedFields, FIELD_KEYWORDS.date, ["string"])?.path ||
        "",
      patrolHoursField: chooseField(flattenedFields, FIELD_KEYWORDS.patrolHours, ["number"])?.path || "",
      quantityField: chooseField(flattenedFields, FIELD_KEYWORDS.quantity, ["number"])?.path || "",
      activityTypeField: chooseField(flattenedFields, FIELD_KEYWORDS.activityType, ["string"])?.path || "",
      descriptionField: chooseField(flattenedFields, FIELD_KEYWORDS.description, ["string"])?.path || "",
    },
    metrics,
  };
}

function pickBestSource(collections, key, minScore = 1) {
  const scoreMap = {
    arrests: "arrestScore",
    patrol: "patrolScore",
    actions: "actionScore",
  };

  const scoreKey = scoreMap[key];
  const ranked = collections
    .filter((collection) => collection.metrics?.[scoreKey] >= minScore)
    .sort(
      (a, b) =>
        (b.metrics?.[scoreKey] || 0) - (a.metrics?.[scoreKey] || 0) ||
        (b.estimatedDocumentCount || 0) - (a.estimatedDocumentCount || 0),
    );

  return ranked[0] || null;
}

function buildOfficerProjection(officerField, fallbackLabel) {
  if (!officerField) {
    return {
      officer: fallbackLabel || "Não identificado",
    };
  }

  return {
    officer: {
      $ifNull: [pathToExpression(officerField), fallbackLabel || "Não identificado"],
    },
  };
}

function buildDateValue(dateField) {
  if (!dateField) return null;

  return {
    $convert: {
      input: pathToExpression(dateField),
      to: "date",
      onError: null,
      onNull: null,
    },
  };
}

async function getArrestMetrics(db, source) {
  if (!source) {
    return {
      total: null,
      ranking: [],
      latest: [],
      summaryByDay: [],
      sourceCollection: null,
      available: false,
    };
  }

  const collection = db.collection(source.name);
  const officerField = source.inferred.officerField;
  const dateField = source.inferred.dateField;

  const total = await collection.countDocuments({});

  const ranking = officerField
    ? await collection
        .aggregate([
          {
            $project: buildOfficerProjection(officerField, "Não identificado"),
          },
          {
            $group: {
              _id: "$officer",
              total: { $sum: 1 },
            },
          },
          { $sort: { total: -1, _id: 1 } },
          { $limit: 10 },
          {
            $project: {
              _id: 0,
              officer: "$_id",
              total: 1,
            },
          },
        ])
        .toArray()
    : [];

  const latestPipeline = [];
  const convertedDate = buildDateValue(dateField);

  latestPipeline.push({
    $project: {
      officer: officerField ? { $ifNull: [pathToExpression(officerField), "Não identificado"] } : "Não identificado",
      description: source.inferred.descriptionField
        ? { $ifNull: [pathToExpression(source.inferred.descriptionField), "Atividade operacional"] }
        : "Atividade operacional",
      activityType: source.inferred.activityTypeField
        ? { $ifNull: [pathToExpression(source.inferred.activityTypeField), "Prisão"] }
        : "Prisão",
      eventDate: convertedDate,
    },
  });

  if (convertedDate) {
    latestPipeline.push({ $sort: { eventDate: -1 } });
  }

  latestPipeline.push({ $limit: 8 });

  const latest = await collection.aggregate(latestPipeline).toArray();

  const summaryByDay =
    convertedDate
      ? await collection
          .aggregate([
            {
              $project: {
                eventDate: convertedDate,
              },
            },
            {
              $match: {
                eventDate: { $ne: null },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%d/%m/%Y",
                    date: "$eventDate",
                  },
                },
                total: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
            { $limit: 7 },
            {
              $project: {
                _id: 0,
                period: "$_id",
                total: 1,
              },
            },
          ])
          .toArray()
      : [];

  return {
    total,
    ranking,
    latest,
    summaryByDay: summaryByDay.reverse(),
    sourceCollection: source.name,
    available: true,
  };
}

async function getPatrolMetrics(db, source) {
  if (!source || !source.inferred.patrolHoursField) {
    return {
      totalHours: null,
      ranking: [],
      latest: [],
      sourceCollection: source?.name || null,
      available: false,
    };
  }

  const collection = db.collection(source.name);
  const officerField = source.inferred.officerField;
  const hoursField = source.inferred.patrolHoursField;
  const dateField = source.inferred.dateField;
  const convertedDate = buildDateValue(dateField);

  const totals = await collection
    .aggregate([
      {
        $project: {
          hours: {
            $convert: {
              input: pathToExpression(hoursField),
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          ...(officerField ? buildOfficerProjection(officerField, "Não identificado") : { officer: "Não identificado" }),
          ...(convertedDate ? { eventDate: convertedDate } : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: "$hours" },
        },
      },
    ])
    .toArray();

  const ranking = await collection
    .aggregate([
      {
        $project: {
          hours: {
            $convert: {
              input: pathToExpression(hoursField),
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          ...(officerField ? buildOfficerProjection(officerField, "Não identificado") : { officer: "Não identificado" }),
        },
      },
      {
        $group: {
          _id: "$officer",
          totalHours: { $sum: "$hours" },
        },
      },
      { $sort: { totalHours: -1, _id: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          officer: "$_id",
          totalHours: { $round: ["$totalHours", 2] },
        },
      },
    ])
    .toArray();

  const latestPipeline = [
    {
      $project: {
        officer: officerField ? { $ifNull: [pathToExpression(officerField), "Não identificado"] } : "Não identificado",
        hours: {
          $convert: {
            input: pathToExpression(hoursField),
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        ...(convertedDate ? { eventDate: convertedDate } : {}),
      },
    },
  ];

  if (convertedDate) {
    latestPipeline.push({ $sort: { eventDate: -1 } });
  } else {
    latestPipeline.push({ $sort: { hours: -1 } });
  }

  latestPipeline.push({ $limit: 8 });
  const latest = await collection.aggregate(latestPipeline).toArray();

  return {
    totalHours: totals[0]?.totalHours ? Number(totals[0].totalHours.toFixed(2)) : 0,
    ranking,
    latest,
    sourceCollection: source.name,
    available: true,
  };
}

async function getActionMetrics(db, source) {
  if (!source) {
    return {
      total: null,
      distinctTypes: [],
      ranking: [],
      latest: [],
      sourceCollection: null,
      available: false,
    };
  }

  const collection = db.collection(source.name);
  const officerField = source.inferred.officerField;
  const typeField = source.inferred.activityTypeField;
  const quantityField = source.inferred.quantityField;
  const dateField = source.inferred.dateField;
  const convertedDate = buildDateValue(dateField);
  const valueExpression = quantityField
    ? {
        $convert: {
          input: pathToExpression(quantityField),
          to: "double",
          onError: 1,
          onNull: 1,
        },
      }
    : 1;

  const totals = await collection
    .aggregate([
      {
        $project: {
          metricValue: valueExpression,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$metricValue" },
        },
      },
    ])
    .toArray();

  const ranking = officerField
    ? await collection
        .aggregate([
          {
            $project: {
              ...(buildOfficerProjection(officerField, "Não identificado")),
              metricValue: valueExpression,
            },
          },
          {
            $group: {
              _id: "$officer",
              total: { $sum: "$metricValue" },
            },
          },
          { $sort: { total: -1, _id: 1 } },
          { $limit: 10 },
          {
            $project: {
              _id: 0,
              officer: "$_id",
              total: { $round: ["$total", 2] },
            },
          },
        ])
        .toArray()
    : [];

  const distinctTypes = typeField ? await collection.distinct(typeField) : [];

  const latestPipeline = [
    {
      $project: {
        officer: officerField ? { $ifNull: [pathToExpression(officerField), "Não identificado"] } : "Não identificado",
        activityType: typeField ? { $ifNull: [pathToExpression(typeField), "Ação operacional"] } : "Ação operacional",
        metricValue: valueExpression,
        description: source.inferred.descriptionField
          ? { $ifNull: [pathToExpression(source.inferred.descriptionField), "Registro operacional"] }
          : "Registro operacional",
        ...(convertedDate ? { eventDate: convertedDate } : {}),
      },
    },
  ];

  if (convertedDate) {
    latestPipeline.push({ $sort: { eventDate: -1 } });
  }

  latestPipeline.push({ $limit: 8 });

  const latest = await collection.aggregate(latestPipeline).toArray();

  return {
    total: totals[0]?.total ? Number(totals[0].total.toFixed?.(2) || totals[0].total) : 0,
    distinctTypes: distinctTypes.filter(Boolean).slice(0, 10),
    ranking,
    latest,
    sourceCollection: source.name,
    available: true,
  };
}

export async function getOperationalDashboardData() {
  const db = await getMongoDatabase();
  const collectionsInfo = await db.listCollections({}, { nameOnly: true }).toArray();
  const discoveredCollections = [];

  for (const collectionInfo of collectionsInfo) {
    try {
      discoveredCollections.push(await discoverCollection(db, collectionInfo));
    } catch (error) {
      discoveredCollections.push({
        name: collectionInfo.name,
        estimatedDocumentCount: null,
        fields: [],
        inferred: {},
        metrics: { arrestScore: 0, patrolScore: 0, actionScore: 0 },
        error: error.message,
      });
    }
  }

  const arrestsSource = pickBestSource(discoveredCollections, "arrests");
  const patrolSource = pickBestSource(discoveredCollections, "patrol");
  const actionsSource = pickBestSource(discoveredCollections, "actions");

  const [arrests, patrol, actions] = await Promise.all([
    getArrestMetrics(db, arrestsSource),
    getPatrolMetrics(db, patrolSource),
    getActionMetrics(db, actionsSource),
  ]);

  const latestActivities = [
    ...(arrests.latest || []).map((item) => ({
      ...item,
      source: "prisões",
    })),
    ...(patrol.latest || []).map((item) => ({
      ...item,
      source: "patrulhamento",
    })),
    ...(actions.latest || []).map((item) => ({
      ...item,
      source: "ações",
    })),
  ]
    .sort((a, b) => {
      const aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 12);

  const warnings = [];
  if (!arrests.available) warnings.push("Não foi possível identificar automaticamente uma coleção confiável de prisões.");
  if (!patrol.available) warnings.push("Não foi possível identificar automaticamente horas patrulhadas no schema atual.");
  if (!actions.available) warnings.push("Não foi possível identificar automaticamente abordagens/apreensões ou outras ações.");

  return {
    generatedAt: new Date().toISOString(),
    databaseName: db.databaseName,
    collections: discoveredCollections,
    sources: {
      arrests: arrestsSource?.name || null,
      patrol: patrolSource?.name || null,
      actions: actionsSource?.name || null,
    },
    metrics: {
      totalArrests: arrests.total,
      topArrestOfficers: arrests.ranking,
      totalPatrolHours: patrol.totalHours,
      topPatrolOfficers: patrol.ranking,
      totalActions: actions.total,
      topActionOfficers: actions.ranking,
      actionTypes: actions.distinctTypes,
      latestActivities,
      periodSummary: arrests.summaryByDay || [],
    },
    warnings,
  };
}
