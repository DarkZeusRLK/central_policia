// Redireciona para o Discord OAuth2
module.exports = (req, res) => {
  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } = process.env;

  // Escopos: identify (pegar ID e Avatar)
  const scope = "identify";

  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    DISCORD_REDIRECT_URI
  )}&response_type=code&scope=${scope}`;

  res.redirect(discordUrl);
};
