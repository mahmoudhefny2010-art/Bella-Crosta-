# Italian Pizza Website - Implementation Roadmap & Metrics

## PHASE 1: CRITICAL SECURITY & FUNCTIONALITY (Week 1-2)

### Sprint 1.1: Security Foundation (Days 1-3)

**Objective:** Fix OWASP top vulnerabilities

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Install & configure rate limiting (express-rate-limit) | 2h | 🔴 Critical | Dev |
| Implement CSRF protection (csurf) | 2h | 🔴 Critical | Dev |
| Add input sanitization (xss, isomorphic-dompurify) | 3h | 🔴 Critical | Dev |
| Validate all user inputs (phone, email, address) | 4h | 🔴 Critical | Dev |
| Add request validation schema (joi) | 3h | 🟡 High | Dev |
| **Total**: | **14h** | | |

**Deliverables:**
- rate-limit middleware on all pub endpoints
- CSRF tokens generated and validated on POST/PATCH/DELETE
- Phone validation for Egyptian format
- Schema validation on orders, users, products

**Testing:**
```bash
# Rate limit test
for i in {1..10}; do curl http://localhost:4000/api/orders; done
# Should block after 3 requests

# CSRF test
curl -X POST http://localhost:4000/api/orders -d '{}' 
# Should return 403 CSRF validation failed

# Input validation test
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}'
# Should return 400 with validation error
```

---

### Sprint 1.2: Guest Checkout & Payment Foundation (Days 4-5)

**Objective:** Enable non-authenticated orders, prepare payment gateway

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Modify checkout form to support guest mode | 3h | 🔴 Critical | Frontend |
| Add client-side form validation | 3h | 🔴 Critical | Frontend |
| Make user profile sync optional | 1h | 🔴 Critical | Backend |
| Integrate Paymob/Stripe test mode | 4h | 🔴 Critical | Backend |
| Create payment processing endpoint | 3h | 🔴 Critical | Backend |
| **Total**: | **14h** | | |

**Deliverables:**
- [ ] Guest can place order without account
- [ ] Form shows validation errors before submission
- [ ] Payment gateway test keys configured
- [ ] Webhook handling for payment confirmation

**Acceptance Criteria:**
```
Scenario: Guest Checkout
Given: User with cart, not logged in
When: Clicks "Order as Guest"
Then: Form shows optional login prompt
And: Can submit with phone, name, address
And: Receives tracking code

Scenario: Form Validation
Given: Checkout form with invalid data
When: Submits form
Then: See specific error for each field
And: Cannot submit until all valid
```

---

### Sprint 1.3: Email Notifications (Days 6-7)

**Objective:** Implement transactional emails

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Configure Nodemailer (already installed) | 1h | 🔴 Critical | Backend |
| Create email templates (order, status, receipt) | 3h | 🔴 Critical | Backend |
| Send order confirmation email | 2h | 🔴 Critical | Backend |
| Send status update emails | 2h | 🔴 Critical | Backend |
| Setup test email service (e.g. Mailtrap) | 1h | 🔴 Critical | DevOps |
| Queue email sending (BullMQ) | 3h | 🟡 High | Backend |
| **Total**: | **12h** | | |

**Deliverables:**
- [ ] Order confirmation email sent within 1 minute of order
- [ ] Status update email sent when order status changes
- [ ] Receipt email sent when order delivered
- [ ] Emails work in test environment

**Email Templates:**
```
1. Order Confirmation
   - Order number, items, total, delivery time
   - Tracking code

2. Order Status Update
   - New status (received, preparing, in-oven, etc.)
   - Estimated time to next step
   - Tracking link

3. Delivery Receipt
   - Final amount paid
   - Rating/review prompt
   - Reorder link

4. Password Reset (for admin/staff)
   - Reset link with token
```

**Example Code:**
```javascript
// services/emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const emailTemplates = {
  orderConfirmation: (order) => ({
    subject: `Order Confirmation - Code ${order.trackingCode}`,
    html: `
      <h1>Order Confirmed!</h1>
      <p>Your order has been received.</p>
      <p><strong>Tracking Code:</strong> ${order.trackingCode}</p>
      <p><strong>Total:</strong> ${order.pricing.total} EGP</p>
      <p>Track your order: <a href="#">link</a></p>
    `,
  }),
  statusUpdate: (order, newStatus) => ({
    subject: `Order Update - ${newStatus}`,
    html: `<p>Your order is now ${newStatus}</p>`,
  }),
};

module.exports = { transporter, emailTemplates };
```

---

## PHASE 2: DATA QUALITY & FEATURES (Week 3-4)

### Sprint 2.1: Validation Overhaul (Days 8-9)

**Objective:** Catch all data quality issues before DB

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Implement comprehensive phone validation | 2h | 🟡 High | Backend |
| Implement date/time validation | 2h | 🟡 High | Backend |
| Validate custom pizza compositions | 2h | 🟡 High | Backend |
| Validate coupon constraints | 2h | 🟡 High | Backend |
| Add field-level error messages in API | 2h | 🟡 High | Backend |
| Create validation test suite | 4h | 🟡 High | QA |
| **Total**: | **14h** | | |

**Test Cases:**
```javascript
describe("Validation", () => {
  describe("Phone", () => {
    test("accepts valid Egyptian mobile", () => {
      expect(validatePhone("01012345678")).toBe(true);
      expect(validatePhone("+201012345678")).toBe(true);
    });
    test("rejects invalid", () => {
      expect(validatePhone("9876543210")).toBe(false);
      expect(validatePhone("abc")).toBe(false);
    });
  });

  describe("ScheduleDate", () => {
    test("rejects past dates", () => {
      const yesterday = new Date(Date.now() - 1000 * 60 * 60);
      expect(validateScheduleDate(yesterday)).rejects;
    });
    test("rejects non-business hours", () => {
      // 3am is outside 1pm-11pm
      const msg = "Please schedule between 1:00 PM and 11:00 PM";
      expect(validateScheduleDate(3amDate).error).toContain(msg);
    });
    test("rejects >7 days in future", () => {
      const future = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      expect(validateScheduleDate(future)).rejects;
    });
  });

  describe("Coupon", () => {
    test("discount cannot exceed 90% of order", () => {
      const coupon = { discountValue: 95, discountType: "percent" };
      expect(validateCoupon(coupon, 100)).rejects;
    });
  });
});
```

---

### Sprint 2.2: Performance Optimization (Days 10-11)

**Objective:** Reduce load times, improve database efficiency

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Add MongoDB indexes | 1h | 🔴 Critical | DevOps |
| Use .lean() on read queries | 2h | 🟡 High | Backend |
| Implement response field filtering | 2h | 🟡 High | Backend |
| Add pagination to list endpoints | 3h | 🟡 High | Backend |
| Gzip compress responses | 1h | 🟡 High | Backend |
| Cache public settings (Redis) | 3h | 🟡 High | Backend |
| Lazy load frontend images | 2h | 🟡 High | Frontend |
| **Total**: | **14h** | | |

**Database Indexes:**
```javascript
// src/models/Order.js
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.phone": 1 });
orderSchema.index({ trackingCode: 1 });

// src/models/Product.js
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ isWeeklyOffer: 1 });

// Create indexes in MongoDB:
// db.orders.createIndex({ createdAt: -1 })
// etc.
```

**Expected Performance Improvements:**
```
Metric                  Current    After     Improvement
Menu Load (DB Query)     500ms      150ms     70% faster
Order Placement         800ms      300ms     62% faster
Page Load Size          1.2MB      350KB     71% smaller (gzipped)
First ContentfulPaint   3.2s       1.1s      65% faster
```

---

### Sprint 2.3: Missing Core Features (Days 12-14)

**Objective:** Add essential missing features

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Order history view for customer | 3h | 🟡 High | Full Stack |
| One-click reorder from history | 2h | 🟡 High | Full Stack |
| Order cancellation (if <30min old) | 2h | 🟡 High | Backend |
| User profile management page | 4h | 🟡 High | Full Stack |
| Search/filter menu by name | 3h | 🟡 High | Full Stack |
| Order status real-time updates (polling) | 3h | 🟡 High | Full Stack |
| **Total**: | **17h** | | |

**Deliverables:**
- [ ] Customer can view all past orders
- [ ] Customer can reorder with 1 click
- [ ] Customer can update delivery address/phone in profile
- [ ] Menu search finds items by name/ingredient
- [ ] Order tracking page shows real-time updates (every 5sec poll)

---

## PHASE 3: ADMIN & OPERATIONS (Week 5-6)

### Sprint 3.1: Kitchen Display System (Days 15-16)

**Objective:** Dedicated kitchen interface for order prep

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Create KDS UI (dedicated page for kitchen) | 5h | 🟡 High | Frontend |
| Real-time order queue (WebSockets) | 4h | 🟡 High | Backend |
| Mark order status (start prep, in-oven, ready) | 2h | 🟡 High | Backend |
| Sound/notification for new orders | 2h | 🟡 High | Frontend |
| ETA predictions per item | 3h | 🟡 High | Backend |
| Print order tickets | 2h | 🟡 High | Backend |
| **Total**: | **18h** | | |

**KDS Features:**
```
Screen Layout:
┌─────────────────────────────────────┐
│ KITCHEN DISPLAY SYSTEM              │
├─────────────────────────────────────┤
│ READY (3)    PREP (5)    IN-OVEN(2) │
├─────────────────────────────────────┤
│                                     │
│ ┌────────────────────────────────┐  │
│ │ Order #PZ-123456 (15 min in)   │  │
│ │ • 2x Margherita                │  │
│ │ • 1x Custom (no onion)         │  │
│ │ [Start] [Timer] [Done]         │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌────────────────────────────────┐  │
│ │ Order #PZ-123457 (Just arrived)│  │
│ │ • 1x Pepperoni                 │  │
│ │ [Start] [Timer] [Done]         │  │
│ └────────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

### Sprint 3.2: Delivery Management & Reporting (Days 17-18)

**Objective:** Optimize delivery routes, gain business insights

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Delivery assignment interface | 4h | 🟡 High | Full Stack |
| Delivery route optimization | 6h | 🟡 High | Backend |
| Sales reports (daily/weekly/monthly) | 5h | 🟡 High | Backend |
| Customer lifetime value metrics | 3h | 🟡 High | Backend |
| Revenue analytics dashboard | 4h | 🟡 High | Frontend |
| Ingredient cost tracking | 3h | 🟡 High | Backend |
| **Total**: | **25h** | | |

**Reports & Dashboards:**
1. Daily Revenue Report
   - Total orders, revenue, average order value
   - Top items, top customers
   - Delivery vs pickup split

2. Customer Analytics
   - New customers, repeat customers, churn rate
   - Lifetime value, average order frequency
   - Delivery zone performance

3. Operational KPIs
   - Average prep time, delivery time, SLA compliance
   - Order cancellation rate
   - Peak hours, slowest performers

---

## PHASE 4: SCALING & OPTIMIZATION (Week 7-8)

### Sprint 4.1: Advanced Features (Days 19-21)

**Objective:** Loyalty, ratings, and advanced functionality

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Customer loyalty points system | 6h | 🟢 Medium | Full Stack |
| Customer ratings & reviews | 4h | 🟢 Medium | Full Stack |
| Inventory management & stock warnings | 5h | 🟢 Medium | Backend |
| Seasonal menu management | 3h | 🟢 Medium | Backend |
| Multi-language admin dashboard | 2h | 🟢 Medium | Frontend |
| **Total**: | **20h** | | |

---

### Sprint 4.2: Scale & Stability (Days 22-23)

**Objective:** Prepare for production traffic

| Task | Effort | Impact | Owner |
|------|--------|--------|-------|
| Load testing with k6 | 3h | 🟡 High | DevOps |
| Database optimization for scale | 4h | 🟡 High | DevOps |
| Redis caching strategy | 4h | 🟡 High | Backend |
| Error tracking setup (Sentry) | 2h | 🟡 High | DevOps |
| Backup & disaster recovery plan | 3h | 🟡 High | DevOps |
| **Total**: | **16h** | | |

**Load Testing:**
```bash
# Test concurrent orders
k6 run --vus 50 --duration 5m load-test.js

# Expected: Handle 50 concurrent users, <500ms response time
```

---

## SUCCESS METRICS & KPIs

### Phase 1 Completion Metrics
```
Security:
✓ 0 OWASP Top 10 vulnerabilities remaining
✓ All endpoints have rate limiting
✓ Input validation on 100% of endpoints
✓ CSRF protection enabled

Functionality:
✓ Guest checkout functional
✓ 95% of form submissions succeed on first try
✓ Email notifications sent successfully
✓ Payment processing tested & working

Quality:
✓ 0 critical bugs
✓ <100ms average response time
✓ 99.5% uptime in staging
```

### Phase 2 Metrics
```
Data Quality:
✓ 0 invalid phone numbers in DB
✓ 0 past-dated orders in DB
✓ 100% coupon applications valid

Performance:
✓ Page load <1.5s (75th percentile)
✓ Database queries <100ms average
✓ Menu endpoint <150ms response time

Features:
✓ Search finds 100% of matching items
✓ Order history loads <500ms
✓ Real-time updates within 5s
```

### Phase 3 Metrics
```
Operations:
✓ KDS improves order clarity by 90%
✓ Delivery time reduced by 15%
✓ Order accuracy improved to 99%
✓ Average prep time tracked & optimized

Business:
✓ Revenue reports automated
✓ Customer LTV calculated & tracked
✓ Repeat customer rate visible
✓ Peak hours identified & staffed
```

---

## DEPLOYMENT PLAN

### Pre-Production Checklist
- [ ] All security issues fixed
- [ ] Database backed up
- [ ] SSL certificate obtained
- [ ] HTTPS enforced
- [ ] Environment variables configured
- [ ] Email provider configured
- [ ] Payment gateway live keys obtained
- [ ] CDN configured (if using)
- [ ] Error tracking initialized
- [ ] Monitoring & alerting setup

### Deployment Steps
```bash
# 1. Backup current database
mongodump --uri mongodb://... --out ./backup

# 2. Run migrations (if any)
npm run migrate

# 3. Deploy code
git pull origin production
npm install
npm run build (if applicable)

# 4. Restart application
pmpm restart app

# 5. Verify health
curl https://pizzeria.com/api/health

# 6. Smoke tests
npm run test:smoke

# 7. Monitor logs
tail -f /var/log/app.log
```

### Rollback Plan
```bash
# If critical issues arise, rollback:
git checkout previous-commit
npm install
pm2 restart app

# Restore database backup if needed
mongorestore --uri mongodb://... ./backup
```

---

## TESTING CHECKLIST

### Unit Tests to Add
```javascript
// tests/validation.test.js
✓ Phone validation for Egyptian mobile
✓ Phone validation for Egyptian landline
✓ Email validation
✓ Date validation (not past, within business hours, within 7 days)
✓ Coupon validation (active, not expired, usage limit, min order)
✓ Custom pizza validation
✓ Quantity bounds (1-20)
✓ Price calculations

// tests/api.test.js
✓ POST /orders creates order
✓ POST /orders rejects duplicate coupon
✓ POST /orders rejects invalid phone
✓ GET /api/menu returns products
✓ GET /api/orders/track/:code returns order
✓ PATCH /api/orders/:id/status updates status
✓ rate limit blocks excess requests
✓ CSRF validation works

// tests/integration.test.js
✓ Full checkout flow (guest)
✓ Full checkout flow (logged in)
✓ Order payment flow
✓ Email notification flow
✓ Status update flow
✓ Reorder flow
```

---

## STAFFING & TIMELINE

### Team Composition
- **Backend Developer**: 1 (Node.js/Express/MongoDB)
- **Frontend Developer**: 1 (EJS/JavaScript/CSS)
- **DevOps/QA**: 1 (Database, deployment, testing)
- **Product Manager**: 1 (Oversight, prioritization)

### Timeline Estimate
```
Week 1-2: Security & Guest Checkout (28 hrs)
Week 3-4: Data Quality & Performance (28 hrs)
Week 5-6: Admin & Delivery (43 hrs)
Week 7-8: Advanced Features & Scale (36 hrs)
─────────────────────────────────
Total: ~8 weeks (135 hours of development)

With team of 2-3 devs: 4-6 weeks to production ready
```

---

## BUDGET ESTIMATE

| Item | Cost | Priority |
|------|------|----------|
| Paymob/Stripe integration | Included | Critical |
| Mailtrap (email testing) | $39/mo | High |
| SendGrid (production emails) | $19/mo | High |
| Redis (caching) | $30/mo | High |
| MongoDB Atlas (production) | $57/mo | Critical |
| Error tracking (Sentry) | $29/mo | High |
| CDN (if needed) | $10-50/mo | Medium |
| **Monthly SaaS Total** | ~$185-225 | |

---

## FINAL RECOMMENDATIONS

1. **Start with Phase 1.1** (Security) - cannot launch without this
2. **Parallel Phase 1.2-1.3** (Guest checkout + Email) together
3. **Skip Phase 2-3 initially** - get Phase 1 working first
4. **Plan Phase 3 for 2 months** after launch (KDS is nice-to-have initially)
5. **Hire a QA engineer** for Phase 2+
6. **Set up monitoring immediately** (Sentry, DataDog, etc.)
7. **Plan weekly releases** once stabilized

