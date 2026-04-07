function buildGuildAvatarUrl(guildId, userId, avatarHash) {
  if (!guildId || !userId || !avatarHash) return "";
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${avatarHash}.png?size=512`;
}

function buildUserAvatarUrl(userId, avatarHash, discriminator) {
  if (userId && avatarHash) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=512`;
  }

  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discriminator || 0, 10) % 5}.png`;
}

export default async function handler(req, res) {
  const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URL,
    DISCORD_GUILD_ID,
  } = process.env;

  const { code } = req.query;

  if (!code) {
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URL || !DISCORD_GUILD_ID) {
      return res.status(500).json({
        error:
          "Erro de configuração: faltam variáveis no .env (verifique DISCORD_GUILD_ID).",
      });
    }

    const scope = "identify guilds.members.read";
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      DISCORD_REDIRECT_URL,
    )}&response_type=code&scope=${encodeURIComponent(scope)}`;

    return res.redirect(discordLoginUrl);
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
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

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    let userRoles = [];
    let displayName = userData.global_name || userData.username;
    let avatarUrl = buildUserAvatarUrl(
      userData.id,
      userData.avatar,
      userData.discriminator,
    );

    try {
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
        {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        userRoles = Array.isArray(memberData.roles) ? memberData.roles : [];
        displayName = memberData.nick || userData.global_name || userData.username;
        avatarUrl =
          buildGuildAvatarUrl(DISCORD_GUILD_ID, userData.id, memberData.avatar) ||
          avatarUrl;
      } else {
        console.error(
          "Erro ao buscar membro da guild:",
          await memberResponse.text(),
        );
      }
    } catch (err) {
      console.error("Falha ao conectar na API de Guilds:", err);
    }

    const params = new URLSearchParams({
      username: userData.username,
      displayName,
      id: userData.id,
      avatar: userData.avatar || "",
      avatarUrl,
      roles: JSON.stringify(userRoles),
    });

    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("Erro Auth:", error);
    return res.redirect("/?error=falha_geral");
  }
}

