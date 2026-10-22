const {now:databaseNow}=require('../db/dialect');
const crypto = require("node:crypto");
const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db");
const upsert = require('../db/upsert');
const { COOKIE, signInToken, sessionCookieOptions } = require("../middleware/session");
const { classifyGoogleError } = require('./errors');

const router = express.Router();
const stateCookie = "bella_oauth_state";
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);

if (configured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = String(profile.emails?.[0]?.value || "").trim().toLowerCase();
      if (!email || profile._json?.email_verified === false) return done(null, false);
      const values = {
        google_id: profile.id,
        email,
        name: String(profile.displayName || email).slice(0, 160),
        updated_at: databaseNow(db),
      };
      const user = await upsert(db, 'users', { email }, values, { google_id: profile.id, name: values.name, updated_at: databaseNow(db) });
      if (!user.is_active) return done(null, false);
      const assignedRole = await db('user_roles').where({ user_id: user.id }).first();
      if (!assignedRole) await upsert(db, 'user_roles', { user_id: user.id, role: 'customer' }, { user_id: user.id, role: 'customer' });
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));
}

router.get("/auth/google", (req, res, next) => {
  if (!configured) return res.status(503).send("Google sign-in is not configured.");
  const state = crypto.randomBytes(32).toString("base64url");
  res.cookie(stateCookie, state, { ...cookieBase, maxAge: 5 * 60 * 1000 });
  return passport.authenticate("google", { scope: ["profile", "email"], state, session: false })(req, res, next);
});

router.get("/auth/google/callback", (req, res, next) => {
  if (!configured) return res.status(503).send('Google sign-in is not configured.');
  const expected = req.cookies?.[stateCookie] || "";
  const actual = String(req.query.state || "");
  res.clearCookie(stateCookie, cookieBase);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (!expected || expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return res.status(400).send("Invalid sign-in state. Please try again.");
  }

  return passport.authenticate("google", { session: false }, (error, user) => {
    if (error) {
      const failure = classifyGoogleError(error);
      // Never log provider bodies, request URLs, authorization codes or credentials.
      console.error('[google-auth]', failure.reason, failure.detail);
      return res.redirect(302, '/login?error=' + failure.reason);
    }
    if (!user) return res.redirect(302, "/login?error=google");
    try {
      res.cookie(COOKIE, signInToken(user), sessionCookieOptions());
      const nextPath = String(req.query.next || "/");
      return res.redirect(302, nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
    } catch (tokenError) {
      return next(tokenError);
    }
  })(req, res, next);
});

router.get("/api/me", (req, res) => {
  const user = req.currentUser;
  if (!user) return res.json({ user: null });
  return res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, roles: user.roles } });
});

router.post(["/api/auth/logout", "/auth/logout"], (req, res) => {
  res.clearCookie(COOKIE, sessionCookieOptions());
  return res.json({ ok: true });
});

module.exports = router;
