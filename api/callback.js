// Troca o código pelo token e redireciona de volta
const fetch = require("node-fetch"); // Em Node < 18 precisa disso, no Vercel atual já é nativo, mas garanta no package.json

module.exports = async (req, res) => {
  const { code } = req.query;
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } =
    process.env;

  if (!code) return res.redirect("/");

  try {
    // 1. Troca CODE por TOKEN
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: "identify",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const tokenData = await tokenResponse.json();

    // 2. Pega Info do Usuário
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // 3. Monta objeto simples (segurança: não envie o token para o front)
    const safeUser = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
    };

    // 4. Codifica em Base64 para passar na URL (Método simples para serverless sem DB)
    const userString = Buffer.from(JSON.stringify(safeUser)).toString("base64");

    // Redireciona para Home com dados
    res.redirect(`/?user=${userString}`);
  } catch (error) {
    console.error(error);
    res.redirect("/?error=auth_failed");
  }
};
