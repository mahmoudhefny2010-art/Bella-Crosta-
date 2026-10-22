// Key-range locks make check/insert atomic on SQL Server without MERGE.
module.exports = async function upsert(db, table, match, insert, update = {}) {
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
