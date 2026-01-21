# Migração para Next.js 14 - App Router

## Estrutura Criada

### Arquivos de Configuração
- ✅ `package.json` - Atualizado com dependências Next.js
- ✅ `tsconfig.json` - Configuração TypeScript
- ✅ `tailwind.config.ts` - Configuração Tailwind com cores customizadas
- ✅ `postcss.config.js` - Configuração PostCSS
- ✅ `next.config.js` - Configuração Next.js

### Estrutura de Pastas
```
app/
├── layout.tsx          # Layout base com Sidebar
├── page.tsx            # Dashboard principal
├── globals.css         # Estilos globais (copiado de main.css)
├── pmerj/
│   └── page.tsx        # Página PMERJ
├── pcerj/
│   └── page.tsx        # Página PCERJ
├── pf/
│   └── page.tsx        # Página PF
├── prf/
│   └── page.tsx        # Página PRF
└── jornal/
    └── page.tsx        # Página Jornal Mare

components/
└── Sidebar.tsx         # Componente Sidebar
```

## Rotas Criadas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `app/page.tsx` | Dashboard principal |
| `/pmerj` | `app/pmerj/page.tsx` | Polícia Militar |
| `/pcerj` | `app/pcerj/page.tsx` | Polícia Civil |
| `/pf` | `app/pf/page.tsx` | Polícia Federal |
| `/prf` | `app/prf/page.tsx` | Polícia Rodoviária Federal |
| `/jornal` | `app/jornal/page.tsx` | Jornal Mare |

## Instalação

```bash
npm install
```

## Executar em Desenvolvimento

```bash
npm run dev
```

## Build para Produção

```bash
npm run build
npm start
```

## Mudanças Realizadas

### HTML → JSX
- `class` → `className`
- Tags `<img>` fechadas → `<img />`
- `style` inline convertido para objetos JavaScript
- Eventos `onclick` → `onClick` (quando necessário)

### Componentes
- Sidebar extraída para componente React reutilizável
- Uso de `usePathname()` para destacar rota ativa
- Integração com localStorage para dados do usuário

### Estilos
- Todo o CSS de `main.css` migrado para `globals.css`
- Variáveis CSS mantidas
- Estilos específicos de departamentos preservados
- Tailwind configurado mas CSS original mantido

## Próximos Passos

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Testar localmente:**
   ```bash
   npm run dev
   ```

3. **Ajustar caminhos de imagens:**
   - Verificar se as imagens em `/public/images/` estão acessíveis
   - Ajustar caminhos se necessário (Next.js usa `/public` como raiz)

4. **Migrar scripts JavaScript:**
   - Converter funções do `scripts/app.js` para hooks React quando necessário
   - Integrar lógica de autenticação com Next.js

5. **Otimizar imagens:**
   - Considerar usar `next/image` para otimização (atualmente usando `<img />` normal)

## Notas Importantes

⚠️ **Arquivos HTML originais foram preservados** - Não foram deletados, podem ser usados como referência.

⚠️ **Caminhos de imagens** - As imagens estão usando `/public/images/...` mas no Next.js devem ser `/images/...` (Next.js serve `/public` como raiz).

⚠️ **API Routes** - As APIs em `api/handler.js` continuam funcionando, mas podem precisar de ajustes para funcionar com Next.js.

## Compatibilidade

- ✅ Next.js 14.2.0
- ✅ React 18.3.0
- ✅ TypeScript 5.4.0
- ✅ Tailwind CSS 3.4.0
