'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'extended.css'),'utf8');

const expected={
  registration:['Oshadhi Gunathilake','94711390292'],
  hackathon:['Dr. Nushara Wedasingha','94764492051'],
  three_mt:['Dr. K. T. Hemachandra','94718957734'],
  award:['Dr. Hansani Weeratunge','94743772290'],
  travel:['Mr. Ashen Wanniarachchi','94779747973'],
  industry:['Dr. Pasan Maduranga','94771417275'],
  panel:['Ms. Anushka Panawenna','94767706612'],
  invoice:['Mr. Pramuditha Coomasaru','94777728081'],
  system:['Mr. Pramuditha Coomasaru','94777728081']
};

Object.entries(expected).forEach(([key,[name,number]])=>{
  assert.match(js,new RegExp(`${key}:\\{name:'${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}',number:'${number}'`));
});
const routingBlock=js.match(/const WHATSAPP_CONTACTS = Object\.freeze\(\{([\s\S]*?)\}\);/);
assert(routingBlock,'WhatsApp routing table is missing.');
const numbers=Array.from(routingBlock[1].matchAll(/number:'([^']+)'/g),match=>match[1]);
assert(numbers.length>=9);
numbers.forEach(number=>assert.match(number,/^94\d{9}$/));

assert.match(html,/id="whatsapp-toggle"/);
assert.match(html,/id="whatsapp-panel"/);
assert.match(html,/Wrong invoice value or billing details/);
assert.match(html,/Technical or registration-system issue/);
assert.match(html,/Technical programme or paper-review query\?/);
assert.match(html,/new2an@crisglobal\.org/);
assert.match(html,/Do not include passwords or card details/);
assert.match(js,/Registration ref:/);
assert.match(js,/Paper \/ CMT ID:/);
assert.match(js,/Payment ref:/);
assert.match(js,/message\.textContent=data\.message/);
assert.match(js,/https:\/\/wa\.me\/\$\{data\.contact\.number\}\?text=/);
assert.match(css,/\.whatsapp-support\{position:fixed/);
assert.match(css,/z-index:60/);
assert.doesNotMatch(routingBlock[1],/Technical Program Committee|Technical Programme Committee/);

console.log('NEW2AN WhatsApp routing and traceability checks passed.');
