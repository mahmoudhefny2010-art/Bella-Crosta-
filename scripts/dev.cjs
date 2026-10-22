const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
require('dotenv').config({quiet:true});
if(process.env.DB_PROVIDER!=='postgres')require('./sqlserver-dev.cjs');
else {
  const root=path.resolve(__dirname,'..'),secretPath=path.join(root,'data','.dev-secret');
  fs.mkdirSync(path.dirname(secretPath),{recursive:true});
  if(!fs.existsSync(secretPath))fs.writeFileSync(secretPath,require('node:crypto').randomBytes(48).toString('hex'),{mode:0o600});
  const child=spawn(process.execPath,['--watch','server/app.js'],{cwd:root,env:{...process.env,NODE_ENV:'development',JWT_SECRET:process.env.JWT_SECRET||fs.readFileSync(secretPath,'utf8')},stdio:'inherit',windowsHide:true});
  child.on('exit',code=>{process.exitCode=code||0;});
  child.on('error',()=>{console.error('Unable to start the development server.');process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}
