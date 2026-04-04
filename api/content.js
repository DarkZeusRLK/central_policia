const DISCORD_API_BASE = "https://discord.com/api/v10";

function formatBrDate(dateStr) {
  return dateStr ? dateStr.split("-").reverse().join("/") : "N/A";
}

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function required(value) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value || "").trim().length > 0;
}

function asLineList(values) {
  if (!Array.isArray(values) || !values.length) return "N/A";
  return values.join(", ");
}

async function sendDiscordMessage(channelId, botToken, payload) {
  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord recusou a mensagem: ${text}`);
  }

  return response;
}

function buildPericiaTemplate(data) {
  const qra = asLineList(data.qra_participantes);
  const tipo = data.tipo_pericia;

  if (tipo === "caminhao") {
    return `----PERÍCIA VEICULO CAMINHÃO----
QRA: ${qra}
MODELO: ${data.modelo || "N/A"}
PLACA: ${data.placa || "N/A"}
PROPRIETÁRIO: ${data.proprietario || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ID DE QUEM TROUXE: ${data.id_referencia || "N/A"}
OCORRIDO: ${data.ocorrido || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "veiculo") {
    return `---- PERÍCIA VEICULO ----
QRA: ${qra}
MODELO: ${data.modelo || "N/A"}
PLACA: ${data.placa || "N/A"}
PROPRIETÁRIO: ${data.proprietario || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ID DO DENUNCIANTE (Caso o veículo tenha sido entregue por terceiros): ${data.id_referencia || "N/A"}
OCORRIDO: ${data.ocorrido || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "corpo") {
    return `----- PERICIA DE CORPO ----
QRA: ${qra}
NOME: ${data.nome || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "facorg") {
    return `----- PESSOAS ARMADAS DENTRO DE FAC/ORG ----
QRA: ${qra}
FAC/ORG: ${data.fac_org || data.nome_fac || "N/A"}
PROVAS: ${data.provas || "N/A"}`;
  }

  throw new Error("Tipo de perícia inválido.");
}

function validatePericiaPayload(data) {
  if (!required(data.qra_participantes)) {
    return "Selecione pelo menos um policial no QRA.";
  }

  const validators = {
    caminhao: [
      "modelo",
      "placa",
      "proprietario",
      "rg_passaporte_vitima",
      "id_referencia",
      "ocorrido",
      "itens_encontrados",
      "regiao",
    ],
    veiculo: [
      "modelo",
      "placa",
      "proprietario",
      "rg_passaporte_vitima",
      "id_referencia",
      "ocorrido",
      "itens_encontrados",
      "regiao",
    ],
    corpo: ["nome", "rg_passaporte_vitima", "itens_encontrados", "regiao"],
    facorg: ["fac_org", "provas"],
  };

  const requiredFields = validators[data.tipo_pericia];
  if (!requiredFields) return "Tipo de perícia inválido.";

  const missingFields = requiredFields.filter((field) => !required(data[field]));
  if (missingFields.length) {
    return `Campos obrigatórios ausentes: ${missingFields.join(", ")}.`;
  }

  return "";
}

async function handleGetNews(res, env) {
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID } = env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID) {
    return res.status(500).json({ error: "Configuração faltando" });
  }

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${JORNAL_CH_ID}/messages?limit=10`,
    {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    },
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar notícias");
  }

  const messages = await response.json();
  const newsData = messages
    .map((msg) => {
      const content = msg.content;
      if (!content.includes("# 📰")) return null;

      const titleMatch = content.match(/# 📰 (.*)/);
      const title = titleMatch ? titleMatch[1] : "Manchete Policial";

      const authorMatch = content.match(/> ✍️.*?Reportagem por:.*?<@(\d+)>/);
      let author = "Redação";

      if (authorMatch) {
        const mentioned = msg.mentions.find((u) => u.id === authorMatch[1]);
        author = mentioned
          ? mentioned.global_name || mentioned.username
          : "Repórter";
      }

      let image = "https://via.placeholder.com/400x200?text=Sem+Imagem";
      if (msg.attachments && msg.attachments.length > 0) {
        image = msg.attachments[0].url;
      } else if (msg.embeds && msg.embeds.length > 0 && msg.embeds[0].image) {
        image = msg.embeds[0].image.url;
      } else if (msg.embeds && msg.embeds.length > 0 && msg.embeds[0].thumbnail) {
        image = msg.embeds[0].thumbnail.url;
      } else {
        const urls = content.match(/https?:\/\/\S+/g);
        if (urls && urls.length > 0) {
          const lastUrl = urls[urls.length - 1];
          if (!lastUrl.includes("discordapp")) {
            image = lastUrl;
          }
        }
      }

      const cleanBody = content
        .replace(/<@&\d+>/g, "")
        .replace(/<@\d+>/g, "")
        .replace(/# 📰 .*\n?/g, "")
        .replace(/> ✍️.*\n?/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\n\n+/g, "\n")
        .trim();

      return {
        id: msg.id,
        title,
        summary: cleanBody,
        image,
        date: new Date(msg.timestamp).toLocaleDateString("pt-BR"),
        author,
      };
    })
    .filter(Boolean);

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
  return res.status(200).json(newsData);
}

async function handlePublishNews(req, res, env) {
  const { title, content, imageUrl, userId, fontFamily } = req.body || {};
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID, MATRIZES_ROLE_ID } = env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID || !MATRIZES_ROLE_ID) {
    return res.status(500).json({ error: "Configuração incompleta (.env)." });
  }

  const rolesToMention = parseIdList(MATRIZES_ROLE_ID)
    .map((id) => `<@&${id}>`)
    .join(" ");

  let formattedContent = content;
  if (fontFamily === "bold") formattedContent = `**${content}**`;
  else if (fontFamily === "italic") formattedContent = `*${content}*`;
  else if (fontFamily === "bold-italic") formattedContent = `***${content}***`;
  else if (fontFamily === "code") formattedContent = `\`\`\`\n${content}\n\`\`\``;

  const policialUserId = "&1447056982371602526";
  const messageContent = `
${rolesToMention}
<@${policialUserId}>

# 📰 ${String(title || "").toUpperCase()}

${formattedContent || ""}

> ✍️ *Reportagem por:* <@${userId}>

${imageUrl || ""}
  `.trim();

  await sendDiscordMessage(JORNAL_CH_ID, DISCORD_BOT_TOKEN, {
    content: messageContent,
  });

  return res.status(200).json({ success: true });
}

async function handleStats(res, env) {
  const { DISCORD_BOT_TOKEN, PRISOES_CH_ID, FIANCAS_CH_ID } = env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot Token não configurado" });
  }

  async function fetchMessagesFromChannel(channelId) {
    let allMessages = [];
    let lastId = null;
    let keepFetching = true;
    let loops = 0;

    while (keepFetching && loops < 5) {
      let url = `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=100`;
      if (lastId) url += `&before=${lastId}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });

      if (!response.ok) break;
      const messages = await response.json();
      if (messages.length === 0) break;

      allMessages = allMessages.concat(messages);
      lastId = messages[messages.length - 1].id;
      loops += 1;
    }

    return allMessages;
  }

  async function countMessagesFromToday(channelId) {
    if (!channelId) return 0;
    const messages = await fetchMessagesFromChannel(channelId);

    const now = new Date();
    const brazilDateString = now.toLocaleDateString("en-US", {
      timeZone: "America/Sao_Paulo",
    });
    const todayBrazil = new Date(brazilDateString);
    todayBrazil.setHours(0, 0, 0, 0);

    return messages.filter((msg) => new Date(msg.timestamp).getTime() >= todayBrazil.getTime()).length;
  }

  const [totalPrisoes, totalFiancas] = await Promise.all([
    countMessagesFromToday(PRISOES_CH_ID),
    countMessagesFromToday(FIANCAS_CH_ID),
  ]);

  return res.status(200).json({
    prisoes: totalPrisoes,
    fiancas: totalFiancas,
    total: totalPrisoes + totalFiancas,
    status: "online",
  });
}

async function handleSubmitBo(req, res, env) {
  const {
    nome,
    passaporte,
    telefone,
    profissao,
    sexo,
    ocorrencia,
    itens,
    local,
    horario,
    video_link,
    userId,
    username,
  } = req.body || {};

  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return res.status(500).json({ error: "Erro no Servidor: Bot não configurado." });
  }

  const anoAtual = new Date().getFullYear();
  const protocolo = Math.floor(1000 + Math.random() * 9000);
  const boNumero = `${anoAtual}-${protocolo}`;

  const dataObj = new Date(horario);
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const relatorio = `
\`\`\`md
# BOLETIM DE OCORRÊNCIA Nº ${boNumero}
DATA DO FATO: ${dataFormatada}
LOCAL DO FATO: ${local}

# VÍTIMA / COMUNICANTE
NOME: ${nome}
PASSAPORTE: ${passaporte}
TELEFONE: ${telefone}
PROFISSÃO: ${profissao || "Não Informado"}
SEXO: ${sexo || "Não Informado"}

# RELATO INDIVIDUAL
${ocorrencia}

# BENS / OBJETOS
${itens || "Nenhum bem declarado."}

# EVIDÊNCIA
${video_link || "N/A"}
\`\`\``;

  const contentMessage = `👮 **Novo registro enviado por:** <@${userId}> (${username})\n${relatorio}`;
  await sendDiscordMessage(DISCORD_CHANNEL_ID_BO, DISCORD_BOT_TOKEN, {
    content: contentMessage,
  });

  return res.status(200).json({ success: true });
}

async function handleSubmitPericia(req, res, env) {
  const botToken = env.DISCORD_BOT_TOKEN;
  const channelId = env.PERICIA_CHANNEL_ID;

  if (!botToken || !channelId) {
    return res.status(500).json({
      error: "Defina DISCORD_BOT_TOKEN e PERICIA_CHANNEL_ID no ambiente.",
    });
  }

  const data = req.body || {};
  const validationError = validatePericiaPayload(data);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const reportBody = buildPericiaTemplate(data);
  const reporter = data.authorId
    ? `<@${data.authorId}>`
    : data.authorName || "Sistema";
  const attachmentLine =
    Array.isArray(data.imagens) && data.imagens.length
      ? `\nANEXOS LOCAIS: ${data.imagens.join(", ")}`
      : "";

  const content = `👮 Enviado por: ${reporter}\n\`\`\`\n${reportBody}${attachmentLine}\n\`\`\``;
  await sendDiscordMessage(channelId, botToken, { content });

  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  const action = req.query.action;
  if (!action) {
    return res.status(400).json({ error: "Ação não informada." });
  }

  try {
    if (action === "news" && req.method === "GET") {
      return await handleGetNews(res, process.env);
    }

    if (action === "publish-news" && req.method === "POST") {
      return await handlePublishNews(req, res, process.env);
    }

    if (action === "stats" && req.method === "GET") {
      return await handleStats(res, process.env);
    }

    if (action === "submit-bo" && req.method === "POST") {
      return await handleSubmitBo(req, res, process.env);
    }

    if (action === "submit-pericia" && req.method === "POST") {
      return await handleSubmitPericia(req, res, process.env);
    }

    return res.status(405).json({ error: "Método ou ação inválidos." });
  } catch (error) {
    console.error("Erro em /api/content:", error);
    return res.status(500).json({ error: "Erro interno ao processar conteúdo." });
  }
}
