exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("google_id", 160);
    table.string("email", 254).notNullable().unique();
    table.string("name", 160).notNullable();
    table.string("phone", 24);
    table.string("role", 24).notNullable().defaultTo("customer");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.check("role IN ('customer', 'admin', 'kitchen', 'driver')", [], "users_role_check");
    table.index(["role", "is_active"], "users_role_active_idx");
  });

  await knex.raw("CREATE UNIQUE INDEX users_google_id_uq ON users(google_id) WHERE google_id IS NOT NULL");

  await knex.schema.createTable("addresses", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("NO ACTION");
    table.string("label", 60).notNullable().defaultTo("Home");
    table.string("address_line", 300).notNullable();
    table.string("landmark", 200).notNullable().defaultTo("");
    table.string("floor", 20).notNullable().defaultTo("");
    table.string("apartment", 20).notNullable().defaultTo("");
    table.string("phone", 24).notNullable();
    table.decimal("latitude", 10, 7);
    table.decimal("longitude", 10, 7);
    table.boolean("is_default").notNullable().defaultTo(false);
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.index(["user_id", "is_default"], "addresses_user_default_idx");
  });

  await knex.schema.createTable("orders", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("order_number", 24).notNullable().unique();
    table.uuid("user_id").references("id").inTable("users").onDelete("NO ACTION");
    table.uuid("address_id").references("id").inTable("addresses").onDelete("NO ACTION");
    table.text("address_snapshot").notNullable();
    table.string("customer_name", 160).notNullable();
    table.string("customer_phone", 24).notNullable();
    table.string("status", 32).notNullable().defaultTo("PLACED");
    table.string("fulfillment_type", 16).notNullable().defaultTo("DELIVERY");
    table.string("payment_method", 24).notNullable().defaultTo("CASH_ON_DELIVERY");
    table.integer("subtotal_egp").notNullable();
    table.integer("delivery_fee_egp").notNullable().defaultTo(0);
    table.integer("total_egp").notNullable();
    table.text("notes").notNullable().defaultTo("");
    table.uuid("assigned_driver_id").references("id").inTable("users").onDelete("NO ACTION");
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.check("status IN ('PLACED','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')", [], "orders_status_check");
    table.check("fulfillment_type IN ('DELIVERY','PICKUP')", [], "orders_fulfillment_check");
    table.check("payment_method IN ('CASH_ON_DELIVERY')", [], "orders_payment_check");
    table.check("subtotal_egp >= 0 AND delivery_fee_egp >= 0 AND total_egp >= 0", [], "orders_amounts_check");
    table.index(["status", "created_at"], "orders_status_created_idx");
    table.index(["user_id", "created_at"], "orders_user_created_idx");
    table.index(["assigned_driver_id", "status"], "orders_driver_status_idx");
  });

  await knex.schema.createTable("order_items", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("NO ACTION");
    table.uuid("product_id").references("id").inTable("products").onDelete("NO ACTION");
    table.string("product_name", 120).notNullable();
    table.integer("quantity").notNullable();
    table.integer("unit_price_egp").notNullable();
    table.integer("line_total_egp").notNullable();
    table.text("options").notNullable().defaultTo("[]");
    table.boolean("is_custom").notNullable().defaultTo(false);
    table.check("quantity > 0 AND unit_price_egp >= 0 AND line_total_egp >= 0", [], "order_items_amounts_check");
    table.index(["order_id"], "order_items_order_idx");
  });

  await knex.schema.createTable("order_events", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("NO ACTION");
    table.string("status", 32).notNullable();
    table.uuid("actor_id").references("id").inTable("users").onDelete("NO ACTION");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.text("note").notNullable().defaultTo("");
    table.index(["order_id", "created_at"], "order_events_order_created_idx");
  });

  await knex.schema.createTable("delivery_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("NO ACTION");
    table.string("token_hash", 128).notNullable().unique();
    table.string("manual_code_hash", 128).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("used_at", { useTz: true });
    table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.index(["order_id", "expires_at", "used_at"], "delivery_tokens_valid_idx");
  });

  await knex.schema.createTable("driver_locations", (table) => {
    table.bigIncrements("id").primary();
    table.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("NO ACTION");
    table.uuid("driver_id").notNullable().references("id").inTable("users").onDelete("NO ACTION");
    table.decimal("latitude", 10, 7).notNullable();
    table.decimal("longitude", 10, 7).notNullable();
    table.timestamp("recorded_at", { useTz: true }).notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.index(["order_id", "recorded_at"], "driver_locations_order_recorded_idx");
  });

  await knex.schema.createTable("push_subscribers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("NO ACTION");
    table.string("external_id", 80).notNullable();
    table.string("onesignal_subscription_id", 120).notNullable().unique();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.unique(["user_id", "onesignal_subscription_id"], "push_subscribers_user_subscription_uq");
    table.index(["user_id"], "push_subscribers_user_idx");
  });
};

exports.down = async function down(knex) {
  for (const table of ["push_subscribers", "driver_locations", "delivery_tokens", "order_events", "order_items", "orders", "addresses", "users"]) {
    await knex.schema.dropTableIfExists(table);
  }
};
