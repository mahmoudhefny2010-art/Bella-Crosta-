function isPostgres(db) { return db.client.config.client === 'pg'; }
function now(db) { return isPostgres(db) ? db.fn.now() : db.raw('SYSUTCDATETIME()'); }
function cairoDay(db,column='orders.created_at') {
  return isPostgres(db) ? `to_char(?? AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD')` : `CONVERT(varchar(10), ?? AT TIME ZONE 'UTC' AT TIME ZONE 'Egypt Standard Time', 23)`;
}
function dateRange(query,db,column,from,to) {
  return isPostgres(db)
    ? query.whereRaw("?? >= (?::date::timestamp AT TIME ZONE 'Africa/Cairo') AND ?? < ((?::date + 1)::timestamp AT TIME ZONE 'Africa/Cairo')",[column,from,column,to])
    : query.whereRaw("?? >= CONVERT(datetime2, (CONVERT(datetime2, ?) AT TIME ZONE 'Egypt Standard Time') AT TIME ZONE 'UTC') AND ?? < CONVERT(datetime2, (DATEADD(day, 1, CONVERT(datetime2, ?)) AT TIME ZONE 'Egypt Standard Time') AT TIME ZONE 'UTC')",[column,from,column,to]);
}
async function requestLock(trx,key) {
  if(isPostgres(trx)) {
    await trx.raw("SET LOCAL lock_timeout = '5s'");
    await trx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))',[key]);
  } else await trx.raw("DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource = ?, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000; IF @result < 0 THROW 51000, 'Order retry is busy. Please retry shortly.', 1;",[key]);
}
module.exports={isPostgres,now,cairoDay,dateRange,requestLock};
