exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT users_role_check');
  await knex.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer','admin','owner','kitchen','driver'))");
  await knex.raw('ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check');
  await knex.raw("ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('customer','admin','owner','kitchen','driver'))");
};

exports.down = async function down(knex) {
  if (await knex('users').where({ role: 'owner' }).first() || await knex('user_roles').where({ role: 'owner' }).first()) {
    throw new Error('Reassign owner accounts before rolling back the owner role migration.');
  }
  await knex.raw('ALTER TABLE users DROP CONSTRAINT users_role_check');
  await knex.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer','admin','kitchen','driver'))");
  await knex.raw('ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check');
  await knex.raw("ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('customer','admin','kitchen','driver'))");
};
