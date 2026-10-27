'use strict';
const path=require('node:path'),{spawnSync}=require('node:child_process');
const {createInterface}=require('node:readline/promises');
const {readEnv}=require('./server.js');
const repository='https://github.com/Arjun-Chandra-7/Healio.git';
function git(args,{allowFailure=false,quiet=false}={}){
 const result=spawnSync('git',args,{cwd:__dirname,encoding:'utf8',stdio:['inherit','pipe',quiet?'pipe':'inherit']});
 if(result.error)throw new Error('Git is required to publish this website.');
 if(result.status!==0&&!allowFailure)throw new Error('Git command failed. Check the message above; no force-push was attempted.');
 return {ok:result.status===0,text:result.stdout||''};
}
async function publish(options={}){
 const run=options.git||git;
 const root=run(['rev-parse','--show-toplevel'],{allowFailure:true,quiet:true});
 const fresh=!root.ok||path.resolve(root.text.trim())!==__dirname;
 if(fresh)run(['init','-b','main']);
 const origin=run(['remote','get-url','origin'],{allowFailure:true,quiet:true});
 if(origin.ok&&!/^(?:https:\/\/github\.com\/|git@github\.com:)Arjun-Chandra-7\/Healio(?:\.git)?\/?$/i.test(origin.text.trim()))throw new Error('This folder has a different origin repository. No remote was changed.');
 if(!origin.ok)run(['remote','add','origin',repository]);
 console.log('Checking the GitHub repository…');
 const remote=run(['ls-remote','--symref','origin','HEAD']).text;
 const branch=remote.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m)?.[1]||'main';
 if(remote.trim()){
  run(['fetch','origin',branch]);
  if(fresh){run(['symbolic-ref','HEAD','refs/heads/'+branch]);run(['reset','--mixed','FETCH_HEAD']);}
 }
 const author={};
 for(const field of ['name','email'])author[field]=run(['config','--get','user.'+field],{allowFailure:true,quiet:true}).text.trim();
 let prompt;
 try{
  for(const field of ['name','email'])if(!author[field]){
   if(options.ask)author[field]=await options.ask(field);
   else{prompt??=createInterface({input:process.stdin,output:process.stdout});author[field]=(await prompt.question(`Commit author ${field}: `)).trim();}
   if(!author[field]||/[\r\n\0]/.test(author[field]))throw new Error('A valid Git author '+field+' is required.');
   run(['config','--local','user.'+field,author[field]]);
  }
 }finally{prompt?.close();}
 // Remove private/local files from the index even if they were tracked previously.
 const tracked=run(['ls-files','-z']).text.split('\0').filter(Boolean);
 const excluded=file=>/^\.env(?:\.|$)/.test(file)||/^(?:\.vercel|\.agents|\.codex|\.aws|public|node_modules)(?:\/|$)/.test(file);
 for(const file of tracked.filter(excluded))run(['rm','--cached','--ignore-unmatch','--',file]);
 run(['add','--all']);
 const staged=run(['ls-files','-z']).text.split('\0').filter(Boolean);
 if(staged.some(excluded))throw new Error('A private file was staged. Publishing stopped.');
 const env=options.env||readEnv(),key=env.GEMINI_API_KEY||env.GOOGLE_API_KEY;
 if(key)for(const file of staged){const content=run(['show',':'+file],{quiet:true}).text;if(content.includes(key))throw new Error('A credential was found in staged content. Publishing stopped.');}
 const changes=run(['diff','--cached','--quiet'],{allowFailure:true,quiet:true});
 if(!changes.ok)run(['commit','-m','Finalize Healio website']);
 else console.log('No new changes to commit.');
 console.log('Pushing to Arjun-Chandra-7/Healio…');
 run(['push','--set-upstream','origin','HEAD:refs/heads/'+branch]);
 console.log('Published: https://github.com/Arjun-Chandra-7/Healio');
}
if(require.main===module)publish().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={publish};
