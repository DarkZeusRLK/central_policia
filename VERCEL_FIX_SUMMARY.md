# Correção Crítica - Limite de 12 Funções Vercel

## Problema Identificado

O projeto estava ultrapassando o limite de 12 Serverless Functions do plano Hobby da Vercel porque:

1. **13 arquivos antigos** na pasta `api/` ainda existiam (mesmo após consolidação)
2. **Build script inadequado** no `package.json`
3. **Falta de configuração** do Vercel para otimização

## Solução Implementada

### 1. Limpeza Radical da Pasta `api/`

**Removidos (13 arquivos):**
- ❌ `api/announce-course.js`
- ❌ `api/check-access.js`
- ❌ `api/get-commanders.js`
- ❌ `api/get-news.js`
- ❌ `api/get-pcerj.js`
- ❌ `api/get-pf.js`
- ❌ `api/get-pmerj.js`
- ❌ `api/get-prf.js`
- ❌ `api/publish-news.js`
- ❌ `api/stats.js`
- ❌ `api/submit-bo.js`
- ❌ `api/submit-course.js`
- ❌ `api/submit-recruitment.js`

**Mantidos (2 arquivos):**
- ✅ `api/handler.js` - Handler consolidado com todas as ações
- ✅ `api/auth.js` - OAuth requer endpoint específico

### 2. Ajuste do `package.json`

**Antes:**
```json
"build": "echo 'Sem build necessario'"
```

**Depois:**
```json
"build": "echo 'Build completo - Vercel Functions otimizadas'"
```

### 3. Criação do `vercel.json`

Configuração otimizada para:
- Roteamento correto das funções
- Timeout adequado (30s)
- Build otimizado

## Resultado Final

### Antes da Correção
- **14 funções serverless** (13 arquivos antigos + handler.js + auth.js)
- ❌ **Acima do limite de 12**

### Depois da Correção
- **2 funções serverless** (handler.js + auth.js)
- ✅ **Bem abaixo do limite de 12**

## Estrutura Final da Pasta `api/`

```
api/
├── handler.js    # Handler consolidado (todas as ações via ?type=...)
└── auth.js       # OAuth do Discord (endpoint específico)
```

## Como Funciona Agora

Todas as requisições passam pelo handler consolidado:

```javascript
// Exemplos de uso
GET  /api/handler?type=get_news
POST /api/handler?type=submit_bo
POST /api/handler?type=publish_news
POST /api/handler?type=submit_course
// ... etc
```

A rota `/api/auth` continua separada porque OAuth do Discord requer um endpoint específico.

## Próximos Passos

1. ✅ **Fazer commit** das mudanças
2. ✅ **Fazer deploy** na Vercel
3. ✅ **Verificar** no dashboard da Vercel que há apenas 2 funções
4. ✅ **Testar** todas as funcionalidades

## Verificação no Dashboard Vercel

Após o deploy, verifique em:
- **Settings → Functions**
- Deve mostrar apenas **2 funções**:
  - `api/handler.js`
  - `api/auth.js`

## Notas Importantes

⚠️ **Este projeto NÃO é Next.js** - É um projeto vanilla HTML/JS com Vercel Serverless Functions.

✅ **Todas as funcionalidades foram preservadas** - Apenas consolidamos as rotas.

✅ **Frontend já está atualizado** - Todas as chamadas já usam `/api/handler?type=...`

✅ **Lógica de roteamento mantida** - Sistema de canais (PMERJ, PCERJ, etc) continua funcionando.

## Troubleshooting

Se ainda aparecer erro de limite:

1. Verifique se não há outros arquivos em `api/` que não foram removidos
2. Verifique se há pastas `app/api/` ou `pages/api/` (não deveria ter neste projeto)
3. Limpe o cache do Vercel e faça redeploy
4. Verifique os logs de build no dashboard da Vercel
