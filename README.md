# ⏱️ Controle de Ponto

Aplicação web para **controle de horário de trabalho**. Cada usuário cria sua conta, registra entradas e saídas (batendo o ponto com um clique ou lançando manualmente) e acompanha o total de horas trabalhadas.

O projeto é dividido em duas partes:

- **`backend/`** — API REST em Node.js + Express, com banco SQLite e autenticação JWT.
- **`frontend/`** — Interface em Angular com Bootstrap.

## ✨ Funcionalidades

- Cadastro e login de usuários (senhas protegidas com bcrypt)
- Autenticação por token JWT (sessão de 8 horas)
- **Bater ponto**: o primeiro registro do dia marca a entrada; o seguinte marca a saída
- Lançamento manual de registros (data, entrada, saída e intervalo em minutos)
- Edição e exclusão de registros
- Cálculo automático das horas trabalhadas (descontando o intervalo)
- Total geral de horas trabalhadas
- Jornada diária configurável por usuário (padrão: 8 horas)
- Cada usuário enxerga apenas os próprios registros

## 🛠️ Tecnologias

| Camada   | Tecnologias                                                     |
| -------- | --------------------------------------------------------------- |
| Backend  | Node.js, Express 5, better-sqlite3, jsonwebtoken, bcryptjs, CORS |
| Frontend | Angular 22, Bootstrap 5, RxJS, TypeScript                       |
| Banco    | SQLite (arquivo `ponto.db`, modo WAL)                           |

## 📁 Estrutura do projeto

```
controle-ponto/
├── backend/
│   ├── server.js          # API, banco de dados e autenticação
│   └── package.json
├── frontend/
│   ├── src/app/
│   │   ├── app.component.ts     # Tela de login e controle de ponto
│   │   ├── auth.service.ts      # Login, cadastro e sessão
│   │   ├── auth.interceptor.ts  # Envia o token JWT nas requisições
│   │   └── ponto.service.ts     # Comunicação com /api/registros
│   └── package.json
└── .gitignore
```

## 🚀 Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- npm

### 1. Clonar o repositório

```bash
git clone https://github.com/Wyul/controle-ponto.git
cd controle-ponto
```

### 2. Iniciar o backend

```bash
cd backend
npm install
node server.js
```

A API ficará disponível em `http://localhost:3000`. O banco `ponto.db` é criado automaticamente na primeira execução.

> 🔐 **Importante:** em uso real, defina a variável de ambiente `JWT_SEGREDO` com um valor longo e aleatório:
>
> ```bash
> JWT_SEGREDO="sua-chave-secreta" node server.js
> ```
>
> No Windows (PowerShell): `$env:JWT_SEGREDO="sua-chave-secreta"; node server.js`

### 3. Iniciar o frontend

Em outro terminal:

```bash
cd frontend
npm install
npm start
```

Acesse `http://localhost:4200/`, crie uma conta e comece a registrar seus horários.

## 📡 Endpoints da API

Todas as rotas, exceto as de autenticação, exigem o cabeçalho `Authorization: Bearer <token>`.

### Autenticação

| Método | Rota                    | Descrição                          |
| ------ | ----------------------- | ---------------------------------- |
| POST   | `/api/auth/registrar`   | Cria uma conta e retorna o token   |
| POST   | `/api/auth/login`       | Autentica e retorna o token        |

### Perfil

| Método | Rota           | Descrição                                |
| ------ | -------------- | ---------------------------------------- |
| GET    | `/api/perfil`  | Retorna nome e jornada diária (horas)    |
| PUT    | `/api/perfil`  | Atualiza a jornada (`jornadaHoras`)      |

### Registros de ponto

| Método | Rota                    | Descrição                                                         |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| POST   | `/api/registros/bater`  | Registra a entrada ou, se houver ponto aberto, a saída            |
| GET    | `/api/registros`        | Lista os registros do usuário                                     |
| POST   | `/api/registros`        | Cria um registro manual                                           |
| PUT    | `/api/registros/:id`    | Atualiza um registro                                              |
| DELETE | `/api/registros/:id`    | Exclui um registro                                                |

**Exemplo de corpo para criar/editar um registro:**

```json
{
  "data": "2026-10-05",
  "entrada": "08:00",
  "saida": "17:00",
  "intervalo": 60
}
```

## 🗄️ Banco de dados

Duas tabelas SQLite:

- **`usuarios`** — `id`, `nome`, `email` (único), `senha_hash`, `jornada_horas`
- **`registros`** — `id`, `usuario_id`, `data`, `entrada`, `saida`, `intervalo`, `minutos_trabalhados`

O servidor aplica migrações automáticas em bancos criados em versões anteriores.

## 📝 Observações

- O frontend está configurado para acessar a API em `http://localhost:3000`. Para outro endereço, altere as URLs em `frontend/src/app/auth.service.ts` e `frontend/src/app/ponto.service.ts`.
- Data e hora do botão "bater ponto" seguem o fuso horário do servidor.
- O arquivo `ponto.db` está no `.gitignore` e não é versionado.

## 📄 Licença

Defina aqui a licença do projeto (por exemplo, MIT).
