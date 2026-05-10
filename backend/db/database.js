/**
 * database.js — MongoDB connection via Mongoose
 * Replaces the old sql.js / SQLite setup.
 * All schemas use snake_case field names to stay compatible with the existing frontend.
 */

const mongoose = require('mongoose');
const crypto   = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kapebara';

// ── toJSON helper: expose `id` string, hide `_id` / `__v` ───────────────────
const jsonOpts = {
  toJSON: {
    virtuals: true,
    transform: (_, ret) => { delete ret._id; delete ret.__v; return ret; }
  }
};

// ── Schemas ──────────────────────────────────────────────────────────────────

const ingredientSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  unit:          { type: String, required: true },
  current_stock: { type: Number, default: 0 },
  min_stock:     { type: Number, default: 0 },
  created_at:    { type: Date, default: Date.now }
}, jsonOpts);

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category:    { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
  emoji:       { type: String, default: '☕' },
  active:      { type: Number, default: 1 },   // 0 or 1 — keeps frontend checks working
  ingredients: [{
    ingredient_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
    quantity_used:  { type: Number, required: true }
  }],
  created_at:  { type: Date, default: Date.now }
}, jsonOpts);

const orderItemSchema = new mongoose.Schema({
  product_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name:   { type: String, required: true },
  quantity:       { type: Number, required: true },
  unit_price:     { type: Number, required: true },
  subtotal:       { type: Number, required: true },
  customizations: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false, toJSON: { virtuals: false } });

const orderSchema = new mongoose.Schema({
  subtotal:       { type: Number, required: true },
  discount:       { type: Number, default: 0 },
  total:          { type: Number, required: true },
  payment_method: { type: String, default: 'Cash' },
  status:         { type: String, default: 'completed' },
  notes:          { type: String, default: '' },
  items:          [orderItemSchema],
  created_at:     { type: Date, default: Date.now }
}, jsonOpts);

const customerSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, unique: true, sparse: true },
  password_hash: { type: String },
  avatar_url:    { type: String },
  points:        { type: Number, default: 0 },
  loyalty_level: { type: String, default: 'Bronze' },
  created_at:    { type: Date, default: Date.now }
}, jsonOpts);

const eventSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  description:  { type: String },
  date:         { type: String, required: true },
  type:         { type: String, default: 'shop' },
  host_name:    { type: String },
  status:       { type: String, default: 'upcoming' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  created_at:   { type: Date, default: Date.now }
}, jsonOpts);

const adminSchema = new mongoose.Schema({
  username:      { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  created_at:    { type: Date, default: Date.now }
}, jsonOpts);

const ratingSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  rating:      { type: Number, required: true, min: 1, max: 5 },
  comment:     { type: String },
  created_at:  { type: Date, default: Date.now }
}, jsonOpts);

// ── Models ───────────────────────────────────────────────────────────────────
const Ingredient = mongoose.model('Ingredient', ingredientSchema);
const Product    = mongoose.model('Product',    productSchema);
const Order      = mongoose.model('Order',      orderSchema);
const Customer   = mongoose.model('Customer',   customerSchema);
const Event      = mongoose.model('Event',      eventSchema);
const Admin      = mongoose.model('Admin',      adminSchema);
const Rating     = mongoose.model('Rating',     ratingSchema);

// ── Seed Data ────────────────────────────────────────────────────────────────
async function seedDatabase() {
  const productCount = await Product.countDocuments();
  if (productCount > 0) return; // already seeded

  console.log('🌱 Seeding KapeBara database...');

  // Ingredients
  const rawIng = [
    ['Coffee Beans',    'g',   5000, 500 ],
    ['Whole Milk',      'ml',  8000, 1000],
    ['Chocolate Syrup', 'ml',  2000, 300 ],
    ['Caramel Syrup',   'ml',  2000, 300 ],
    ['Sugar',           'g',   3000, 500 ],
    ['Ice',             'g',  10000, 2000],
    ['Matcha Powder',   'g',    500, 100 ],
    ['Strawberry Syrup','ml',  1500, 300 ],
    ['Whipping Cream',  'ml',  2000, 400 ],
    ['Pastry Stock',    'pcs',   50,  10 ],
    ['Vanilla Syrup',   'ml',  1500, 300 ],
    ['Espresso Shot',   'ml',  3000, 500 ],
  ];
  const ingDocs = await Ingredient.insertMany(rawIng.map(([name, unit, current_stock, min_stock]) =>
    ({ name, unit, current_stock, min_stock })
  ));
  const ing = {};
  ingDocs.forEach(i => { ing[i.name] = i._id; });

  // Products
  const rawProducts = [
    { name:'Espresso',          category:'Espresso',    price:80,  description:'Pure concentrated coffee shot',         emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',30]]},
    { name:'Americano',         category:'Espresso',    price:90,  description:'Espresso with hot water',               emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',60]]},
    { name:'Cappuccino',        category:'Espresso',    price:110, description:'Espresso with steamed milk foam',        emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',60],['Whole Milk',120]]},
    { name:'Latte',             category:'Espresso',    price:120, description:'Espresso with silky steamed milk',       emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',60],['Whole Milk',200]]},
    { name:'Caramel Macchiato', category:'Espresso',    price:135, description:'Vanilla latte with caramel drizzle',    emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',60],['Whole Milk',200],['Caramel Syrup',30],['Vanilla Syrup',15]]},
    { name:'Matcha Latte',      category:'Specialty',   price:130, description:'Premium matcha with steamed milk',      emoji:'🍵', ing:[['Matcha Powder',10],['Whole Milk',250],['Sugar',15]]},
    { name:'Vanilla Latte',     category:'Specialty',   price:125, description:'Espresso with vanilla and milk',        emoji:'☕', ing:[['Coffee Beans',18],['Espresso Shot',60],['Whole Milk',200],['Vanilla Syrup',30]]},
    { name:'Chocolate Frappé',  category:'Frappé',      price:145, description:'Blended chocolate ice drink with cream',emoji:'🧋', ing:[['Chocolate Syrup',45],['Whole Milk',150],['Ice',250],['Whipping Cream',50],['Sugar',20]]},
    { name:'Strawberry Frappé', category:'Frappé',      price:145, description:'Blended strawberry ice drink',          emoji:'🧋', ing:[['Strawberry Syrup',45],['Whole Milk',150],['Ice',250],['Whipping Cream',50],['Sugar',20]]},
    { name:'Caramel Frappé',    category:'Frappé',      price:150, description:'Blended caramel ice drink with cream',  emoji:'🧋', ing:[['Caramel Syrup',45],['Whole Milk',150],['Ice',250],['Whipping Cream',50],['Coffee Beans',10]]},
    { name:'Mocha Frappé',      category:'Frappé',      price:150, description:'Coffee meets chocolate in icy form',    emoji:'🧋', ing:[['Chocolate Syrup',40],['Coffee Beans',15],['Whole Milk',150],['Ice',250],['Whipping Cream',50]]},
    { name:'Iced Americano',    category:'Cold Drinks', price:95,  description:'Cold espresso with chilled water',      emoji:'🧊', ing:[['Coffee Beans',18],['Espresso Shot',60],['Ice',200]]},
    { name:'Iced Latte',        category:'Cold Drinks', price:120, description:'Espresso over ice with cold milk',      emoji:'🧊', ing:[['Coffee Beans',18],['Espresso Shot',60],['Whole Milk',200],['Ice',200]]},
    { name:'Iced Matcha Latte', category:'Cold Drinks', price:135, description:'Matcha poured over ice and milk',       emoji:'🍵', ing:[['Matcha Powder',10],['Whole Milk',200],['Ice',200],['Sugar',15]]},
    { name:'Butter Croissant',  category:'Food',        price:85,  description:'Flaky, buttery French pastry',          emoji:'🥐', ing:[['Pastry Stock',1]]},
    { name:'Blueberry Muffin',  category:'Food',        price:75,  description:'Soft muffin bursting with blueberries', emoji:'🧁', ing:[['Pastry Stock',1]]},
    { name:'Cheese Sandwich',   category:'Food',        price:90,  description:'Grilled cheese on artisan bread',       emoji:'🥪', ing:[['Pastry Stock',1]]},
    { name:'Banana Loaf',       category:'Food',        price:65,  description:'Moist homemade banana bread slice',     emoji:'🍞', ing:[['Pastry Stock',1]]},
  ];

  const productDocs = await Product.insertMany(rawProducts.map(p => ({
    name: p.name, category: p.category, price: p.price,
    description: p.description, emoji: p.emoji, active: 1,
    ingredients: p.ing.map(([name, qty]) => ({ ingredient_id: ing[name], quantity_used: qty }))
  })));

  // Historical orders (30 days) for forecast data
  const orders = [];
  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const ordersToday = Math.floor(Math.random() * 15) + 8;
    for (let o = 0; o < ordersToday; o++) {
      const hour = Math.floor(Math.random() * 12) + 7;
      const min  = Math.floor(Math.random() * 60);
      const ts   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, min, 0);
      let subtotal = 0;
      const items  = [];
      const itemCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < itemCount; i++) {
        const prod = productDocs[Math.floor(Math.random() * productDocs.length)];
        const qty  = Math.floor(Math.random() * 3) + 1;
        const sub  = prod.price * qty;
        subtotal  += sub;
        items.push({ product_id: prod._id, product_name: prod.name, quantity: qty, unit_price: prod.price, subtotal: sub, customizations: {} });
      }
      const discount = Math.random() < 0.12 ? Math.round(subtotal * 0.1) : 0;
      orders.push({ subtotal, discount, total: subtotal - discount, payment_method: 'Cash', status: 'completed', items, created_at: ts });
    }
  }
  await Order.insertMany(orders);

  // Seed customer
  const seedPw = crypto.createHash('sha256').update('password123').digest('hex');
  await Customer.create({ name: 'Juan Dela Cruz', email: 'juan@kapebara.com', password_hash: seedPw, points: 1250, loyalty_level: 'Gold' });

  // Seed events
  const d1 = new Date(); d1.setDate(d1.getDate() + 2);
  const d2 = new Date(); d2.setDate(d2.getDate() + 5);
  const d3 = new Date(); d3.setDate(d3.getDate() + 10);
  await Event.insertMany([
    { title: 'Latte Art Workshop', description: 'Learn the basics of latte art from our master barista.', date: d1.toISOString().slice(0,10), type: 'shop', host_name: 'KapeBara' },
    { title: 'Acoustic Night', description: 'Enjoy live acoustic music while sipping your favorite coffee.', date: d2.toISOString().slice(0,10), type: 'shop', host_name: 'KapeBara' },
    { title: 'Book Club Meetup', description: 'Monthly meetup for local book lovers.', date: d3.toISOString().slice(0,10), type: 'customer', host_name: 'Maria Clara' },
  ]);

  // Seed admin
  const adminPw = crypto.createHash('sha256').update('admin123').digest('hex');
  await Admin.create({ username: 'admin', password_hash: adminPw });

  console.log('✅ MongoDB seeded with KapeBara sample data');
}

// ── Connect ───────────────────────────────────────────────────────────────────
async function connectDatabase() {
  await mongoose.connect(MONGODB_URI);
  console.log(`📦 Connected to MongoDB → ${MONGODB_URI}`);
  await seedDatabase();
}

module.exports = { connectDatabase, Ingredient, Product, Order, Customer, Event, Admin, Rating };
