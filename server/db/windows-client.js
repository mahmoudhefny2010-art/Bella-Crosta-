// Knex compiles SQL Server queries; native ODBC uses the current Windows identity.
const SqlServerClient = require('knex/lib/dialects/mssql');
const Transaction = require('knex/lib/execution/transaction');
const native = require('msnodesqlv8');
class WindowsTransaction extends Transaction {
  async begin(connection) { await connection.native.promises.beginTransaction(); connection.inTransaction = true; }
  async savepoint(connection) { await connection.native.promises.query(`SAVE TRANSACTION [${this.txid}]`); }
  async commit(connection, value) {
    try { await connection.native.promises.commit(); connection.inTransaction = false; this._completed = true; this._resolver(value); }
    catch (error) { this._rejecter(error); }
  }
  release(connection, value) { this._resolver(value); return Promise.resolve(); }
  async rollback(connection, error) {
    this._completed = true;
    try { await connection.native.promises.rollback(); } catch (rollbackError) { error ||= rollbackError; }
    connection.inTransaction = false;
    if (!error && this.doNotRejectOnRollback) this._resolver();
    else this._rejecter(error || new Error('Transaction rolled back.'));
  }
  async rollbackTo(connection, error) {
    this._completed = true;
    try { await connection.native.promises.query(`ROLLBACK TRANSACTION [${this.txid}]`); } catch (rollbackError) { error ||= rollbackError; }
    if (!error && this.doNotRejectOnRollback) this._resolver();
    else this._rejecter(error || new Error('Savepoint rolled back.'));
  }
}
module.exports = class WindowsSqlServerClient extends SqlServerClient {
  async acquireRawConnection() {
    const connection = await native.promises.open(this.connectionSettings.connectionString);
    connection.setUseUTC(true);
    return { native: connection, connected: true, inTransaction: false };
  }
  async destroyRawConnection(connection) { connection.connected = false; await connection.native.promises.close(); }
  validateConnection(connection) { return Boolean(connection?.connected); }
  positionBindings(sql) { return sql.replace(/\\\?/g, '?'); }
  transaction() { return new WindowsTransaction(this, ...arguments); }
  async _query(connection, query) {
    try {
      const result = await connection.native.promises.query({ query_str: query.sql, query_timeout: 30 }, query.bindings || []);
      query.response = (result.results || []).flat().map(row => Object.entries(row).map(([colName, value]) => ({ metadata: { colName }, value })));
      return query;
    } catch (error) {
      if (String(error.sqlstate || error.errors?.[0]?.sqlstate || '').startsWith('08')) connection.connected = false;
      throw error;
    }
  }
  async _stream(connection, query, stream) {
    try { for (const row of this.processResponse(await this._query(connection, query))) stream.write(row); stream.end(); }
    catch (error) { stream.destroy(error); throw error; }
  }
};
