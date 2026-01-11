// ler_cargo.js
const express = require("express");
const router = express.Router();
require("dotenv").config(); // Importante: Carrega as variáveis do .env

// Rota GET que será acessada via: /api/config/roles
router.get("/config/roles", (req, res) => {
  // Pega a variável do arquivo .env
  const rolesAutorizados = process.env.ROLES_PERMITIDOS_CURSO;

  // Verificação de segurança: Se não tiver nada no .env, avisa no console
  if (!rolesAutorizados) {
    console.warn(
      "⚠️ AVISO: A variável ROLES_PERMITIDOS_CURSO não está definida no arquivo .env"
    );
  }

  // Retorna um JSON para o frontend
  res.json({
    // O frontend espera receber "pcerj_pf" (conforme fizemos no script anterior)
    pcerj_pf: rolesAutorizados || "",
  });
});

module.exports = router;
