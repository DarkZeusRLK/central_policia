// api/handler.js
// Handler consolidado para reduzir o número de funções serverless da Vercel
// Uso: /api/handler?type=submit_bo, /api/handler?type=get_news, etc.
import { getDestinationChannel, sendDiscordMessage } from "../lib/discord-router.js";

export default async function handler(req, res) {
  const { type } = req.query;

  if (!type) {
    return res.status(400).json({ error: "Parâmetro 'type' é obrigatório" });
  }

  // Switch case para rotear para a ação correta
  switch (type) {
    case "submit_bo":
      return await handleSubmitBO(req, res);
    case "publish_news":
      return await handlePublishNews(req, res);
    case "get_news":
      return await handleGetNews(req, res);
    case "check_access":
      return await handleCheckAccess(req, res);
    case "get_commanders":
      return await handleGetCommanders(req, res);
    case "get_pcerj":
      return await handleGetPCERJ(req, res);
    case "get_pmerj":
      return await handleGetPMERJ(req, res);
    case "get_pf":
      return await handleGetPF(req, res);
    case "get_prf":
      return await handleGetPRF(req, res);
    case "stats":
      return await handleStats(req, res);
    case "announce_course":
      return await handleAnnounceCourse(req, res);
    case "submit_course":
      return await handleSubmitCourse(req, res);
    case "submit_recruitment":
      return await handleSubmitRecruitment(req, res);
    default:
      return res.status(400).json({ error: `Tipo '${type}' não reconhecido` });
  }
}

// ============================================================================
// HANDLERS INDIVIDUAIS
// ============================================================================

async function handleSubmitBO(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

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
  } = req.body;

  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID_BO } = process.env;

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID_BO) {
    return res
      .status(500)
      .json({ error: "Erro no Servidor: Bot não configurado." });
  }

  try {
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

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID_BO}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: contentMessage }),
      }
    );

    if (!discordResponse.ok) {
      const errorData = await discordResponse.json();
      console.error("Erro Discord:", errorData);
      return res.status(500).json({ error: "Discord recusou a mensagem." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}

async function handlePublishNews(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { title, content, imageUrl, userId, fontFamily } = req.body;

  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID, MATRIZES_ROLE_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID || !MATRIZES_ROLE_ID) {
    return res.status(500).json({ error: "Configuração incompleta (.env)." });
  }

  try {
    const rolesToMention = MATRIZES_ROLE_ID.split(",")
      .map((id) => `<@&${id.trim()}>`)
      .join(" ");

    let formattedContent = content;
    if (fontFamily === "bold") {
      formattedContent = `**${content}**`;
    } else if (fontFamily === "italic") {
      formattedContent = `*${content}*`;
    } else if (fontFamily === "bold-italic") {
      formattedContent = `***${content}***`;
    } else if (fontFamily === "code") {
      formattedContent = `\`\`\`\n${content}\n\`\`\``;
    }

    const POLICIAL_USER_ID = "&1447056982371602526";

    const messageContent = `
${rolesToMention}
<@${POLICIAL_USER_ID}>

# 📰 ${title.toUpperCase()}

${formattedContent}

> ✍️ *Reportagem por:* <@${userId}>

${imageUrl}
    `.trim();

    const response = await fetch(
      `https://discord.com/api/v10/channels/${JORNAL_CH_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: messageContent,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Discord Error:", err);
      throw new Error("Falha ao enviar para o Discord");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao publicar notícia." });
  }
}

async function handleGetNews(req, res) {
  const { DISCORD_BOT_TOKEN, JORNAL_CH_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !JORNAL_CH_ID) {
    return res.status(500).json({ error: "Configuração faltando" });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${JORNAL_CH_ID}/messages?limit=10`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      }
    );

    if (!response.ok) throw new Error("Erro ao buscar notícias");

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
        } else if (
          msg.embeds &&
          msg.embeds.length > 0 &&
          msg.embeds[0].thumbnail
        ) {
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

        let cleanBody = content
          .replace(/<@&\d+>/g, "")
          .replace(/<@\d+>/g, "")
          .replace(/# 📰 .*\n?/g, "")
          .replace(/> ✍️.*\n?/g, "")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/\n\n+/g, "\n")
          .trim();

        return {
          id: msg.id,
          title: title,
          summary: cleanBody,
          image: image,
          date: new Date(msg.timestamp).toLocaleDateString("pt-BR"),
          author: author,
        };
      })
      .filter((item) => item !== null);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json(newsData);
  } catch (error) {
    console.error(error);
    return res.status(500).json([]);
  }
}

async function handleCheckAccess(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, JORNALISTA_ROLE_ID } =
    process.env;

  if (!userId || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração ou UserID faltando" });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (response.status === 404) {
      return res.status(200).json({ isMember: false, isJournalist: false });
    }

    if (!response.ok) throw new Error("Erro na API do Discord");

    const memberData = await response.json();

    const hasJournalistRole = memberData.roles.includes(JORNALISTA_ROLE_ID);

    return res.status(200).json({
      isMember: true,
      isJournalist: hasJournalistRole,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }
}

async function handleGetCommanders(req, res) {
  const { DISCORD_BOT_TOKEN, COMANDO_GERAL_IDS, DISCORD_GUILD_ID } =
    process.env;

  if (!DISCORD_BOT_TOKEN || !COMANDO_GERAL_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({
      error: "Configuração faltando no .env (Verifique DISCORD_GUILD_ID)",
    });
  }

  const ids = COMANDO_GERAL_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (!response.ok) return null;

      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const commanders = await Promise.all(fetchPromises);

    return res.status(200).json(commanders.filter((c) => c !== null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar comandantes" });
  }
}

async function handleGetPCERJ(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DELEGADOS_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !DELEGADOS_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({
      error:
        "Configuração faltando no .env (Verifique GUILD_ID e DELEGADOS_IDS)",
    });
  }

  const ids = DELEGADOS_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) {
        console.error(`Erro ao buscar ID ${id}: ${response.status}`);
        return null;
      }

      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    console.error("Erro API PCERJ:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}

async function handleGetPMERJ(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, COMANDOS_PMERJ_IDS } =
    process.env;

  if (!DISCORD_BOT_TOKEN || !COMANDOS_PMERJ_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração faltando no .env" });
  }

  const ids = COMANDOS_PMERJ_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) return null;
      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    return res.status(500).json({ error: "Erro interno" });
  }
}

async function handleGetPF(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DIRETORES_PF_IDS } = process.env;

  if (!DISCORD_BOT_TOKEN || !DIRETORES_PF_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração faltando no .env" });
  }

  const ids = DIRETORES_PF_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) return null;
      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    return res.status(500).json({ error: "Erro interno" });
  }
}

async function handleGetPRF(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DIRETORES_PRF_IDS } =
    process.env;

  if (!DISCORD_BOT_TOKEN || !DIRETORES_PRF_IDS || !DISCORD_GUILD_ID) {
    return res.status(500).json({ error: "Configuração faltando no .env" });
  }

  const ids = DIRETORES_PRF_IDS.split(",").map((id) => id.trim());

  try {
    const fetchPromises = ids.map(async (id) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${id}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        }
      );

      if (!response.ok) return null;
      const memberData = await response.json();
      const user = memberData.user;

      return {
        username: memberData.nick || user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator || 0) % 5
            }.png`,
      };
    });

    const members = await Promise.all(fetchPromises);
    return res.status(200).json(members.filter((c) => c !== null));
  } catch (error) {
    return res.status(500).json({ error: "Erro interno" });
  }
}

async function handleStats(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { DISCORD_BOT_TOKEN, PRISOES_CH_ID, FIANCAS_CH_ID } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot Token não configurado" });
  }

  async function fetchMessagesFromChannel(channelId) {
    let allMessages = [];
    let lastId = null;
    let keepFetching = true;
    let loops = 0;

    while (keepFetching && loops < 5) {
      try {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (lastId) {
          url += `&before=${lastId}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        });

        if (!response.ok) break;

        const messages = await response.json();

        if (messages.length === 0) {
          keepFetching = false;
          break;
        }

        allMessages = allMessages.concat(messages);
        lastId = messages[messages.length - 1].id;
        loops++;
      } catch (e) {
        console.error("Erro no fetch loop:", e);
        keepFetching = false;
      }
    }
    return allMessages;
  }

  async function countMessagesFromToday(channelId) {
    if (!channelId) return 0;

    try {
      const messages = await fetchMessagesFromChannel(channelId);

      const now = new Date();
      const brazilDateString = now.toLocaleDateString("en-US", {
        timeZone: "America/Sao_Paulo",
      });
      const hojeBrasilia = new Date(brazilDateString);
      hojeBrasilia.setHours(0, 0, 0, 0);

      const count = messages.filter((msg) => {
        const msgDate = new Date(msg.timestamp);
        return msgDate.getTime() >= hojeBrasilia.getTime();
      }).length;

      return count;
    } catch (error) {
      console.error(`Erro ao processar canal ${channelId}:`, error);
      return 0;
    }
  }

  try {
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
  } catch (error) {
    console.error("Erro geral na API stats:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar estatísticas" });
  }
}

async function handleAnnounceCourse(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    courseName,
    courseDescription,
    courseDate,
    courseInstructor,
    courseLink,
    userId,
    username,
  } = req.body;

  const { DISCORD_BOT_TOKEN, CHANNEL_CURSOS_ANUNCIADOS } = process.env;

  if (!DISCORD_BOT_TOKEN || !CHANNEL_CURSOS_ANUNCIADOS) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado ou canal de anúncios não definido.",
    });
  }

  try {
    const dataFormatada = courseDate
      ? new Date(courseDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "A definir";

    const anuncio = `
\`\`\`md
# 📚 ANÚNCIO DE CURSO

NOME: ${courseName || "Não informado"}
DESCRIÇÃO: ${courseDescription || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${courseInstructor || "Não informado"}
LINK: ${courseLink || "N/A"}
\`\`\``;

    const contentMessage = `🎓 **Novo curso anunciado por:** <@${userId}> (${username})\n${anuncio}`;

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_CURSOS_ANUNCIADOS}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: contentMessage }),
      }
    );

    if (!discordResponse.ok) {
      const errorData = await discordResponse.json();
      console.error("Erro Discord:", errorData);
      return res.status(500).json({ error: "Discord recusou a mensagem." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar anúncio." });
  }
}

async function handleSubmitCourse(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    courseName,
    courseDate,
    participants,
    instructor,
    observations,
    userId,
    username,
    userRoles,
  } = req.body;

  const {
    DISCORD_BOT_TOKEN,
    CHANNEL_CURSOS_FINALIZADOS,
    MATRIZES_ROLE_ID,
    CHANNEL_CURSOS_RELATORIOS,
  } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado.",
    });
  }

  if (!CHANNEL_CURSOS_FINALIZADOS) {
    return res.status(500).json({
      error: "Erro no Servidor: Canal de cursos finalizados não configurado.",
    });
  }

  try {
    const dataFormatada = courseDate
      ? new Date(courseDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleDateString("pt-BR");

    const logResumido = `
\`\`\`md
# ✅ CURSO FINALIZADO

CURSO: ${courseName || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${instructor || "Não informado"}
PARTICIPANTES: ${participants || "Não informado"}
\`\`\``;

    const logMessage = `📋 **Log de curso finalizado por:** <@${userId}> (${username})\n${logResumido}`;

    const logResult = await sendDiscordMessage(
      CHANNEL_CURSOS_FINALIZADOS,
      logMessage,
      DISCORD_BOT_TOKEN
    );

    if (!logResult.success) {
      console.error("Erro ao enviar log resumido:", logResult.error);
    }

    if (MATRIZES_ROLE_ID && CHANNEL_CURSOS_RELATORIOS && userRoles) {
      const targetChannel = getDestinationChannel(
        userRoles,
        MATRIZES_ROLE_ID,
        CHANNEL_CURSOS_RELATORIOS
      );

      if (targetChannel) {
        const relatorioDetalhado = `
\`\`\`md
# 📊 RELATÓRIO DETALHADO DE CURSO

CURSO: ${courseName || "Não informado"}
DATA: ${dataFormatada}
INSTRUTOR: ${instructor || "Não informado"}
PARTICIPANTES: ${participants || "Não informado"}

# OBSERVAÇÕES
${observations || "Nenhuma observação registrada."}
\`\`\``;

        const relatorioMessage = `📊 **Relatório detalhado enviado por:** <@${userId}> (${username})\n${relatorioDetalhado}`;

        const relatorioResult = await sendDiscordMessage(
          targetChannel,
          relatorioMessage,
          DISCORD_BOT_TOKEN
        );

        if (!relatorioResult.success) {
          console.error("Erro ao enviar relatório detalhado:", relatorioResult.error);
          return res.status(200).json({
            success: true,
            warning: "Relatório detalhado não pôde ser enviado, mas o log foi registrado.",
          });
        }
      } else {
        console.warn(
          "Não foi possível determinar o canal de destino para o relatório detalhado."
        );
      }
    } else {
      console.warn(
        "Variáveis de ambiente ou cargos do usuário não configurados para roteamento de relatórios."
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}

async function handleSubmitRecruitment(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const {
    department,
    candidateName,
    candidatePassport,
    recruitmentDate,
    status,
    observations,
    userId,
    username,
    userRoles,
  } = req.body;

  const {
    DISCORD_BOT_TOKEN,
    MATRIZES_ROLE_ID,
    CHANNEL_RECRUTAMENTOS_MATRIZES,
  } = process.env;

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({
      error: "Erro no Servidor: Bot não configurado.",
    });
  }

  if (!MATRIZES_ROLE_ID || !CHANNEL_RECRUTAMENTOS_MATRIZES) {
    return res.status(500).json({
      error: "Erro no Servidor: Configuração de roteamento não completa.",
    });
  }

  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return res.status(400).json({
      error: "Cargos do usuário não fornecidos. É necessário estar logado.",
    });
  }

  try {
    const targetChannel = getDestinationChannel(
      userRoles,
      MATRIZES_ROLE_ID,
      CHANNEL_RECRUTAMENTOS_MATRIZES
    );

    if (!targetChannel) {
      return res.status(400).json({
        error: "Não foi possível determinar o canal de destino. Verifique se o usuário possui um cargo válido.",
      });
    }

    const dataFormatada = recruitmentDate
      ? new Date(recruitmentDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleDateString("pt-BR");

    const relatorio = `
\`\`\`md
# 👮 RELATÓRIO DE RECRUTAMENTO

DEPARTAMENTO: ${department || "Não informado"}
CANDIDATO: ${candidateName || "Não informado"}
PASSAPORTE: ${candidatePassport || "Não informado"}
DATA: ${dataFormatada}
STATUS: ${status || "Não informado"}

# OBSERVAÇÕES
${observations || "Nenhuma observação registrada."}
\`\`\``;

    const contentMessage = `👮 **Recrutamento finalizado por:** <@${userId}> (${username})\n${relatorio}`;

    const result = await sendDiscordMessage(
      targetChannel,
      contentMessage,
      DISCORD_BOT_TOKEN
    );

    if (!result.success) {
      console.error("Erro ao enviar relatório de recrutamento:", result.error);
      return res.status(500).json({
        error: "Erro ao enviar relatório para o Discord.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar envio." });
  }
}
