require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./config/db');

async function main() {
  try {

    await pool.query('DELETE FROM agendamentos');
    await pool.query('DELETE FROM usuarios');

    const senhaDanilo = await bcrypt.hash('1234', 10);
    const senhaThiago = await bcrypt.hash('1234', 10);

    await pool.query(
      `INSERT INTO usuarios
      (nome, username, senha, role, percentual_comissao, ativo, aparece_na_agenda)
      VALUES
      ($1, $2, $3, $4, $5, $6, $7),
      ($8, $9, $10, $11, $12, $13, $14)`,
      [
        'Danilo', 'danilo', senhaDanilo, 'admin', 100.00, true, true,
        'Thiago', 'thiago', senhaThiago, 'barbeiro', 50.00, true, true
      ]
    );

    console.log('Usuários criados com hash com sucesso.');
  } catch (error) {
    console.error('Erro ao criar usuários:', error);
  } finally {
    await pool.end();
  }
}

main();