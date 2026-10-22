const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../../.env'),quiet:true});
const pg=require('pg');
// Legacy UTC timestamp columns have no timezone in the original schema.
pg.types.setTypeParser(1114,value=>new Date(value.replace(' ','T')+'Z'));
function normalize(value) {
  if(Array.isArray(value))return value.map(normalize);
  if(!value||typeof value!=='object'||value instanceof Date||Buffer.isBuffer(value))return value;
  return Object.fromEntries(Object.entries(value).map(([key,field])=>{
    if(['ingredients','address_snapshot','options'].includes(key)&&typeof field==='string')field=JSON.parse(field);
    if(['price_delta_egp','price_egp','sale_price_egp','subtotal_egp','delivery_fee_egp','total_egp','amount_received_egp','change_due_egp','latitude','longitude'].includes(key)&&field!==null)field=Number(field);
    return [key,normalize(field)];
  }));
}
function config(url=process.env.DATABASE_URL,{direct=false}={}) {
  if(!url)throw Error('DATABASE_URL is required for PostgreSQL.');
  const connection=new URL(url);
  if(!['postgres:','postgresql:'].includes(connection.protocol))throw Error('DATABASE_URL must use PostgreSQL.');
  const schema=process.env.NODE_ENV==='test'?process.env.BELLA_TEST_SCHEMA:undefined;
  if(schema&&!/^bella_test_[a-f0-9]{16}$/.test(schema))throw Error('Invalid isolated test schema.');
  if((direct||schema)&&connection.hostname.endsWith('.neon.tech'))connection.hostname=connection.hostname.replace('-pooler.','.');
  if(connection.hostname.endsWith('.neon.tech'))connection.searchParams.set('sslmode','verify-full');
  return {client:'pg',connection:{connectionString:connection.toString(),application_name:'bella-crosta',connectionTimeoutMillis:15000,statement_timeout:30000},
    pool:{min:0,max:process.env.VERCEL?2:5,idleTimeoutMillis:10000},acquireConnectionTimeout:15000,
    ...(schema?{searchPath:[schema]}:{}),migrations:{directory:path.join(__dirname,'postgres-migrations'),tableName:'knex_migrations',...(schema?{schemaName:schema}:{})},
    seeds:{directory:path.join(__dirname,'seeds')},postProcessResponse:normalize};
}
module.exports={config,normalize};
