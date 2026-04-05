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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveConfiguredRoleIds(targetRoles, roles) {
  return parseIdList(targetRoles)
    .map((targetRole) => {
      const exactId = roles.find((role) => role.id === targetRole);
      if (exactId) return exactId.id;

      const byName = roles.find((role) => normalize(role.name) === normalize(targetRole));
      return byName?.id || "";
    })
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

async function sendDiscordMultipartMessage(channelId, botToken, payload, attachments) {
  const form = new FormData();
  const files = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const normalizedPayload = {
    ...payload,
    attachments: files.map((attachment, index) => ({
      id: String(index),
      filename: attachment.name || `anexo-${index + 1}`,
    })),
  };

  form.append("payload_json", JSON.stringify(normalizedPayload));

  files.forEach((attachment, index) => {
    const match = String(attachment.dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
    if (!match) return;

    const mimeType = attachment.type || match[1] || "application/octet-stream";
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    const blob = new Blob([buffer], { type: mimeType });
    const fileName = attachment.name || `anexo-${index + 1}`;

    form.append(`files[${index}]`, blob, fileName);
  });

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord recusou a mensagem multipart: ${text}`);
  }

  return response;
}

function buildPericiaTemplate(data) {
  const tipo = data.tipo_pericia;

  if (tipo === "caminhao") {
    return {
      title: "🚛 Perícia Veículo Caminhão",
      sections: [
        `- **Modelo:** ${data.modelo || "N/A"}`,
        `- **Placa:** ${data.placa || "N/A"}`,
        `- **Proprietário:** ${data.proprietario || "N/A"}`,
        `- **Passaporte:** ${data.rg_passaporte_vitima || "N/A"}`,
        `- **ID de Quem Trouxe:** ${data.id_referencia || "N/A"}`,
        `- **Ocorrido:** ${data.ocorrido || "N/A"}`,
        `- **Itens Encontrados:** ${data.itens_encontrados || "N/A"}`,
        `- **Região:** ${data.regiao || "N/A"}`,
      ],
    };
  }

  if (tipo === "veiculo") {
    return {
      title: "🚓 Perícia Veículo",
      sections: [
        `- **Modelo:** ${data.modelo || "N/A"}`,
        `- **Placa:** ${data.placa || "N/A"}`,
        `- **Proprietário:** ${data.proprietario || "N/A"}`,
        `- **Passaporte:** ${data.rg_passaporte_vitima || "N/A"}`,
        `- **ID do Denunciante:** ${data.id_referencia || "N/A"}`,
        `- **Ocorrido:** ${data.ocorrido || "N/A"}`,
        `- **Itens Encontrados:** ${data.itens_encontrados || "N/A"}`,
        `- **Região:** ${data.regiao || "N/A"}`,
      ],
    };
  }

  if (tipo === "corpo") {
    return {
      title: "🧍 Perícia de Corpo",
      sections: [
        `- **Nome:** ${data.nome || "N/A"}`,
        `- **Passaporte:** ${data.rg_passaporte_vitima || "N/A"}`,
        `- **Itens Encontrados:** ${data.itens_encontrados || "N/A"}`,
        `- **Região:** ${data.regiao || "N/A"}`,
      ],
    };
  }

  if (tipo === "facorg") {
    return {
      title: "🏴 Pessoas Armadas em FAC/ORG",
      sections: [
        `- **FAC/ORG:** ${data.fac_org || data.nome_fac || "N/A"}`,
        `- **Provas:** ${data.provas || "N/A"}`,
      ],
    };
  }

  throw new Error("Tipo de perícia inválido.");
}

function getPericiaAccentColor(tipo) {
  if (tipo === "caminhao") return 0xd97706;
  if (tipo === "veiculo") return 0x2563eb;
  if (tipo === "corpo") return 0x059669;
  if (tipo === "facorg") return 0x7c3aed;
  return 0xd4af37;
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
  if (!requiredFields) return "Tipo de perÃ­cia invÃ¡lido.";

  const missingFields = requiredFields.filter((field) => !required(data[field]));
  if (missingFields.length) {
    return `Campos obrigatÃ³rios ausentes: ${missingFields.join(", ")}.`;
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
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID, CARGO_POLICIAL_REVOADA } = env;
  const guildId = env.DISCORD_GUILD_ID || env.GUILD_ID;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID || !CARGO_POLICIAL_REVOADA || !guildId) {
    return res.status(500).json({ error: "Configuração incompleta (.env)." });
  }

  const rolesResponse = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  });

  if (!rolesResponse.ok) {
    throw new Error("Não foi possível validar o cargo policial do jornal.");
  }

  const guildRoles = await rolesResponse.json();
  const rolesToMention = resolveConfiguredRoleIds(CARGO_POLICIAL_REVOADA, guildRoles)
    .map((id) => `<@&${id}>`)
    .join(" ");

  let formattedContent = content;
  if (fontFamily === "bold") formattedContent = `**${content}**`;
  else if (fontFamily === "italic") formattedContent = `*${content}*`;
  else if (fontFamily === "bold-italic") formattedContent = `***${content}***`;
  else if (fontFamily === "code") formattedContent = `\`\`\`\n${content}\n\`\`\``;

  const policialUserId = "1447056982371602526";
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
    return res.status(500).json({ error: "Bot Token nÃ£o configurado" });
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
    return res.status(500).json({ error: "Erro no Servidor: Bot nÃ£o configurado." });
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
# BOLETIM DE OCORRÃŠNCIA NÂº ${boNumero}
DATA DO FATO: ${dataFormatada}
LOCAL DO FATO: ${local}

# VÃTIMA / COMUNICANTE
NOME: ${nome}
PASSAPORTE: ${passaporte}
TELEFONE: ${telefone}
PROFISSÃƒO: ${profissao || "NÃ£o Informado"}
SEXO: ${sexo || "NÃ£o Informado"}

# RELATO INDIVIDUAL
${ocorrencia}

# BENS / OBJETOS
${itens || "Nenhum bem declarado."}

# EVIDÃŠNCIA
${video_link || "N/A"}
\`\`\``;

  const contentMessage = `ðŸ‘® **Novo registro enviado por:** <@${userId}> (${username})\n${relatorio}`;
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

  const reportTemplate = buildPericiaTemplate(data);
  const reporter = data.authorId ? `<@${data.authorId}>` : data.authorName || "Sistema";
  const qraMentions = Array.isArray(data.qra_participantes) ? data.qra_participantes : [];
  const attachments = Array.isArray(data.imageAttachments) ? data.imageAttachments : [];
  const mainCard = container(getPericiaAccentColor(data.tipo_pericia), [
    textDisplay([
      `## ${reportTemplate.title}`,
      `**👮 Enviado por:** ${reporter}`,
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👥 QRA",
      qraMentions.length ? qraMentions.map((mention) => `- ${mention}`).join("\n") : "- N/A",
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📋 Detalhes da Perícia",
      reportTemplate.sections.join("\n"),
    ].join("\n")),
  ]);

  const attachmentText = attachments.length
    ? "### 🖼️ Anexos\nAs imagens da perícia foram enviadas em anexo nesta mensagem."
    : Array.isArray(data.imagens) && data.imagens.length
      ? `### 🖼️ Anexos\n${data.imagens.map((name) => `- ${name}`).join("\n")}`
      : "### 🖼️ Anexos\nNenhuma imagem anexada nesta perícia.";

  mainCard.components.push(separator(), textDisplay(attachmentText));

  const payload = {
    flags: 32768,
    allowed_mentions: {
      parse: ["users", "roles"],
    },
    components: [mainCard],
  };

  if (attachments.length) {
    await sendDiscordMultipartMessage(channelId, botToken, payload, attachments);
  } else {
    await sendDiscordMessage(channelId, botToken, payload);
  }

  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  const action = req.query.action;
  if (!action) {
    return res.status(400).json({ error: "AÃ§Ã£o nÃ£o informada." });
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

    return res.status(405).json({ error: "MÃ©todo ou aÃ§Ã£o invÃ¡lidos." });
  } catch (error) {
    console.error("Erro em /api/content:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao processar conteúdo." });
  }
}

