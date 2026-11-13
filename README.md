# Gestão financeira corporativa

Aplicação para registrar e acompanhar receitas e despesas por categoria, com dados separados por usuário. A API e a interface compartilham este repositório e são executadas de forma independente.

- Aplicação pública: https://fintech-expenses-challenge.netlify.app
- Repositório: https://github.com/felipetassi97-gif/fintech-expenses-challenge

Conta de demonstração:

- E-mail: `contateste@teste.com`
- Senha: `Teste123@`

## Escopo

O sistema contempla autenticação, gestão de categorias, transações financeiras e indicadores consolidados. A interface React consome a API para autenticação, operações de categorias e transações e consulta dos indicadores.

## Tecnologias e organização

- `apps/api`: NestJS, TypeScript, Prisma e PostgreSQL.
- `apps/web`: React, TypeScript e Vite.
- Raiz: npm workspaces e scripts compartilhados.

## Execução local

Requisitos: Node.js 24.15 ou superior na linha 24, npm e PostgreSQL.

Na raiz do repositório, instale as dependências e crie os arquivos de ambiente apenas se ainda não existirem:

```bash
npm install
cp -n apps/api/.env.example apps/api/.env
cp -n apps/web/.env.example apps/web/.env
```

Em `apps/api/.env`, configure `DATABASE_URL` para o PostgreSQL local e substitua `JWT_SECRET` por um valor aleatório, por exemplo, gerado com `openssl rand -hex 32`. `PORT` define a porta da API. Em `apps/web/.env`, `VITE_API_URL` aponta para a API. `CORS_ORIGINS` lista as origens do frontend separadas por vírgula; o exemplo inclui os endereços padrão do Vite.

Gere o cliente Prisma e aplique as migrations:

```bash
npm run prisma:generate -w @fintech/api
npm run prisma:deploy -w @fintech/api
```

Inicie a API e o frontend em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

Abra o endereço informado pelo Vite e crie uma conta pela interface. Para criar migrations durante o desenvolvimento, use `npm run prisma:migrate -w @fintech/api`.

## Banco PostgreSQL para a demonstração pública (Neon Free)

O desafio exige PostgreSQL e migrations, sem exigir um provedor pago. Para a demonstração, use um projeto PostgreSQL no plano gratuito do Neon. O código da API já usa uma URL PostgreSQL padrão por `DATABASE_URL`.

No painel do Neon, copie as duas URLs de conexão:

- Configure a URL **pooled** (host com `-pooler`) como `DATABASE_URL`. A API NestJS usa essa URL em runtime.
- Configure a URL **direct** (host sem `-pooler`) como `DIRECT_URL`. O Prisma CLI usa essa URL para migrations.

Mantenha os parâmetros TLS fornecidos pelo Neon, incluindo `sslmode=require`. Configure ambas as variáveis e `JWT_SECRET`, `PORT` e `CORS_ORIGINS` somente no serviço da API. O frontend recebe apenas `VITE_API_URL`; nunca exponha credenciais do banco no Vite ou no repositório.

Antes de liberar a API, aplique as migrations versionadas com `npm run prisma:deploy -w @fintech/api`, usando `DIRECT_URL`. Para alterações de esquema, crie e versione uma migration em um ambiente de desenvolvimento e aplique-a no banco público com `prisma:deploy`; não use `migrate dev` no banco da demonstração.

Mantenha os testes em um banco isolado e os dados públicos fictícios. A suíte e2e cria e remove registros, então `TEST_DATABASE_URL` nunca deve apontar para o banco Neon usado pela demonstração. O plano gratuito é adequado à avaliação, mas sua janela de recuperação é curta; não use esta instância para dados financeiros reais.

## Decisões técnicas

O PostgreSQL armazena valores monetários como `Decimal(14,2)` e datas sem horário. A relação entre transações e categorias inclui o identificador do usuário, garantindo no banco que ambos tenham o mesmo proprietário. Restrições também impedem valores não positivos; excluir uma categoria exclui em cascata suas transações.

A autenticação usa bcrypt para armazenar senhas como hashes e JWT com validade de uma hora. A API está organizada por responsabilidade em módulos NestJS. O monorepo mantém API e interface próximas, com dependências e execução independentes.

No frontend, React Router usa rotas por hash para funcionar em hospedagem estática. A Context API compartilha a sessão e o usuário autenticado entre as rotas, enquanto as telas mantêm seus formulários e filtros em estado local; essa divisão evita um store global para dados que não são compartilhados. Uma camada Fetch centraliza URL, autenticação, serialização e mensagens de erro para manter as páginas focadas na interface e nas ações do usuário.

## Autenticação

- `POST /api/auth/register`: recebe `{ "name", "email", "password" }` e retorna o usuário sem a senha.
- `POST /api/auth/login`: recebe `{ "email", "password" }` e retorna `{ "accessToken" }`.
- `GET /api/auth/me`: recebe o token em `Authorization: Bearer <token>` e retorna o usuário autenticado.

O e-mail é normalizado para minúsculas e sem espaços nas extremidades. No cadastro, a senha deve ter pelo menos oito caracteres e no máximo 72 bytes em UTF-8. Erros retornam `{ statusCode, message }`.

## Categorias, transações e indicadores

As rotas abaixo exigem `Authorization: Bearer <token>`. Cada usuário acessa apenas seus próprios dados.

- `GET` e `POST /api/categories`; `GET`, `PATCH` e `DELETE /api/categories/:id`. A exclusão de categoria também exclui suas transações vinculadas.
- `GET` e `POST /api/transactions`; `GET`, `PATCH` e `DELETE /api/transactions/:id`. A listagem aceita `type`, `categoryId`, `startDate`, `endDate`, `page` e `limit` e retorna `data` e `pagination`.
- `GET /api/dashboard` aceita `startDate`, `endDate`, `comparisonStartDate` e `comparisonEndDate`. Retorna o saldo atual até a data de hoje no fuso `America/Sao_Paulo` (`balance`), o saldo de todas as transações, inclusive futuras (`historicalBalance`), o saldo até o fim do intervalo (`balanceAtEnd`), entradas, despesas, as três categorias de maior volume e os indicadores calculados no backend. Os dois limites de comparação devem ser informados juntos e precisam anteceder o período selecionado.

Datas usam `YYYY-MM-DD`, com limites inclusivos. Valores monetários são strings decimais com até duas casas, como `"120.50"`; os valores de transação devem ser positivos. O frontend compara o intervalo selecionado com o período anterior equivalente e a API calcula as variações percentuais e as diferenças monetárias absolutas (`amountDifference`). Quando não existe período anterior (como em todo o histórico), ou quando a base anterior é zero, a resposta sinaliza que não há percentual disponível em vez de exibir uma variação enganosa.

Os indicadores do período seguem estas fórmulas: crescimento das entradas e variação das despesas comparam os totais dos dois períodos; participação operacional é o total de despesas dividido pelo total de entradas; resultado do período é entradas menos despesas. A participação fica indisponível quando não houve entradas. O saldo exibido acompanha a data final selecionada; sem data final, apresenta o saldo atual. Os períodos rápidos consideram a data corrente no fuso `America/Sao_Paulo`, igual ao cálculo do saldo atual na API.

## Verificações

Execute `npm run build`, `npm run typecheck` e `npm run lint` na raiz. Os testes da API exigem um PostgreSQL separado para testes, com a migration aplicada:

```bash
export TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/fintech_test?schema=public'
DIRECT_URL="$TEST_DATABASE_URL" DATABASE_URL="$TEST_DATABASE_URL" npm run prisma:deploy -w @fintech/api
npm run test -w @fintech/api
node --test apps/web/test/*.test.mjs
```

Os testes criam e removem seus próprios dados; não use banco de produção. É possível criar uma conta pela interface para experimentar a aplicação.
