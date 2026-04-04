const DISCORD_API_BASE = "https://discord.com/api/v10";

function required(value) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value || "").trim().length > 0;
}

function asLineList(values) {
  if (!Array.isArray(values) || !values.length) return "N/A";
  return values.join(", ");
}

function buildTemplate(data) {
  const qra = asLineList(data.qra_participantes);
  const tipo = data.tipo_pericia;

  if (tipo === "caminhao") {
    return `----PERÍCIA VEICULO CAMINHÃO----
QRA: ${qra}
MODELO: ${data.modelo || "N/A"}
PLACA: ${data.placa || "N/A"}
PROPRIETÁRIO: ${data.proprietario || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ID DE QUEM TROUXE: ${data.id_referencia || "N/A"}
OCORRIDO: ${data.ocorrido || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "veiculo") {
    return `---- PERÍCIA VEICULO ----
QRA: ${qra}
MODELO: ${data.modelo || "N/A"}
PLACA: ${data.placa || "N/A"}
PROPRIETÁRIO: ${data.proprietario || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ID DO DENUNCIANTE (Caso o veículo tenha sido entregue por terceiros): ${data.id_referencia || "N/A"}
OCORRIDO: ${data.ocorrido || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "corpo") {
    return `----- PERICIA DE CORPO ----
QRA: ${qra}
NOME: ${data.nome || "N/A"}
PASSAPORTE: ${data.rg_passaporte_vitima || "N/A"}
ITENS ENCONTRADOS: ${data.itens_encontrados || "N/A"}
Região: ${data.regiao || "N/A"}`;
  }

  if (tipo === "facorg") {
    return `----- PESSOAS ARMADAS DENTRO DE FAC/ORG ----
QRA: ${qra}
FAC/ORG: ${data.fac_org || data.nome_fac || "N/A"}
PROVAS: ${data.provas || "N/A"}`;
  }

  throw new Error("Tipo de perícia inválido.");
}

function validatePayload(data) {
  if (!required(data.qra_participantes)) {
    return "Selecione pelo menos um policial no QRA.";
  }

  const validators = {
    caminhao: ["modelo", "placa", "proprietario", "rg_passaporte_vitima", "id_referencia", "ocorrido", "itens_encontrados", "regiao"],
    veiculo: ["modelo", "placa", "proprietario", "rg_passaporte_vitima", "id_referencia", "ocorrido", "itens_encontrados", "regiao"],
    corpo: ["nome", "rg_passaporte_vitima", "itens_encontrados", "regiao"],
    facorg: ["fac_org", "provas"],
  };

  const requiredFields = validators[data.tipo_pericia];
  if (!requiredFields) return "Tipo de perícia inválido.";

  const missingFields = requiredFields.filter((field) => !required(data[field]));
  if (missingFields.length) {
    return `Campos obrigatórios ausentes: ${missingFields.join(", ")}.`;
  }

  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.PERICIA_CHANNEL_ID;

  if (!botToken || !channelId) {
    return res.status(500).json({
      error: "Defina DISCORD_BOT_TOKEN e PERICIA_CHANNEL_ID no ambiente.",
    });
  }

  const data = req.body || {};
  const validationError = validatePayload(data);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const reportBody = buildTemplate(data);
    const reporter = data.authorId ? `<@${data.authorId}>` : (data.authorName || "Sistema");
    const attachmentLine = Array.isArray(data.imagens) && data.imagens.length
      ? `\nANEXOS LOCAIS: ${data.imagens.join(", ")}`
      : "";

    const content = `👮 Enviado por: ${reporter}\n\`\`\`\n${reportBody}${attachmentLine}\n\`\`\``;

    const discordResponse = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      },
    );

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      throw new Error(`Discord recusou a mensagem: ${errorText}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro em /api/submit-pericia:", error);
    return res.status(500).json({ error: "Erro ao enviar perícia ao Discord." });
  }
}
