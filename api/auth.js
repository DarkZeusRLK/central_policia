// api/auth.js - Código Corrigido (Compatível com sua Vercel)

export default async function handler(req, res) {
  // 1. Pegar variáveis de ambiente (Note: Mudamos para _URL para bater com sua Vercel)
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URL } =
    process.env;

  // 2. Verifica se veio o código do Discord na URL
  const { code } = req.query;

  // CENÁRIO A: O usuário clicou em "Login" no site
  if (!code) {
    // Verificação de segurança para avisar se faltar algo no .env
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URL) {
      return res.status(500).json({
        error:
          "Configuração de API incompleta. Verifique se DISCORD_CLIENT_ID e DISCORD_REDIRECT_URL estão no .env",
      });
    }

    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      DISCORD_REDIRECT_URL
    )}&response_type=code&scope=identify`;

    return res.redirect(discordLoginUrl);
  }

  // CENÁRIO B: O Discord devolveu o usuário com um código
  try {
    // 3. Troca o CODE pelo TOKEN
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: DISCORD_REDIRECT_URL, // Usando a variável com final URL
        scope: "identify",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Erro Token Discord:", tokenData);
      return res.redirect("/?error=token_error");
    }

    // 4. Pega os dados do Usuário
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // 5. Devolve para o site
    const params = new URLSearchParams({
      username: userData.username,
      id: userData.id,
      avatar: userData.avatar,
    });

    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("Erro Geral:", error);
    return res.redirect("/?error=auth_failed");
  }
}
