import { getOperationalDashboardData } from "../lib/operational-dashboard-service.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const data = await getOperationalDashboardData();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Erro em /api/operational:", error);
    return res.status(503).json({
      error:
        "Não foi possível carregar o Painel Operacional agora. Verifique a conexão com o MongoDB e tente novamente.",
      details: error.message,
    });
  }
}

