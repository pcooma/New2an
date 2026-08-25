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
  Excursion_Interest:'No',Bill_To:'Participant',Billing_Address:'Address',Payment_Stage:'NOT_PAID',Policy_Agreement:true
};
const errors = value => Array.from(context.validateRegistration(context.normaliseRegistration({...base,...value})));

assert.deepStrictEqual(errors({}),[]);
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
console.log('NEW2AN business-rule checks passed.');
