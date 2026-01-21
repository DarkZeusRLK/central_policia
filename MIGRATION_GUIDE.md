# Guia de Migração - Consolidação de APIs

## Resumo da Refatoração

Para resolver o limite de 12 funções serverless da Vercel, consolidamos todas as APIs em uma única rota: `/api/handler.js`.

### Antes (14 funções serverless)

- `/api/submit-bo.js`
- `/api/publish-news.js`
- `/api/get-news.js`
- `/api/check-access.js`
- `/api/get-commanders.js`
- `/api/get-pcerj.js`
- `/api/get-pmerj.js`
- `/api/get-pf.js`
- `/api/get-prf.js`
- `/api/stats.js`
- `/api/announce-course.js`
- `/api/submit-course.js`
- `/api/submit-recruitment.js`
- `/api/auth.js` (mantido separado - OAuth requer endpoint específico) abacate

### Depois (2 funções serverless)

- `/api/handler.js` - Handler consolidado com todas as ações
- `/api/auth.js` - Mantido separado (OAuth)

## Mapeamento de Rotas

Todas as rotas antigas agora usam o parâmetro `?type=...`:

| Rota Antiga               | Nova Rota                              |
| ------------------------- | -------------------------------------- |
| `/api/submit-bo`          | `/api/handler?type=submit_bo`          |
| `/api/publish-news`       | `/api/handler?type=publish_news`       |
| `/api/get-news`           | `/api/handler?type=get_news`           |
| `/api/check-access`       | `/api/handler?type=check_access`       |
| `/api/get-commanders`     | `/api/handler?type=get_commanders`     |
| `/api/get-pcerj`          | `/api/handler?type=get_pcerj`          |
| `/api/get-pmerj`          | `/api/handler?type=get_pmerj`          |
| `/api/get-pf`             | `/api/handler?type=get_pf`             |
| `/api/get-prf`            | `/api/handler?type=get_prf`            |
| `/api/stats`              | `/api/handler?type=stats`              |
| `/api/announce-course`    | `/api/handler?type=announce_course`    |
| `/api/submit-course`      | `/api/handler?type=submit_course`      |
| `/api/submit-recruitment` | `/api/handler?type=submit_recruitment` |

## Arquivos Atualizados

### Frontend

- ✅ `scripts/app.js` - Todas as chamadas atualizadas
- ✅ `public/central_policial.html` - Chamadas atualizadas
- ✅ `public/jornalmare.html` - Chamadas atualizadas
- ✅ `index.html` - Chamadas atualizadas

### Backend

- ✅ `api/handler.js` - Handler consolidado criado
- ⚠️ Arquivos antigos podem ser removidos após confirmação de funcionamento

## Como Testar

1. **Teste de Rotas GET:**

   ```javascript
   // Antes
   fetch("/api/get-news");

   // Depois
   fetch("/api/handler?type=get_news");
   ```

2. **Teste de Rotas POST:**

   ```javascript
   // Antes
   fetch("/api/submit-bo", {
     method: "POST",
     body: JSON.stringify(data),
   });

   // Depois
   fetch("/api/handler?type=submit_bo", {
     method: "POST",
     body: JSON.stringify(data),
   });
   ```

## Remoção de Arquivos Antigos (Após Testes)

Após confirmar que tudo está funcionando, você pode remover os seguintes arquivos:

```bash
# APIs consolidadas (podem ser removidas)
rm api/submit-bo.js
rm api/publish-news.js
rm api/get-news.js
rm api/check-access.js
rm api/get-commanders.js
rm api/get-pcerj.js
rm api/get-pmerj.js
rm api/get-pf.js
rm api/get-prf.js
rm api/stats.js
rm api/announce-course.js
rm api/submit-course.js
rm api/submit-recruitment.js

# MANTER (não remover)
# api/auth.js - OAuth requer endpoint específico
```

## Benefícios

1. **Redução de Funções Serverless:** De 14 para 2 funções
2. **Economia de Recursos:** Menos funções = menos custo
3. **Manutenção Simplificada:** Toda lógica em um único arquivo
4. **Compatibilidade:** Mantém a mesma interface, apenas muda a URL

## Notas Importantes

- ⚠️ A rota `/api/auth.js` foi **mantida separada** porque OAuth do Discord requer um endpoint específico
- ✅ Todas as funcionalidades foram preservadas
- ✅ A lógica de roteamento de canais (PMERJ, PCERJ, etc.) continua funcionando normalmente
- ✅ Não há mudanças nas variáveis de ambiente necessárias

## Próximos Passos

1. Fazer deploy e testar todas as funcionalidades
2. Verificar se o número de funções serverless está abaixo de 12
3. Após confirmação, remover os arquivos antigos
4. Monitorar logs para garantir que tudo está funcionando corretamente
