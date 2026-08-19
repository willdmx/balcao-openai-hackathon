# BALCÃO

MVP criado para o OpenAI Hackathon Brasil 2026. O BALCÃO transforma uma
solicitação em linguagem natural em um plano operacional revisável e só executa
ações que alteram estado depois da aprovação humana.

## Rodar localmente

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

No Windows, prepare e autentique uma vez o runtime local do Codex:

```bash
npm run codex:setup
npm run codex:login
```

Copie `.env.example` para `.env.local` e mantenha
`BALCAO_AI_PROVIDER=codex`. Esse modo usa a autenticação local do Codex e não
exige `OPENAI_API_KEY`. A chave e `OPENAI_MODEL` ficam disponíveis somente para
o provider futuro `openai`.

## Arquitetura mínima

- `app/`: interface única do MVP, sem dashboard ou autenticação.
- `app/api/plan/`: endpoint de planejamento com o Codex local autenticado.
- `app/api/execute/`: execução determinística e idempotente após aprovação.
- `lib/domain/`: schemas Zod do plano, aprovação e eventos de execução.
- `lib/inventory/`: estoque local e implementação somente leitura de
  `check_inventory`.
- `lib/planning/`: providers de IA, interpretação estruturada e montagem
  determinística do plano.
- `lib/state/`: armazenamento local em memória para estoque, pedidos, reservas,
  cobranças e registros de idempotência.
- `lib/tools/`: contratos, definições e executores validados das quatro tools.

O planejamento usa a abstração `AIPlanner`, com `CodexLocalPlanner` para a demo
e `OpenAIResponsesPlanner` preservado para uso futuro. O provider interpreta
somente cliente, produto, quantidade, preço, prazo e ações solicitadas. Depois,
o código da aplicação chama `check_inventory`, calcula o total e monta um
`OperationPlan` validado com Zod.

O Codex roda de forma efêmera em um diretório temporário vazio, com sandbox
somente leitura, sem web, sem configuração do usuário e com timeout. O runtime
local em `.balcao-runtime` é ignorado pelo Git; a autenticação permanece sob
controle do próprio Codex e nunca é copiada para o projeto.

## Estado desta etapa

O botão **Gerar plano** usa o Codex real. **Aprovar execução** só é habilitado
quando o plano possui estoque suficiente e chama, nessa ordem, `create_order`,
`reserve_inventory` e `create_payment`. A execução usa `operationId`, é atômica
e idempotente, e permanece inteiramente local. O estado é mantido em memória no
processo e volta ao estoque inicial quando o servidor é reiniciado.

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
