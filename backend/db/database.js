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
  name:               { type: String, required: true },
  unit:               { type: String, required: true },
  current_stock:      { type: Number, default: 0 },
  min_stock:          { type: Number, default: 0 },
  last_restocked_at:  { type: Date,   default: null },
  last_restocked_by:  { type: String, default: null },
  created_at:         { type: Date,   default: Date.now }
}, jsonOpts);

const productSchema = new mongoose.Schema({
  name:              { type: String, required: true },
  category:          { type: String, required: true },
  price:             { type: Number, required: true },
  description:       { type: String, default: '' },
  emoji:             { type: String, default: '☕' },
  image_url:         { type: String, default: '' },
  active:            { type: Number, default: 1 },   // 0 or 1 — keeps frontend checks working
  is_special_edition: { type: Boolean, default: false },
  is_best_seller:     { type: Boolean, default: false },
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
  order_number:       { type: String, default: '' },   // e.g. KB-000001
  subtotal:           { type: Number, required: true },
  discount:           { type: Number, default: 0 },
  total:              { type: Number, required: true },
  payment_method:     { type: String, default: 'Cash' },
  table_number:       { type: String, default: '' },
  customer_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name:      { type: String, default: '' },
  customer_unique_id: { type: String, default: '' },
  source:             { type: String, default: 'pos' },   // 'pos' | 'portal'
  status:             { type: String, default: 'pending' },   // 'completed' | 'pending' | 'processing'
  notes:              { type: String, default: '' },
  items:              [orderItemSchema],
  created_at:         { type: Date, default: Date.now }
}, jsonOpts);

const customerSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, unique: true, sparse: true },
  password_hash: { type: String },
  avatar_url:    { type: String },
  points:        { type: Number, default: 0 },
  loyalty_level: { type: String, default: 'Bronze' },
  unique_id:     { type: String, unique: true, sparse: true },
  birthdate:     { type: String, default: '' },
  phone:         { type: String, default: '' },
  created_at:    { type: Date, default: Date.now }
}, jsonOpts);

const eventSchema = new mongoose.Schema({
  title:               { type: String, required: true },
  description:         { type: String },
  date:                { type: String, required: true },
  preferred_time:      { type: String, default: '' },
  type:                { type: String, default: 'shop' },
  host_name:           { type: String },
  phone:               { type: String, default: '' },
  is_private:          { type: Boolean, default: false },
  max_participants:    { type: Number, default: 30 },
  participant_names:   [{ type: String }],
  status:              { type: String, default: 'upcoming' },
  approval_notified:   { type: Boolean, default: false },
  participants:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  customer_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  created_at:          { type: Date, default: Date.now }
}, jsonOpts);

const shopSettingsSchema = new mongoose.Schema({
  max_people_per_event:    { type: Number, default: 30 },
  max_concurrent_events:   { type: Number, default: 1 },
  shop_open_time:          { type: String, default: '14:00' },
  shop_close_time:         { type: String, default: '00:00' },
}, jsonOpts);

const adminSchema = new mongoose.Schema({
  username:      { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  role:          { type: String, enum: ['admin', 'staff'], default: 'staff' },
  created_at:    { type: Date, default: Date.now }
}, jsonOpts);

const auditLogSchema = new mongoose.Schema({
  admin_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  username:   { type: String, required: true },
  role:       { type: String, default: 'staff' },
  action:     { type: String, required: true },
  ip:         { type: String, default: 'unknown' },
  created_at: { type: Date, default: Date.now }
}, jsonOpts);

const ratingSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  rating:      { type: Number, required: true, min: 1, max: 5 },
  comment:     { type: String },
  created_at:  { type: Date, default: Date.now }
}, jsonOpts);

// ── Counter schema for sequential order numbers ───────────────────────────────
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// ── Models ───────────────────────────────────────────────────────────────────
const Ingredient   = mongoose.model('Ingredient',   ingredientSchema);
const Product      = mongoose.model('Product',      productSchema);
const Order        = mongoose.model('Order',        orderSchema);
const Customer     = mongoose.model('Customer',     customerSchema);
const Event        = mongoose.model('Event',        eventSchema);
const Admin        = mongoose.model('Admin',        adminSchema);
const AuditLog     = mongoose.model('AuditLog',     auditLogSchema);
const Rating       = mongoose.model('Rating',       ratingSchema);
const ShopSettings = mongoose.model('ShopSettings', shopSettingsSchema);
const Counter      = mongoose.model('Counter',      counterSchema);

// ── Seed Data ────────────────────────────────────────────────────────────────
async function seedDatabase() {
  console.log('🌱 Checking KapeBara database seed status...');

  // 1. Seed Admin & Staff accounts if missing
  const hasAdmin = await Admin.findOne({ username: 'admin' });
  if (!hasAdmin) {
    const adminPw = crypto.createHash('sha256').update('admin123').digest('hex');
    await Admin.create({ username: 'admin', password_hash: adminPw, role: 'admin' });
    console.log('✅ Admin account created (admin/admin123)');
  }

  const hasStaff = await Admin.findOne({ username: 'staff' });
  if (!hasStaff) {
    const staffPw = crypto.createHash('sha256').update('staff123').digest('hex');
    await Admin.create({ username: 'staff', password_hash: staffPw, role: 'staff' });
    console.log('✅ Staff account created (staff/staff123)');
  }

  // 2. Seed Customer if missing
  const customerCount = await Customer.countDocuments();
  if (customerCount === 0) {
    const seedPw = crypto.createHash('sha256').update('password123').digest('hex');
    await Customer.create({
      name: 'Juan Dela Cruz',
      email: 'juan@kapebara.com',
      password_hash: seedPw,
      points: 1250,
      loyalty_level: 'Gold',
      unique_id: '123456'
    });
    console.log('✅ Customer account created (juan@kapebara.com / password123)');
  }

  // 3. Seed Events if missing
  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    const d1 = new Date(); d1.setDate(d1.getDate() + 2);
    const d2 = new Date(); d2.setDate(d2.getDate() + 5);
    const d3 = new Date(); d3.setDate(d3.getDate() + 10);
    await Event.insertMany([
      { title: 'Latte Art Workshop', description: 'Learn the basics of latte art from our master barista.', date: d1.toISOString().slice(0,10), type: 'shop', host_name: 'KapeBara', status: 'approved' },
      { title: 'Acoustic Night', description: 'Enjoy live acoustic music while sipping your favorite coffee.', date: d2.toISOString().slice(0,10), type: 'shop', host_name: 'KapeBara', status: 'approved' },
      { title: 'Book Club Meetup', description: 'Monthly meetup for local book lovers.', date: d3.toISOString().slice(0,10), type: 'customer', host_name: 'Maria Clara', status: 'approved' },
    ]);
    console.log('✅ Sample Events created');
  }

  // 4. Seed Products & Ingredients only if the collection is empty.
  //    We do NOT wipe existing products so that uploaded images & customisations are preserved.
  const productCount = await Product.countDocuments();
  if (productCount > 0) {
    console.log(`✅ Products already seeded (${productCount} found) — skipping to preserve images.`);
    return;
  }
  await Ingredient.deleteMany({});
  console.log('🌱 Seeding products & ingredients for the first time...');

  // ── Ingredients ─────────────────────────────────────────────────────────────
  // min_stock = safety threshold. For liquids (ml) it's 1000 → triggers "critical" alert.
  const rawIng = [
    // name,                    unit,      current_stock, min_stock
    ['Espresso Shot',           'ml',          5000,       1000],
    ['Whole Milk',              'ml',          8000,       1000],
    ['Matcha Powder',           'g',            500,        100],
    ['Chocolate Syrup',         'ml',          3000,       1000],
    ['Caramel Syrup',           'ml',          3000,       1000],
    ['Hazelnut Syrup',          'ml',          3000,       1000],
    ['Strawberry Syrup',        'ml',          3000,       1000],
    ['Blueberry Syrup',         'ml',          3000,       1000],
    ['Ice',                     'ml',         10000,       1000],
    ['Vanilla Syrup',           'ml',          3000,       1000],
    ['Spanish Syrup',           'ml',          2000,       1000],
    ['Honey',                   'ml',          2000,        500],
    ['Lemon Juice',             'ml',          2000,        500],
    ['White Chocolate Syrup',   'ml',          3000,       1000],
    ['Iced Tea Mix',            'g',           1000,        200],
    ['Melon Syrup',             'ml',          2000,       1000],
    ['Ube Syrup',               'ml',          2000,       1000],
    ['Mango Syrup',             'ml',          2000,       1000],
    ['Ice Cream',               'scoops',        50,         10],
    ['French Fries',            'g',           5000,        500],
    ['Chicken',                 'g',           5000,        500],
    ['Waffle Mix',              'g',           3000,        500],
    ['Seaweed',                 'pcs',          100,         20],
    ['Rice',                    'g',           5000,        500],
    ['Soda Can',                'pcs',           48,         12],
    ['Water Bottle',            'pcs',           24,          6],
    ['Whipping Cream',          'ml',          3000,        500],
    ['Sea Salt',                'g',            500,         50],
  ];

  const ingDocs = await Ingredient.insertMany(
    rawIng.map(([name, unit, current_stock, min_stock]) => ({ name, unit, current_stock, min_stock }))
  );
  const ing = {};
  ingDocs.forEach(i => { ing[i.name] = i._id; });

  // ── Products ─────────────────────────────────────────────────────────────────
  // Cold price is the base. Hot = base + ₱20 (handled as a customization in POS).
  const rawProducts = [

    // ── Capy Caffeine — COFFEE ─────────────────────────────────────────────────
    { name:'Americano',                 category:'Coffee',          price:120, emoji:'☕', is_best_seller:true,
      ing:[['Espresso Shot',60],['Ice',200]] },
    { name:'Spanish Latte',             category:'Coffee',          price:160, emoji:'☕',
      ing:[['Espresso Shot',60],['Spanish Syrup',30],['Whole Milk',120]] },
    { name:'French Vanilla Latte',      category:'Coffee',          price:160, emoji:'☕',
      ing:[['Espresso Shot',60],['Vanilla Syrup',30],['Whole Milk',150]] },
    { name:'Dutch Mocha',               category:'Coffee',          price:160, emoji:'☕',
      ing:[['Espresso Shot',60],['Chocolate Syrup',30],['Whole Milk',150]] },
    { name:'Caramel Macchiato',         category:'Coffee',          price:160, emoji:'☕', is_best_seller:true,
      ing:[['Espresso Shot',60],['Caramel Syrup',30],['Whole Milk',150]] },
    { name:'Seasalt Caramel',           category:'Coffee',          price:170, emoji:'☕',
      ing:[['Espresso Shot',60],['Caramel Syrup',30],['Whole Milk',150],['Sea Salt',2]] },
    { name:'Dirty Matcha',              category:'Coffee',          price:170, emoji:'☕', is_special_edition:true,
      ing:[['Espresso Shot',30],['Matcha Powder',8],['Whole Milk',150]] },

    // ── Gentle Drinks — NON-COFFEE ─────────────────────────────────────────────
    { name:'Mocha Hazelnut',            category:'Non-Coffee',      price:170, emoji:'🍫',
      ing:[['Chocolate Syrup',30],['Hazelnut Syrup',20],['Whole Milk',150]] },
    { name:'Matcha Latte',              category:'Non-Coffee',      price:160, emoji:'🍵', is_best_seller:true,
      ing:[['Matcha Powder',8],['Whole Milk',200]] },
    { name:'Strawberry Matcha',         category:'Non-Coffee',      price:170, emoji:'🍵',
      ing:[['Matcha Powder',6],['Strawberry Syrup',20],['Whole Milk',150]] },
    { name:'Strawberry Milk',           category:'Non-Coffee',      price:160, emoji:'🍓',
      ing:[['Strawberry Syrup',30],['Whole Milk',200]] },
    { name:'Blueberry Milk',            category:'Non-Coffee',      price:160, emoji:'🫐',
      ing:[['Blueberry Syrup',30],['Whole Milk',200]] },
    { name:'White Chocolate',           category:'Non-Coffee',      price:160, emoji:'🍦',
      ing:[['White Chocolate Syrup',40],['Whole Milk',200]] },
    { name:'Dutch Chocolate',           category:'Non-Coffee',      price:160, emoji:'🍫',
      ing:[['Chocolate Syrup',40],['Whole Milk',200]] },
    { name:'Honey Lemon Ginger',        category:'Non-Coffee',      price:160, emoji:'🍋',
      ing:[['Honey',30],['Lemon Juice',30]] },
    { name:'Iced Tea',                  category:'Non-Coffee',      price:70,  emoji:'🧊',
      ing:[['Iced Tea Mix',15],['Ice',200]] },

    // ── Blended Series ─────────────────────────────────────────────────────────
    { name:'Melon Frost',               category:'Blended',         price:150, emoji:'🥤',
      ing:[['Melon Syrup',40],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },
    { name:'Vanilla Frost',             category:'Blended',         price:150, emoji:'🥤',
      ing:[['Vanilla Syrup',40],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },
    { name:'Ube Frost',                 category:'Blended',         price:150, emoji:'🥤', is_special_edition:true,
      ing:[['Ube Syrup',40],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },
    { name:'Mango Frost',               category:'Blended',         price:150, emoji:'🥤',
      ing:[['Mango Syrup',40],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },
    { name:'Caramel Macchiato Blended', category:'Blended',         price:150, emoji:'🥤',
      ing:[['Caramel Syrup',30],['Espresso Shot',30],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },
    { name:'Choco Hot Fudge',           category:'Blended',         price:150, emoji:'🥤', is_best_seller:true,
      ing:[['Chocolate Syrup',40],['Whole Milk',100],['Ice',300],['Whipping Cream',30]] },

    // ── Comforting Bites — FOOD ────────────────────────────────────────────────
    { name:'French Fries (Small)',       category:'Food',            price:70,  emoji:'🍟',
      ing:[['French Fries',100]] },
    { name:'French Fries (Medium)',      category:'Food',            price:120, emoji:'🍟', is_best_seller:true,
      ing:[['French Fries',200]] },
    { name:'French Fries (Large)',       category:'Food',            price:160, emoji:'🍟',
      ing:[['French Fries',300]] },
    { name:'Chicken Poppers',            category:'Food',            price:150, emoji:'🍗', is_best_seller:true,
      ing:[['Chicken',150]] },
    { name:'Giant Waffles 8"',           category:'Food',            price:150, emoji:'🧇',
      ing:[['Waffle Mix',200]] },
    { name:'Korean Musubi',              category:'Food',            price:50,  emoji:'🍱',
      ing:[['Seaweed',2],['Rice',150]] },

    // ── Bubbly & Floating — FRUIT SODAS ───────────────────────────────────────
    { name:'Strawberry Soda',            category:'Fruit Soda',      price:120, emoji:'🍓',
      ing:[['Strawberry Syrup',30],['Soda Can',1]] },
    { name:'Blueberry Soda',             category:'Fruit Soda',      price:120, emoji:'🫐',
      ing:[['Blueberry Syrup',30],['Soda Can',1]] },
    { name:'Mixed Berry Soda',           category:'Fruit Soda',      price:120, emoji:'🍇',
      ing:[['Strawberry Syrup',15],['Blueberry Syrup',15],['Soda Can',1]] },

    // ── Classic Cans ───────────────────────────────────────────────────────────
    { name:'Coke',                       category:'Classic Cans',    price:90,  emoji:'🥤',
      ing:[['Soda Can',1]] },
    { name:'Royal',                      category:'Classic Cans',    price:90,  emoji:'🥤',
      ing:[['Soda Can',1]] },
    { name:'Sprite',                     category:'Classic Cans',    price:90,  emoji:'🥤',
      ing:[['Soda Can',1]] },
    { name:'Root Beer',                  category:'Classic Cans',    price:100, emoji:'🥤',
      ing:[['Soda Can',1]] },
    { name:'Water 500ml',                category:'Classic Cans',    price:25,  emoji:'💧',
      ing:[['Water Bottle',1]] },

    // ── Floating Chills ────────────────────────────────────────────────────────
    { name:'Coke Float',                 category:'Floating Chills', price:130, emoji:'🍨',
      ing:[['Soda Can',1],['Ice Cream',2]] },
    { name:'Royal Float',                category:'Floating Chills', price:130, emoji:'🍨',
      ing:[['Soda Can',1],['Ice Cream',2]] },
    { name:'Sprite Float',               category:'Floating Chills', price:130, emoji:'🍨',
      ing:[['Soda Can',1],['Ice Cream',2]] },
    { name:'Root Beer Float',            category:'Floating Chills', price:130, emoji:'🍨',
      ing:[['Soda Can',1],['Ice Cream',2]] },
  ];

  const productDocs = await Product.insertMany(rawProducts.map(p => ({
    name: p.name, category: p.category, price: p.price,
    description: p.description || '', emoji: p.emoji, active: 1,
    is_best_seller: p.is_best_seller || false,
    is_special_edition: p.is_special_edition || false,
    ingredients: p.ing.map(([name, qty]) => ({
      ingredient_id: ing[name],
      quantity_used: qty
    }))
  })));
  console.log(`✅ ${productDocs.length} products seeded`);
  console.log(`✅ ${ingDocs.length} ingredients seeded`);

  // 5. Seed 30 days of sample orders (only if none exist yet)
  const orderCount = await Order.countDocuments();
  if (orderCount === 0) {
    console.log('🌱 Seeding 30 days of sample orders...');

    // Get a counter starting point
    const startCounter = await Counter.findByIdAndUpdate(
      'orders',
      { $inc: { seq: 0 } },
      { new: true, upsert: true }
    );
    let seqNum = startCounter.seq;

    const orders = [];
    for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const ordersToday = Math.floor(Math.random() * 15) + 8;
      for (let o = 0; o < ordersToday; o++) {
        const hour = Math.floor(Math.random() * 12) + 10;
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
          items.push({
            product_id: prod._id,
            product_name: prod.name,
            quantity: qty,
            unit_price: prod.price,
            subtotal: sub,
            customizations: {}
          });
        }
        const discount = Math.random() < 0.12 ? Math.round(subtotal * 0.1) : 0;
        seqNum += 1;
        orders.push({
          order_number: `KB-${String(seqNum).padStart(6, '0')}`,
          subtotal,
          discount,
          total: subtotal - discount,
          payment_method: 'Cash',
          status: 'completed',
          items,
          created_at: ts
        });
      }
    }
    // Update counter to reflect seeded orders
    await Counter.findByIdAndUpdate('orders', { $set: { seq: seqNum } }, { upsert: true });
    await Order.insertMany(orders);
    console.log(`✅ ${orders.length} sample orders seeded`);
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────
async function connectDatabase() {
  await mongoose.connect(MONGODB_URI);
  console.log(`📦 Connected to MongoDB → ${MONGODB_URI}`);
  await seedDatabase();
}

module.exports = {
  connectDatabase,
  Ingredient, Product, Order, Customer, Event,
  Admin, AuditLog, Rating, ShopSettings, Counter
};
