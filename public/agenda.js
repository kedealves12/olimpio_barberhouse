console.log('AGENDA JS V3 CARREGOU');

const agendaForm = document.getElementById('agendaForm');
const mensagem = document.getElementById('mensagem');
const selectHora = document.getElementById('hora');
const inputData = document.getElementById('data');
const selectBarbeiro = document.getElementById('barbeiro');
const selectServico = document.getElementById('servico');
const infoServico = document.getElementById('infoServico');
const horariosDiv = document.getElementById('horarios');

let horaSelecionada = '';

function dataLocalISO(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function configurarCampoData() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  inputData.min = dataLocalISO(hoje);
  inputData.max = dataLocalISO(amanha);
}

function validarDataSelecionada(data) {
  if (!data) return 'Data obrigatória.';

  const escolhida = new Date(`${data}T00:00:00`);
  if (isNaN(escolhida.getTime())) return 'Data inválida.';

  if (escolhida.getDay() === 0) return 'Não atendemos aos domingos.';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const formatar = (d) => d.toISOString().split('T')[0];

  if (formatar(escolhida) !== formatar(hoje) &&
      formatar(escolhida) !== formatar(amanha)) {
    return 'Agendamento disponível apenas para hoje e amanhã.';
  }

  return null;
}

function limparHorarios() {
  selectHora.innerHTML = '<option value="">Selecione o horário</option>';
  horaSelecionada = '';
  horariosDiv.innerHTML = '';
}

function marcarBotaoHorario(hora) {
  document.querySelectorAll('#horarios button').forEach((botao) => {
    botao.classList.remove('active');
    if (botao.dataset.hora === hora) {
      botao.classList.add('active');
    }
  });
}

function renderizarHorariosEmBotoes(lista) {
  horariosDiv.innerHTML = '';

  if (!lista.length) {
    horariosDiv.innerHTML = '<p>Nenhum horário disponível</p>';
    return;
  }

  lista.forEach((hora) => {
    const btn = document.createElement('button');
    btn.textContent = hora;

    btn.onclick = () => {
      horaSelecionada = hora;
      selectHora.value = hora;
      marcarBotaoHorario(hora);
    };

    horariosDiv.appendChild(btn);
  });
}

async function carregarBarbeiros() {
  const res = await fetch('/api/barbeiros');
  const barbeiros = await res.json();

  selectBarbeiro.innerHTML = `
    <option value="">Selecione</option>
    <option value="qualquer">Qualquer</option>
  `;

  barbeiros.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.nome;
    selectBarbeiro.appendChild(opt);
  });
}

async function carregarHorarios() {
  const data = inputData.value;
  const barbeiro = selectBarbeiro.value;
  const servico = selectServico.value;

  if (!data || !barbeiro || !servico) return;

  const erro = validarDataSelecionada(data);
  if (erro) {
    mensagem.textContent = erro;
    return;
  }

  const params = new URLSearchParams({ data, barbeiro, servico });

  const res = await fetch(`/api/horarios-disponiveis?${params.toString()}`);
  const horarios = await res.json();

  if (!res.ok) {
    mensagem.textContent = horarios.erro;
    return;
  }

  selectHora.innerHTML = '<option value="">Selecione</option>';

  horarios.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    selectHora.appendChild(opt);
  });

  renderizarHorariosEmBotoes(horarios);
}

inputData.addEventListener('change', carregarHorarios);
selectBarbeiro.addEventListener('change', carregarHorarios);
selectServico.addEventListener('change', carregarHorarios);

selectHora.addEventListener('change', () => {
  horaSelecionada = selectHora.value;
  marcarBotaoHorario(horaSelecionada);
});

agendaForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const cliente = document.getElementById('cliente').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const barbeiro = selectBarbeiro.value;
  const servico = selectServico.value;

  const valorBruto = inputData.value;

  let data;

  if (valorBruto.includes('/')) {
    const [dia, mes, ano] = valorBruto.split('/');
    data = `${ano}-${mes}-${dia}`;
  } else {
    data = valorBruto;
  }

  const hora = selectHora.value || horaSelecionada;
  const pagamento = document.getElementById('pagamento').value;

  if (!cliente || !barbeiro || !servico || !data || !hora) {
    mensagem.textContent = 'Preencha os campos obrigatórios.';
    return;
  }

  const erroData = validarDataSelecionada(data);
  if (erroData) {
    mensagem.textContent = erroData;
    return;
  }

  try {
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente,
        telefone,
        barbeiro,
        servico,
        data,
        hora,
        pagamento
      })
    });

    const dataResposta = await res.json();

    if (!res.ok) {
      mensagem.textContent = dataResposta.erro || 'Erro ao salvar.';
      return;
    }

    mensagem.textContent = 'Agendamento salvo com sucesso!';
    agendaForm.reset();
    limparHorarios();
    configurarCampoData();
    await carregarBarbeiros();

  } catch (error) {
    console.error(error);
    mensagem.textContent = 'Erro ao conectar com o servidor.';
  }
});

configurarCampoData();
carregarBarbeiros();