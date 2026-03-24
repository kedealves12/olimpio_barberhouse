const agendaForm = document.getElementById('agendaForm');
const mensagem = document.getElementById('mensagem');
const selectHora = document.getElementById('hora');
const inputData = document.getElementById('data');
const selectBarbeiro = document.getElementById('barbeiro');
const selectServico = document.getElementById('servico');
const infoServico = document.getElementById('infoServico');
const horariosDiv = document.getElementById('horarios');

let horaSelecionada = '';

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

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

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

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const escolhida = new Date(`${data}T00:00:00`);

  if (Number.isNaN(escolhida.getTime())) {
    return 'Data inválida.';
  }

  if (escolhida.getDay() === 0) {
    return 'Não atendemos aos domingos.';
  }

  const formato = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const dataEscolhida = formato(escolhida);
  const hojeISO = formato(hoje);
  const amanhaISO = formato(amanha);

  if (dataEscolhida !== hojeISO && dataEscolhida !== amanhaISO) {
    return 'Agendamento disponível apenas para hoje e amanhã.';
  }

  return null;
}

function atualizarInfoServico() {
  const chave = selectServico.value;
  const servico = servicos[chave];

  if (!servico) {
    infoServico.innerHTML = '';
    return;
  }

  infoServico.innerHTML = `
    <p><strong>Serviço:</strong> ${servico.nome}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(servico.valor)}</p>
    <p><strong>Duração:</strong> ${servico.duracao} min</p>
  `;
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

  if (!Array.isArray(lista) || lista.length === 0) {
    horariosDiv.innerHTML = '<p class="aviso-horario">Nenhum horário disponível.</p>';
    return;
  }

  lista.forEach((hora) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = hora;
    btn.dataset.hora = hora;

    btn.addEventListener('click', () => {
      horaSelecionada = hora;
      selectHora.value = hora;
      marcarBotaoHorario(hora);
    });

    horariosDiv.appendChild(btn);
  });
}

async function carregarBarbeiros() {
  try {
    const res = await fetch('/api/barbeiros');
    const barbeiros = await res.json();

    if (!res.ok) {
      mensagem.textContent = barbeiros.erro || 'Erro ao carregar barbeiros.';
      return;
    }

    selectBarbeiro.innerHTML = `
      <option value="">Selecione o barbeiro</option>
      <option value="qualquer">Sem preferência</option>
    `;

    barbeiros.forEach((barbeiro) => {
      const option = document.createElement('option');
      option.value = barbeiro.id;
      option.textContent = barbeiro.nome;
      selectBarbeiro.appendChild(option);
    });
  } catch (error) {
    console.error(error);
    mensagem.textContent = 'Erro ao carregar barbeiros.';
  }
}

async function carregarHorarios() {
  if (!data || !barbeiro || !servico) {
    mensagem.textContent = 'Selecione barbeiro, serviço e data para ver os horários.';
    return;
  }

  const erroData = validarDataSelecionada(data);
  if (erroData) {
    mensagem.textContent = erroData;
    return;
  }

  try {
    const params = new URLSearchParams({
      data,
      barbeiro,
      servico
    });

    const res = await fetch(`/api/horarios-disponiveis?${params.toString()}`);
    const horarios = await res.json();

    if (!res.ok) {
      mensagem.textContent = horarios.erro || 'Erro ao buscar horários disponíveis.';
      return;
    }

    if (!Array.isArray(horarios) || horarios.length === 0) {
      selectHora.innerHTML = '<option value="">Nenhum horário disponível</option>';
      horariosDiv.innerHTML = '<p class="aviso-horario">Nenhum horário disponível para esse serviço nessa data.</p>';
      mensagem.textContent = 'Tente outro barbeiro, outro horário ou uma duração menor.';
      return;
    }

    selectHora.innerHTML = '<option value="">Selecione o horário</option>';
    horariosDiv.innerHTML = '';
    mensagem.textContent = '';

    horarios.forEach((hora) => {
      const option = document.createElement('option');
      option.value = hora;
      option.textContent = hora;
      selectHora.appendChild(option);
    });

    renderizarHorariosEmBotoes(horarios);
  } catch (error) {
    console.error(error);
    mensagem.textContent = 'Erro ao buscar horários disponíveis.';
  }
}

inputData.addEventListener('change', carregarHorarios);
selectBarbeiro.addEventListener('change', carregarHorarios);

selectServico.addEventListener('change', () => {
  atualizarInfoServico();
  carregarHorarios();
});

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
  
  let data = inputData.value;

// 🔥 converte a data pro formato certo
if (data.includes('/')) {
  const [dia, mes, ano] = data.split('/');
  data = `${ano}-${mes}-${dia}`;
}

  const hora = selectHora.value || horaSelecionada;
  const pagamento = document.getElementById('pagamento').value;

  console.log('DATA INPUT:', inputData.value);
console.log('DATA ENVIADA:', data);

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
      mensagem.textContent = dataResposta.erro || 'Erro ao salvar agendamento.';
      return;
    }

    if (selectBarbeiro.value === 'qualquer' && dataResposta.barbeiroNome) {
      mensagem.textContent = `Agendamento salvo com sucesso! Barbeiro escolhido: ${dataResposta.barbeiroNome}.`;
    } else {
      mensagem.textContent = 'Agendamento salvo com sucesso!';
    }

    agendaForm.reset();
    infoServico.innerHTML = '';
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

async function irParaPainel() {
  try {
    const res = await fetch('/api/me');
    const user = await res.json();

    if (!res.ok) {
      window.location.href = 'index.html';
      return;
    }

    if (user.role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }

    if (user.role === 'barbeiro') {
      window.location.href = 'barbeiro.html';
      return;
    }

  } catch (err) {
    window.location.href = 'index.html';
  }
}