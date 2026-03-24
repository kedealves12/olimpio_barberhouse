let usuario = null;

const formSenha = document.getElementById('formSenha');
const mensagem = document.getElementById('mensagem');
const btnVoltar = document.getElementById('btnVoltar');
const btnSair = document.getElementById('btnSair');

async function carregarUsuario() {
  const res = await fetch('/api/me');
  const data = await res.json();

  if (!res.ok) {
    window.location.href = 'index.html';
    return false;
  }

  usuario = data;
  return true;
}

formSenha.addEventListener('submit', async (e) => {
  e.preventDefault();

  mensagem.textContent = '';

  const senhaAtual = document.getElementById('senhaAtual').value.trim();
  const novaSenha = document.getElementById('novaSenha').value.trim();
  const confirmarSenha = document.getElementById('confirmarSenha').value.trim();

  if (novaSenha !== confirmarSenha) {
    mensagem.textContent = 'A confirmação da nova senha não confere.';
    return;
  }

  const res = await fetch('/api/usuarios/alterar-senha', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senhaAtual,
      novaSenha
    })
  });

  const data = await res.json();

  if (!res.ok) {
    mensagem.textContent = data.erro || 'Erro ao alterar senha.';
    return;
  }

  mensagem.textContent = 'Senha alterada com sucesso.';
  formSenha.reset();
});

btnVoltar.addEventListener('click', () => {
  if (usuario?.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  window.location.href = 'barbeiro.html';
});

btnSair.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'index.html';
});

(async () => {
  await carregarUsuario();
})();