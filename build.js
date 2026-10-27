'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,output=path.join(root,'public');
const files=['index.html','styles.css','experience.css','commerce.css','upgrade.css','catalogue.js','script.js','experience.js','motion.js','reels.js','care.js'];
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const name of files)fs.copyFileSync(path.join(root,name),path.join(output,name));
for(const name of ['Images','assets'])fs.cpSync(path.join(root,name),path.join(output,name),{recursive:true});
console.log('Healio static site built.');
