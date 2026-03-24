let usuario = null;
let ultimoTotalNaoLidas = 0;
let audioLiberado = false;
let audioContext = null;

const tituloBarbeiro = document.getElementById('tituloBarbeiro');
const saldoDiaEl = document.getElementById('saldoDia');
const saldoMesEl = document.getElementById('saldoMes');
const agendaLista = document.getElementById('agendaLista');
const concluidosLista = document.getElementById('concluidosLista');
const historicoMensal = document.getElementById('historicoMensal');
const listaNotificacoes = document.getElementById('listaNotificacoes');
const badgeNotificacoes = document.getElementById('badgeNotificacoes');
const btnMarcarLidas = document.getElementById('btnMarcarLidas');
const mensagem = document.getElementById('mensagem');

const btnSenha = document.getElementById('btnSenha');
const btnSair = document.getElementById('btnSair');

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarHora(hora) {
  return String(hora).slice(0, 5);
}

function formatarData(data) {
  const [ano, mes, dia] = String(data).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataHora) {
  const data = new Date(dataHora);
  return data.toLocaleString('pt-BR');
}

function inicializarAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  audioLiberado = true;
}

async function tocarSomNotificacao() {
  try {
    if (!audioLiberado) return;
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
  } catch (error) {
    console.error('Erro ao tocar som:', error);
  }
}

async function carregarUsuario() {
  const res = await fetch('/api/me');
  const data = await res.json();

  if (!res.ok || data.role !== 'barbeiro') {
    window.location.href = 'index.html';
    return false;
  }

  usuario = data;
  tituloBarbeiro.textContent = `Painel de ${usuario.nome}`;
  return true;
}

async function carregarNotificacoes() {
  const res = await fetch('/api/notificacoes');
  const data = await res.json();

  if (!res.ok) return;

  badgeNotificacoes.textContent = data.totalNaoLidas;

  if (data.totalNaoLidas > ultimoTotalNaoLidas && ultimoTotalNaoLidas !== 0) {
    await tocarSomNotificacao();
  }

  ultimoTotalNaoLidas = data.totalNaoLidas;

  listaNotificacoes.innerHTML = '';

  if (!data.notificacoes.length) {
    listaNotificacoes.innerHTML = '<p>Nenhuma notificação.</p>';
    return;
  }

  data.notificacoes.forEach((item) => {
    const div = document.createElement('div');
    div.className = `card-agendamento ${item.lida ? 'concluido' : 'notificacao-nova'}`;
    div.innerHTML = `
      <div class="linha-forte">
        <strong>${item.titulo}</strong>
      </div>
      <div>${item.mensagem}</div>
      <div class="notificacao-rodape">
        <small>${formatarDataHora(item.criado_em)}</small>
        ${item.lida ? '' : `<button type="button" class="btn-concluir btn-lida" data-id="${item.id}">Marcar como lida</button>`}
      </div>
    `;
    listaNotificacoes.appendChild(div);
  });

  document.querySelectorAll('.btn-lida').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/notificacoes/${btn.dataset.id}/lida`, {
        method: 'PATCH'
      });
      await carregarNotificacoes();
    });
  });
}

async function carregarResumo() {
  const res = await fetch('/api/barbeiro/resumo');
  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao carregar resumo.';
    return;
  }

  saldoDiaEl.textContent = formatarMoeda(data.saldoDia);
  saldoMesEl.textContent = formatarMoeda(data.saldoMes);

  historicoMensal.innerHTML = '';

  if (!data.historicoMensal.length) {
    historicoMensal.innerHTML = '<p>Nenhum histórico encontrado.</p>';
    return;
  }

  data.historicoMensal.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'item-lista';
    div.innerHTML = `
      <strong>${item.mes}</strong>
      <span>${formatarMoeda(item.liquido)}</span>
    `;
    historicoMensal.appendChild(div);
  });
}

async function carregarAgenda() {
  const res = await fetch('/api/barbeiro/agenda');
  const agenda = await res.json();

  if (!res.ok) {
    mensagem.textContent = agenda.erro || 'Erro ao carregar agenda.';
    return;
  }

  agendaLista.innerHTML = '';

  if (!agenda.length) {
    agendaLista.innerHTML = '<p>Nenhum atendimento agendado para hoje ou amanhã.</p>';
    return;
  }

  agenda.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'card-agendamento';

    div.innerHTML = `
      <div class="linha-forte">
        <strong>${formatarData(item.data)} às ${formatarHora(item.hora)}</strong>
      </div>
      <div>Cliente: ${item.cliente}</div>
      <div>Telefone: ${item.telefone || ''}</div>
      <div>Serviço: ${item.servico}</div>
      <div>Pagamento: ${item.pagamento || ''}</div>
      <div>Valor: ${formatarMoeda(item.valor)}</div>
      <div class="acoes">
        <button type="button" class="btn-concluir" data-id="${item.id}">Concluir</button>
        <button type="button" class="btn-cancelar" data-id="${item.id}">Cancelar</button>
      </div>
    `;

    agendaLista.appendChild(div);
  });

  document.querySelectorAll('.btn-concluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await concluirAtendimento(btn.dataset.id);
    });
  });

  document.querySelectorAll('.btn-cancelar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await cancelarAtendimento(btn.dataset.id);
    });
  });
}

async function carregarConcluidos() {
  const res = await fetch('/api/barbeiro/concluidos');
  const concluidos = await res.json();

  if (!res.ok) {
    mensagem.textContent = concluidos.erro || 'Erro ao carregar concluídos.';
    return;
  }

  concluidosLista.innerHTML = '';

  if (!concluidos.length) {
    concluidosLista.innerHTML = '<p>Nenhum atendimento concluído.</p>';
    return;
  }

  concluidos.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'card-agendamento concluido';

    div.innerHTML = `
      <div class="linha-forte">
        <strong>${formatarData(item.data)} às ${formatarHora(item.hora)}</strong>
      </div>
      <div>Cliente: ${item.cliente}</div>
      <div>Serviço: ${item.servico}</div>
      <div>Pagamento: ${item.pagamento || ''}</div>
      <div>Valor: ${formatarMoeda(item.valor)}</div>
      <div>Origem: ${item.origem}</div>
      <div>Status: concluído</div>
    `;

    concluidosLista.appendChild(div);
  });
}

async function concluirAtendimento(id) {
  mensagem.textContent = '';

  const res = await fetch(`/api/agendamentos/${id}/concluir`, {
    method: 'PATCH'
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao concluir atendimento.';
    return;
  }

  mensagem.textContent = 'Atendimento concluído com sucesso.';
  await atualizarTudo();
}

async function cancelarAtendimento(id) {
  mensagem.textContent = '';

  const res = await fetch(`/api/agendamentos/${id}/cancelar`, {
    method: 'PATCH'
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao cancelar atendimento.';
    return;
  }

  mensagem.textContent = 'Atendimento cancelado com sucesso.';
  await atualizarTudo();
}

async function atualizarTudo() {
  await carregarNotificacoes();
  await carregarResumo();
  await carregarAgenda();
  await carregarConcluidos();
}

btnMarcarLidas.addEventListener('click', async () => {
  await fetch('/api/notificacoes/marcar-todas', {
    method: 'PATCH'
  });
  await carregarNotificacoes();
});

btnSenha.addEventListener('click', () => {
  window.location.href = 'senha.html';
});

btnSair.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'index.html';
});

document.addEventListener('click', inicializarAudio, { once: true });
document.addEventListener('keydown', inicializarAudio, { once: true });

(async () => {
  const ok = await carregarUsuario();
  if (ok) {
    await atualizarTudo();
    setInterval(carregarNotificacoes, 5000);
  }
})();