# Italian Pizza Website - Developer Quick Reference Guide

## ⚡ QUICK START: TOP 10 THINGS TO FIX FIRST

1. **Install & configure rate limiting** (1 hour)
2. **Add phone number validation** (1 hour)
3. **Enable guest checkout** (2 hours)
4. **Add form validation feedback** (2 hours)
5. **Send order confirmation emails** (2 hours)
6. **Fix custom pizza validation errors** (1 hour)
7. **Add database indexes** (30 minutes)
8. **Implement CSRF protection** (1 hour)
9. **Validate pre-order dates** (1 hour)
10. **Add input sanitization** (1 hour)

**Total Time: ~12 hours** = One solid day of work

---

## 🔐 SECURITY CHECKLIST

### Before Launch - MUST HAVE
- [ ] Rate limiting on all endpoints (3, 5, 10 requests per minute depending on endpoint)
- [ ] CSRF tokens on all POST/PATCH/DELETE endpoints
- [ ] Input sanitization on all user inputs
- [ ] Phone number validation
- [ ] Email validation
- [ ] Address minimum length validation
- [ ] HTTPS enforced (secure cookies)
- [ ] SQL/NoSQL injection prevented
- [ ] XSS prevention
- [ ] Authentication required on admin endpoints

### Tests to Add
```javascript
// Rate limiting
GET /api/orders 10x should return 503 on 4th request

// CSRF
POST /api/orders without token should return 403

// Input sanitization  
POST /api/orders with HTML in notes should be escaped

// Phone validation
POST /api/orders with "abc" as phone should return 400
```

---

## 📝 VALIDATION QUICK REFERENCE

### Common Validation Patterns

**Phone (Egyptian)**
```javascript
/^(\+20|0)?(10|11|12|15)\d{8}$/
Test: "01012345678" ✓, "20123456789" ✓, "abc" ✗
```

**Email**
```javascript
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
Test: "user@example.com" ✓, "user@" ✗
```

**Date (Future, Business Hours)**
```javascript
function isValidOrderDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  
  // Must be future
  if (date <= now) return false;
  
  // Must be within 7 days
  if (date > new Date(now.getTime() + 7*24*60*60*1000)) return false;
  
  // Must be during business hours (1pm-11pm)
  const hour = date.getHours();
  if (hour < 13 || hour >= 23) return false;
  
  return true;
}
```

**Qty (1-20)**
```javascript
Math.max(1, Math.min(20, parseInt(qty)))
```

**Coupon Discount (max 90%)**
```javascript
const maxDiscount = Math.min(
  subtotal * 0.9,
  coupon.discountType === "percent"
    ? (subtotal * coupon.discountValue) / 100
    : coupon.discountValue
);
```

---

## 📊 API RESPONSE FORMAT STANDARD

### Success Response (200/201)
```javascript
{
  message: "Order placed successfully",
  data: { /* actual data */ }
}
```

### Validation Error (400)
```javascript
{
  message: "Validation failed",
  errors: [
    { field: "phone", message: "Invalid format" },
    { field: "address", message: "Too short" }
  ]
}
```

### Authentication Error (401)
```javascript
{
  message: "Authentication required"
}
```

### Permission Error (403)
```javascript
{
  message: "Access denied"
}
```

### Not Found (404)
```javascript
{
  message: "Order not found"
}
```

### Rate Limited (429)
```javascript
{
  message: "Too many requests, please try again later",
  retryAfter: 60
}
```

### Server Error (500)
```javascript
{
  message: "Something went wrong",
  errorId: "uuid-for-logging"  // For customer support
}
```

---

## 🎯 ENDPOINT QUICK REFERENCE

### Public API (No Auth Required)

| Method | Endpoint | Returns | Notes |
|--------|----------|---------|-------|
| GET | `/api/health` | `{ ok: true }` | Always 200 |
| GET | `/api/settings/public` | Settings object | Cacheable |
| GET | `/api/menu` | `{ products: [...] }` | Add pagination? |
| GET | `/api/offers` | `{ offers: [...] }` | Weekly items |
| GET | `/api/coupons/validate/:code?orderTotal=500` | `{ valid: true/false }` | Rate limit this! |
| POST | `/api/orders` | `{ order: {...}, trackingCode: "ABC123" }` | Requires body |
| GET | `/api/orders/track/:code` | `{ order: {...} }` | Public tracking |

### Authenticated API (Requires Auth)

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get session token |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/profile` | Update user |
| GET | `/api/orders/my` | User's orders |
| GET | `/api/orders/last` | Last order (for reorder) |

### Admin API (Requires Admin Role)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/orders` | View all orders |
| PATCH | `/api/admin/orders/:id/status` | Update status |
| GET | `/api/admin/products` | Inventory |
| POST | `/api/admin/products` | Add product |
| PUT | `/api/admin/products/:id` | Edit product |
| DELETE | `/api/admin/products/:id` | Remove product |
| GET | `/api/admin/stats` | Dashboard data |
| GET | `/api/admin/reports/daily` | Daily metrics |

---

## 🐛 COMMON BUGS & FIXES

### Bug: Order placed twice when clicking submit button multiple times
**Fix:** Disable submit button after first click
```javascript
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  
  try {
    await request("/api/orders", { method: "POST", body: ... });
  } finally {
    submitBtn.disabled = false;
  }
});
```

### Bug: Coupon validation says "invalid" without reason
**Fix:** Return detailed error messages
```javascript
// Before
if (!coupon.canUse(subtotal)) {
  throw new Error("Coupon is not valid for this order");
}

// After
const result = coupon.validate(subtotal);
if (!result.valid) {
  throw new Error(result.reason); // "Minimum order 500 EGP" etc
}
```

### Bug: Admin account locked out after 5 login failures
**Fix:** Implement account lockout with reset
```javascript
user.loginAttempts = (user.loginAttempts || 0) + 1;
if (user.loginAttempts >= 5) {
  user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await user.save();
  return res.status(429).json({
    message: "Too many failed attempts. Try again in 15 minutes"
  });
}
```

### Bug: Delivery zone check too strict
**Fix:** Case-insensitive fuzzy matching
```javascript
const normalizeZone = (z) => String(z || "").trim().toLowerCase();

const isValidZone = (userZone) => {
  const normalized = normalizeZone(userZone);
  return zones.some(z => normalizeZone(z) === normalized);
};
```

### Bug: Images display huge/slow to load
**Fix:** Lazy load and optimize
```html
<img 
  src="/path/to/image" 
  alt="product"
  loading="lazy"
  decoding="async"
  width="400"
  height="300"
  srcset="/image_small.webp 200w, /image_large.webp 400w"
/>
```

---

## 🚀 PERFORMANCE TIPS

### Database
```javascript
// GOOD: Returns plain objects (fast)
Product.find().lean()

// AVOID: Returns Mongoose documents (slow)
Product.find()

// GOOD: Populate relations
Order.find().populate('customer.userId', 'name email')

// GOOD: Add indexes for queried fields
db.orders.createIndex({ createdAt: -1 })
db.orders.createIndex({ trackingCode: 1 })
```

### API Responses
```javascript
// GOOD: Only return needed fields
res.json({ 
  products: products.map(p => ({
    id: p._id,
    name: p.name,
    price: p.price
  }))
});

// AVOID: Return entire Mongoose documents
res.json({ products });

// GOOD: Paginate large lists
res.json({ 
  products: items.slice(0, 20),
  total: 150,
  page: 1,
  pageSize: 20
});
```

### Frontend
```javascript
// GOOD: Cache API responses
const cache = new Map();

async function getMenu() {
  if (cache.has('menu')) return cache.get('menu');
  const data = await fetch('/api/menu');
  cache.set('menu', data);
  return data;
}

// GOOD: Debounce search
const searchDebounced = debounce((query) => {
  fetchSearchResults(query);
}, 300);

// AVOID: Re-render entire DOM on change
// GOOD: Update only changed elements
element.textContent = newValue;
```

---

## 📱 MOBILE TESTING CHECKLIST

- [ ] Hamburger menu works on <768px
- [ ] Form inputs are large enough to tap (44x44px minimum)
- [ ] No horizontal scroll
- [ ] Images scale properly
- [ ] Buttons are easy to click (not too close together)
- [ ] Text is readable (16px minimum)
- [ ] Loading states shown clearly
- [ ] Try on iPhone + Android

---

## 🔍 DEBUGGING QUICK COMMANDS

### Node.js Server
```bash
# Run with debug logging
DEBUG=* npm start

# Watch file changes
npm run dev

# Check if port is free
lsof -i :4000

# Kill process on port
kill -9 $(lsof -t -i:4000)
```

### MongoDB
```bash
# Connect to MongoDB
mongosh

# Show all databases
show dbs

# Use database
use italian_home_kitchen

# Show all collections
show collections

# Count documents
db.orders.countDocuments()

# Find recent orders
db.orders.find().sort({ createdAt: -1 }).limit(10)

# Find by tracking code
db.orders.findOne({ trackingCode: "ABC123" })

# Check indexes
db.orders.getIndexes()

# Create index
db.orders.createIndex({ createdAt: -1 })
```

### Frontend
```javascript
// Check cart state
console.log(state.cart)

// Check auth user
console.log(state.authUser)

// Check settings
console.log(state.settings)

// Test API
fetch('/api/menu').then(r => r.json()).then(console.log)

// Clear localStorage
localStorage.clear()

// Clear all cookies
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
})
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Code
- [ ] No console.log() in production code
- [ ] No hardcoded passwords or API keys
- [ ] All environment variables in .env file
- [ ] Error handling on all API endpoints
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Rate limiting enabled

### Database
- [ ] MongoDB user/password strong
- [ ] MongoDB backups configured
- [ ] Indexes created
- [ ] Connection string secure (encrypted)

### Security
- [ ] JWT secret is random and long
- [ ] Password hashing with bcrypt
- [ ] CSRF tokens on forms
- [ ] Input validation everywhere
- [ ] XSS protection enabled
- [ ] No sensitive data in logs

### Monitoring
- [ ] Error tracking (Sentry) configured
- [ ] Logging service (LogRocket) configured
- [ ] Uptime monitoring setup
- [ ] Performance monitoring setup
- [ ] Alerts for errors/downtime

### Documentation
- [ ] README updated with deployment steps
- [ ] API documentation written
- [ ] Environment variables documented
- [ ] Common issues documented

---

## 📞 SUPPORT CONTACTS

| Issue | Who | Action |
|-------|-----|--------|
| Server down | DevOps | Check logs: `journalctl -u pizza-app` |
| Database slow | DBA | Check indexes and query plans |
| Payment failing | Payment provider | Check webhook logs |
| Email not sending | Backend dev | Check Nodemailer config |
| Website errors | Frontend dev | Check browser console |
| Customer complaint | Product manager | Review order in admin dashboard |

---

## 📚 DOCUMENTATION LINKS

- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Optimization](https://docs.mongodb.com/manual/administration/optimization/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mongoose Schema Guide](https://mongoosejs.com/docs/guide.html)

---

## 🎓 CODE STANDARDS

### Naming Conventions
```javascript
// Variables and functions: camelCase
const getUserEmail = () => {}
let totalPrice = 0

// Constants: UPPER_SNAKE_CASE
const MAX_QUANTITY = 20
const DEFAULT_TIMEOUT = 5000

// Classes and Constructors: PascalCase
class OrderService {}
```

### Error Handling
```javascript
// Always catch errors
try {
  await operation();
} catch (error) {
  console.error("Operation failed:", error);
  return res.status(500).json({ message: "Operation failed" });
}

// Use meaningful error messages
if (!user) {
  // BAD: return res.status(400).json({ message: "Error" })
  // GOOD:
  return res.status(404).json({ message: "User not found" });
}
```

### Comments
```javascript
// Use comments for WHY, not WHAT
// BAD: const x = y * 2; // multiply y by 2
// GOOD:
const doubleDiscount = baseDiscount * 2; // EU customers get double discount

// Document complex logic
/**
 * Validates Egyptian phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
  return /^(\+20|0)?(10|11|12|15)\d{8}$/.test(phone);
}
```

---

## 🏁 READY? START HERE

1. **Read** [CODEBASE_ANALYSIS.md](CODEBASE_ANALYSIS.md) - Understand what's wrong
2. **Understand** [FIXES_AND_CODE_EXAMPLES.md](FIXES_AND_CODE_EXAMPLES.md) - See how to fix it  
3. **Plan** [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) - Know what to do first
4. **Build** Using this Quick Reference - Execute with confidence
5. **Test** Using checklists above - Verify each fix works
6. **Deploy** Following pre-deployment checklist - Go live safely

Good luck! 🍕

