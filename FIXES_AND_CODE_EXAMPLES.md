# Italian Pizza Website - Critical Issues & Actionable Fixes

## SECURITY VULNERABILITIES - WITH CODE EXAMPLES

### Issue 1: Weak Admin Authentication
**Severity:** 🔴 CRITICAL  
**File:** [src/middleware/auth.js](src/middleware/auth.js)

**Current Implementation:**
```javascript
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}
```

**Problem:**
- Admin identified only by role in JWT
- No separate admin authentication layer
- Old code used simple header check: `x-admin-key`
- No rate limiting on login attempts
- Session lives 7 days; if token stolen, full access for week

**Fix:**
```javascript
const rateLimit = require("express-rate-limit");

// Add to server.js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  // ... existing login logic
});

// Implement token rotation
function signSessionToken(user) {
  const payload = createTokenPayload(user);
  return jwt.sign(payload, getSessionSecret(), { 
    expiresIn: 3600, // 1 hour instead of 7 days
    issuer: 'pizza-app',
    audience: 'web'
  });
}

// Add token refresh endpoint
router.post("/auth/refresh", requireAuth, (req, res) => {
  const newToken = signSessionToken(req.user);
  setSessionCookie(res, newToken);
  res.json({ message: "Token refreshed" });
});
```

---

### Issue 2: No Input Sanitization
**Severity:** 🔴 CRITICAL  
**File:** [src/routes/publicRoutes.js](src/routes/publicRoutes.js#L307)

**Current Implementation:**
```javascript
const order = await Order.create({
  customer: {
    name: String(customerName).trim(),
    phone: String(phone).trim(),
    address: String(address || "").trim(),
    notes: String(notes || "").trim(),
  },
  // ...
  specialTags: extractSpecialTags(notes),
});

function extractSpecialTags(notes = "") {
  const text = String(notes || "").toLowerCase();
  const tags = new Set();
  if (text.includes("allergy") || text.includes("allergic")) {
    tags.add("allergy");
  }
  // ... more hardcoded strings
}
```

**Problem:**
- User input stored directly without sanitization
- Could contain HTML/JS that executes if rendered in unsafe context
- Special tags extraction uses brittle string matching
- No protection against XSS

**Fix:**
```javascript
const xss = require("xss");
const DOMPurify = require("isomorphic-dompurify");

// Sanitize all user input
const sanitizedOrder = {
  customer: {
    name: xss(String(customerName).trim(), { whiteList: {} }),
    phone: String(phone).trim().replace(/[^\d+\-\s]/g, ""), // digits only
    address: xss(String(address).trim(), { whiteList: {} }),
    zone: String(zone).trim(),
    notes: xss(String(notes).trim(), { 
      whiteList: {},
      stripIgnoredTag: true 
    }),
  },
  // ...
};

// Better special tags extraction using regex
function extractSpecialTags(notes = "") {
  const text = String(notes || "").toLowerCase();
  const tags = new Set();
  
  const patterns = {
    allergy: /allerg(y|ic)/i,
    noOnion: /no\s?onion|without\s?onion/i,
    noGarlic: /no\s?garlic|without\s?garlic/i,
    noCheese: /no\s?cheese|without\s?cheese/i,
    extraSpicy: /extra\s?spicy|very\s?spicy/i,
  };
  
  Object.entries(patterns).forEach(([tag, pattern]) => {
    if (pattern.test(text)) {
      tags.add(tag);
    }
  });
  
  return Array.from(tags);
}
```

---

### Issue 3: No CSRF Protection
**Severity:** 🔴 CRITICAL  
**File:** [src/server.js](src/server.js)

**Current Implementation:**
```javascript
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
// No CSRF middleware
```

**Problem:**
- POST endpoints (checkout, order) have no CSRF token validation
- Attacker can trick user into ordering via hidden form
- No protection against cross-site request forgery

**Fix:**
```javascript
const csrf = require("csurf");

// Add CSRF protection
const csrfProtection = csrf({ cookie: false }); // Use sessions

// Only protect state-changing endpoints
router.post("/orders", csrfProtection, async (req, res, next) => {
  // Validate CSRF token from request body or header
  try {
    await csrfValidation(req); // Custom CSRF check
  } catch (error) {
    return res.status(403).json({ message: "Invalid request token" });
  }
  // ... rest of endpoint
});

// Provide CSRF token to frontend
router.get("/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

---

### Issue 4: No Rate Limiting
**Severity:** 🔴 CRITICAL  
**File:** All routes

**Current Implementation:**
```javascript
router.post("/orders", async (req, res, next) => {
  // Anyone can call infinitely
```

**Problem:**
- Can spam order endpoint 1000x/second
- DOS attack vector
- Coupon validation endpoint can be brute-forced
- Login endpoint can be password sprayed

**Fix:**
```javascript
const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 30, // max 30 requests
  message: "Too many requests, please try again later.",
  store: new RedisStore({
    client: redisClient,
    prefix: "rl:", // rate limit prefix
  }),
});

const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3, // max 3 orders per minute per IP
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Too many orders, please try again later.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // max 5 login attempts per 15 min
  message: "Too many login attempts",
  skipSuccessfulRequests: true,
});

app.use("/api/", generalLimiter);
router.post("/orders", orderLimiter, async (req, res, next) => { ... });
router.post("/login", authLimiter, async (req, res, next) => { ... });
router.get("/coupons/validate/:code", orderLimiter, async (req, res, next) => { ... });
```

---

## VALIDATION GAPS - WITH FIXES

### Issue 1: No Phone Number Validation
**Severity:** 🔴 CRITICAL  
**File:** [src/routes/publicRoutes.js](src/routes/publicRoutes.js#L307)

**Current:**
```javascript
phone: String(phone).trim(),
```

**Fix:**
```javascript
function validateEgyptianPhone(phone) {
  // Egypt phone format: +20 or 0, then 10 digits
  const patterns = [
    /^(\+20|0)?(10|11|12|15)\d{8}$/, // Egypt mobile
    /^(\+20|0)?(2|3|4|5|6|7|8|9)\d{7,8}$/, // Egypt landline
  ];
  
  const normalized = String(phone).trim().replace(/\s/g, "");
  return patterns.some(p => p.test(normalized));
}

if (!phone || !validateEgyptianPhone(phone)) {
  return res.status(400).json({
    message: "Please provide a valid Egyptian phone number",
  });
}
```

---

### Issue 2: Pre-order Date Not Validated
**Severity:** 🔴 CRITICAL  
**File:** [src/routes/publicRoutes.js](src/routes/publicRoutes.js#L430)

**Current:**
```javascript
const safeScheduleAt = scheduleAt ? new Date(scheduleAt) : null;
```

**Problem:**
- Accepts past dates
- Accepts 3am when shop open 1pm-11pm
- No timezone handling
- No maximum scheduling days

**Fix:**
```javascript
function validateScheduleTime(scheduleAtInput) {
  if (!scheduleAtInput) {
    return null; // No scheduling = ASAP
  }

  const requestedTime = new Date(scheduleAtInput);
  const now = new Date();

  // Must be in future
  if (requestedTime <= now) {
    throw new Error("Cannot schedule for past time");
  }

  // Maximum 7 days in advance
  const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (requestedTime > maxDate) {
    throw new Error("Cannot schedule more than 7 days in advance");
  }

  // Check if requested time is during business hours
  // Assuming 1pm-11pm daily (adjust as needed)
  const hour = requestedTime.getHours();
  const dayOfWeek = requestedTime.getDay();

  // If no specific closing days, skip day check
  const closedDays = []; // Empty unless you have specific closed days
  if (closedDays.includes(dayOfWeek)) {
    throw new Error("We are closed on that day");
  }

  if (hour < 13 || hour >= 23) {
    throw new Error("Please schedule between 1:00 PM and 11:00 PM");
  }

  return requestedTime;
}

try {
  const scheduleAt = validateScheduleTime(req.body.scheduleAt);
  // Use scheduleAt
} catch (error) {
  return res.status(400).json({ message: error.message });
}
```

---

### Issue 3: Custom Pizza Validation Silent Failures
**Severity:** 🟡 HIGH  
**File:** [src/routes/publicRoutes.js](src/routes/publicRoutes.js#L105-L150)

**Current:**
```javascript
incoming.forEach((item) => {
  if (!item) {
    return;
  }

  const size = String(item.size || "").trim().toLowerCase();
  const crust = String(item.crust || "").trim();
  const sauce = String(item.sauce || "").trim();
  const cheeseLevel = String(item.cheeseLevel || "").trim();

  if (!size || !crust || !sauce || !cheeseLevel) {
    return; // Silently skip invalid items!
  }
  // ...
});

// No error if all pizzas were invalid
if (parsedItems.length === 0 && parsedCustomPizzas.length === 0) {
  return res.status(400).json({
    message: "Order must contain at least one menu item or custom pizza.",
  });
}
```

**Problem:**
- User thinks they ordered custom pizza but it was silently dropped
- No error feedback
- Could result in incomplete orders

**Fix:**
```javascript
function validateCustomPizzas(rawCustomPizzas, buildPizzaConfig) {
  const errors = [];
  const customPizzas = [];

  const incoming = Array.isArray(rawCustomPizzas)
    ? rawCustomPizzas
    : rawCustomPizzas ? [rawCustomPizzas] : [];

  const validSizes = new Set((buildPizzaConfig.sizes || []).map(s => 
    String(s.value || "").toLowerCase()
  ));
  const validCrusts = new Set((buildPizzaConfig.crusts || []).map(c => 
    String(c.value || "").toLowerCase()
  ));
  // ... similar for sauces, cheeses, toppings

  incoming.forEach((item, index) => {
    if (!item) {
      errors.push(`Custom pizza #${index + 1}: Missing entire object`);
      return;
    }

    const size = String(item.size || "").trim().toLowerCase();
    if (!validSizes.has(size)) {
      errors.push(`Custom pizza #${index + 1}: Invalid size "${size}"`);
      return;
    }

    const crust = String(item.crust || "").trim();
    if (!crust) {
      errors.push(`Custom pizza #${index + 1}: Crust is required`);
      return;
    }

    // ... validate other fields

    customPizzas.push({
      size,
      crust,
      sauce,
      cheeseLevel,
      toppings,
      basePrice,
      toppingsPrice,
      totalPrice,
    });
  });

  if (errors.length > 0) {
    throw new Error(`Invalid custom pizzas: ${errors.join("; ")}`);
  }

  return customPizzas;
}

try {
  const parsedCustomPizzas = validateCustomPizzas(
    customPizzas,
    content.buildPizza || {}
  );
  // ... proceed
} catch (error) {
  return res.status(400).json({ message: error.message });
}
```

---

### Issue 4: Coupon Validation Not Comprehensive
**Severity:** 🟡 HIGH  
**File:** [src/routes/publicRoutes.js](src/routes/publicRoutes.js#L265-L290)

**Current:**
```javascript
router.get("/coupons/validate/:code", async (req, res, next) => {
  try {
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase() 
    });
    
    if (!coupon) {
      return res.status(400).json({ error: "Coupon does not exist." });
    }

    if (!coupon.canUse(subtotal)) {
      return res.status(400).json({ error: "Coupon is not valid for this order." });
    }

    return res.json({ coupon });
  } catch (error) {
    return next(error);
  }
});

// Coupon model
couponSchema.methods.canUse = function canUse(orderTotal) {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  if (typeof this.maxUses === "number" && this.usedCount >= this.maxUses) return false;
  if (orderTotal < this.minOrderTotal) return false;
  return true;
};
```

**Problem:**
- Doesn't validate if discount exceeds order total
- No maximum discount limit
- Doesn't prevent combining multiple coupons
- Generic error message doesn't tell user why it's invalid

**Fix:**
```javascript
couponSchema.methods.canUse = function canUse(orderTotal) {
  const errors = [];

  if (!this.isActive) {
    errors.push("This coupon has been deactivated");
  }

  if (this.expiresAt && this.expiresAt < new Date()) {
    errors.push(`This coupon expired on ${this.expiresAt.toLocaleDateString()}`);
  }

  if (typeof this.maxUses === "number" && this.usedCount >= this.maxUses) {
    errors.push("This coupon has reached its usage limit");
  }

  if (orderTotal < this.minOrderTotal) {
    errors.push(`Minimum order amount is ${this.minOrderTotal} EGP`);
  }

  // New: Validate discount amount
  const potentialDiscount = this.discountType === "percent"
    ? (orderTotal * this.discountValue) / 100
    : this.discountValue;

  if (potentialDiscount > orderTotal * 0.9) {
    errors.push("Coupon discount is too high");
  }

  return { isValid: errors.length === 0, errors };
};

router.get("/coupons/validate/:code", async (req, res, next) => {
  try {
    const { code } = req.params;
    const { orderTotal } = req.query;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    const subtotal = Number(orderTotal) || 0;
    if (subtotal <= 0) {
      return res.status(400).json({ message: "Order total must be greater than 0" });
    }

    const coupon = await Coupon.findOne({ 
      code: String(code).trim().toUpperCase() 
    });

    if (!coupon) {
      return res.status(404).json({ 
        message: "This coupon code does not exist",
        valid: false,
      });
    }

    const validation = coupon.canUse(subtotal);
    if (!validation.isValid) {
      return res.status(400).json({ 
        message: validation.errors[0], // First error
        valid: false,
        details: validation.errors,
      });
    }

    return res.json({ 
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        // Don't return usedCount or other internal details
      }
    });
  } catch (error) {
    return next(error);
  }
});
```

---

## UX IMPROVEMENTS

### Issue 1: Mandatory Login on Checkout
**Severity:** 🔴 CRITICAL  
**File:** [public/js/app.js](public/js/app.js#L1780-L1810)

**Current:**
```javascript
function setupCheckout() {
  const form = byId("checkoutForm");
  
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.authUser) {
      message.textContent = t("order.loginFirst", "Please login first so we can save your delivery details.");
      message.classList.add("is-error");
      return;
    }
    // ...
  });
}
```

**Fix: Allow Guest Checkout**
```javascript
function setupCheckout() {
  const form = byId("checkoutForm");
  const guestCheckboxOption = byId("guestCheckout"); // Add this to HTML

  // Show/hide fields based on guest mode
  if (guestCheckboxOption) {
    guestCheckboxOption.addEventListener("change", () => {
      const isGuest = guestCheckboxOption.checked;
      // Show different form fields for guest vs logged-in
      updateCheckoutForGuestMode(isGuest);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const isGuestMode = guestCheckboxOption?.checked || false;

    if (!isGuestMode && !state.authUser) {
      // User wants logged-in mode but not authenticated
      message.textContent = t("order.loginFirst", 
        "Please login first or check 'Order as guest'");
      message.classList.add("is-error");
      return;
    }

    removeUnavailableCartItems();

    if (state.cart.length === 0 && state.customPizzas.length === 0) {
      message.textContent = t("order.needItems", "Please add items to cart first.");
      message.classList.add("is-error");
      return;
    }

    const formData = new FormData(form);
    const payload = buildOrderPayload(formData);
    
    // For guest orders, still generate tracking code
    payload.source = isGuestMode ? "web-guest" : "web";

    try {
      message.textContent = t("order.submitting", "Submitting order...");

      // For logged-in users, sync profile
      if (!isGuestMode && state.authUser) {
        try {
          await request("/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({
              name: payload.customerName,
              phone: payload.phone,
              address: payload.address,
              zone: payload.zone,
            }),
          });
        } catch (profileError) {
          console.warn("Profile update skipped:", profileError.message);
        }
      }

      const response = await request("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const trackingCode = response.order?.trackingCode;
      message.textContent = trackingCode
        ? `${t("order.placed", "Order placed. Code:")} ${trackingCode}`
        : t("order.placedNoCode", "Order placed successfully.");
      
      // Show tracking code in modal or redirect to tracking page
      displayOrderConfirmation(response.order);

      resetCartAfterOrder();
      form.reset();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("is-error");
    }
  });
}
```

---

### Issue 2: No Form Validation Feedback
**Severity:** 🔴 CRITICAL  
**File:** [src/views/partials/site/sections/checkout.ejs](src/views/partials/site/sections/checkout.ejs)

**Fix: Add Client-Side Validation**
```html
<form id="checkoutForm">
  <div class="form-group">
    <label for="customerName">
      <%= t('checkout.name', 'Name') %>
      <span class="required">*</span>
    </label>
    <input
      id="customerName"
      type="text"
      name="customerName"
      required
      minlength="2"
      maxlength="100"
      placeholder="Your full name"
      data-validate="name"
      data-error="Name must be 2-100 characters"
    />
    <small class="error-message"></small>
  </div>

  <div class="form-group">
    <label for="phone">
      <%= t('checkout.phone', 'Phone') %>
      <span class="required">*</span>
    </label>
    <input
      id="phone"
      type="tel"
      name="phone"
      required
      placeholder="+20 123 456 7890"
      data-validate="phone"
      data-error="Please enter a valid Egyptian phone number"
      pattern="^(\+20|0)?(10|11|12|15)\d{8}$"
    />
    <small class="error-message"></small>
  </div>

  <!-- Rest of form... -->
</form>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .required {
    color: var(--tomato);
  }

  input:invalid {
    border-color: var(--tomato);
    background-color: rgba(201, 52, 47, 0.05);
  }

  input:valid {
    border-color: var(--basil);
  }

  .error-message {
    color: var(--tomato);
    font-size: 0.85em;
    display: none;
  }

  input:invalid:not(:placeholder-shown) ~ .error-message {
    display: block;
  }
</style>

<script>
  function setupFormValidation() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;

    const fields = form.querySelectorAll("[data-validate]");

    fields.forEach(field => {
      // Real-time validation
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("change", () => validateField(field));

      // Show errors on input
      field.addEventListener("invalid", (e) => {
        e.preventDefault();
        validateField(field);
      });
    });

    form.addEventListener("submit", (e) => {
      const isValid = Array.from(fields).every(field => 
        validateField(field)
      );

      if (!isValid) {
        e.preventDefault();
        alert("Please fix the errors in the form");
      }
    });
  }

  function validateField(field) {
    const type = field.dataset.validate;
    const value = field.value.trim();
    const errorEl = field.parentElement.querySelector(".error-message");
    if (!errorEl) return true;

    let isValid = true;
    let errorMsg = field.dataset.error || "Invalid input";

    if (field.required && !value) {
      isValid = false;
      errorMsg = `${field.previousElementSibling.textContent} is required`;
    } else if (value) {
      switch (type) {
        case "phone":
          isValid = /^(\+20|0)?(10|11|12|15)\d{8}$/.test(
            value.replace(/\s/g, "")
          );
          break;
        case "email":
          isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          break;
        case "name":
          isValid = value.length >= 2 && value.length <= 100;
          break;
        case "address":
          isValid = value.length >= 5;
          break;
      }
    }

    field.classList.toggle("is-invalid", !isValid);
    errorEl.textContent = isValid ? "" : errorMsg;
    errorEl.style.display = isValid ? "none" : "block";

    return isValid;
  }

  setupFormValidation();
</script>
```

---

## DATABASE PERFORMANCE FIXES

### Issue: Missing Indexes
**File:** [src/models/Order.js](src/models/Order.js)

**Fix:**
```javascript
// Add indexes for performance
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "customer.phone": 1 });
orderSchema.index({ "customer.userId": 1 });
orderSchema.index({ trackingCode: 1, unique: true });
orderSchema.index({ orderNumber: 1, unique: true });
orderSchema.index({ createdAt: -1, status: 1 }); // Compound index for daily report queries

// Same for other frequently queried fields
```

---

## ARCHITECTURE IMPROVEMENTS

### Create Validation Layer
**New File:** `src/validation/schemas.js`

```javascript
const joi = require("joi");

const schemas = {
  order: joi.object({
    customerName: joi.string().trim().required().min(2).max(100),
    phone: joi
      .string()
      .required()
      .pattern(/^(\+20|0)?(10|11|12|15)\d{8}$/)
      .messages({
        "string.pattern.base": "Invalid Egyptian phone number",
      }),
    address: joi.string().trim().min(5).max(500).when("fulfillmentType", {
      is: "delivery",
      then: joi.required(),
    }),
    zone: joi.string().trim().when("fulfillmentType", {
      is: "delivery",
      then: joi.required(),
    }),
    fulfillmentType: joi
      .string()
      .valid("delivery", "pickup")
      .default("delivery"),
    paymentMethod: joi
      .string()
      .valid("cash", "card-online", "wallet")
      .default("cash"),
    items: joi.array().items(
      joi.object({
        productId: joi.string().required(),
        quantity: joi.number().min(1).max(20).required(),
        sizeLabel: joi.string().trim(),
      })
    ),
    customPizzas: joi.array().items(
      joi.object({
        size: joi.string().required(),
        crust: joi.string().required(),
        sauce: joi.string().required(),
        cheeseLevel: joi.string().required(),
        toppings: joi.array().items(joi.string()),
      })
    ),
    couponCode: joi.string().trim().uppercase(),
    scheduleAt: joi.date().iso().greater("now").max("30 days"),
    notes: joi.string().trim().max(500),
  }),
};

module.exports = schemas;
```

**Usage in Route:**
```javascript
const schemas = require("../validation/schemas");

router.post("/orders", async (req, res, next) => {
  try {
    const { error, value } = schemas.order.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join("."),
        message: d.message,
      }));
      return res.status(400).json({ message: "Validation failed", details });
    }

    // Use validated data
    const order = await Order.create(value);
    // ...
  } catch (error) {
    next(error);
  }
});
```

---

## SUMMARY OF QUICK WINS (Do These First)

1. **Add Rate Limiting** (30 min)
   ```bash
   npm install express-rate-limit redis
   ```

2. **Add Input Sanitization** (1 hour)
   ```bash
   npm install xss isomorphic-dompurify
   ```

3. **Enable Client-Side Form Validation** (2 hours)
   - Add HTML5 validation attributes
   - Add error message display

4. **Allow Guest Checkout** (3 hours)
   - Add checkbox for guest mode
   - Make user profile sync optional

5. **Add Database Indexes** (30 min)
   - Performance improvement: 50-70% faster queries

6. **Implement Email Notifications** (4 hours)
   - Use Nodemailer (already installed)
   - Send order confirmations and status updates

---

## TESTING CHECKLIST

After fixes, test:
- [ ] Guest checkout works
- [ ] Form validation prevents submission of invalid data
- [ ] Rate limiting blocks excessive requests
- [ ] Custom pizza validation catches errors
- [ ] Coupon validation returns helpful error messages
- [ ] Phone number validation works for Egyptian format
- [ ] Pre-order date validation prevents past/non-business-hour orders
- [ ] Unauthorized users get 401, not 500 errors
- [ ] Database queries have proper indexes (check MongoDB logs)

