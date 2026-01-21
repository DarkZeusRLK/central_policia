# Variáveis de Ambiente - Roteamento de Canais Discord

Este documento descreve as novas variáveis de ambiente necessárias para o sistema de roteamento de canais do Discord.

## Novas Variáveis de Ambiente

Adicione/Atualize estas chaves no seu arquivo `.env.local` ou `.env`:

### Canais de Cursos

```env
# Canal para anúncios públicos de cursos
CHANNEL_CURSOS_ANUNCIADOS=id_do_canal_anuncios_cursos_aqui

# Canal para log simples de cursos finalizados (Geral - todos os departamentos)
CHANNEL_CURSOS_FINALIZADOS=id_do_canal_cursos_finalizados_aqui
```

### Configuração de Roteamento

```env
# Lista de IDs de cargos das matrizes (separados por vírgula)
# IMPORTANTE: A ordem define a correspondência com os canais abaixo
# Exemplo: MATRIZES_ROLE_ID=ID_PMERJ,ID_PCERJ,ID_PRF,ID_PF
MATRIZES_ROLE_ID=id_cargo_pmerj,id_cargo_pcerj,id_cargo_prf,id_cargo_pf

# Lista de IDs de canais para recrutamentos (separados por vírgula)
# IMPORTANTE: Deve estar na mesma ordem dos cargos em MATRIZES_ROLE_ID
# Exemplo: CHANNEL_RECRUTAMENTOS_MATRIZES=ID_CANAL_PMERJ,ID_CANAL_PCERJ,ID_CANAL_PRF,ID_CANAL_PF
CHANNEL_RECRUTAMENTOS_MATRIZES=id_canal_recrutamentos_pmerj,id_canal_recrutamentos_pcerj,id_canal_recrutamentos_prf,id_canal_recrutamentos_pf

# Lista de IDs de canais para relatórios de cursos (separados por vírgula)
# IMPORTANTE: Deve estar na mesma ordem dos cargos em MATRIZES_ROLE_ID
# Exemplo: CHANNEL_CURSOS_RELATORIOS=ID_CANAL_RELATORIOS_PMERJ,ID_CANAL_RELATORIOS_PCERJ,ID_CANAL_RELATORIOS_PRF,ID_CANAL_RELATORIOS_PF
CHANNEL_CURSOS_RELATORIOS=id_canal_relatorios_pmerj,id_canal_relatorios_pcerj,id_canal_relatorios_prf,id_canal_relatorios_pf
```

## Exemplo Completo

```env
# Exemplo de configuração completa
CHANNEL_CURSOS_ANUNCIADOS=1234567890123456789
CHANNEL_CURSOS_FINALIZADOS=9876543210987654321

MATRIZES_ROLE_ID=1111111111111111111,2222222222222222222,3333333333333333333,4444444444444444444
CHANNEL_RECRUTAMENTOS_MATRIZES=5555555555555555555,6666666666666666666,7777777777777777777,8888888888888888888
CHANNEL_CURSOS_RELATORIOS=9999999999999999999,1010101010101010101,1212121212121212121,1313131313131313131
```

## Como Funciona o Roteamento

1. O sistema verifica quais cargos o usuário possui (vindos da sessão/login)
2. Compara esses cargos com a lista `MATRIZES_ROLE_ID`
3. Encontra o índice do primeiro cargo correspondente
4. Usa o mesmo índice para selecionar o canal correto nas listas de canais

### Exemplo Prático

Se `MATRIZES_ROLE_ID=ID_PMERJ,ID_PCERJ,ID_PRF` e o usuário tem o cargo `ID_PCERJ`:
- Índice encontrado: 1 (segunda posição)
- Canal de recrutamento: segundo canal de `CHANNEL_RECRUTAMENTOS_MATRIZES`
- Canal de relatórios: segundo canal de `CHANNEL_CURSOS_RELATORIOS`

## Regras de Postagem

### Ao Anunciar um Curso
- **Canal:** `CHANNEL_CURSOS_ANUNCIADOS`
- **API:** `/api/announce-course`

### Ao Finalizar um Curso
- **Log Resumido:** `CHANNEL_CURSOS_FINALIZADOS` (padrão para todos)
- **Relatório Detalhado:** Canal determinado pelo roteamento usando `CHANNEL_CURSOS_RELATORIOS` + Cargo do Usuário
- **API:** `/api/submit-course`

### Ao Finalizar Recrutamento
- **Canal:** Determinado pelo roteamento usando `CHANNEL_RECRUTAMENTOS_MATRIZES` + Cargo do Usuário
- **API:** `/api/submit-recruitment`

## Notas Importantes

⚠️ **ORDEM É CRUCIAL**: A ordem dos IDs em `MATRIZES_ROLE_ID` deve corresponder exatamente à ordem dos IDs nas listas de canais.

⚠️ **CARGOS DO USUÁRIO**: As APIs de finalização de curso e recrutamento requerem que o `userRoles` seja enviado no body da requisição. Certifique-se de que o frontend está enviando os cargos do usuário logado.
