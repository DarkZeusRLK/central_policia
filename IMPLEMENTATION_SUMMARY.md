# Resumo da Implementação - Roteamento de Canais Discord

## Arquivos Criados

### 1. `lib/discord-router.js`
Função utilitária de roteamento que:
- Recebe os cargos do usuário, lista de cargos de matrizes e lista de canais
- Encontra o índice do cargo correspondente
- Retorna o canal no mesmo índice
- Inclui função auxiliar `sendDiscordMessage` para envio de mensagens

### 2. `api/announce-course.js`
API para anunciar cursos publicamente:
- Envia mensagem para `CHANNEL_CURSOS_ANUNCIADOS`
- Não requer roteamento (canal único)

### 3. `api/submit-course.js`
API para finalizar cursos:
- Envia log resumido para `CHANNEL_CURSOS_FINALIZADOS` (canal padrão)
- Envia relatório detalhado para canal determinado pelo roteamento usando `CHANNEL_CURSOS_RELATORIOS`
- Requer `userRoles` no body da requisição

### 4. `api/submit-recruitment.js`
API para finalizar recrutamentos:
- Envia relatório para canal determinado pelo roteamento usando `CHANNEL_RECRUTAMENTOS_MATRIZES`
- Requer `userRoles` no body da requisição

### 5. `ENV_VARIABLES.md`
Documentação completa das variáveis de ambiente necessárias

## Como Usar

### Frontend - Enviar Cargos do Usuário

Ao chamar as APIs de finalização de curso ou recrutamento, certifique-se de incluir os cargos do usuário:

```javascript
// Exemplo de chamada para submit-course
const userRoles = Session.user.roles; // Array de IDs de cargos

const response = await fetch("/api/submit-course", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    courseName: "Curso de Formação",
    courseDate: "2024-01-15",
    participants: "10",
    instructor: "Instrutor X",
    observations: "Curso realizado com sucesso",
    userId: Session.user.id,
    username: Session.user.username,
    userRoles: userRoles, // IMPORTANTE: Incluir os cargos
  }),
});
```

### Configuração das Variáveis de Ambiente

Adicione as seguintes variáveis ao seu `.env.local` ou `.env`:

```env
CHANNEL_CURSOS_ANUNCIADOS=id_do_canal
CHANNEL_CURSOS_FINALIZADOS=id_do_canal
MATRIZES_ROLE_ID=id1,id2,id3
CHANNEL_RECRUTAMENTOS_MATRIZES=id1,id2,id3
CHANNEL_CURSOS_RELATORIOS=id1,id2,id3
```

⚠️ **IMPORTANTE**: A ordem dos IDs em `MATRIZES_ROLE_ID` deve corresponder exatamente à ordem nas listas de canais.

## Lógica de Roteamento

1. Sistema recebe `userRoles` (array de IDs de cargos do usuário)
2. Compara com `MATRIZES_ROLE_ID` (string separada por vírgulas)
3. Encontra o primeiro cargo correspondente e seu índice
4. Retorna o canal no mesmo índice da lista de canais correspondente

### Exemplo

```
MATRIZES_ROLE_ID = "ID_PMERJ,ID_PCERJ,ID_PRF"
CHANNEL_RECRUTAMENTOS_MATRIZES = "CH_PMERJ,CH_PCERJ,CH_PRF"

Usuário tem cargo ID_PCERJ (índice 1)
→ Canal de destino: CH_PCERJ (índice 1)
```

## Próximos Passos

1. Configurar as variáveis de ambiente no servidor
2. Atualizar o frontend para enviar `userRoles` nas requisições
3. Testar o roteamento com diferentes cargos
4. Verificar se os canais do Discord estão configurados corretamente
