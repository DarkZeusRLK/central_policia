/**
 * Função utilitária para roteamento de canais do Discord baseado em cargos do usuário
 * 
 * @param {string[]} userRoles - Array de IDs de cargos do usuário
 * @param {string} roleListEnv - String de variável de ambiente com IDs de cargos separados por vírgula (ex: "ID1,ID2,ID3")
 * @param {string} channelListEnv - String de variável de ambiente com IDs de canais separados por vírgula (ex: "CH1,CH2,CH3")
 * @returns {string|null} - ID do canal correspondente ou null se não encontrar correspondência
 */
export function getDestinationChannel(userRoles, roleListEnv, channelListEnv) {
  // Validação de entrada
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    console.warn("getDestinationChannel: userRoles inválido ou vazio");
    return null;
  }

  if (!roleListEnv || !channelListEnv) {
    console.warn("getDestinationChannel: Variáveis de ambiente não definidas");
    return null;
  }

  // Converte as strings de ENV em arrays
  const roleIds = roleListEnv
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const channelIds = channelListEnv
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // Validação de arrays
  if (roleIds.length === 0 || channelIds.length === 0) {
    console.warn("getDestinationChannel: Arrays de roles ou canais vazios");
    return null;
  }

  if (roleIds.length !== channelIds.length) {
    console.warn(
      `getDestinationChannel: Arrays com tamanhos diferentes. Roles: ${roleIds.length}, Canais: ${channelIds.length}`
    );
    return null;
  }

  // Verifica qual cargo da lista MATRIZES_ROLE_ID o usuário possui
  let matchedIndex = -1;
  for (let i = 0; i < roleIds.length; i++) {
    if (userRoles.includes(roleIds[i])) {
      matchedIndex = i;
      break; // Pega o primeiro match
    }
  }

  // Se encontrou correspondência, retorna o canal no mesmo índice
  if (matchedIndex >= 0 && matchedIndex < channelIds.length) {
    return channelIds[matchedIndex];
  }

  console.warn(
    "getDestinationChannel: Nenhum cargo do usuário corresponde à lista de matrizes"
  );
  return null;
}

/**
 * Função auxiliar para enviar mensagem ao Discord
 * 
 * @param {string} channelId - ID do canal do Discord
 * @param {string} messageContent - Conteúdo da mensagem
 * @param {string} botToken - Token do bot do Discord
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendDiscordMessage(channelId, messageContent, botToken) {
  if (!channelId || !messageContent || !botToken) {
    return {
      success: false,
      error: "Parâmetros inválidos para envio de mensagem",
    };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: messageContent }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Erro ao enviar mensagem ao Discord:", errorData);
      return {
        success: false,
        error: `Discord API retornou erro: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar mensagem ao Discord:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao enviar mensagem",
    };
  }
}
