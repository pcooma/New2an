'use strict';
const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

class File{constructor(name,data){this.name=name;this.data=data;}getName(){return this.name;}getUrl(){return 'drive://'+this.name;}setContent(data){this.data=data;}}
class Folder{
  constructor(name){this.name=name;this.files=[];this.folders=[];}
  getName(){return this.name;}getUrl(){return 'folder://'+this.name;}
  getFoldersByName(name){const found=this.folders.filter(folder=>folder.name===name);return{hasNext:()=>found.length>0,next:()=>found.shift()};}
  createFolder(name){const folder=new Folder(name);this.folders.push(folder);return folder;}
  getFilesByName(name){const found=this.files.filter(file=>file.name===name);return{hasNext:()=>found.length>0,next:()=>found.shift()};}
  createFile(first,data){const file=typeof first==='string'?new File(first,data):new File(first.name,first.data);this.files.push(file);return file;}
}

const properties=new Map(),cache=new Map();
const context={
  console,
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key)||null,setProperty:(key,value)=>properties.set(key,value)})},
  CacheService:{getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value)})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType(){return JSON.parse(text);}})},
  Session:{getScriptTimeZone:()=>'Asia/Colombo'},MimeType:{PLAIN_TEXT:'text'},
  Utilities:{
    Charset:{UTF_8:'utf8'},getUuid:()=>crypto.randomUUID(),formatDate:()=>'20260826_120000_000',
    base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),base64DecodeWebSafe:value=>Array.from(Buffer.from(value,'base64url')),
    base64Decode:value=>Array.from(Buffer.from(value,'base64')),
    computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest()),
    newBlob:(data,mimeType,name)=>({data,mimeType,name,getDataAsString:()=>Buffer.from(data).toString()})
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../google-apps-script/Code.gs'),'utf8'),context);

const ref='NEW2AN2026-ABC1234',email='owner@example.org';
const token=context.issueEditToken(ref,email);
assert(context.verifyEditToken(token,ref,email));
assert(!context.verifyEditToken(token,ref,'attacker@example.org'));
assert(!context.verifyEditToken(token,'NEW2AN2026-ZZZ9999',email));

const headers=context.HEADERS||vm.runInContext('HEADERS.slice()',context);
const row=headers.map(header=>header==='Reference_ID'?ref:header==='Email'?email:'');
const sheet={getDataRange:()=>({getValues:()=>[headers,row]})};
const recordsFolder=new Folder('records');
context.getResources=()=>({sheet,recordsFolder});
const pdf=Buffer.from('%PDF-1.4 test invoice').toString('base64');
const rejected=context.saveInvoiceVersion({referenceId:ref,email,editToken:'invalid',file:{mimeType:'application/pdf',data:pdf}});
assert.strictEqual(rejected.success,false);
assert.strictEqual(recordsFolder.folders.length,0);
const first=context.saveInvoiceVersion({referenceId:ref,email,editToken:token,file:{mimeType:'application/pdf',data:pdf}});
const second=context.saveInvoiceVersion({referenceId:ref,email,editToken:token,file:{mimeType:'application/pdf',data:pdf}});
assert(first.success&&second.success);
assert.strictEqual(recordsFolder.folders.length,1);
const invoices=recordsFolder.folders[0].folders.find(folder=>folder.name==='Invoices');
assert.strictEqual(invoices.files.length,2);
console.log('NEW2AN ownership and invoice-archive security checks passed.');
