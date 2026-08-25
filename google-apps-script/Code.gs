/**
 * NEW2AN 2026 Registration backend.
 *
 * Before deployment, add these Script Properties:
 *   MAIN_FOLDER_ID  ID of the NEW2AN Drive folder (created by setupNEW2AN if absent)
 *   ADMIN_EMAIL     dashboard email (required)
 *   ADMIN_PASSWORD  strong dashboard password (required)
 *
 * Deploy as a Web app: execute as Me, access Anyone. Copy the /exec URL into
 * CONFIG.apiUrl in app.js. Never reuse a folder belonging to another event.
 */

const CONFERENCE = 'NEW2AN 2026';
const MAIN_FOLDER_NAME = 'NEW2AN 2026 - Registration Administration';
const SHEET_NAME = 'NEW2AN 2026 - Master Registration Database';
const SHEET_TAB_NAME = 'Registrations';
const RECORDS_FOLDER = '01 - Participant Registration Records';
const PAYMENT_PROOFS_FOLDER = '02 - Payment Proofs';
const EARLY_DEADLINE = new Date('2026-10-31T23:59:59+05:30');
const SCHEMA_VERSION = 1;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXCURSION_FEE_USD = 50;
const ALLOWED_UPLOAD_MIME = ['application/pdf','image/jpeg','image/png','image/webp'];
const HEADERS = [
  'Submission_Date','Last_Updated','Reference_ID','Status','Payment_Status',
  'Title','Full_Name','Certificate_Name','Email','Phone','Organization','Designation',
  'Country_of_Residence','Nationality','International_Eligibility_Confirmed','Participant_Role',
  'Attendance_Mode','Paper_Count','Paper_1_ID','Paper_1_Title','Paper_1_Presenter',
  'Paper_2_ID','Paper_2_Title','Paper_2_Presenter','CMT_Changes','Registration_Fee','Currency','Fee_Basis',
  'Workshop_Attendance','Future_Workshop_Updates','Workshop_Selections','Workshop_Notes',
  'Passport_Name','Passport_Issuing_Country','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance','Room_Preference',
  'Arrival_Date','Departure_Date','Arrival_Details','Departure_Details','Dietary_Preference',
  'Venue_Transport','Accessibility_Needs','Emergency_Contact_Name','Emergency_Contact_Phone','Visit_Notes','Support_Category','Support_Reply_Method','Support_Request','Travel_Data_Consent',
  'Excursion_Interest','Excursion_Participant_Count','Excursion_Participant_Names','Excursion_Group_Details',
  'Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language','Excursion_Acknowledgement',
  'Bill_To','Billing_Email','Billing_Address','Purchase_Order','Additional_Info',
  'Payment_Stage','Transaction_Reference','Amount_Paid','Payment_Currency','Payment_Proof_Files',
  'Policy_Agreement','Form_Schema_Version',
  'Record_File_URL','Excursion_Fee_Per_Person_USD','Excursion_Total_USD'
];

function doGet(e) {
  const action = clean(e && e.parameter && e.parameter.action, 50);
  try {
    if (action === 'getRegistration') return getRegistration(e.parameter);
    if (action === 'getSubmissions') return getSubmissions(e.parameter);
    if (action === 'getWorkshops') return json({success:true,workshops:readWorkshops()});
    return json({success:true,status:CONFERENCE + ' Registration API running',schemaVersion:SCHEMA_VERSION});
  } catch (error) { return json({success:false,error:safeError(error)}); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (_) { return json({success:false,error:'The server is busy. Please retry shortly.'}); }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'adminLogin') return adminLogin(body);
    if (body.action === 'saveWorkshops') return saveWorkshops(body);
    if (body.action === 'submitRegistration') return saveRegistration(body.data || {});
    return json({success:false,error:'Unsupported action.'});
  } catch (error) { return json({success:false,error:safeError(error)}); }
  finally { lock.releaseLock(); }
}

function saveRegistration(input) {
  const data = normaliseRegistration(input);
  const errors = validateRegistration(data);
  if (errors.length) return json({success:false,error:errors.join(' ')});
  const resources = getResources();
  const sheet = resources.sheet;
  const now = new Date();
  const existing = findRow(sheet, data.Reference_ID, data.Email);
  const referenceId = existing.referenceId || makeReferenceId();
  data.Reference_ID = referenceId;
  data.Submission_Date = existing.submissionDate || now.toISOString();
  data.Last_Updated = now.toISOString();
  const proofUrls = savePaymentProofs(resources.paymentProofsFolder, referenceId, data.Payment_Proof_Base64);
  if (proofUrls.length) data.Payment_Proof_Files = proofUrls.join('\n');
  else if (data.Payment_Proof_Base64 === '(uploaded — see folder)') data.Payment_Proof_Files = existing.paymentProofFiles || '(retained)';
  delete data.Payment_Proof_Base64;
  data.Status = existing.status || 'PENDING_PAYMENT_CONFIRMATION';
  data.Payment_Status = existing.paymentStatus === 'CONFIRMED' ? 'CONFIRMED' : (data.Payment_Stage === 'NOT_PAID' ? 'AWAITING_PAYMENT' : 'PROOF_SUBMITTED');
  data.Registration_Fee = feeFor(now);
  data.Currency = 'EUR';
  data.Fee_Basis = data.Registration_Fee === 400 ? 'AUTHOR_OR_EARLY_ON_OR_BEFORE_2026-10-31' : 'LATE_AFTER_2026-10-31';
  data.Form_Schema_Version = SCHEMA_VERSION;
  data.Record_File_URL = saveRecordFile(resources.recordsFolder, data);
  const row = HEADERS.map(function(header) { return serialise(data[header]); });
  if (existing.rowNumber) sheet.getRange(existing.rowNumber,1,1,HEADERS.length).setValues([row]);
  else sheet.appendRow(row);
  return json({success:true,referenceId:referenceId,status:data.Status,paymentStatus:data.Payment_Status});
}

function normaliseRegistration(input) {
  const output = {};
  HEADERS.forEach(function(header) { if (Object.prototype.hasOwnProperty.call(input,header)) output[header] = input[header]; });
  ['Title','Full_Name','Certificate_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Participant_Role','Attendance_Mode','CMT_Changes','Workshop_Attendance','Future_Workshop_Updates','Workshop_Notes','Passport_Name','Passport_Issuing_Country','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance','Room_Preference','Arrival_Date','Departure_Date','Arrival_Details','Departure_Details','Venue_Transport','Dietary_Preference','Accessibility_Needs','Emergency_Contact_Name','Emergency_Contact_Phone','Visit_Notes','Support_Category','Support_Reply_Method','Support_Request','Excursion_Interest','Excursion_Participant_Names','Excursion_Group_Details','Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language','Bill_To','Billing_Email','Billing_Address','Purchase_Order','Additional_Info','Payment_Stage','Transaction_Reference','Payment_Currency','Paper_1_ID','Paper_1_Title','Paper_2_ID','Paper_2_Title'].forEach(function(key) { output[key]=clean(output[key], key.indexOf('Notes') >= 0 || key.indexOf('Address') >= 0 || key.indexOf('Names') >= 0 || key.indexOf('Changes') >= 0 || key.indexOf('Request') >= 0 ? 2000 : 300); });
  output.Email = output.Email.toLowerCase();
  output.Billing_Email = output.Billing_Email.toLowerCase();
  output.Reference_ID = clean(input.Reference_ID,40).toUpperCase();
  output.Paper_Count = Math.max(0,Math.min(2,parseInt(input.Paper_Count,10)||0));
  output.Excursion_Participant_Count = Math.max(0,Math.min(10,parseInt(input.Excursion_Participant_Count,10)||0));
  output.Excursion_Fee_Per_Person_USD = EXCURSION_FEE_USD;
  output.Excursion_Total_USD = output.Excursion_Interest === 'Yes' ? EXCURSION_FEE_USD * output.Excursion_Participant_Count : 0;
  output.Amount_Paid = Number(input.Amount_Paid || 0);
  output.Payment_Proof_Base64 = input.Payment_Proof_Base64;
  output.Payment_Currency = 'EUR';
  output.Workshop_Selections = clean(input.Workshop_Selections,2000);
  ['International_Eligibility_Confirmed','Travel_Data_Consent','Excursion_Acknowledgement','Policy_Agreement','Paper_1_Presenter','Paper_2_Presenter'].forEach(function(key){output[key]=input[key]===true||String(input[key]).toLowerCase()==='true';});
  return output;
}

function validateRegistration(d) {
  const errors=[];
  ['Title','Full_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Participant_Role','Attendance_Mode','Bill_To','Billing_Address','Payment_Stage'].forEach(function(k){if(!d[k])errors.push(k.replace(/_/g,' ')+' is required.');});
  if(d.Attendance_Mode==='In person in Colombo'&&(!d.Emergency_Contact_Name||!d.Emergency_Contact_Phone))errors.push('Emergency contact name and phone are required for in-person participants.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.Email)) errors.push('A valid email is required.');
  if (!d.International_Eligibility_Confirmed || /^sri\s*lanka$/i.test(d.Country_of_Residence) || /^sri\s*lankan$/i.test(d.Nationality)) errors.push('This registration form is for participants who are not Sri Lankan citizens and do not live in Sri Lanka.');
  if (d.Participant_Role === 'Author / presenting author' && d.Paper_Count < 1) errors.push('A presenting author must provide an accepted paper.');
  if (d.Paper_Count && d.Participant_Role !== 'Author / presenting author') errors.push('Accepted papers require the author role.');
  for (let i=1;i<=d.Paper_Count;i++){if(!d['Paper_'+i+'_ID']||!d['Paper_'+i+'_Title']||!d['Paper_'+i+'_Presenter'])errors.push('Paper '+i+' requires its CMT ID, title and presenter confirmation.');}
  const help=/^Yes/.test(d.Travel_Agency_Assistance)||/^Yes/.test(d.Accommodation_Assistance);
  if(help&&!d.Travel_Data_Consent)errors.push('Travel data consent is required for coordination requests.');
  if(d.Arrival_Date&&d.Departure_Date&&d.Departure_Date<d.Arrival_Date)errors.push('Departure cannot be before arrival.');
  if(/^Yes/.test(d.Visa_Support)&&(!d.Passport_Name||!d.Passport_Issuing_Country))errors.push('Passport name and issuing country are required for visa support.');
  if(d.Attendance_Mode==='In person in Colombo'&&d.Excursion_Interest !== 'No'){
    if(!Number.isInteger(d.Excursion_Participant_Count)||d.Excursion_Participant_Count<1||d.Excursion_Participant_Count>10)errors.push('Excursion participant count must be from 1 to 10.');
    if(d.Excursion_Participant_Count>1&&!d.Excursion_Participant_Names)errors.push('List accompanying excursion participants.');
    if(!d.Excursion_Acknowledgement)errors.push('Excursion acknowledgement is required.');
  }
  const paid=d.Payment_Stage!=='NOT_PAID';
  if(['NOT_PAID','PAID_GATEWAY','PAID_TRANSFER','PAID_OTHER'].indexOf(d.Payment_Stage)<0)errors.push('Select a valid payment stage.');
  const proofs=Array.isArray(d.Payment_Proof_Base64)?d.Payment_Proof_Base64:[];
  if(paid&&!d.Transaction_Reference)errors.push('Payment reference is required after payment.');
  if(paid&&!(d.Amount_Paid>0))errors.push('Amount paid is required after payment.');
  if(paid&&!proofs.length&&d.Payment_Proof_Base64!=='(uploaded — see folder)')errors.push('Proof of payment is required after payment.');
  proofs.forEach(function(file){const issue=validateUpload(file);if(issue)errors.push(issue);});
  if(!d.Policy_Agreement)errors.push('Policy agreement is required.');
  if(d.Reference_ID&&!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(d.Reference_ID))errors.push('Invalid reference ID.');
  return errors;
}

function getRegistration(params) {
  const ref=clean(params.ref,40).toUpperCase(), email=clean(params.email,300).toLowerCase();
  if(!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(ref)||!email)return json({success:false,error:'Reference ID and email are required.'});
  const sheet=getResources().sheet, values=sheet.getDataRange().getValues();
  const refIndex=HEADERS.indexOf('Reference_ID'),emailIndex=HEADERS.indexOf('Email');
  for(let r=1;r<values.length;r++)if(String(values[r][refIndex])===ref&&String(values[r][emailIndex]).toLowerCase()===email){const out={};HEADERS.forEach(function(h,i){out[h]=values[r][i];});const hasProof=!!out.Payment_Proof_Files;delete out.Payment_Proof_Files;delete out.Record_File_URL;if(hasProof)out.Payment_Proof_Base64='(uploaded — see folder)';return json({success:true,data:out});}
  return json({success:false,error:'No matching registration was found.'});
}

function adminLogin(body) {
  const props=PropertiesService.getScriptProperties();
  const expectedEmail=props.getProperty('ADMIN_EMAIL'), expectedPassword=props.getProperty('ADMIN_PASSWORD');
  if(!expectedEmail||!expectedPassword)throw new Error('Admin credentials are not configured.');
  if(clean(body.email,300).toLowerCase()!==expectedEmail.toLowerCase()||String(body.password||'')!==expectedPassword)return json({success:false,error:'Invalid credentials.'});
  const token=Utilities.getUuid()+Utilities.getUuid(); CacheService.getScriptCache().put('admin:'+token,'1',21600);
  return json({success:true,token:token});
}

function defaultWorkshops(){
  return [{id:'seeing-through-ai-2026',title:'Seeing Through AI: Deep Learning for Computer Vision',date:'2026-07-21',time:'09:30–12:30',venue:'G906, New Building',fee:0,currency:'EUR',status:'completed',contact:'Mr. Amila Karunanayake, +94 77 443 9069'}];
}

function readWorkshops(){
  const raw=PropertiesService.getScriptProperties().getProperty('WORKSHOPS_JSON');
  if(!raw)return defaultWorkshops();
  try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:defaultWorkshops();}catch(_){return defaultWorkshops();}
}

function saveWorkshops(body){
  if(!validToken(body.token))return json({success:false,error:'Unauthorized.'});
  if(!Array.isArray(body.workshops)||body.workshops.length>20)return json({success:false,error:'Provide no more than 20 workshops.'});
  const cleanRows=body.workshops.map(function(item,index){
    const row={id:clean(item.id,80).toLowerCase().replace(/[^a-z0-9-]/g,'-'),title:clean(item.title,200),date:clean(item.date,20),time:clean(item.time,80),venue:clean(item.venue,200),fee:Number(item.fee||0),currency:clean(item.currency,10)||'EUR',status:clean(item.status,20),contact:clean(item.contact,200)};
    if(!row.id||!row.title||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||['draft','open','closed','completed'].indexOf(row.status)<0||row.fee<0)throw new Error('Workshop '+(index+1)+' has invalid details.');
    return row;
  });
  PropertiesService.getScriptProperties().setProperty('WORKSHOPS_JSON',JSON.stringify(cleanRows));
  return json({success:true,workshops:cleanRows});
}

function getSubmissions(params) {
  if(!validToken(params.token))return json({success:false,error:'Unauthorized.'});
  const values=getResources().sheet.getDataRange().getValues(), rows=[];
  for(let r=1;r<values.length;r++){const item={};HEADERS.forEach(function(h,i){item[h]=values[r][i];});rows.push(item);}
  return json({success:true,submissions:rows.reverse()});
}

function validToken(token){return !!(token&&CacheService.getScriptCache().get('admin:'+token));}

function getResources() {
  const id=PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID');
  if(!id)throw new Error('Run setupNEW2AN once to create and configure the NEW2AN Drive structure.');
  const folder=DriveApp.getFolderById(id);
  const sheetFiles=folder.getFilesByName(SHEET_NAME); let spreadsheet;
  if(sheetFiles.hasNext())spreadsheet=SpreadsheetApp.openById(sheetFiles.next().getId());
  else{spreadsheet=SpreadsheetApp.create(SHEET_NAME);DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);}
  const sheet=spreadsheet.getSheets()[0]; if(sheet.getName()!==SHEET_TAB_NAME)sheet.setName(SHEET_TAB_NAME); ensureSchema(sheet);
  const folders=folder.getFoldersByName(RECORDS_FOLDER); const recordsFolder=folders.hasNext()?folders.next():folder.createFolder(RECORDS_FOLDER);
  const proofFolders=folder.getFoldersByName(PAYMENT_PROOFS_FOLDER); const paymentProofsFolder=proofFolders.hasNext()?proofFolders.next():folder.createFolder(PAYMENT_PROOFS_FOLDER);
  return {folder:folder,sheet:sheet,recordsFolder:recordsFolder,paymentProofsFolder:paymentProofsFolder};
}

function ensureSchema(sheet) {
  if(sheet.getLastRow()===0){sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);sheet.setFrozenRows(1);return;}
  const existing=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const missing=HEADERS.filter(function(h){return existing.indexOf(h)<0;});
  if(missing.length)sheet.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
  const finalHeaders=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  if(HEADERS.some(function(h,i){return finalHeaders[i]!==h;}))throw new Error('The NEW2AN master-sheet header order is incompatible. Use a new dedicated folder or repair the header row.');
}

function findRow(sheet, ref, email) {
  const values=sheet.getDataRange().getValues();
  const refIndex=HEADERS.indexOf('Reference_ID'),emailIndex=HEADERS.indexOf('Email'),proofIndex=HEADERS.indexOf('Payment_Proof_Files');
  for(let r=1;r<values.length;r++)if((ref&&String(values[r][refIndex])===ref)||(!ref&&String(values[r][emailIndex]).toLowerCase()===String(email).toLowerCase()))return{rowNumber:r+1,referenceId:String(values[r][refIndex]),submissionDate:values[r][0],status:values[r][3],paymentStatus:values[r][4],paymentProofFiles:values[r][proofIndex]};
  return {};
}

function validateUpload(file){
  if(!file||!file.data)return 'A payment proof file is unreadable.';
  if(ALLOWED_UPLOAD_MIME.indexOf(String(file.mimeType||''))<0)return 'Payment proof must be PDF, JPEG, PNG or WebP.';
  if(Math.ceil(String(file.data).length*3/4)>MAX_UPLOAD_BYTES)return 'Each payment proof must be 5 MB or smaller.';
  return '';
}

function savePaymentProofs(recordsFolder,referenceId,uploads){
  if(!Array.isArray(uploads)||!uploads.length)return [];
  const named=recordsFolder.getFoldersByName(referenceId), folder=named.hasNext()?named.next():recordsFolder.createFolder(referenceId);
  const oldFiles=[], existing=folder.getFiles();while(existing.hasNext())oldFiles.push(existing.next());
  const created=[];
  try {
    uploads.forEach(function(file,index){
      const safeName=clean(file.name,120).replace(/[^A-Za-z0-9._-]/g,'_')||('proof_'+(index+1));
      const blob=Utilities.newBlob(Utilities.base64Decode(file.data),file.mimeType,'new_payment_proof_'+Date.now()+'_'+(index+1)+'_'+safeName);
      created.push(folder.createFile(blob));
    });
    oldFiles.forEach(function(file){file.setTrashed(true);});
    created.forEach(function(file){file.setName(file.getName().replace(/^new_/,''));});
    return created.map(function(file){return file.getUrl();});
  } catch(error) {
    created.forEach(function(file){try{file.setTrashed(true);}catch(_){}});
    throw error;
  }
}

function saveRecordFile(folder,data) {
  const name=data.Reference_ID+'.json', files=folder.getFilesByName(name), body=JSON.stringify(data,null,2);
  if(files.hasNext()){const file=files.next();file.setContent(body);return file.getUrl();}
  return folder.createFile(name,body,MimeType.PLAIN_TEXT).getUrl();
}

function feeFor(date){return date<=EARLY_DEADLINE?400:500;}
function makeReferenceId(){return 'NEW2AN2026-'+Utilities.getUuid().replace(/-/g,'').slice(0,9).toUpperCase();}
function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max||500);}
function serialise(value){return typeof value==='boolean'?value:(value==null?'':value);}
function safeError(error){Logger.log(error&&error.stack||error);return String(error&&error.message||error||'Unexpected error.').slice(0,500);}
function json(payload){return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}

/** Run once from the Apps Script editor. Creates the complete Drive structure when needed. */
function setupNEW2AN(){
  const props=PropertiesService.getScriptProperties();
  let id=props.getProperty('MAIN_FOLDER_ID'),folder;
  if(id)folder=DriveApp.getFolderById(id);
  else{
    folder=DriveApp.createFolder(MAIN_FOLDER_NAME);
    props.setProperty('MAIN_FOLDER_ID',folder.getId());
  }
  const resources=getResources();
  return{success:true,mainFolderName:folder.getName(),mainFolderId:folder.getId(),mainFolderUrl:folder.getUrl(),spreadsheetName:resources.sheet.getParent().getName(),spreadsheetUrl:resources.sheet.getParent().getUrl(),sheetTab:resources.sheet.getName(),recordsFolder:resources.recordsFolder.getName(),paymentProofsFolder:resources.paymentProofsFolder.getName(),headers:HEADERS.length};
}
