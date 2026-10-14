/**
 * Deterministic synthetic seed data for ShopSure QA.
 *
 * Everything here is fictional. Prices deliberately include the boundary values used by the
 * pricing decision table (49.99 / 50.00 / 99.99 / 100.00) and stock deliberately includes an
 * out-of-stock and a low-stock product so negative and boundary tests can reference stable IDs.
 *
 * IDs are NOT hardcoded: rows are inserted in array order into a freshly reset database, so the
 * resulting auto-increment IDs are stable (category 1..6, product 1..24, ...).
 */

export const demoUsers = [
  { email: "customer@example.com", name: "Casey Customer", password: "Customer#12345", role: "CUSTOMER" },
  { email: "second@example.com", name: "Robin Second", password: "Second#12345", role: "CUSTOMER" },
  { email: "admin@example.com", name: "Avery Admin", password: "Admin#12345", role: "ADMIN" },
];

export const categories = [
  { name: "Electronics", slug: "electronics" },
  { name: "Home & Kitchen", slug: "home-kitchen" },
  { name: "Books", slug: "books" },
  { name: "Sports", slug: "sports" },
  { name: "Toys", slug: "toys" },
  { name: "Apparel", slug: "apparel" },
];

/**
 * price/stock choices that matter for tests:
 *  - id 1  149.99 stock 25  -> single line pushes subtotal over the 100 discount threshold
 *  - id 2   49.99 stock 12  -> 1 cent below the free-shipping threshold
 *  - id 3   50.00 stock 40  -> exactly at the free-shipping threshold
 *  - id 4   35.00 stock 0   -> OUT OF STOCK (negative tests)
 *  - id 5   12.50 stock 3   -> LOW STOCK (below low_stock_threshold)
 *  - id 6   99.99 stock 18  -> 1 cent below the discount threshold
 *  - id 7  100.00 stock 11  -> exactly at the discount threshold
 */
export const products = [
  { sku: "SKU-EL-001", name: "Aurora Wireless Headphones", categorySlug: "electronics", price: 149.99, stock: 25, lowStockThreshold: 5, description: "Over-ear wireless headphones with active noise cancelling and 40-hour battery life." },
  { sku: "SKU-EL-002", name: "Pebble Bluetooth Speaker", categorySlug: "electronics", price: 49.99, stock: 12, lowStockThreshold: 5, description: "Compact splash-resistant speaker with rich bass." },
  { sku: "SKU-EL-003", name: "Nimbus Wireless Mouse", categorySlug: "electronics", price: 50.0, stock: 40, lowStockThreshold: 5, description: "Silent-click ergonomic mouse with USB-C charging." },
  { sku: "SKU-EL-004", name: "Volt Power Bank 20000", categorySlug: "electronics", price: 35.0, stock: 0, lowStockThreshold: 5, description: "20,000 mAh power bank with dual fast-charge ports." },
  { sku: "SKU-EL-005", name: "Lumen Desk Lamp", categorySlug: "electronics", price: 12.5, stock: 3, lowStockThreshold: 5, description: "Dimmable LED desk lamp with three colour temperatures." },
  { sku: "SKU-EL-006", name: "Atlas Mechanical Keyboard", categorySlug: "electronics", price: 99.99, stock: 18, lowStockThreshold: 5, description: "Hot-swappable 75% mechanical keyboard." },
  { sku: "SKU-EL-007", name: "Cobalt 4K Webcam", categorySlug: "electronics", price: 100.0, stock: 11, lowStockThreshold: 5, description: "4K webcam with auto-framing and dual microphones." },
  { sku: "SKU-HK-001", name: "Ember Ceramic Mug Set", categorySlug: "home-kitchen", price: 24.5, stock: 60, lowStockThreshold: 10, description: "Set of four 350 ml stoneware mugs." },
  { sku: "SKU-HK-002", name: "Willow Bamboo Cutting Board", categorySlug: "home-kitchen", price: 18.75, stock: 34, lowStockThreshold: 10, description: "Reversible bamboo board with juice groove." },
  { sku: "SKU-HK-003", name: "Hearth Cast Iron Pan", categorySlug: "home-kitchen", price: 45.0, stock: 22, lowStockThreshold: 5, description: "Pre-seasoned 26 cm cast iron skillet." },
  { sku: "SKU-HK-004", name: "Mist Aroma Diffuser", categorySlug: "home-kitchen", price: 39.99, stock: 15, lowStockThreshold: 5, description: "Ultrasonic diffuser with 7-colour ambient light." },
  { sku: "SKU-BK-001", name: "Clean Testing Practices", categorySlug: "books", price: 39.99, stock: 30, lowStockThreshold: 5, description: "A practical guide to writing maintainable automated tests." },
  { sku: "SKU-BK-002", name: "The Pragmatic Bug Hunter", categorySlug: "books", price: 29.5, stock: 26, lowStockThreshold: 5, description: "Defect discovery techniques for web applications." },
  { sku: "SKU-BK-003", name: "SQL for Testers", categorySlug: "books", price: 33.0, stock: 14, lowStockThreshold: 5, description: "Database validation queries every QA engineer should know." },
  { sku: "SKU-BK-004", name: "API Testing Field Notes", categorySlug: "books", price: 27.25, stock: 19, lowStockThreshold: 5, description: "Hands-on REST API testing with real-world scenarios." },
  { sku: "SKU-SP-001", name: "Trail Runner Bottle 750ml", categorySlug: "sports", price: 12.5, stock: 48, lowStockThreshold: 10, description: "Insulated stainless-steel bottle with wide mouth." },
  { sku: "SKU-SP-002", name: "Starter Yoga Mat", categorySlug: "sports", price: 29.99, stock: 16, lowStockThreshold: 5, description: "6 mm non-slip yoga mat with carry strap." },
  { sku: "SKU-SP-003", name: "Resistance Band Set", categorySlug: "sports", price: 21.0, stock: 55, lowStockThreshold: 10, description: "Five resistance levels with door anchor." },
  { sku: "SKU-SP-004", name: "Summit Camp Stove", categorySlug: "sports", price: 64.5, stock: 9, lowStockThreshold: 5, description: "Lightweight folding camping stove." },
  { sku: "SKU-TO-001", name: "Brick Builder 500 Set", categorySlug: "toys", price: 54.0, stock: 20, lowStockThreshold: 5, description: "500-piece creative construction set." },
  { sku: "SKU-TO-002", name: "Galaxy Puzzle 1000", categorySlug: "toys", price: 19.99, stock: 42, lowStockThreshold: 10, description: "1000-piece jigsaw of a spiral galaxy." },
  { sku: "SKU-AP-001", name: "Everyday Cotton Tee", categorySlug: "apparel", price: 15.0, stock: 80, lowStockThreshold: 15, description: "Organic cotton crew-neck t-shirt." },
  { sku: "SKU-AP-002", name: "Rain Shell Jacket", categorySlug: "apparel", price: 89.0, stock: 13, lowStockThreshold: 5, description: "Packable waterproof shell with taped seams." },
  { sku: "SKU-AP-003", name: "Merino Trail Socks", categorySlug: "apparel", price: 16.5, stock: 65, lowStockThreshold: 12, description: "Cushioned merino-blend hiking socks." },
];

/**
 * Two pre-existing orders owned by customer@example.com so order-history and
 * isolation tests have stable targets:
 *   ORD-00001 (PENDING)   subtotal 52.49 -> no discount, free shipping (>= 50)
 *   ORD-00002 (DELIVERED) subtotal 149.99 -> 10% discount, free shipping
 */
export const seededOrders = [
  {
    number: "ORD-00001",
    userEmail: "customer@example.com",
    status: "PENDING",
    items: [
      { sku: "SKU-SP-001", quantity: 1 },
      { sku: "SKU-BK-002", quantity: 1 },
    ],
    shipping: {
      name: "Casey Customer",
      email: "customer@example.com",
      phone: "+1 555 0100",
      address: "12 Example Street",
      city: "Springfield",
      postcode: "12345",
    },
  },
  {
    number: "ORD-00002",
    userEmail: "customer@example.com",
    status: "DELIVERED",
    items: [{ sku: "SKU-EL-001", quantity: 1 }],
    shipping: {
      name: "Casey Customer",
      email: "customer@example.com",
      phone: "+1 555 0100",
      address: "12 Example Street",
      city: "Springfield",
      postcode: "12345",
    },
  },
];

/** US-style postcode used by tests that need an invalid value. */
export const invalidPostcodes = ["12", "12345678901", "!!!", "AB"];
