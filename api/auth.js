// api/auth.js
export default async function handler(req, res) {
  // 1. Pegamos também o DISCORD_GUILD_ID do .env
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
          "Erro de Configuração: Faltam variáveis no .env (Verifique o GUILD_ID)",
      });
    }

    // ADICIONAMOS 'guilds.members.read' ao escopo
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

    // --- FASE 3: Pegar Dados do Usuário ---
    // Pega dados básicos (Username, Avatar, ID)
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // --- FASE 4: Pegar CARGOS (Roles) no Servidor Específico ---
    // Usamos o endpoint de Guild Member para pegar os cargos daquele servidor
    let userRoles = [];
    try {
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
        {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        userRoles = memberData.roles; // Isso é um array de IDs ["123", "456"]
      } else {
        console.error("Erro ao buscar cargos:", await memberResponse.text());
      }
    } catch (err) {
      console.error("Falha ao conectar na API de Guilds:", err);
    }

    // --- FASE 5: Redirecionar para o Frontend ---
    const params = new URLSearchParams({
      username: userData.username,
      id: userData.id,
      avatar: userData.avatar,
      // Enviamos os roles como uma string JSON para o front conseguir ler depois
      roles: JSON.stringify(userRoles),
    });

    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("Erro Auth:", error);
    return res.redirect("/?error=falha_geral");
  }
}
