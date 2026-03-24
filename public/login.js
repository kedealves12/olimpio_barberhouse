document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const mensagem = document.getElementById('mensagem');

  if (!form) {
    alert('loginForm não encontrado');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    mensagem.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        mensagem.textContent = data.erro || 'Erro no login';
        return;
      }

      if (data.role === 'admin') {
        window.location.href = 'admin.html';
        return;
      }

      if (data.role === 'barbeiro') {
        window.location.href = 'barbeiro.html';
        return;
      }

      mensagem.textContent = 'Login ok, mas sem perfil válido.';
    } catch (err) {
      console.error(err);
      mensagem.textContent = 'Erro ao conectar com servidor';
    }
  });
});