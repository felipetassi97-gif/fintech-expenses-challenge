# Gestão financeira corporativa

Aplicação para registrar e acompanhar receitas e despesas por categoria, com dados separados por usuário. A API e a interface compartilham este repositório e são executadas de forma independente.

## Escopo

O sistema contempla autenticação, gestão de categorias, transações financeiras e indicadores consolidados. No estado atual, estão disponíveis a estrutura das aplicações, a modelagem do banco e os DTOs iniciais; as rotas e telas funcionais ainda não foram implementadas.

## Tecnologias e organização

- `apps/api`: NestJS, TypeScript, Prisma e PostgreSQL.
- `apps/web`: React, TypeScript e Vite.
- Raiz: npm workspaces e scripts compartilhados.

## Execução local

Requisitos: Node.js 24.15 ou superior na linha 24, npm e PostgreSQL.

Na raiz do repositório, instale as dependências e prepare as variáveis de ambiente:

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Em `apps/api/.env`, ajuste `DATABASE_URL` para o banco local e defina `JWT_SECRET`. `PORT` configura a porta da API. Em `apps/web/.env`, `VITE_API_URL` indica a URL da API; seu consumo será integrado à interface posteriormente.

Gere o cliente Prisma e aplique as migrations:

```bash
npm run prisma:generate -w @fintech/api
npm run prisma:deploy -w @fintech/api
```

Inicie a API e a interface em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

Para criar migrations durante o desenvolvimento, use `npm run prisma:migrate -w @fintech/api`.

## Decisões técnicas

O PostgreSQL armazena valores monetários como `Decimal(14,2)` e datas sem horário. A relação entre transações e categorias inclui o identificador do usuário, garantindo no banco que ambos tenham o mesmo proprietário. Restrições também impedem valores não positivos e a exclusão de categorias com transações.

A API está organizada por responsabilidade em módulos NestJS. O monorepo mantém API e interface próximas, com dependências e execução independentes.

## Verificações

Execute `npm run build`, `npm run typecheck` e `npm run lint` na raiz. Ainda não há suíte de testes automatizados ou demonstração pública disponível.
