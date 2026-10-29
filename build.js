'use strict';
const fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'public');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
for(const name of ['index.html','css','js','assets'])fs.cpSync(path.join(__dirname,name),path.join(output,name),{recursive:true});
console.log('Healio static assets built in public/.');
