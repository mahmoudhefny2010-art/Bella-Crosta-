// Copies a consistent SQL Server snapshot into an EMPTY Neon database.
// Does not delete source data, seed products, change accounts or alter billing.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const knex=require('knex');
const sqlConfig=require('../server/db/sqlserver-config').development;
const {config}=require('../server/db/postgres-config');
const tables=['categories','products','product_options','users','user_roles','addresses','orders','order_items','order_events','delivery_tokens','driver_locations','push_subscribers','site_settings','site_copy','site_visitors','site_page_views','order_requests'];
const jsonFields=new Set(['ingredients','options','address_snapshot']);
const source=knex(sqlConfig),target=knex(config(process.env.DATABASE_URL,{direct:true}));
function canonical(value) {
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
function prepare(row,columns) {
  return Object.fromEntries(Object.entries(row).map(([key,value])=>{
    if(value==null)return[key,value];
    const type=columns[key];
    if(jsonFields.has(key))value=typeof value==='string'?value:JSON.stringify(value);
    else if(type==='boolean')value=value===true||value===1||value==='1'||value==='true';
    else if(type?.startsWith('timestamp'))value=new Date(value);
    else if(type==='uuid')value=String(value).toLowerCase();
    return[key,value];
  }));
}
function digest(rows,columns) {
  const normalized=rows.map(row=>{
    const clean=prepare(row,columns);
    for(const [key,value] of Object.entries(clean)) {
      if(value==null)continue;
      if(jsonFields.has(key))clean[key]=typeof value==='string'?JSON.parse(value):value;
      else if(['integer','bigint','numeric','smallint'].includes(columns[key]))clean[key]=String(value);
    }
    return JSON.stringify(canonical(clean));
  }).sort();
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
async function main() {
  const url=new URL(process.env.DATABASE_URL);
  assert.ok(url.hostname.endsWith('.neon.tech'),'Target must be the configured Neon database.');
  const existing=await target('information_schema.tables').where({table_schema:'public',table_type:'BASE TABLE'}).pluck('table_name');
  if(existing.some(table=>!['knex_migrations','knex_migrations_lock'].includes(table)))throw Error('Target is not empty. Import will not overwrite existing data.');
  const snapshot=await source.transaction(async trx=>{
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const names=await trx('INFORMATION_SCHEMA.TABLES').where({TABLE_SCHEMA:'dbo',TABLE_TYPE:'BASE TABLE'}).pluck('TABLE_NAME');
    const unknown=names.filter(name=>!tables.includes(name)&&!['knex_migrations','knex_migrations_lock'].includes(name));
    assert.deepEqual(unknown,[],'Unexpected source tables; review before transferring.');
    const result={};
    for(const table of tables)result[table]=await trx(table).select('*');
    return result;
  });
  const backup=path.resolve(__dirname,'../data/backups/neon-source-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
  await fs.mkdir(path.dirname(backup),{recursive:true});
  await fs.writeFile(backup,JSON.stringify({format:'bella-neon-source-v1',createdAt:new Date().toISOString(),tables:snapshot}),{flag:'wx',mode:0o600});
  console.log('Private source snapshot saved under ignored data/backups.');
  await target.migrate.latest();
  const metadata=await target('information_schema.columns').where({table_schema:'public'}).select('table_name','column_name','data_type');
  const types=Object.fromEntries(tables.map(table=>[table,Object.fromEntries(metadata.filter(row=>row.table_name===table).map(row=>[row.column_name,row.data_type]))]));
  const summary={};
  await target.transaction(async trx=>{
    for(const table of tables)assert.equal(Number((await trx(table).count('* as count').first()).count),0,'Target table is not empty: '+table);
    for(const table of tables) {
      const rows=snapshot[table];
      for(let index=0;index<rows.length;index+=50)await trx(table).insert(rows.slice(index,index+50).map(row=>prepare(row,types[table])));
      const copied=await trx(table).select('*');
      assert.equal(copied.length,rows.length,'Count mismatch: '+table);
      assert.equal(digest(copied,types[table]),digest(rows,types[table]),'Data mismatch: '+table);
      summary[table]=rows.length;
    }
    for(const [table,column] of [['orders','receipt_number'],['driver_locations','id'],['site_page_views','id']]){
      const sequence=(await trx.raw('SELECT pg_get_serial_sequence(?,?) AS name',[table,column])).rows[0].name;
      const max=(await trx(table).max(column+' as value').first()).value;
      if(sequence)await trx.raw('SELECT setval(?::regclass,?,?)',[sequence,max||1,max!==null]);
    }
  });
  console.log(JSON.stringify({migrated:true,allRowsVerified:true,sourceUnchanged:true,counts:summary}));
}
main().catch(error=>{console.error(JSON.stringify({migrated:false,code:error.code||'MIGRATION_FAILED',message:error.code?'Database operation failed; credentials are not logged.':error.message}));process.exitCode=1;}).finally(async()=>{await Promise.allSettled([source.destroy(),target.destroy()]);});
