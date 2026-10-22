const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { COOKIE } = require('../middleware/session');
const { hasRole, loadUserRoles } = require('../services/roles');
function attach(server, origin) {
  const io = new Server(server, { cors: { origin, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const cookies = Object.fromEntries((socket.handshake.headers.cookie || '').split(';').filter(Boolean).map(v => { const i = v.indexOf('='); return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))]; }));
      const claims = jwt.verify(cookies[COOKIE], process.env.JWT_SECRET, { issuer: 'bella-crosta' });
      const user = await db('users').where({ id: claims.sub, is_active: true }).first();
      if (!user) throw new Error('Unauthorized');
      await loadUserRoles(db, user);
      socket.data.user = user;
      next();
    } catch { next(new Error('Authentication required.')); }
  });
  io.on('connection', socket => {
    const user = socket.data.user;
    socket.join('user:' + user.id);
    if (hasRole(user, 'kitchen') || hasRole(user, 'admin')) socket.join('kitchen');
    if (hasRole(user, 'admin')) socket.join('admin');
    if (hasRole(user, 'owner')) socket.join('owner');
    if (hasRole(user, 'driver')) { socket.join('driver:' + user.id); socket.join('delivery'); }
    socket.on('watch', async (id, ack = () => {}) => {
      if (!/^[0-9a-f-]{36}$/i.test(String(id))) return ack({ error: 'Invalid order.' });
      try {
        const order = await db('orders').where({ id }).first();
        if (!order || !(order.user_id === user.id || order.assigned_driver_id === user.id || hasRole(user, 'admin') || hasRole(user, 'owner') || hasRole(user, 'kitchen'))) return ack({ error: 'Access denied.' });
        socket.join('order:' + id);
        ack({ ok: true });
      } catch { ack({ error: 'Unable to watch order.' }); }
    });
  });
  return io;
}
module.exports = attach;
