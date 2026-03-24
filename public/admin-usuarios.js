const formNovoUsuario = document.getElementById('formNovoUsuario');
const listaUsuarios = document.getElementById('listaUsuarios');
const mensagem = document.getElementById('mensagem');

const btnVoltar = document.getElementById('btnVoltar');
const btnSair = document.getElementById('btnSair');

async function validarAdmin() {
  const res = await fetch('/api/me');
  const data = await res.json();

  if (!res.ok || data.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

async function carregarUsuarios() {
  const res = await fetch('/api/admin/usuarios');
  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao carregar usuários.';
    return;
  }

  listaUsuarios.innerHTML = '';

  if (!data.length) {
    listaUsuarios.innerHTML = '<p>Nenhum usuário encontrado.</p>';
    return;
  }

  data.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'card-agendamento';

    div.innerHTML = `
      <div><strong>${item.nome}</strong></div>
      <div>Usuário: ${item.username}</div>
      <div>Tipo: ${item.role}</div>
      <div>Comissão: ${item.percentual_comissao}%</div>
      <div>Status: <span class="${item.ativo ? 'status-ativo' : 'status-inativo'}">${item.ativo ? 'Ativo' : 'Inativo'}</span></div>
      <div>Aparece na agenda: ${item.aparece_na_agenda ? 'Sim' : 'Não'}</div>
      <div class="acoes">
        ${item.ativo
          ? `<button type="button" class="btn-cancelar" data-id="${item.id}" data-nome="${item.nome}">Desativar</button>`
          : `<button type="button" class="btn-concluir" data-id="${item.id}" data-nome="${item.nome}">Reativar</button>`
        }
      </div>
    `;

    listaUsuarios.appendChild(div);
  });

  document.querySelectorAll('.btn-cancelar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nome = btn.dataset.nome;
      const confirmar = confirm(`Deseja desativar ${nome}?`);
      if (confirmar) {
        await desativarUsuario(btn.dataset.id);
      }
    });
  });

  document.querySelectorAll('.btn-concluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nome = btn.dataset.nome;
      const confirmar = confirm(`Deseja reativar ${nome}?`);
      if (confirmar) {
        await reativarUsuario(btn.dataset.id);
      }
    });
  });
}

async function desativarUsuario(id) {
  mensagem.textContent = '';

  const res = await fetch(`/api/admin/usuarios/${id}/desativar`, {
    method: 'PATCH'
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao desativar usuário.';
    return;
  }

  mensagem.textContent = 'Usuário desativado com sucesso.';
  await carregarUsuarios();
}

async function reativarUsuario(id) {
  mensagem.textContent = '';

  const res = await fetch(`/api/admin/usuarios/${id}/ativar`, {
    method: 'PATCH'
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao reativar usuário.';
    return;
  }

  mensagem.textContent = 'Usuário reativado com sucesso.';
  await carregarUsuarios();
}

formNovoUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();

  mensagem.textContent = '';

  const nome = document.getElementById('nome').value.trim();
  const username = document.getElementById('username').value.trim();
  const senha = document.getElementById('senha').value.trim();
  const role = document.getElementById('role').value;
  const percentual_comissao = document.getElementById('percentual').value;

  const res = await fetch('/api/admin/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome,
      username,
      senha,
      role,
      percentual_comissao
    })
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao criar usuário.';
    return;
  }

  mensagem.textContent = 'Usuário criado com sucesso.';
  formNovoUsuario.reset();
  await carregarUsuarios();
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
  if (ok) {
    await carregarUsuarios();
  }
})();