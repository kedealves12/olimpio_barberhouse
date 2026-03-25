console.log("ATUALIZAÇÃO HORARIOS");

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('./config/db');

const app = express();

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || '123456',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  }
}));

const servicos = {
  corte: { nome: 'Corte', valor: 30, duracao: 45 },
  barba: { nome: 'Barba', valor: 20, duracao: 30 },
  perfil: { nome: 'Perfil', valor: 10, duracao: 15 },
  sobrancelha: { nome: 'Sobrancelha', valor: 10, duracao: 15 },
  corte_1_so_pente: { nome: 'Corte 1 so pente', valor: 20, duracao: 15 },
  pigmentacao: { nome: 'Pigmentação', valor: 20, duracao: 30 },
  limpeza_facial: { nome: 'Limpeza facial', valor: 20, duracao: 30 },
  corte_barba: { nome: 'Corte + barba', valor: 50, duracao: 75 },
  corte_sobrancelha: { nome: 'Corte + sobrancelha', valor: 30, duracao: 45 },
  corte_limpeza_facial: { nome: 'Corte + limpeza facial', valor: 50, duracao: 75 },
  corte_pigmentacao: { nome: 'Corte + pigmentação', valor: 50, duracao: 75 },
  corte_completo: { nome: 'Corte completo', valor: 50, duracao: 75 },
  corte_completo_pigmentacao: { nome: 'Corte completo + pigmentação', valor: 70, duracao: 90 },
  corte_completo_limpeza_facial: { nome: 'Corte completo + limpeza facial', valor: 70, duracao: 90 }
};

function horarioParaMinutos(h) {
  const [hora, min] = h.split(':').map(Number);
  return hora * 60 + min;
}

function minutosParaHorario(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function gerarHorarios() {
  const lista = [];
  let atual = 9 * 60;
  const fim = 19 * 60;

  while (atual < fim) {
    if (atual >= 12 * 60 && atual < 13 * 60) {
      atual += 15;
      continue;
    }

    lista.push(minutosParaHorario(atual));
    atual += 15;
  }

  return lista;
}

function conflito(i1, f1, i2, f2) {
  return i1 < f2 && f1 > i2;
}

function invadeHorarioAlmoco(inicio, fim) {
  const almocoInicio = 12 * 60;
  const almocoFim = 13 * 60;
  return inicio < almocoFim && fim > almocoInicio;
}

function dataLocalISO(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function hojeEAmanha() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  return {
    hojeISO: dataLocalISO(hoje),
    amanhaISO: dataLocalISO(amanha)
  };
}

function validarDataAgendamento(data) {
  if (!data) return 'Data obrigatória.';

  const { hojeISO, amanhaISO } = hojeEAmanha();
  const escolhida = new Date(`${data}T00:00:00`);

  if (Number.isNaN(escolhida.getTime())) return 'Data inválida.';
  if (escolhida.getDay() === 0) return 'Não atendemos aos domingos.';

  const dataEscolhidaISO = dataLocalISO(escolhida);

  if (dataEscolhidaISO !== hojeISO && dataEscolhidaISO !== amanhaISO) {
    return 'Agendamento disponível apenas para hoje e amanhã.';
  }

  return null;
}

async function buscarBarbeirosDaAgenda() {
  const result = await pool.query(
    `SELECT id, nome, role
     FROM usuarios
     WHERE ativo = TRUE
       AND aparece_na_agenda = TRUE
     ORDER BY nome`
  );
  return result.rows;
}

async function criarNotificacao(usuarioId, titulo, mensagem) {
  await pool.query(
    `INSERT INTO notificacoes (usuario_id, titulo, mensagem, lida)
     VALUES ($1, $2, $3, FALSE)`,
    [usuarioId, titulo, mensagem]
  );
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  next();
}

app.get('/api/teste', (req, res) => {
  res.json({ ok: true, mensagem: 'Servidor funcionando' });
});



app.get('/api/barbeiros', async (req, res) => {
  res.json([{ id: 999, nome: 'TESTE BARBEIRO' }]);
});

app.get('/api/teste-banco', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT NOW()');

    return res.json({
      ok: true,
      mensagem: 'Banco conectado com sucesso',
      horario: resultado.rows[0].now
    });

  } catch (error) {
    console.error('ERRO BANCO:', error);

    return res.status(500).json({
      ok: false,
      erro: 'Erro ao conectar no banco'
    });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
    }

    const result = await pool.query(
      `SELECT id, nome, username, role, senha
       FROM usuarios
       WHERE username = $1
         AND ativo = TRUE`,
      [username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const usuario = result.rows[0];
    const senhaCorreta = await bcrypt.compare(password, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    req.session.user = {
      id: usuario.id,
      nome: usuario.nome,
      username: usuario.username,
      role: usuario.role
    };

    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).json({ erro: 'Erro ao salvar sessão' });
      }

      return res.json({
        ok: true,
        role: usuario.role,
        nome: usuario.nome
      });
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro no servidor' });
  }
});

app.get('/api/servicos', (req, res) => {
  res.json(servicos);
});

app.get('/api/barbeiros', async (req, res) => {
  try {
    const barbeiros = await buscarBarbeirosDaAgenda();
    res.json(barbeiros);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar barbeiros.' });
  }
});

app.get('/api/horarios-disponiveis', async (req, res) => {
  const { data, barbeiro, servico } = req.query;

  if (!data || !barbeiro || !servico) {
    return res.status(400).json({ erro: 'Data, barbeiro e serviço são obrigatórios.' });
  }

  const erroData = validarDataAgendamento(data);
  if (erroData) {
    return res.status(400).json({ erro: erroData });
  }

  const s = servicos[servico];
  if (!s) {
    return res.status(400).json({ erro: 'Serviço inválido.' });
  }

  try {
    const base = gerarHorarios();
    const agora = new Date();
    const hojeLocal = dataLocalISO(agora);
    const agoraMinutos = agora.getHours() * 60 + agora.getMinutes();

    if (barbeiro === 'qualquer') {
      const barbeiros = await buscarBarbeirosDaAgenda();
      const livres = [];

      for (const h of base) {
        const inicio = horarioParaMinutos(h);
        const fim = inicio + s.duracao;

        if (data === hojeLocal && inicio <= agoraMinutos + 10) continue;
        if (fim > 19 * 60) continue;
        if (invadeHorarioAlmoco(inicio, fim)) continue;

        let algumLivre = false;

        for (const b of barbeiros) {
          const result = await pool.query(
            `SELECT hora, duracao
             FROM agendamentos
             WHERE data = $1
               AND barbeiro_id = $2
               AND status = 'agendado'`,
            [data, b.id]
          );

          let livre = true;

          for (const item of result.rows) {
            const i = horarioParaMinutos(String(item.hora).slice(0, 5));
            const f = i + Number(item.duracao || 0);

            if (conflito(inicio, fim, i, f)) {
              livre = false;
              break;
            }
          }

          if (livre) {
            algumLivre = true;
            break;
          }
        }

        if (algumLivre) livres.push(h);
      }

      return res.json(livres);
    }

    const barbeiroId = Number(barbeiro);

    const result = await pool.query(
      `SELECT hora, duracao
       FROM agendamentos
       WHERE data = $1
         AND barbeiro_id = $2
         AND status = 'agendado'`,
      [data, barbeiroId]
    );

    const livres = base.filter((h) => {
      const inicio = horarioParaMinutos(h);
      const fim = inicio + s.duracao;

      if (data === hojeLocal && inicio <= agoraMinutos + 10) return false;
      if (fim > 19 * 60) return false;
      if (invadeHorarioAlmoco(inicio, fim)) return false;

      for (const item of result.rows) {
        const i = horarioParaMinutos(String(item.hora).slice(0, 5));
        const f = i + Number(item.duracao || 0);

        if (conflito(inicio, fim, i, f)) return false;
      }

      return true;
    });

    return res.json(livres);
  } catch (error) {
    console.error('Erro em /api/horarios-disponiveis:', error);
    return res.status(500).json({ erro: 'Erro ao buscar horários disponíveis.' });
  }
});

app.post('/api/agendamentos', async (req, res) => {
  let { cliente, telefone, barbeiro, servico, data, hora, pagamento } = req.body;

  if (!cliente || !barbeiro || !servico || !data || !hora) {
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
  }

  const erroData = validarDataAgendamento(data);
  if (erroData) {
    return res.status(400).json({ erro: erroData });
  }

  const s = servicos[servico];
  if (!s) {
    return res.status(400).json({ erro: 'Serviço inválido.' });
  }

  try {
    const inicioNovo = horarioParaMinutos(hora);
    const fimNovo = inicioNovo + s.duracao;

    const agora = new Date();
    const hojeLocal = dataLocalISO(agora);
    const agoraMinutos = agora.getHours() * 60 + agora.getMinutes();

    if (data === hojeLocal && inicioNovo <= agoraMinutos + 10) {
      return res.status(400).json({ erro: 'Esse horário já passou. Escolha um horário futuro.' });
    }

    if (fimNovo > 19 * 60) {
      return res.status(400).json({ erro: 'Esse serviço ultrapassa o horário de funcionamento.' });
    }

    if (invadeHorarioAlmoco(inicioNovo, fimNovo)) {
      return res.status(400).json({ erro: 'Esse serviço invade o horário de almoço. Escolha outro horário.' });
    }

    let barbeiroNome = '';
    let barbeiroIdFinal = null;

    if (barbeiro === 'qualquer') {
      const barbeiros = await buscarBarbeirosDaAgenda();
      let barbeiroEscolhido = null;

      for (const b of barbeiros) {
        const resultado = await pool.query(
          `SELECT hora, duracao
           FROM agendamentos
           WHERE data = $1
             AND barbeiro_id = $2
             AND status = 'agendado'`,
          [data, b.id]
        );

        let livre = true;

        for (const item of resultado.rows) {
          const inicioExistente = horarioParaMinutos(String(item.hora).slice(0, 5));
          const fimExistente = inicioExistente + Number(item.duracao || 0);

          if (conflito(inicioNovo, fimNovo, inicioExistente, fimExistente)) {
            livre = false;
            break;
          }
        }

        if (livre) {
          barbeiroEscolhido = b;
          break;
        }
      }

      if (!barbeiroEscolhido) {
        return res.status(400).json({ erro: 'Nenhum barbeiro disponível nesse horário.' });
      }

      barbeiroIdFinal = barbeiroEscolhido.id;
      barbeiroNome = barbeiroEscolhido.nome;
    } else {
      barbeiroIdFinal = Number(barbeiro);

      const conflitoResult = await pool.query(
        `SELECT hora, duracao
         FROM agendamentos
         WHERE data = $1
           AND barbeiro_id = $2
           AND status = 'agendado'`,
        [data, barbeiroIdFinal]
      );

      for (const item of conflitoResult.rows) {
        const inicioExistente = horarioParaMinutos(String(item.hora).slice(0, 5));
        const fimExistente = inicioExistente + Number(item.duracao || 0);

        if (conflito(inicioNovo, fimNovo, inicioExistente, fimExistente)) {
          return res.status(400).json({ erro: 'Horário indisponível para esse barbeiro.' });
        }
      }

      const barbeiroResult = await pool.query(
        `SELECT nome
         FROM usuarios
         WHERE id = $1`,
        [barbeiroIdFinal]
      );

      barbeiroNome = barbeiroResult.rows[0]?.nome || '';
    }

    await pool.query(
      `INSERT INTO agendamentos
       (cliente, telefone, barbeiro_id, servico, data, hora, valor, duracao, pagamento, status, origem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'agendado', 'agendado')`,
      [cliente, telefone || '', barbeiroIdFinal, s.nome, data, hora, s.valor, s.duracao, pagamento || '']
    );

    const dataFormatada = data.split('-').reverse().join('/');

    await criarNotificacao(
      barbeiroIdFinal,
      'Novo agendamento',
      `${cliente} agendou ${s.nome} para ${dataFormatada} às ${hora}.`
    );

    return res.json({
      ok: true,
      mensagem: 'Agendamento salvo com sucesso.',
      barbeiroNome
    });
  } catch (error) {
    console.error('Erro em /api/agendamentos:', error);
    return res.status(500).json({ erro: 'Erro ao salvar agendamento.' });
  }
});

app.get('/api/notificacoes', requireAuth, async (req, res) => {
  try {
    const usuarioId = req.session.user.id;

    const result = await pool.query(
      `SELECT id, titulo, mensagem, lida, criado_em
       FROM notificacoes
       WHERE usuario_id = $1
       ORDER BY criado_em DESC
       LIMIT 20`,
      [usuarioId]
    );

    const naoLidas = result.rows.filter((n) => !n.lida).length;

    res.json({
      totalNaoLidas: naoLidas,
      notificacoes: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar notificações.' });
  }
});

app.patch('/api/notificacoes/:id/lida', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.user.id;

    await pool.query(
      `UPDATE notificacoes
       SET lida = TRUE
       WHERE id = $1
         AND usuario_id = $2`,
      [id, usuarioId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao marcar notificação como lida.' });
  }
});

app.patch('/api/notificacoes/marcar-todas', requireAuth, async (req, res) => {
  try {
    const usuarioId = req.session.user.id;

    await pool.query(
      `UPDATE notificacoes
       SET lida = TRUE
       WHERE usuario_id = $1
         AND lida = FALSE`,
      [usuarioId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao marcar notificações.' });
  }
});

app.get('/api/barbeiro/agenda', requireAuth, async (req, res) => {
  const usuarioId = req.session.user.id;

  try {
    const { hojeISO, amanhaISO } = hojeEAmanha();

    const result = await pool.query(
      `SELECT id, cliente, telefone, servico, data, hora, valor, pagamento, status
       FROM agendamentos
       WHERE barbeiro_id = $1
         AND data IN ($2, $3)
         AND status = 'agendado'
       ORDER BY data, hora`,
      [usuarioId, hojeISO, amanhaISO]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar agenda.' });
  }
});

app.get('/api/barbeiro/concluidos', requireAuth, async (req, res) => {
  const usuarioId = req.session.user.id;

  try {
    const result = await pool.query(
      `SELECT id, cliente, servico, data, hora, valor, pagamento, origem
       FROM agendamentos
       WHERE barbeiro_id = $1
         AND status = 'concluido'
       ORDER BY data DESC, hora DESC`,
      [usuarioId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar concluídos.' });
  }
});

app.get('/api/barbeiro/resumo', requireAuth, async (req, res) => {
  const usuarioId = req.session.user.id;

  try {
    const usuarioResult = await pool.query(
      `SELECT percentual_comissao
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    );

    const percentual = Number(usuarioResult.rows[0]?.percentual_comissao || 50);

    const diaResult = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total
       FROM agendamentos
       WHERE barbeiro_id = $1
         AND status = 'concluido'
         AND data = CURRENT_DATE`,
      [usuarioId]
    );

    const mesResult = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total
       FROM agendamentos
       WHERE barbeiro_id = $1
         AND status = 'concluido'
         AND date_trunc('month', data) = date_trunc('month', CURRENT_DATE)`,
      [usuarioId]
    );

    const historicoResult = await pool.query(
      `SELECT TO_CHAR(date_trunc('month', data), 'MM/YYYY') AS mes,
              COALESCE(SUM(valor), 0) AS total
       FROM agendamentos
       WHERE barbeiro_id = $1
         AND status = 'concluido'
       GROUP BY date_trunc('month', data)
       ORDER BY date_trunc('month', data) DESC`,
      [usuarioId]
    );

    const brutoDia = Number(diaResult.rows[0].total || 0);
    const brutoMes = Number(mesResult.rows[0].total || 0);

    res.json({
      saldoDia: brutoDia * (percentual / 100),
      saldoMes: brutoMes * (percentual / 100),
      historicoMensal: historicoResult.rows.map((item) => ({
        mes: item.mes,
        bruto: Number(item.total),
        liquido: Number(item.total) * (percentual / 100)
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

app.patch('/api/agendamentos/:id/concluir', requireAuth, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.user.id;

  try {
    const result = await pool.query(
      `UPDATE agendamentos
       SET status = 'concluido',
           concluido_em = NOW()
       WHERE id = $1
         AND barbeiro_id = $2
         AND status = 'agendado'
       RETURNING *`,
      [id, usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Atendimento concluído.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao concluir atendimento.' });
  }
});

app.patch('/api/agendamentos/:id/cancelar', requireAuth, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.user.id;

  try {
    const result = await pool.query(
      `UPDATE agendamentos
       SET status = 'cancelado',
           cancelado_em = NOW()
       WHERE id = $1
         AND barbeiro_id = $2
         AND status = 'agendado'
       RETURNING *`,
      [id, usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Atendimento cancelado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao cancelar atendimento.' });
  }
});

app.get('/api/admin/resumo-financeiro', requireAdmin, async (req, res) => {
  try {
    const brutoBarbearia = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total
       FROM agendamentos
       WHERE status = 'concluido'`
    );

    const barbeirosLiquido = await pool.query(
      `SELECT COALESCE(SUM(a.valor * (u.percentual_comissao / 100.0)), 0) AS total
       FROM agendamentos a
       JOIN usuarios u ON u.id = a.barbeiro_id
       WHERE a.status = 'concluido'
         AND u.role = 'barbeiro'`
    );

    const porUsuario = await pool.query(
      `SELECT u.nome,
              u.role,
              COALESCE(SUM(a.valor), 0) AS bruto,
              COALESCE(SUM(a.valor * (u.percentual_comissao / 100.0)), 0) AS liquido
       FROM usuarios u
       LEFT JOIN agendamentos a
         ON a.barbeiro_id = u.id
        AND a.status = 'concluido'
       WHERE u.ativo = TRUE
       GROUP BY u.id, u.nome, u.role, u.percentual_comissao
       ORDER BY u.nome`
    );

    const historicoMensal = await pool.query(
      `SELECT
         TO_CHAR(date_trunc('month', data), 'MM/YYYY') AS mes,
         COALESCE(SUM(valor), 0) AS bruto
       FROM agendamentos
       WHERE status = 'concluido'
       GROUP BY date_trunc('month', data)
       ORDER BY date_trunc('month', data) DESC`
    );

    const manuaisRecentes = await pool.query(
      `SELECT a.cliente, a.servico, a.valor, a.pagamento, a.data, u.nome AS barbeiro
       FROM agendamentos a
       JOIN usuarios u ON u.id = a.barbeiro_id
       WHERE a.origem = 'manual'
         AND a.status = 'concluido'
       ORDER BY a.criado_em DESC
       LIMIT 10`
    );

    const brutoTotal = Number(brutoBarbearia.rows[0].total || 0);
    const liquidoBarbeiros = Number(barbeirosLiquido.rows[0].total || 0);

    res.json({
      brutoBarbearia: brutoTotal,
      liquidoBarbeiros,
      lucroBarbearia: brutoTotal - liquidoBarbeiros,
      usuarios: porUsuario.rows.map((u) => ({
        nome: u.nome,
        role: u.role,
        bruto: Number(u.bruto || 0),
        liquido: Number(u.liquido || 0)
      })),
      historicoMensal: historicoMensal.rows.map((item) => ({
        mes: item.mes,
        bruto: Number(item.bruto || 0)
      })),
      manuaisRecentes: manuaisRecentes.rows.map((item) => ({
        cliente: item.cliente,
        servico: item.servico,
        valor: Number(item.valor || 0),
        pagamento: item.pagamento,
        data: item.data,
        barbeiro: item.barbeiro
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar resumo financeiro.' });
  }
});

app.post('/api/admin/lancamento-manual', requireAdmin, async (req, res) => {
  const { cliente, barbeiroId, servico, valor, pagamento } = req.body;

  if (!cliente || !barbeiroId || !servico || !valor) {
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
  }

  try {
    const hoje = dataLocalISO(new Date());

    await pool.query(
      `INSERT INTO agendamentos
      (cliente, telefone, barbeiro_id, servico, data, hora, valor, duracao, pagamento, status, origem, concluido_em)
      VALUES ($1, '', $2, $3, $4, '00:00', $5, 0, $6, 'concluido', 'manual', NOW())`,
      [cliente, barbeiroId, servico, hoje, valor, pagamento || '']
    );

    await criarNotificacao(
      Number(barbeiroId),
      'Lançamento manual',
      `${cliente} foi lançado manualmente com serviço ${servico}.`
    );

    res.json({ ok: true, mensagem: 'Lançamento manual salvo com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao salvar lançamento manual.' });
  }
});

app.get('/api/admin/usuarios', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, username, role, percentual_comissao, ativo, aparece_na_agenda
       FROM usuarios
       ORDER BY nome`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
});

app.post('/api/admin/usuarios', requireAdmin, async (req, res) => {
  const { nome, username, senha, role, percentual_comissao } = req.body;

  if (!nome || !username || !senha || !role) {
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    await pool.query(
      `INSERT INTO usuarios
      (nome, username, senha, role, percentual_comissao, ativo, aparece_na_agenda)
      VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)`,
      [nome, username, senhaHash, role, percentual_comissao || 50]
    );

    res.json({ ok: true, mensagem: 'Usuário criado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

app.patch('/api/admin/usuarios/:id/desativar', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE usuarios
       SET ativo = FALSE,
           aparece_na_agenda = FALSE
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true, mensagem: 'Usuário desativado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao desativar usuário.' });
  }
});

app.patch('/api/admin/usuarios/:id/ativar', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE usuarios
       SET ativo = TRUE,
           aparece_na_agenda = TRUE
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true, mensagem: 'Usuário reativado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao reativar usuário.' });
  }
});

app.patch('/api/usuarios/alterar-senha', requireAuth, async (req, res) => {
  const usuarioId = req.session.user.id;
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: 'Preencha os campos obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM usuarios WHERE id = $1`,
      [usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const usuario = result.rows[0];
    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);

    if (!senhaCorreta) {
      return res.status(400).json({ erro: 'Senha atual incorreta.' });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(
      `UPDATE usuarios
       SET senha = $1
       WHERE id = $2`,
      [novaSenhaHash, usuarioId]
    );

    res.json({ ok: true, mensagem: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao alterar senha.' });
  }
});

async function iniciarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT,
        username TEXT UNIQUE,
        senha TEXT,
        role TEXT,
        percentual_comissao NUMERIC,
        ativo BOOLEAN DEFAULT TRUE,
        aparece_na_agenda BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        cliente TEXT,
        telefone TEXT,
        barbeiro_id INTEGER REFERENCES usuarios(id),
        servico TEXT,
        valor NUMERIC,
        duracao INTEGER DEFAULT 0,
        data DATE,
        hora TIME,
        status TEXT DEFAULT 'agendado',
        pagamento TEXT,
        origem TEXT DEFAULT 'agendado',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        concluido_em TIMESTAMP,
        cancelado_em TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
        titulo TEXT,
        mensagem TEXT,
        lida BOOLEAN DEFAULT FALSE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tabelas criadas/verificadas');
  } catch (err) {
    console.error('Erro ao iniciar banco:', err);
  }
}

async function criarUsuariosPadrao() {
  try {
    const senhaDanilo = await bcrypt.hash('1234', 10);
    const senhaThiago = await bcrypt.hash('1234', 10);

    await pool.query(
      `
      INSERT INTO usuarios (nome, username, senha, role, percentual_comissao)
      VALUES
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10)
      ON CONFLICT (username) DO UPDATE SET
        nome = EXCLUDED.nome,
        senha = EXCLUDED.senha,
        role = EXCLUDED.role,
        percentual_comissao = EXCLUDED.percentual_comissao;
      `,
      [
        'Danilo', 'danilo', senhaDanilo, 'admin', 100,
        'Thiago', 'thiago', senhaThiago, 'barbeiro', 50
      ]
    );

    console.log('✅ Usuários padrão verificados');
  } catch (err) {
    console.error('Erro ao criar usuários padrão:', err);
  }
}

(async () => {
  await iniciarBanco();
  await criarUsuariosPadrao();

  const port = process.env.PORT || 3001;

  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
})();