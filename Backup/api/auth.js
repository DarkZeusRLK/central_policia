export default async function handler(req, res) {
  // 1. Pegamos as variáveis do ambiente (Incluindo o ID do Servidor)
  const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URL,
    DISCORD_GUILD_ID,
  } = process.env;

  const { code } = req.query;

  // --- FASE 1: Redirecionar para o Discord ---
  if (!code) {
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URL || !DISCORD_GUILD_ID) {
      return res.status(500).json({
        error:
          "Erro de Configuração: Faltam variáveis no .env (Verifique DISCORD_GUILD_ID)",
      });
    }

    // ADICIONAMOS 'guilds.members.read' ao escopo para poder ler os cargos
    const scope = "identify guilds.members.read";

    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      DISCORD_REDIRECT_URL
    )}&response_type=code&scope=${encodeURIComponent(scope)}`;

    return res.redirect(discordLoginUrl);
  }

  // --- FASE 2: Trocar Código pelo Token ---
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: DISCORD_REDIRECT_URL,
        scope: "identify guilds.members.read",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Erro Token:", tokenData);
      return res.redirect("/?error=token_invalido");
    }

    // --- FASE 3: Pegar Dados Básicos do Usuário ---
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // --- FASE 4: Pegar CARGOS (Roles) no Servidor Específico ---
    let userRoles = [];

    // Tenta buscar os dados do membro dentro do servidor (Guild)
    try {
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
        {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        userRoles = memberData.roles; // Isso é um array com os IDs dos cargos
      } else {
        console.error(
          "Erro ao buscar cargos (Verifique se o bot está no servidor):",
          await memberResponse.text()
        );
      }
    } catch (err) {
      console.error("Falha ao conectar na API de Guilds:", err);
    }

    // --- FASE 5: Redirecionar para o Frontend com os Dados ---
    const params = new URLSearchParams({
      username: userData.username,
      id: userData.id,
      avatar: userData.avatar,
      // IMPORTANTE: Enviamos os roles como Texto (JSON) para o front ler
      roles: JSON.stringify(userRoles),
    });

    // Redireciona de volta para a home
    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("Erro Auth:", error);
    return res.redirect("/?error=falha_geral");
  }
}
