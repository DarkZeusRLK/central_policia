// api/auth.js
export default async function handler(req, res) {
  // Pega as variáveis do ambiente
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URL } =
    process.env;
  const { code } = req.query;

  // 1. Se NÃO tem código, manda o usuário para o Login do Discord
  if (!code) {
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URL) {
      return res
        .status(500)
        .json({ error: "Erro de Configuração: Faltam variáveis no .env" });
    }

    // Monta o link de login
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      DISCORD_REDIRECT_URL
    )}&response_type=code&scope=identify`;

    return res.redirect(discordLoginUrl);
  }

  // 2. Se JÁ tem código (voltou do Discord), troca pelo Token
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
        scope: "identify",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Erro Token:", tokenData);
      return res.redirect("/?error=token_invalido");
    }

    // 3. Pega os dados do Usuário usando o Token
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    // 4. Manda de volta para o site (Front) com os dados na URL
    const params = new URLSearchParams({
      username: userData.username,
      id: userData.id,
      avatar: userData.avatar,
    });

    // Redireciona para a home limpa com os dados
    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("Erro Auth:", error);
    return res.redirect("/?error=falha_geral");
  }
}
