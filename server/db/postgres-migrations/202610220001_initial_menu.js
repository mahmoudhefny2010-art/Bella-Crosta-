exports.up = async function up(knex) {
  await knex.schema.createTable("categories", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 80).notNullable();
    table.string("name_ar", 100).notNullable();
    table.string("slug", 80).notNullable().unique();
    table.text("description").notNullable().defaultTo("");
    table.text("description_ar").notNullable().defaultTo("");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
  });

  await knex.schema.createTable("products", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("category_id").references("id").inTable("categories").onDelete("NO ACTION");
    table.string("name", 120).notNullable();
    table.string("name_ar", 160).notNullable();
    table.string("slug", 120).notNullable().unique();
    table.text("description").notNullable().defaultTo("");
    table.text("description_ar").notNullable().defaultTo("");
    table.integer("price_egp").notNullable().checkPositive();
    table.text("image_url").notNullable().defaultTo("");
    table.text("ingredients").notNullable().defaultTo("[]");
    table.boolean("is_available").notNullable().defaultTo(true);
    table.boolean("is_featured").notNullable().defaultTo(false);
    table.integer("prep_minutes").notNullable().defaultTo(20);
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.index(["category_id", "is_available"], "products_category_available_idx");
    table.index(["is_available", "is_featured"], "products_available_featured_idx");
  });

  await knex.schema.createTable("product_options", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("product_id").notNullable().references("id").inTable("products").onDelete("NO ACTION");
    table.string("option_group", 60).notNullable();
    table.string("name", 100).notNullable();
    table.string("name_ar", 120).notNullable();
    table.integer("price_delta_egp").notNullable().defaultTo(0);
    table.boolean("is_available").notNullable().defaultTo(true);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.unique(["product_id", "option_group", "name"], "product_options_group_name_uq");
    table.index(["product_id", "option_group", "is_available"], "product_options_product_group_idx");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("product_options");
  await knex.schema.dropTableIfExists("products");
  await knex.schema.dropTableIfExists("categories");
};
