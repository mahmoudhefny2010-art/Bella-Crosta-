const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../../.env'),quiet:true});
if(process.env.DB_PROVIDER === 'postgres') {
  const config=require('./postgres-config').config();
  module.exports={development:config,production:config};
} else module.exports = require('./sqlserver-config');
