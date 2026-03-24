const brutoBarbeariaEl = document.getElementById('brutoBarbearia');
const liquidoBarbeirosEl = document.getElementById('liquidoBarbeiros');
const lucroBarbeariaEl = document.getElementById('lucroBarbearia');
const usuariosResumo = document.getElementById('usuariosResumo');
const historicoMensalGeral = document.getElementById('historicoMensalGeral');
const manuaisRecentes = document.getElementById('manuaisRecentes');
const mensagem = document.getElementById('mensagem');

const formLancamentoManual = document.getElementById('formLancamentoManual');
const barbeiroManual = document.getElementById('barbeiroManual');
const servicoManual = document.getElementById('servicoManual');

const btnVoltar = document.getElementById('btnVoltar');
const btnSair = document.getElementById('btnSair');

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarData(data) {
  const [ano, mes, dia] = String(data).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

async function validarAdmin() {
  const res = await fetch('/api/me');
  const data = await res.json();

  if (!res.ok || data.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

async function carregarServicos() {
  const res = await fetch('/api/servicos');
  const data = await res.json();

  servicoManual.innerHTML = '<option value="">Selecione o serviço</option>';

  Object.entries(data).forEach(([, servico]) => {
    const option = document.createElement('option');
    option.value = servico.nome;
    option.textContent = `${servico.nome} - ${formatarMoeda(servico.valor)}`;
    servicoManual.appendChild(option);
  });
}

async function carregarBarbeiros() {
  const res = await fetch('/api/barbeiros');
  const data = await res.json();

  barbeiroManual.innerHTML = '<option value="">Selecione o barbeiro</option>';

  data.forEach((barbeiro) => {
    const option = document.createElement('option');
    option.value = barbeiro.id;
    option.textContent = barbeiro.nome;
    barbeiroManual.appendChild(option);
  });
}

async function carregarResumoFinanceiro() {
  const res = await fetch('/api/admin/resumo-financeiro');
  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao carregar financeiro.';
    return;
  }

  brutoBarbeariaEl.textContent = formatarMoeda(data.brutoBarbearia);
  liquidoBarbeirosEl.textContent = formatarMoeda(data.liquidoBarbeiros);
  lucroBarbeariaEl.textContent = formatarMoeda(data.lucroBarbearia);

  usuariosResumo.innerHTML = '';
  historicoMensalGeral.innerHTML = '';
  manuaisRecentes.innerHTML = '';

  data.usuarios.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'item-lista';
    div.innerHTML = `
      <div>
        <strong>${item.nome}</strong><br>
        <small>${item.role}</small>
      </div>
      <div>
        Bruto: ${formatarMoeda(item.bruto)}<br>
        Líquido: ${formatarMoeda(item.liquido)}
      </div>
    `;
    usuariosResumo.appendChild(div);
  });

  if (!data.historicoMensal.length) {
    historicoMensalGeral.innerHTML = '<p>Nenhum histórico mensal encontrado.</p>';
  } else {
    data.historicoMensal.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'item-lista';
      div.innerHTML = `
        <strong>${item.mes}</strong>
        <span>${formatarMoeda(item.bruto)}</span>
      `;
      historicoMensalGeral.appendChild(div);
    });
  }

  if (!data.manuaisRecentes.length) {
    manuaisRecentes.innerHTML = '<p>Nenhum lançamento manual encontrado.</p>';
  } else {
    data.manuaisRecentes.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'card-agendamento concluido';
      div.innerHTML = `
        <div><strong>${item.cliente}</strong></div>
        <div>Barbeiro: ${item.barbeiro}</div>
        <div>Serviço: ${item.servico}</div>
        <div>Valor: ${formatarMoeda(item.valor)}</div>
        <div>Pagamento: ${item.pagamento || ''}</div>
        <div>Data: ${formatarData(item.data)}</div>
      `;
      manuaisRecentes.appendChild(div);
    });
  }
}

formLancamentoManual.addEventListener('submit', async (e) => {
  e.preventDefault();

  mensagem.textContent = '';

  const cliente = document.getElementById('clienteManual').value.trim();
  const barbeiroId = barbeiroManual.value;
  const servico = servicoManual.value;
  const valor = document.getElementById('valorManual').value;
  const pagamento = document.getElementById('pagamentoManual').value;

  const res = await fetch('/api/admin/lancamento-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cliente,
      barbeiroId,
      servico,
      valor,
      pagamento
    })
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao salvar lançamento.';
    return;
  }

  mensagem.textContent = 'Lançamento manual salvo com sucesso.';
  formLancamentoManual.reset();
  await carregarResumoFinanceiro();
});

btnVoltar.addEventListener('click', () => {
  window.location.href = 'admin.html';
});

btnSair.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'index.html';
});

(async () => {
  const ok = await validarAdmin();
  if (!ok) return;

  await carregarBarbeiros();
  await carregarServicos();
  await carregarResumoFinanceiro();
})();