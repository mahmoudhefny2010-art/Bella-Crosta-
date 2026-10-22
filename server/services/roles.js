const ROLE_VALUES = ['customer', 'admin', 'owner', 'kitchen', 'driver'];

function normalizeRoles(roles) {
  return [...new Set(roles)].filter(role => ROLE_VALUES.includes(role));
}

function primaryRole(roles) {
  const values = normalizeRoles(roles);
  return ['admin', 'owner', 'kitchen', 'driver', 'customer'].find(role => values.includes(role)) || 'customer';
}

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
  return roles.includes(role);
}

async function loadUserRoles(db, user) {
  if (!user) return user;
  const rows = await db('user_roles').where({ user_id: user.id }).select('role');
  user.roles = rows.length ? rows.map(row => row.role) : [user.role];
  return user;
}

async function replaceUserRoles(trx, userId, roles) {
  const values = normalizeRoles(roles);
  await trx('user_roles').where({ user_id: userId }).del();
  await trx('user_roles').insert(values.map(role => ({ user_id: userId, role })));
  return values;
}

module.exports = { ROLE_VALUES, normalizeRoles, primaryRole, hasRole, loadUserRoles, replaceUserRoles };
