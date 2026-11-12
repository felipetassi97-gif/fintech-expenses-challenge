# Gestão financeira corporativa

Aplicação para registrar e acompanhar receitas e despesas por categoria, com dados separados por usuário. A API e a interface compartilham este repositório e são executadas de forma independente.

## Escopo

O sistema contempla autenticação, gestão de categorias, transações financeiras e indicadores consolidados. A API oferece autenticação, gestão de categorias e transações, além de indicadores financeiros. As telas da aplicação ainda estão em desenvolvimento.

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

A autenticação usa bcrypt para armazenar senhas como hashes e JWT com validade de uma hora. A API está organizada por responsabilidade em módulos NestJS. O monorepo mantém API e interface próximas, com dependências e execução independentes.

## Autenticação

- `POST /api/auth/register`: recebe `{ "name", "email", "password" }` e retorna o usuário sem a senha.
- `POST /api/auth/login`: recebe `{ "email", "password" }` e retorna `{ "accessToken" }`.
- `GET /api/auth/me`: recebe o token em `Authorization: Bearer <token>` e retorna o usuário autenticado.

O e-mail é normalizado para minúsculas e sem espaços nas extremidades. No cadastro, a senha deve ter pelo menos oito caracteres e no máximo 72 bytes em UTF-8. Erros retornam `{ statusCode, message }`.

## Categorias, transações e indicadores

As rotas abaixo exigem `Authorization: Bearer <token>`. Cada usuário acessa apenas seus próprios dados.

- `GET` e `POST /api/categories`; `GET`, `PATCH` e `DELETE /api/categories/:id`. A exclusão de categoria vinculada a transações retorna 409.
- `GET` e `POST /api/transactions`; `GET`, `PATCH` e `DELETE /api/transactions/:id`. A listagem aceita `type`, `categoryId`, `startDate`, `endDate`, `page` e `limit` e retorna `data` e `pagination`.
- `GET /api/dashboard` aceita `startDate` e `endDate` e retorna `balance`, `income`, `expense` e `topCategories`. O saldo considera todo o histórico; os demais indicadores consideram o período informado.

Datas usam `YYYY-MM-DD`, com limites inclusivos. Valores monetários são strings decimais com até duas casas, como `"120.50"`; os valores de transação devem ser positivos. Sem filtro de período, os indicadores consideram todo o histórico.

## Verificações

Execute `npm run build`, `npm run typecheck` e `npm run lint` na raiz. Os testes da API exigem um PostgreSQL separado para testes, com a migration aplicada:

```bash
export TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/fintech_test?schema=public'
DATABASE_URL="$TEST_DATABASE_URL" npm run prisma:deploy -w @fintech/api
npm run test -w @fintech/api
```

Os testes criam e removem seus próprios dados; não use banco de produção. Ainda não há demonstração pública disponível.
