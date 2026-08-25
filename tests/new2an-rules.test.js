'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const code = fs.readFileSync(path.resolve(__dirname,'../google-apps-script/Code.gs'),'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(code,context);

const base = {
  Title:'Prof.',Full_Name:'A. Author',Email:'author@example.org',Phone:'+358400000000',
  Organization:'University',Designation:'Professor',Country_of_Residence:'Finland',Nationality:'Finnish',
  International_Eligibility_Confirmed:true,Participant_Role:'Author / presenting author',Attendance_Mode:'In person in Colombo',
  Emergency_Contact_Name:'E. Contact',Emergency_Contact_Phone:'+358411111111',Paper_Count:1,
  Paper_1_ID:'123',Paper_1_Title:'A paper',Paper_1_Presenter:true,
  Workshop_Attendance:'Did not attend',Future_Workshop_Updates:'Yes — email me official updates',
  Excursion_Interest:'No',Bill_To:'Participant',Billing_Legal_Name:'A. Author',Billing_Email:'finance@example.org',Billing_Address:'Address',Payment_Stage:'NOT_PAID',Policy_Agreement:true
};
const errors = value => Array.from(context.validateRegistration(context.normaliseRegistration({...base,...value})));

assert.deepStrictEqual(errors({}),[]);
assert.deepStrictEqual(errors({Billing_Legal_Name:'',Billing_Email:'',Billing_Address:''}),[]);
assert(errors({Bill_To:'Institution / organisation',Billing_Legal_Name:'',Billing_Email:'',Billing_Address:''}).some(x=>x.includes('institutional invoice')));
assert.deepStrictEqual(errors({Bill_To:'Institution / organisation'}),[]);
assert.deepStrictEqual(errors({Attendance_Mode:'Online access',Emergency_Contact_Name:'',Emergency_Contact_Phone:''}),[]);
assert.deepStrictEqual(errors({Attendance_Mode:'Online access',Emergency_Contact_Name:'',Emergency_Contact_Phone:'',Excursion_Interest:''}),[]);
assert(errors({Emergency_Contact_Name:''}).some(x=>x.includes('Emergency contact')));
assert(errors({Country_of_Residence:'Sri Lanka'}).some(x=>x.includes('not Sri Lankan citizens')));
assert(errors({Nationality:'Sri Lankan'}).some(x=>x.includes('not Sri Lankan citizens')));
assert(errors({Paper_Count:0}).some(x=>x.includes('presenting author')));
assert(errors({Excursion_Interest:'Yes',Excursion_Participant_Count:2,Excursion_Acknowledgement:true}).some(x=>x.includes('accompanying')));
assert(errors({Excursion_Interest:'Yes',Excursion_Participant_Count:1,Excursion_Acknowledgement:false}).some(x=>x.includes('acknowledgement')));
assert(errors({Payment_Stage:'PAID_TRANSFER',Transaction_Reference:'',Amount_Paid:400,Payment_Proof_Base64:[]}).some(x=>x.includes('Payment reference')));
assert.deepStrictEqual(errors({Payment_Stage:'PAID_GATEWAY',Transaction_Reference:'TX-1',Amount_Paid:400,Payment_Proof_Base64:[{name:'receipt.pdf',mimeType:'application/pdf',data:'AAAA'}]}),[]);
assert(errors({Payment_Stage:'PAID_GATEWAY',Transaction_Reference:'TX-1',Amount_Paid:400,Payment_Proof_Base64:[{name:'bad.exe',mimeType:'application/octet-stream',data:'AAAA'}]}).some(x=>x.includes('PDF')));
assert.strictEqual(context.feeFor(new Date('2026-10-31T18:00:00Z')),400);
assert.strictEqual(context.feeFor(new Date('2026-11-01T18:00:00Z')),500);
const excursion = context.normaliseRegistration({...base,Excursion_Interest:'Yes',Excursion_Participant_Count:2,Excursion_Acknowledgement:true,Excursion_Participant_Names:'Guest'});
assert.strictEqual(excursion.Excursion_Fee_Per_Person_USD,50);
assert.strictEqual(excursion.Excursion_Total_USD,100);

const schemaHeaders = vm.runInContext('HEADERS.slice()',context);
const reorderedHeaders = schemaHeaders.filter(header=>header!=='Billing_Legal_Name').concat('Billing_Legal_Name');
const schemaSheet = {
  headers:reorderedHeaders.slice(),
  getLastRow(){return 2;},getLastColumn(){return this.headers.length;},setFrozenRows(){},
  getRange(row,column,height,width){
    return {
      getValues:()=>[this.headers.slice(column-1,column-1+width)],
      setValues:values=>{values[0].forEach((value,index)=>{this.headers[column-1+index]=value;});}
    };
  }
};
assert.doesNotThrow(()=>context.ensureSchema(schemaSheet));
assert.deepStrictEqual(schemaSheet.headers,reorderedHeaders);

const physicalHeaders=['Email','Reference_ID','Submission_Date','Status','Payment_Status','Payment_Proof_Files','Billing_Legal_Name','Manual_Note'];
const storedRow=['old@example.org','NEW2AN2026-OLD1234','2026-01-01','PENDING','AWAITING_PAYMENT','','Old name','Keep this'];
const writeSheet={
  row:storedRow.slice(),appended:null,getLastColumn(){return physicalHeaders.length;},
  getRange(row){return{getValues:()=>[row===1?physicalHeaders.slice():this.row.slice()],setValues:values=>{this.row=values[0].slice();}};},
  appendRow(row){this.appended=row.slice();}
};
context.writeSheetRecord(writeSheet,{Email:'new@example.org',Reference_ID:'NEW2AN2026-NEW1234',Billing_Legal_Name:'New legal name'},2);
assert.strictEqual(writeSheet.row[0],'new@example.org');
assert.strictEqual(writeSheet.row[1],'NEW2AN2026-NEW1234');
assert.strictEqual(writeSheet.row[6],'New legal name');
assert.strictEqual(writeSheet.row[7],'Keep this');
console.log('NEW2AN business-rule checks passed.');
