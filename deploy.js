'use strict';
const {spawnSync}=require('node:child_process');
const {readEnv}=require('./server.js');

function runVercel(args,value){
  const secretStep=value!==undefined;
  const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','vercel',...args],{
    cwd:__dirname,
    env:{...process.env,VERCEL_TELEMETRY_DISABLED:'1',NO_UPDATE_NOTIFIER:'1'},
    ...(secretStep?{input:value,encoding:'utf8',stdio:['pipe','pipe','pipe']}:{stdio:'inherit'})
  });
  if(result.error)throw new Error('Could not start Vercel CLI. Check that Node.js and npm are installed.');
  if(result.status!==0){
    // Secret-variable commands never forward captured output, including error messages.
    throw new Error(secretStep?'Vercel could not save the environment variable. Check your account/project access.':'Vercel command failed. Check the error above and run npm run deploy again.');
  }
}
function deploy(options={}){
  const env=options.env||{...readEnv(),...process.env};
  const key=env.GEMINI_API_KEY||env.GOOGLE_API_KEY;
  if(!key)throw new Error('Add GEMINI_API_KEY to .env before deploying.');
  const run=options.run||runVercel;
  console.log('Linking this folder to Vercel…');
  run(['link','--yes','--project','healio']);
  console.log('Saving the Gemini key privately for production…');
  run(['env','add','GEMINI_API_KEY','--environment','production','--sensitive','--force','--yes'],key);
  run(['env','add','GEMINI_MODEL','--environment','production','--no-sensitive','--force','--yes'],env.GEMINI_MODEL||'auto');
  console.log('Deploying Healio to production…');
  run(['deploy','--prod','--yes']);
}
if(require.main===module){try{deploy();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={deploy};
