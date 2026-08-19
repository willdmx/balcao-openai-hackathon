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

Para a próxima etapa, copie `.env.example` para `.env.local` e preencha
`OPENAI_API_KEY`. A interface e os contratos não dependem da chave para compilar.

## Arquitetura mínima

- `app/`: interface única do MVP, sem dashboard ou autenticação.
- `lib/domain/`: schemas Zod do plano, aprovação e eventos de execução.
- `lib/inventory/`: estado inicial da demonstração.
- `lib/tools/`: argumentos, resultados e definições das quatro tools.

O registro de tools expõe ao planejador somente `check_inventory`. As três tools
que alteram estado só podem ser obtidas por `getExecutionToolsForApprovedPlan`,
que valida o estado `approved` antes de liberá-las.

## Estado desta etapa

A interface é uma prévia fiel do golden path. Os botões de planejamento e
aprovação estão intencionalmente desabilitados até a integração da OpenAI e dos
executores em memória na próxima etapa. Nenhuma mutação é simulada.
