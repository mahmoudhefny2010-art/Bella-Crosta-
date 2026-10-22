const upsert = require('../upsert');
const categories = [
  { slug: "classic", name: "Classic", name_ar: "كلاسيكية", description: "Neapolitan classics", description_ar: "كلاسيكيات نابولي" },
  { slug: "special", name: "Signature", name_ar: "مميزة", description: "Bella Crosta signatures", description_ar: "اختيارات بيلا كروستا المميزة" },
];

const products = [
  { slug: "margherita", category: "classic", name: "Margherita", name_ar: "مارغريتا", price_egp: 300, description: "Italian tomato sauce, Italian basil, Fiori di Latte mozzarella, and extra virgin olive oil.", description_ar: "صلصة طماطم إيطالية، ريحان إيطالي، جبنة فيوري دي لاتيه، وزيت زيتون بكر ممتاز.", image_url: "/uploads/1777142685620-Margherita-Pizza.jpg", ingredients: ["Italian tomato sauce", "Italian basil", "Fiori di Latte mozzarella", "Extra virgin olive oil"], featured: true },
  { slug: "la-rossetta", category: "special", name: "La Rossetta", name_ar: "لا روسيتا", price_egp: 330, description: "Italian tomato sauce, basil, Fiori di Latte mozzarella, parmesan, pepperoni, and extra virgin olive oil.", description_ar: "صلصة طماطم إيطالية، ريحان، جبنة فيوري دي لاتيه، بارميزان، بيبروني، وزيت زيتون بكر ممتاز.", image_url: "/uploads/1777142695243-La-Rossetta.jpg", ingredients: ["Italian tomato sauce", "Italian basil", "Fiori di Latte mozzarella", "Parmesan", "Pepperoni", "Extra virgin olive oil"], featured: true },
  { slug: "bella-pizza", category: "special", name: "Bella Pizza", name_ar: "بيلا بيتزا", price_egp: 330, description: "Cream sauce, basil, mozzarella, smoked turkey, and extra virgin olive oil.", description_ar: "صلصة كريمة، ريحان، جبنة موزاريلا، ديك رومي مدخن، وزيت زيتون بكر ممتاز.", image_url: "/uploads/1777142578662-Bella-Pizza.jpg", ingredients: ["Cream sauce", "Italian basil", "Mozzarella", "Smoked turkey", "Extra virgin olive oil"], featured: true },
  { slug: "pepperoni", category: "classic", name: "Pepperoni", name_ar: "بيبروني", price_egp: 340, description: "Italian tomato sauce, mozzarella, and generous slices of pepperoni.", description_ar: "صلصة طماطم إيطالية، موزاريلا، وشرائح وفيرة من البيبروني.", image_url: "", ingredients: ["Italian tomato sauce", "Mozzarella", "Pepperoni"] },
  { slug: "pastrami", category: "special", name: "Pastrami", name_ar: "بسطرمة", price_egp: 460, description: "Tomato sauce, mozzarella, Egyptian beef pastrami, and fresh herbs.", description_ar: "صلصة طماطم، موزاريلا، بسطرمة لحم بقري مصرية، وأعشاب طازجة.", image_url: "", ingredients: ["Tomato sauce", "Mozzarella", "Beef pastrami", "Fresh herbs"] },
  { slug: "beef-bacon", category: "special", name: "Beef Bacon", name_ar: "بيف بيكون", price_egp: 400, description: "Tomato sauce, mozzarella, and crisp beef bacon.", description_ar: "صلصة طماطم، موزاريلا، وشرائح بيف بيكون مقرمشة.", image_url: "", ingredients: ["Tomato sauce", "Mozzarella", "Beef bacon"] },
  { slug: "spicy-honey-diavola", category: "special", name: "Spicy Honey Diavola", name_ar: "ديافولا بالعسل الحار", price_egp: 500, description: "Tomato sauce, mozzarella, spicy salami, chili, and a drizzle of honey.", description_ar: "صلصة طماطم، موزاريلا، سلامي حار، فلفل حار، ولمسة من العسل.", image_url: "", ingredients: ["Tomato sauce", "Mozzarella", "Spicy salami", "Chili", "Honey"] },
  { slug: "marinara", category: "classic", name: "Marinara", name_ar: "مارينارا", price_egp: 270, description: "Neapolitan tomato sauce, garlic, oregano, and extra virgin olive oil. No cheese.", description_ar: "صلصة طماطم نابولية، ثوم، أوريغانو، وزيت زيتون بكر ممتاز، بدون جبن.", image_url: "", ingredients: ["Tomato sauce", "Garlic", "Oregano", "Extra virgin olive oil"] },
  { slug: "pizza-napoli", category: "special", name: "Pizza Napoli", name_ar: "بيتزا نابولي", price_egp: 450, description: "Tomato sauce, Fiori di Latte mozzarella, anchovies, capers, oregano, and extra virgin olive oil.", description_ar: "صلصة طماطم، جبنة فيوري دي لاتيه، أنشوجة، كَبَر، أوريغانو، وزيت زيتون بكر ممتاز.", image_url: "/uploads/napoli-pizza.jpg", ingredients: ["Tomato sauce", "Fiori di Latte mozzarella", "Anchovies", "Capers", "Oregano", "Extra virgin olive oil"], featured: true },
];

exports.seed = async function seed(knex) {
  await knex.transaction(async (trx) => {
    for (const category of categories) {
      await upsert(trx, "categories", { slug: category.slug }, category, {
        name: category.name,
        name_ar: category.name_ar,
        description: category.description,
        description_ar: category.description_ar,
        updated_at: trx.raw('SYSUTCDATETIME()'),
      });
    }

    const categoryRows = await trx("categories").select("id", "slug");
    const categoryIds = Object.fromEntries(categoryRows.map((row) => [row.slug, row.id]));

    for (const product of products) {
      const { category, featured = false, ...values } = product;
      await upsert(trx, "products", { slug: product.slug }, {
        ...values, ingredients: JSON.stringify(values.ingredients),
        category_id: categoryIds[category],
        is_featured: featured,
        is_available: true,
      }, {
        ...values, ingredients: JSON.stringify(values.ingredients),
        category_id: categoryIds[category],
        is_featured: featured,
        is_available: true,
        updated_at: trx.raw('SYSUTCDATETIME()'),
      });
    }

    const margherita = await trx("products").where({ slug: "margherita" }).first("id");
    for (const option of [
      { option_group: 'sauce', name: 'Tomato sauce', name_ar: 'صلصة الطماطم', price_delta_egp: 0, sort_order: 0 },
      { option_group: 'sauce', name: 'Cream sauce', name_ar: 'صلصة الكريمة', price_delta_egp: 0, sort_order: 1 },
      { option_group: "extra_topping", name: "Extra mozzarella", name_ar: "موزاريلا إضافية", price_delta_egp: 45, sort_order: 1 },
      { option_group: "extra_topping", name: "Extra pepperoni", name_ar: "بيبروني إضافي", price_delta_egp: 55, sort_order: 2 },
    ]) {
      await upsert(trx, "product_options", { product_id: margherita.id, option_group: option.option_group, name: option.name }, option);
    }
  });
};
