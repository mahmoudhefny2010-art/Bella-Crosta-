// Key-range locks make check/insert atomic on SQL Server without MERGE.
module.exports = async function upsert(db, table, match, insert, update = {}) {
  if(db.client.config.client==='pg') {
    const query=db(table).insert({...insert,...match}).onConflict(Object.keys(match));
    const rows=Object.keys(update).length ? await query.merge(update).returning('*') : await query.ignore().returning('*');
    return rows[0] || db(table).where(match).first();
  }
  const work = async trx => {
    const row = await trx.select('*').from(trx.raw('?? WITH (UPDLOCK, HOLDLOCK)', [table])).where(match).first();
    if (row) {
      if (!Object.keys(update).length) return row;
      return (await trx(table).where(match).update(update).returning('*'))[0];
    }
    return (await trx(table).insert({ ...insert, ...match }).returning('*'))[0];
  };
  return db.isTransaction ? work(db) : db.transaction(work);
};
