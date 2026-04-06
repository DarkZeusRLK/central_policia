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

function formatDateTimeParts(value) {
  if (!value) {
    return {
      date: "data não preenchida",
      time: "horário não informado",
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: "data não preenchida",
      time: "horário não informado",
    };
  }

  return {
    date: parsed.toLocaleDateString("pt-BR"),
    time: parsed.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function ensureRevoadaLocation(value) {
  const location = String(value || "").trim();
  if (!location) return "local não informado na cidade de Revoada RJ";
  if (/na cidade de revoada\s*rj$/i.test(location)) return location;
  return `${location} na cidade de Revoada RJ`;
}

function extractTextFromComponent(component, output = []) {
  if (!component || typeof component !== "object") return output;

  if (component.type === 10 && typeof component.content === "string") {
    output.push(component.content);
  }

  if (Array.isArray(component.components)) {
    component.components.forEach((child) => extractTextFromComponent(child, output));
  }

  if (Array.isArray(component.items)) {
    component.items.forEach((child) => extractTextFromComponent(child, output));
  }

  return output;
}

async function fetchDiscordChannelMessages(channelId, botToken, limit = 100, before) {
  const url = new URL(`${DISCORD_API_BASE}/channels/${channelId}/messages`);
  url.searchParams.set("limit", String(limit));
  if (before) url.searchParams.set("before", before);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord recusou a leitura do canal: ${text}`);
  }

  return response.json();
}

async function getNextBoNumber(channelId, botToken, year) {
  const targetYear = String(year);
  let before = "";
  let maxSequence = 0;

  for (let page = 0; page < 10; page += 1) {
    const messages = await fetchDiscordChannelMessages(channelId, botToken, 100, before);
    if (!Array.isArray(messages) || !messages.length) break;

    for (const message of messages) {
      const chunks = [];
      if (typeof message.content === "string") chunks.push(message.content);
      if (Array.isArray(message.components)) {
        message.components.forEach((component) => extractTextFromComponent(component, chunks));
      }

      const text = chunks.join("\n");
      const regex = new RegExp(`${targetYear}-(\\d{4})`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const number = Number.parseInt(match[1], 10);
        if (!Number.isNaN(number)) {
          maxSequence = Math.max(maxSequence, number);
        }
      }
    }

    before = messages[messages.length - 1]?.id || "";
    if (!before) break;
  }

  return `${targetYear}-${String(maxSequence + 1).padStart(4, "0")}`;
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

function mediaGalleryFromAttachments(attachments) {
  const files = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!files.length) return null;

  return {
    type: 12,
    items: files.map((attachment) => ({
      media: {
        url: `attachment://${attachment.name || "anexo.jpg"}`,
      },
    })),
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
      description: attachment.description || attachment.name || `anexo-${index + 1}`,
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

function validateBlitzPayload(data) {
  if (!required(data.dirigentes)) return "Informe pelo menos um dirigente da blitz.";
  if (!required(data.participantes)) return "Informe pelo menos um participante da blitz.";
  if (!required(data.data_realizacao)) return "Informe a data de realização da blitz.";
  if (!required(data.horario_inicio)) return "Informe o horário de início da blitz.";
  if (!required(data.horario_termino)) return "Informe o horário de término da blitz.";
  return "";
}

async function handleSubmitBlitz(req, res, env) {
  const botToken = env.DISCORD_BOT_TOKEN;
  const channelId = env.CH_BLITZ_RELATORIO;

  if (!botToken || !channelId) {
    return res.status(500).json({
      error: "Defina DISCORD_BOT_TOKEN e CH_BLITZ_RELATORIO no ambiente.",
    });
  }

  const data = req.body || {};
  const userRoles = Array.isArray(data.userRoles) ? data.userRoles.map(String) : [];
  const ownerIds = parseIdList(env.OWNER);
  const prfRoles = parseIdList(env.ROLE_ID_PRF);
  const commandRoles = parseIdList(env.COMANDO_GERAL);
  const isOwner = ownerIds.includes(String(data.authorId || ""));
  const canSendBlitz =
    isOwner ||
    userRoles.some((roleId) => prfRoles.includes(roleId)) ||
    userRoles.some((roleId) => commandRoles.includes(roleId));

  if (!canSendBlitz) {
    return res.status(403).json({ error: "Você não possui permissão para enviar relatório de blitz." });
  }

  const validationError = validateBlitzPayload(data);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const attachments = Array.isArray(data.imageAttachments) ? data.imageAttachments : [];
  const reporter = data.authorId ? `<@${data.authorId}>` : data.authorName || "Sistema";
  const mediaGallery = mediaGalleryFromAttachments(attachments.slice(0, 1));
  const mainCard = container(0x1d4ed8, [
    textDisplay([
      "## 🚧 Central Policial | Relatório de Blitz",
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👔 Dirigentes",
      String(data.dirigentes || "N/A"),
    ].join("\n")),
    separator(),
    textDisplay([
      "### 👥 Participantes",
      String(data.participantes || "N/A"),
    ].join("\n")),
    separator(),
    textDisplay([
      "### 📅 Operação",
      `- **Data de realização:** ${formatBrDate(data.data_realizacao)}`,
      `- **Horário de início:** ${data.horario_inicio || "N/A"}`,
      `- **Horário de término:** ${data.horario_termino || "N/A"}`,
      `- **Participantes de outras Matrizes:** ${data.outras_matrizes || "Nenhum"}`,
    ].join("\n")),
    separator(),
    textDisplay(
      attachments.length
        ? "### 🖼️ Imagem\nA imagem da blitz foi enviada em anexo nesta mensagem."
        : "### 🖼️ Imagem\nNenhuma imagem anexada neste relatório."
    ),
    ...(mediaGallery ? [mediaGallery] : []),
    separator(),
    textDisplay(`-# Relatório enviado por: ${reporter}`),
  ]);

  const payload = {
    flags: 32768,
    allowed_mentions: {
      parse: ["users", "roles"],
    },
    components: [mainCard],
  };

  if (attachments.length) {
    await sendDiscordMultipartMessage(
      channelId,
      botToken,
      payload,
      attachments.slice(0, 1).map((attachment) => ({
        ...attachment,
        description: "Imagem da blitz",
      })),
    );
  } else {
    await sendDiscordMessage(channelId, botToken, payload);
  }

  return res.status(200).json({ success: true });
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

  const messageContent = `
${rolesToMention}

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

  if (!required(nome) || !required(passaporte) || !required(telefone) || !required(sexo) || !required(ocorrencia) || !required(local) || !required(horario) || !required(itens)) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios do boletim, incluindo os itens perdidos." });
  }

  const anoAtual = new Date().getFullYear();
  const boNumero = await getNextBoNumber(DISCORD_CHANNEL_ID_BO, DISCORD_BOT_TOKEN, anoAtual);

  const eventDateTime = formatDateTimeParts(horario);
  const reporter = userId ? `<@${userId}>` : username || "Sistema";
  const localFormatado = ensureRevoadaLocation(local);
  const declaracao = [
    `Eu, **${nome || "cidadão não identificado"}**, inscrito no **RG/Passaporte ${passaporte || "não informado"}**${profissao ? `, profissão declarada como **${profissao}**` : ""}, declaro para os devidos fins que compareço perante a Central de Polícia para registrar formalmente uma ocorrência.`,
    "",
    `O relato informa que, na data de **${eventDateTime.date}**, por volta de **${eventDateTime.time}**, ocorreu um fato descrito como **${ocorrencia || "ocorrência não informada"}**, nas imediações de **${localFormatado}**.`,
    "",
    `Registro ainda que os bens ou objetos mencionados neste atendimento correspondem a **${itens || "itens não descritos"}**, ficando a presente declaração sujeita à confirmação documental, checagem da autoridade policial e eventual complementação probatória quando necessário.`,
  ].join("\n");

  const payload = {
    flags: 32768,
    allowed_mentions: {
      parse: ["users"],
    },
    components: [
      container(0xfbbf24, [
        textDisplay("## 📋 Central Policial | Boletim de Ocorrência"),
        separator(),
        textDisplay([
          `### 🆔 Identificação do Registro`,
          `- **Número do B.O.:** ${boNumero}`,
          `- **Comunicante:** ${nome || "Não informado"}`,
          `- **RG/Passaporte:** ${passaporte || "Não informado"}`,
          `- **Telefone:** ${telefone || "Não informado"}`,
          `- **Sexo:** ${sexo || "Não informado"}`,
          `- **Local informado:** ${localFormatado}`,
        ].join("\n")),
        separator(),
        textDisplay(`### 📝 Declaração Formal\n${declaracao}`),
        separator(),
        textDisplay(`### 🎥 Evidência\n${video_link || "Nenhum link de prova anexado."}`),
        separator(),
        textDisplay(`-# Relatório enviado por: ${reporter}${username ? ` (${username})` : ""}`),
      ]),
    ],
  };

  await sendDiscordMessage(DISCORD_CHANNEL_ID_BO, DISCORD_BOT_TOKEN, payload);

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
  const mediaGallery = mediaGalleryFromAttachments(attachments);
  const mainCard = container(getPericiaAccentColor(data.tipo_pericia), [
    textDisplay([
      `## ${reportTemplate.title}`,
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

  mainCard.components.push(
    separator(),
    textDisplay(attachmentText),
    ...(mediaGallery ? [mediaGallery] : []),
    separator(),
    textDisplay(`-# Relatório enviado por: ${reporter}`),
  );

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

    if (action === "submit-blitz" && req.method === "POST") {
      return await handleSubmitBlitz(req, res, process.env);
    }

    return res.status(405).json({ error: "MÃ©todo ou aÃ§Ã£o invÃ¡lidos." });
  } catch (error) {
    console.error("Erro em /api/content:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao processar conteúdo." });
  }
}

