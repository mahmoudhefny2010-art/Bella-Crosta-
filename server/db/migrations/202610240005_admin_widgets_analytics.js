exports.up = async function up(knex) {
  await knex.schema.createTable('site_settings', table => {
    table.string('setting_key', 120).primary();
    table.text('value_en').notNullable().defaultTo('');
    table.text('value_ar').notNullable().defaultTo('');
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('SYSUTCDATETIME()'));
  });

  await knex.schema.createTable('site_copy', table => {
    table.string('source_text', 500).primary();
    table.text('value_en').notNullable().defaultTo('');
    table.text('value_ar').notNullable().defaultTo('');
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('SYSUTCDATETIME()'));
  });

  await knex.schema.createTable('site_visitors', table => {
    table.string('visitor_key', 64).primary();
    table.uuid('user_id').references('id').inTable('users').onDelete('NO ACTION');
    table.timestamp('first_seen_at').notNullable().defaultTo(knex.raw('SYSUTCDATETIME()'));
    table.timestamp('last_seen_at').notNullable().defaultTo(knex.raw('SYSUTCDATETIME()'));
    table.integer('visit_count').notNullable().defaultTo(0);
    table.index(['user_id', 'last_seen_at'], 'site_visitors_user_seen_idx');
    table.index(['last_seen_at'], 'site_visitors_seen_idx');
  });

  await knex.schema.createTable('site_page_views', table => {
    table.bigIncrements('id').primary();
    table.string('visitor_key', 64).notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('NO ACTION');
    table.string('path', 160).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('SYSUTCDATETIME()'));
    table.index(['created_at', 'path'], 'site_page_views_created_path_idx');
    table.index(['user_id', 'created_at'], 'site_page_views_user_created_idx');
    table.index(['visitor_key', 'created_at'], 'site_page_views_visitor_created_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('site_page_views');
  await knex.schema.dropTableIfExists('site_visitors');
  await knex.schema.dropTableIfExists('site_copy');
  await knex.schema.dropTableIfExists('site_settings');
};
