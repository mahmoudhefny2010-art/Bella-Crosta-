const jwt = require("jsonwebtoken");
const db = require("../db");
const { hasRole, loadUserRoles } = require('../services/roles');

const COOKIE = "bella_session";

function signInToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return jwt.sign({ sub: user.id }, secret, { expiresIn: "7d", issuer: "bella-crosta" });
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

async function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { issuer: "bella-crosta" });
    const user = await db("users").where({ id: claims.sub, is_active: true }).first();
    await loadUserRoles(db, user);
    req.currentUser = user || null;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      res.clearCookie(COOKIE, sessionCookieOptions());
      req.currentUser = null;
      return next();
    }
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) return res.status(401).json({ message: "Authentication required." });
  return next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) return res.status(401).json({ message: "Authentication required." });
    if (!roles.some(role => hasRole(req.currentUser, role))) return res.status(403).json({ message: "Access denied." });
    return next();
  };
}

module.exports = { COOKIE, signInToken, sessionCookieOptions, attachUser, requireAuth, requireRoles };
