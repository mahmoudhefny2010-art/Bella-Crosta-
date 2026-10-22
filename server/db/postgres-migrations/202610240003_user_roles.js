exports.up = async function up(knex) {
  await knex.schema.createTable('user_roles', table => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('role', 24).notNullable();
    table.primary(['user_id', 'role'], 'user_roles_pk');
    table.check("role IN ('customer', 'admin', 'kitchen', 'driver')", [], 'user_roles_role_check');
    table.index(['role', 'user_id'], 'user_roles_role_user_idx');
  });

  await knex.raw('INSERT INTO user_roles (user_id, role) SELECT id, role FROM users');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_roles');
};
