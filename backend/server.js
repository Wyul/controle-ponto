const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

// Em uso real, defina a variável de ambiente JWT_SEGREDO
const SEGREDO = process.env.JWT_SEGREDO || 'troque-este-segredo-em-producao';

// ---------- BANCO DE DADOS ----------

const db = new Database('ponto.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    jornada_horas REAL NOT NULL DEFAULT 8
  );

  CREATE TABLE IF NOT EXISTS registros (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    data                TEXT NOT NULL,
    entrada             TEXT NOT NULL,
    saida               TEXT,
    intervalo           INTEGER NOT NULL DEFAULT 0,
    minutos_trabalhados INTEGER
  );
`);

// Migração: bancos criados na versão anterior tinham "saida" obrigatória.
// Se for o caso, recria a tabela permitindo ponto em aberto (saida vazia).
const colSaida = db.prepare('PRAGMA table_info(registros)').all()
  .find(c => c.name === 'saida');
if (colSaida && colSaida.notnull === 1) {
  db.exec(`
    BEGIN;
    CREATE TABLE registros_novo (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
      data                TEXT NOT NULL,
      entrada             TEXT NOT NULL,
      saida               TEXT,
      intervalo           INTEGER NOT NULL DEFAULT 0,
      minutos_trabalhados INTEGER
    );
    INSERT INTO registros_novo SELECT * FROM registros;
    DROP TABLE registros;
    ALTER TABLE registros_novo RENAME TO registros;
    COMMIT;
  `);
}

// Migração: bancos antigos não tinham a jornada diária por usuário.
const colunasUsuarios = db.prepare('PRAGMA table_info(usuarios)').all();
if (!colunasUsuarios.some(c => c.name === 'jornada_horas')) {
  db.exec('ALTER TABLE usuarios ADD COLUMN jornada_horas REAL NOT NULL DEFAULT 8');
}

const SELECT_REGISTRO = `
  SELECT r.id, u.nome AS funcionario, r.data, r.entrada, r.saida,
         r.intervalo, r.minutos_trabalhados AS minutosTrabalhados
  FROM registros r
  JOIN usuarios u ON u.id = r.usuario_id
`;

const q = {
  usuarioPorEmail: db.prepare('SELECT * FROM usuarios WHERE email = ?'),
  perfil: db.prepare(
    'SELECT nome, jornada_horas AS jornadaHoras FROM usuarios WHERE id = ?'
  ),
  atualizarJornada: db.prepare('UPDATE usuarios SET jornada_horas = ? WHERE id = ?'),
  inserirUsuario: db.prepare(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)'
  ),
  listarRegistros: db.prepare(
    `${SELECT_REGISTRO} WHERE r.usuario_id = ? ORDER BY r.data DESC, r.entrada DESC`
  ),
  registroDoUsuario: db.prepare(
    `${SELECT_REGISTRO} WHERE r.id = ? AND r.usuario_id = ?`
  ),
  registroAberto: db.prepare(
    `${SELECT_REGISTRO} WHERE r.usuario_id = ? AND r.saida IS NULL
     ORDER BY r.data DESC, r.entrada DESC LIMIT 1`
  ),
  inserirRegistro: db.prepare(`
    INSERT INTO registros (usuario_id, data, entrada, saida, intervalo, minutos_trabalhados)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  atualizarRegistro: db.prepare(`
    UPDATE registros
    SET data = ?, entrada = ?, saida = ?, intervalo = ?, minutos_trabalhados = ?
    WHERE id = ? AND usuario_id = ?
  `),
  fecharRegistro: db.prepare(`
    UPDATE registros SET saida = ?, minutos_trabalhados = ?
    WHERE id = ? AND usuario_id = ?
  `),
  excluirRegistro: db.prepare('DELETE FROM registros WHERE id = ? AND usuario_id = ?')
};

// ---------- APP ----------

const app = express();
app.use(cors());
app.use(express.json());

// ---------- AUTENTICAÇÃO ----------

const gerarToken = (u) =>
  jwt.sign({ id: u.id, nome: u.nome }, SEGREDO, { expiresIn: '8h' });

function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.usuario = jwt.verify(token, SEGREDO);
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  }
}

app.post('/api/auth/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
  }
  if (senha.length < 4) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres' });
  }
  const emailNormalizado = email.trim().toLowerCase();
  if (q.usuarioPorEmail.get(emailNormalizado)) {
    return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });
  }
  const info = q.inserirUsuario.run(
    nome.trim(), emailNormalizado, bcrypt.hashSync(senha, 10)
  );
  const usuario = { id: Number(info.lastInsertRowid), nome: nome.trim() };
  res.status(201).json({ token: gerarToken(usuario), nome: usuario.nome });
});

app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  const usuario = q.usuarioPorEmail.get((email || '').trim().toLowerCase());
  if (!usuario || !bcrypt.compareSync(senha || '', usuario.senha_hash)) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }
  res.json({ token: gerarToken(usuario), nome: usuario.nome });
});

// ---------- PERFIL (JORNADA DIÁRIA) ----------

app.use('/api/perfil', autenticar);

app.get('/api/perfil', (req, res) => {
  const perfil = q.perfil.get(req.usuario.id);
  if (!perfil) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(perfil);
});

app.put('/api/perfil', (req, res) => {
  const horas = Number(req.body.jornadaHoras);
  if (!(horas > 0 && horas <= 24)) {
    return res.status(400).json({ erro: 'A jornada deve ficar entre 0,5 e 24 horas' });
  }
  q.atualizarJornada.run(horas, req.usuario.id);
  res.json(q.perfil.get(req.usuario.id));
});

// ---------- REGISTROS DE PONTO ----------

const paraMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

// Data (AAAA-MM-DD) e hora (HH:MM) atuais, no fuso do servidor
function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`
  };
}

function validar({ data, entrada, saida, intervalo }) {
  if (!data || !entrada || !saida) {
    return { erro: 'Data, entrada e saída são obrigatórias' };
  }
  const pausa = Number(intervalo) || 0;
  const minutos = paraMinutos(saida) - paraMinutos(entrada) - pausa;
  if (minutos <= 0) {
    return { erro: 'A saída deve ser depois da entrada (descontado o intervalo)' };
  }
  return { minutos, pausa };
}

app.use('/api/registros', autenticar);

// BATER PONTO: sem ponto aberto registra a entrada; com ponto aberto, a saída
app.post('/api/registros/bater', (req, res) => {
  const usuarioId = req.usuario.id;
  const { data, hora } = agora();
  const aberto = q.registroAberto.get(usuarioId);

  if (!aberto) {
    const info = q.inserirRegistro.run(usuarioId, data, hora, null, 0, null);
    return res.status(201).json({
      acao: 'entrada',
      registro: q.registroDoUsuario.get(Number(info.lastInsertRowid), usuarioId)
    });
  }

  if (aberto.data !== data) {
    const [a, m, d] = aberto.data.split('-');
    return res.status(409).json({
      erro: `Existe um ponto aberto do dia ${d}/${m}/${a}. Edite esse registro e informe a saída.`
    });
  }

  const minutos = Math.max(
    0,
    paraMinutos(hora) - paraMinutos(aberto.entrada) - aberto.intervalo
  );
  q.fecharRegistro.run(hora, minutos, aberto.id, usuarioId);
  res.json({
    acao: 'saida',
    registro: q.registroDoUsuario.get(aberto.id, usuarioId)
  });
});

// READ
app.get('/api/registros', (req, res) => {
  res.json(q.listarRegistros.all(req.usuario.id));
});

// CREATE (lançamento manual)
app.post('/api/registros', (req, res) => {
  const v = validar(req.body);
  if (v.erro) return res.status(400).json({ erro: v.erro });

  const { data, entrada, saida } = req.body;
  const info = q.inserirRegistro.run(
    req.usuario.id, data, entrada, saida, v.pausa, v.minutos
  );
  res.status(201).json(
    q.registroDoUsuario.get(Number(info.lastInsertRowid), req.usuario.id)
  );
});

// UPDATE
app.put('/api/registros/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!q.registroDoUsuario.get(id, req.usuario.id)) {
    return res.status(404).json({ erro: 'Registro não encontrado' });
  }
  const v = validar(req.body);
  if (v.erro) return res.status(400).json({ erro: v.erro });

  const { data, entrada, saida } = req.body;
  q.atualizarRegistro.run(data, entrada, saida, v.pausa, v.minutos, id, req.usuario.id);
  res.json(q.registroDoUsuario.get(id, req.usuario.id));
});

// DELETE
app.delete('/api/registros/:id', (req, res) => {
  q.excluirRegistro.run(Number(req.params.id), req.usuario.id);
  res.status(204).end();
});

app.listen(3000, () => console.log('API rodando em http://localhost:3000'));
