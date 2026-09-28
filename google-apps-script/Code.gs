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
const INVOICES_FOLDER = 'Invoices';
const PAYMENT_PROOFS_FOLDER = 'Payment Proofs';
const TRAVEL_DOCUMENTS_FOLDER = 'Travel Documents';
const EARLY_DEADLINE = new Date('2026-10-31T23:59:59+05:30');
const SCHEMA_VERSION = 4;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXCURSION_FEE_USD = 50;
const ALLOWED_UPLOAD_MIME = ['application/pdf','image/jpeg','image/png','image/webp'];
const REGISTRATION_CATEGORIES = ['INT_AUTHOR','INT_NON_AUTHOR','LK_AUTHOR','LK_NON_AUTHOR'];
const PARTICIPANT_ROLES = ['Author / presenting author','Non-author attendee','Industry professional'];
const DIETARY_PREFERENCES = ['Vegetarian','Non-vegetarian','Halal'];
const LEGACY_PARTICIPANT_ROLES = {'Non-author academic / researcher':'Non-author attendee','Invited or keynote speaker':'Non-author attendee','Committee member / chair':'Non-author attendee'};
const HEADERS = [
  'Submission_Date','Last_Updated','Reference_ID','Status','Payment_Status',
  'Title','Full_Name','Certificate_Name','Email','Phone','Organization','Designation',
  'Country_of_Residence','Nationality','International_Eligibility_Confirmed','Registration_Category','Participant_Role',
  'Attendance_Mode','Paper_Count','Paper_1_ID','Paper_1_Title','Paper_1_Presenter',
  'Paper_2_ID','Paper_2_Title','Paper_2_Presenter','CMT_Changes','Registration_Fee','Currency','Fee_Basis',
  'Workshop_Attendance','Future_Workshop_Updates','Workshop_Selections','Workshop_Notes',
  'Passport_Name','Passport_Issuing_Country','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance','Room_Preference',
  'Arrival_Date','Departure_Date','Arrival_Details','Departure_Details','Dietary_Preference',
  'Venue_Transport','Accessibility_Needs','Emergency_Contact_Name','Emergency_Contact_Phone','Visit_Notes','Support_Category','Support_Reply_Method','Support_Request','Travel_Data_Consent',
  'Excursion_Interest','Excursion_Participant_Count','Excursion_Participant_Names','Excursion_Group_Details',
  'Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language','Excursion_Acknowledgement',
  'Bill_To','Billing_Legal_Name','Billing_Email','Billing_Address','Purchase_Order','Additional_Info',
  'Gala_Dinner_Interest','Gala_Dinner_Fee','Gala_Dinner_Currency','Gala_Dinner_Payment_Reference',
  'Payment_Stage','Transaction_Reference','Amount_Paid','Payment_Currency','Payment_Proof_Files',
  'Policy_Agreement','Form_Schema_Version',
  'Record_File_URL','Excursion_Fee_Per_Person_USD','Excursion_Total_USD',
  'Excursion_USD_to_EUR_Rate','Excursion_Total_EUR_Indicative',
  'Travel_Details_Status','Travel_Details_Last_Updated','Air_Ticket_Assistance',
  'Ticket_Departure_City_Airport','Preferred_Departure_Home_Date','Preferred_Arrival_Sri_Lanka_Date',
  'Preferred_Departure_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Time','Ticket_Destination_City_Airport',
  'Passport_Number','Date_of_Birth','Passport_Issue_Date',
  'Passport_Expiry_Date','Place_Country_of_Birth','Passport_Bio_Page_Files','Travel_Details_Consent'
];

function doGet(e) {
  const action = clean(e && e.parameter && e.parameter.action, 50);
  try {
    if (action === 'getRegistration') return getRegistration(e.parameter);
    if (action === 'getSubmissions') return getSubmissions(e.parameter);
    if (action === 'getWorkshops') return json({success:true,workshops:readWorkshops(),publicSettings:readPublicSettings()});
    return json({success:true,status:CONFERENCE + ' Registration API running',schemaVersion:SCHEMA_VERSION,registrationCategories:REGISTRATION_CATEGORIES,participantRoles:PARTICIPANT_ROLES,dietaryPreferences:DIETARY_PREFERENCES});
  } catch (error) { return json({success:false,error:safeError(error)}); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (_) { return json({success:false,error:'The server is busy. Please retry shortly.'}); }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'adminLogin') return adminLogin(body);
    if (body.action === 'saveWorkshops') return saveWorkshops(body);
    if (body.action === 'savePublicSettings') return savePublicSettings(body);
    if (body.action === 'saveInvoiceVersion') return saveInvoiceVersion(body);
    if (body.action === 'submitTravelDetails') return saveTravelDetails(body.data || {},body.editToken);
    if (body.action === 'submitRegistration') return saveRegistration(body.data || {},body.editToken);
    return json({success:false,error:'Unsupported action.'});
  } catch (error) { return json({success:false,error:safeError(error)}); }
  finally { lock.releaseLock(); }
}

function saveRegistration(input,editToken) {
  const data = normaliseRegistration(input);
  const errors = validateRegistration(data);
  if (errors.length) return json({success:false,error:errors.join(' ')});
  const publicSettings = readPublicSettings();
  if(data.Excursion_Interest === 'Yes' && !(publicSettings.usdToEurRate>0))return json({success:false,error:'The excursion conversion rate has not been configured. Please contact the organiser before registering for the excursion.'});
  const resources = getResources();
  const sheet = resources.sheet;
  const now = new Date();
  const price = registrationPriceFor(now,data.Registration_Category);
  const existing = data.Reference_ID ? findRow(sheet,data.Reference_ID,'') : {};
  if(data.Reference_ID&&(!existing.rowNumber||existing.email.toLowerCase()!==data.Email||!verifyEditToken(editToken,data.Reference_ID,data.Email)))return json({success:false,error:'This registration cannot be updated without a valid reference-and-email session. Reload it using the returning-registration form.'});
  const referenceId = existing.referenceId || makeReferenceId();
  data.Reference_ID = referenceId;
  data.Submission_Date = existing.submissionDate || now.toISOString();
  data.Last_Updated = now.toISOString();
  const registrationFolder = getRegistrationFolder(resources.recordsFolder, referenceId);
  const proofUrls = savePaymentProofs(registrationFolder, data.Payment_Proof_Base64);
  if (proofUrls.length) data.Payment_Proof_Files = [existing.paymentProofFiles].concat(proofUrls).filter(Boolean).join('\n');
  else if (data.Payment_Proof_Base64 === '(uploaded — see folder)') data.Payment_Proof_Files = existing.paymentProofFiles || '(retained)';
  delete data.Payment_Proof_Base64;
  data.Registration_Fee = price.amount;
  data.Status = existing.status || 'PENDING_PAYMENT_CONFIRMATION';
  const paymentMismatch = Math.abs(data.Amount_Paid-price.amount)>0.009 || data.Payment_Currency!==price.currency;
  data.Payment_Status = existing.paymentStatus === 'CONFIRMED' ? 'CONFIRMED' : (data.Payment_Stage === 'NOT_PAID' ? 'AWAITING_PAYMENT' : (paymentMismatch?'PROOF_SUBMITTED_AMOUNT_MISMATCH':'PROOF_SUBMITTED'));
  data.Currency = price.currency;
  data.Fee_Basis = price.feeBasis;
  data.Payment_Currency = price.currency;
  data.Gala_Dinner_Fee = data.Gala_Dinner_Interest === 'Yes' ? (data.Registration_Category==='LK_AUTHOR'?12000:15000) : 0;
  data.Gala_Dinner_Currency = data.Gala_Dinner_Interest === 'Yes' ? 'LKR' : '';
  data.Excursion_Fee_Per_Person_USD = EXCURSION_FEE_USD;
  data.Excursion_Total_USD = data.Excursion_Interest === 'Yes' ? EXCURSION_FEE_USD * data.Excursion_Participant_Count : 0;
  data.Excursion_USD_to_EUR_Rate = data.Excursion_Interest === 'Yes' ? publicSettings.usdToEurRate : '';
  data.Excursion_Total_EUR_Indicative = data.Excursion_Interest === 'Yes' ? roundMoney(data.Excursion_Total_USD * publicSettings.usdToEurRate) : 0;
  data.Form_Schema_Version = SCHEMA_VERSION;
  data.Record_File_URL = saveRecordFile(registrationFolder, data);
  writeSheetRecord(sheet,data,existing.rowNumber);
  return json({
    success:true,
    referenceId:referenceId,
    editToken:issueEditToken(referenceId,data.Email),
    status:data.Status,
    paymentStatus:data.Payment_Status,
    pricing:{
      registrationFee:data.Registration_Fee,
      currency:data.Currency,
      feeBasis:data.Fee_Basis,
      galaDinnerFee:data.Gala_Dinner_Fee,
      galaDinnerCurrency:data.Gala_Dinner_Currency,
      excursionFeePerPersonUsd:data.Excursion_Fee_Per_Person_USD,
      excursionTotalUsd:data.Excursion_Total_USD,
      excursionUsdToEurRate:data.Excursion_USD_to_EUR_Rate,
      excursionTotalEurIndicative:data.Excursion_Total_EUR_Indicative
    }
  });
}

function normaliseRegistration(input) {
  const output = {};
  HEADERS.forEach(function(header) { if (Object.prototype.hasOwnProperty.call(input,header)) output[header] = input[header]; });
  ['Title','Full_Name','Certificate_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Registration_Category','Participant_Role','Attendance_Mode','CMT_Changes','Workshop_Attendance','Future_Workshop_Updates','Workshop_Notes','Passport_Name','Passport_Issuing_Country','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance','Room_Preference','Arrival_Date','Departure_Date','Arrival_Details','Departure_Details','Venue_Transport','Dietary_Preference','Accessibility_Needs','Emergency_Contact_Name','Emergency_Contact_Phone','Visit_Notes','Support_Category','Support_Reply_Method','Support_Request','Excursion_Interest','Excursion_Participant_Names','Excursion_Group_Details','Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language','Bill_To','Billing_Legal_Name','Billing_Email','Billing_Address','Purchase_Order','Additional_Info','Gala_Dinner_Interest','Gala_Dinner_Payment_Reference','Payment_Stage','Transaction_Reference','Payment_Currency','Paper_1_ID','Paper_1_Title','Paper_2_ID','Paper_2_Title'].forEach(function(key) { output[key]=clean(output[key], key.indexOf('Notes') >= 0 || key.indexOf('Address') >= 0 || key.indexOf('Names') >= 0 || key.indexOf('Changes') >= 0 || key.indexOf('Request') >= 0 ? 2000 : 300); });
  output.Email = output.Email.toLowerCase();
  output.Billing_Email = output.Billing_Email.toLowerCase();
  output.Reference_ID = clean(input.Reference_ID,40).toUpperCase();
  output.Paper_Count = Math.max(0,Math.min(2,parseInt(input.Paper_Count,10)||0));
  output.Excursion_Participant_Count = Math.max(0,Math.min(10,parseInt(input.Excursion_Participant_Count,10)||0));
  output.Excursion_Fee_Per_Person_USD = EXCURSION_FEE_USD;
  output.Excursion_Total_USD = output.Excursion_Interest === 'Yes' ? EXCURSION_FEE_USD * output.Excursion_Participant_Count : 0;
  output.Amount_Paid = Number(input.Amount_Paid || 0);
  output.Payment_Proof_Base64 = input.Payment_Proof_Base64;
  output.Payment_Currency = output.Payment_Currency.toUpperCase();
  output.Gala_Dinner_Interest = output.Gala_Dinner_Interest || 'No';
  output.Workshop_Selections = clean(input.Workshop_Selections,2000);
  ['International_Eligibility_Confirmed','Travel_Data_Consent','Excursion_Acknowledgement','Policy_Agreement','Paper_1_Presenter','Paper_2_Presenter'].forEach(function(key){output[key]=input[key]===true||String(input[key]).toLowerCase()==='true';});
  return output;
}

function validateRegistration(d) {
  const errors=[];
  ['Title','Full_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Registration_Category','Participant_Role','Attendance_Mode','Bill_To','Payment_Stage'].forEach(function(k){if(!d[k])errors.push(k.replace(/_/g,' ')+' is required.');});
  if(d.Bill_To==='Institution / organisation')['Billing_Legal_Name','Billing_Email','Billing_Address'].forEach(function(k){if(!d[k])errors.push(k.replace(/_/g,' ')+' is required for an institutional invoice.');});
  if(d.Attendance_Mode==='In person in Colombo'&&(!d.Emergency_Contact_Name||!d.Emergency_Contact_Phone))errors.push('Emergency contact name and phone are required for in-person participants.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.Email)) errors.push('A valid email is required.');
  const authorCategory=d.Registration_Category==='INT_AUTHOR'||d.Registration_Category==='LK_AUTHOR';
  if(REGISTRATION_CATEGORIES.indexOf(d.Registration_Category)<0)errors.push('Select a valid registration category.');
  if(PARTICIPANT_ROLES.indexOf(d.Participant_Role)<0)errors.push('Select a valid participant role.');
  if(authorCategory&&d.Participant_Role!=='Author / presenting author')errors.push('Author registration categories require the presenting-author role.');
  if(!authorCategory&&d.Participant_Role==='Author / presenting author')errors.push('Presenting authors require an author registration category.');
  if(authorCategory&&d.Paper_Count<1)errors.push('A presenting author must provide an accepted paper.');
  if(!authorCategory&&d.Paper_Count)errors.push('Accepted papers require an author registration category.');
  if(d.Registration_Category==='LK_AUTHOR'&&d.Paper_Count>1)errors.push('Each Sri Lankan-affiliated author registration covers one accepted paper.');
  if(d.Attendance_Mode==='Request online presentation (international author; approval required)'&&d.Registration_Category!=='INT_AUTHOR')errors.push('Online presentation may be requested only by an international author.');
  if(authorCategory&&d.Attendance_Mode==='Online session access (non-presenting)')errors.push('An author cannot use non-presenting online access to satisfy the paper-presentation requirement.');
  for (let i=1;i<=d.Paper_Count;i++){if(!d['Paper_'+i+'_ID']||!d['Paper_'+i+'_Title']||!d['Paper_'+i+'_Presenter'])errors.push('Paper '+i+' requires its CMT ID, title and presenter confirmation.');}
  const help=/^Yes/.test(d.Travel_Agency_Assistance)||/^Yes/.test(d.Accommodation_Assistance);
  if(help&&!d.Travel_Data_Consent)errors.push('Travel data consent is required for coordination requests.');
  if(d.Arrival_Date&&d.Departure_Date&&d.Departure_Date<d.Arrival_Date)errors.push('Departure cannot be before arrival.');
  if(/^Yes/.test(d.Visa_Support)&&(!d.Passport_Name||!d.Passport_Issuing_Country))errors.push('Passport name and issuing country are required for visa support.');
  if(d.Dietary_Preference&&DIETARY_PREFERENCES.indexOf(d.Dietary_Preference)<0)errors.push('Select Vegetarian, Non-vegetarian or Halal as the dietary preference.');
  if(d.Attendance_Mode==='In person in Colombo'&&d.Excursion_Interest === 'Yes'){
    if(!Number.isInteger(d.Excursion_Participant_Count)||d.Excursion_Participant_Count<1||d.Excursion_Participant_Count>10)errors.push('Excursion participant count must be from 1 to 10.');
    if(d.Excursion_Participant_Count>1&&!d.Excursion_Participant_Names)errors.push('List accompanying excursion participants.');
    if(!d.Excursion_Acknowledgement)errors.push('Excursion acknowledgement is required.');
  }
  const paid=d.Payment_Stage!=='NOT_PAID';
  if(['NOT_PAID','PAID_GATEWAY','PAID_TRANSFER','PAID_OTHER'].indexOf(d.Payment_Stage)<0)errors.push('Select a valid payment stage.');
  const proofs=Array.isArray(d.Payment_Proof_Base64)?d.Payment_Proof_Base64:[];
  if(paid&&!d.Transaction_Reference)errors.push('Payment reference is required after payment.');
  if(paid&&!(d.Amount_Paid>0))errors.push('Amount paid is required after payment.');
  const expectedCurrency=d.Registration_Category.indexOf('LK_')===0?'LKR':'EUR';
  if(paid&&d.Payment_Currency!==expectedCurrency)errors.push('Payment currency does not match the selected registration category.');
  if(paid&&!proofs.length&&d.Payment_Proof_Base64!=='(uploaded — see folder)')errors.push('Proof of payment is required after payment.');
  proofs.forEach(function(file){const issue=validateUpload(file);if(issue)errors.push(issue);});
  if(d.Gala_Dinner_Interest==='Yes'&&d.Registration_Category.indexOf('LK_')!==0)errors.push('Published gala dinner tickets are available only for Sri Lankan-affiliated categories.');
  if(!d.Policy_Agreement)errors.push('Policy agreement is required.');
  if(d.Reference_ID&&!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(d.Reference_ID))errors.push('Invalid reference ID.');
  return errors;
}

function getRegistration(params) {
  const ref=clean(params.ref,40).toUpperCase(), email=clean(params.email,300).toLowerCase();
  if(!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(ref)||!email)return json({success:false,error:'Reference ID and email are required.'});
  const sheet=getResources().sheet, values=sheet.getDataRange().getValues();
  const headers=values[0]||[],map=headerMap(headers),refIndex=map.Reference_ID,emailIndex=map.Email;
  for(let r=1;r<values.length;r++)if(String(values[r][refIndex])===ref&&String(values[r][emailIndex]).toLowerCase()===email){const out=rowToObject(headers,values[r]);out.Participant_Role=LEGACY_PARTICIPANT_ROLES[out.Participant_Role]||out.Participant_Role;if(!out.Registration_Category)out.Registration_Category=out.Participant_Role==='Author / presenting author'?'INT_AUTHOR':'INT_NON_AUTHOR';const hasProof=!!out.Payment_Proof_Files,hasPassport=!!out.Passport_Bio_Page_Files;delete out.Payment_Proof_Files;delete out.Passport_Bio_Page_Files;delete out.Record_File_URL;if(hasProof)out.Payment_Proof_Base64='(uploaded — see folder)';if(hasPassport)out.Passport_Bio_Page_Base64='(uploaded — see folder)';return json({success:true,data:out,editToken:issueEditToken(ref,email)});}
  return json({success:false,error:'No matching registration was found.'});
}

function saveTravelDetails(input,editToken) {
  const referenceId=clean(input.Reference_ID,40).toUpperCase(),email=clean(input.Email,300).toLowerCase();
  if(!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(referenceId)||!email)return json({success:false,error:'Reference ID and registration email are required.'});
  const resources=getResources(),existing=findRow(resources.sheet,referenceId,'');
  if(!existing.rowNumber||existing.email.toLowerCase()!==email||!verifyEditToken(editToken,referenceId,email))return json({success:false,error:'Reload the registration with its reference and email before saving travel details.'});
  const values=resources.sheet.getDataRange().getValues(),headers=values[0]||[],stored=rowToObject(headers,values[existing.rowNumber-1]);
  if(stored.Excursion_Interest!=='Yes')return json({success:false,error:'This follow-up form is available only to participants whose registration says Yes to the excursion. Update the main registration first if needed.'});
  const flightRequested=stored.Travel_Agency_Assistance==='Yes — flight options'||stored.Travel_Agency_Assistance==='Yes — flights and transfer';
  if(!flightRequested)return json({success:false,error:'Your registration does not request organiser flight assistance. No additional passport or ticket details are required.'});
  const data=normaliseTravelDetails(input),errors=validateTravelDetails(data,!!stored.Passport_Bio_Page_Files);
  if(errors.length)return json({success:false,error:errors.join(' ')});
  const registrationFolder=getRegistrationFolder(resources.recordsFolder,referenceId);
  const passportUrls=saveTravelDocuments(registrationFolder,data.Passport_Bio_Page_Base64);
  data.Passport_Bio_Page_Files=passportUrls.length?[stored.Passport_Bio_Page_Files].concat(passportUrls).filter(Boolean).join('\n'):(stored.Passport_Bio_Page_Files||'');
  delete data.Passport_Bio_Page_Base64;
  data.Reference_ID=referenceId;data.Email=email;data.Air_Ticket_Assistance='Yes';data.Travel_Details_Status='SUBMITTED';data.Travel_Details_Last_Updated=new Date().toISOString();
  const merged=Object.assign({},stored,data);
  merged.Record_File_URL=saveRecordFile(registrationFolder,merged);data.Record_File_URL=merged.Record_File_URL;
  writeSheetRecord(resources.sheet,data,existing.rowNumber);
  return json({success:true,referenceId:referenceId,status:data.Travel_Details_Status,passportOnFile:!!data.Passport_Bio_Page_Files,editToken:issueEditToken(referenceId,email)});
}

function normaliseTravelDetails(input){
  const output={};
  ['Ticket_Departure_City_Airport','Preferred_Departure_Home_Date','Preferred_Arrival_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Time','Ticket_Destination_City_Airport','Passport_Number','Date_of_Birth','Passport_Issue_Date','Passport_Expiry_Date','Place_Country_of_Birth'].forEach(function(key){output[key]=clean(input[key],300);});
  output.Travel_Details_Consent=input.Travel_Details_Consent===true||String(input.Travel_Details_Consent).toLowerCase()==='true';
  output.Passport_Bio_Page_Base64=input.Passport_Bio_Page_Base64;
  return output;
}

function validateTravelDetails(d,hasPassportOnFile){
  const errors=[];
  if(!d.Travel_Details_Consent)errors.push('Consent is required before sensitive travel details can be stored.');
  {
    ['Ticket_Departure_City_Airport','Preferred_Departure_Home_Date','Preferred_Arrival_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Time','Ticket_Destination_City_Airport','Passport_Number','Date_of_Birth','Passport_Issue_Date','Passport_Expiry_Date','Place_Country_of_Birth'].forEach(function(key){if(!d[key])errors.push(key.replace(/_/g,' ')+' is required for organiser-arranged air travel.');});
    if(d.Preferred_Arrival_Sri_Lanka_Date&&d.Preferred_Departure_Sri_Lanka_Date&&d.Preferred_Departure_Sri_Lanka_Date<d.Preferred_Arrival_Sri_Lanka_Date)errors.push('Departure from Sri Lanka cannot be before arrival in Sri Lanka.');
    if(d.Passport_Issue_Date&&d.Passport_Expiry_Date&&d.Passport_Expiry_Date<=d.Passport_Issue_Date)errors.push('Passport expiry date must be after its issue date.');
    const uploads=Array.isArray(d.Passport_Bio_Page_Base64)?d.Passport_Bio_Page_Base64:[];
    if(!uploads.length&&!hasPassportOnFile)errors.push('Upload the passport bio page for organiser-arranged air travel.');
    if(uploads.length>1)errors.push('Upload one passport bio-page file only.');
    uploads.forEach(function(file){const issue=validateTravelUpload(file);if(issue)errors.push(issue);});
  }
  return errors;
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
  return [
    {id:'seeing-through-ai-2026',title:'Seeing Through AI: Deep Learning for Computer Vision',date:'2026-07-21',time:'09:30–12:30',venue:'G906, New Building',fee:0,currency:'EUR',status:'completed',contact:'Mr. Amila Karunanayake, +94 77 443 9069'},
    {id:'ai-communications-6g-2026',title:'AI-Based Communications Towards 6G',date:'2026-09-11',time:'11:00 onwards',venue:'SLIIT, Malabe',fee:0,currency:'LKR',status:'completed',contact:'Prof. Dushantha Jayakody, +94 71 402 9161'}
  ];
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

function readPublicSettings(){
  const props=PropertiesService.getScriptProperties(),stored=Number(props.getProperty('USD_TO_EUR_RATE')),approved=props.getProperty('INVOICE_SETTINGS_APPROVED')==='true';
  return {
    excursionFeeUsd:EXCURSION_FEE_USD,
    usdToEurRate:approved&&stored>0?stored:0,
    issuerLegalName:approved?clean(props.getProperty('INVOICE_ISSUER_LEGAL_NAME'),300):'',
    issuerAddress:approved?clean(props.getProperty('INVOICE_ISSUER_ADDRESS'),1000):'',
    issuerRegistrationNumber:approved?clean(props.getProperty('INVOICE_ISSUER_REGISTRATION_NUMBER'),120):'',
    issuerTaxStatement:approved?clean(props.getProperty('INVOICE_TAX_STATEMENT'),500):'',
    issuerEmail:approved?clean(props.getProperty('INVOICE_ISSUER_EMAIL'),300):'',
    issuerPhone:approved?clean(props.getProperty('INVOICE_ISSUER_PHONE'),100):'',
    paymentInstructions:approved?clean(props.getProperty('INVOICE_PAYMENT_INSTRUCTIONS'),1500):'',
    paymentDueDays:Math.max(1,Math.min(90,parseInt(props.getProperty('INVOICE_PAYMENT_DUE_DAYS'),10)||14)),
    termsUrl:clean(props.getProperty('INVOICE_TERMS_URL'),500)||'https://new2an.com/terms.html',
    invoiceSettingsApproved:approved
  };
}

function savePublicSettings(body){
  if(!validToken(body.token))return json({success:false,error:'Unauthorized.'});
  const rate=Number(body.usdToEurRate);
  if(!Number.isFinite(rate)||rate<=0||rate>10)return json({success:false,error:'Enter a valid USD to EUR rate greater than 0.'});
  const settings={
    INVOICE_ISSUER_LEGAL_NAME:clean(body.issuerLegalName,300),
    INVOICE_ISSUER_ADDRESS:clean(body.issuerAddress,1000),
    INVOICE_ISSUER_REGISTRATION_NUMBER:clean(body.issuerRegistrationNumber,120),
    INVOICE_TAX_STATEMENT:clean(body.issuerTaxStatement,500),
    INVOICE_ISSUER_EMAIL:clean(body.issuerEmail,300).toLowerCase(),
    INVOICE_ISSUER_PHONE:clean(body.issuerPhone,100),
    INVOICE_PAYMENT_INSTRUCTIONS:clean(body.paymentInstructions,1500),
    INVOICE_PAYMENT_DUE_DAYS:String(Math.max(1,Math.min(90,parseInt(body.paymentDueDays,10)||0))),
    INVOICE_TERMS_URL:clean(body.termsUrl,500)
  };
  if(!settings.INVOICE_ISSUER_LEGAL_NAME||!settings.INVOICE_ISSUER_ADDRESS||!settings.INVOICE_TAX_STATEMENT||!settings.INVOICE_ISSUER_EMAIL||!settings.INVOICE_PAYMENT_INSTRUCTIONS||!(parseInt(settings.INVOICE_PAYMENT_DUE_DAYS,10)>0))return json({success:false,error:'Complete the issuer legal name, address, tax statement, email, payment instructions and payment due period.'});
  if(body.invoiceSettingsApproved!==true&&String(body.invoiceSettingsApproved).toLowerCase()!=='true')return json({success:false,error:'Confirm that the organiser has verified the invoice issuer, tax, payment, bank and exchange-rate settings.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.INVOICE_ISSUER_EMAIL))return json({success:false,error:'Enter a valid invoice issuer email address.'});
  const props=PropertiesService.getScriptProperties();
  props.setProperty('USD_TO_EUR_RATE',String(roundRate(rate)));
  Object.keys(settings).forEach(function(key){props.setProperty(key,settings[key]);});
  props.setProperty('INVOICE_SETTINGS_APPROVED','true');
  return json({success:true,publicSettings:readPublicSettings()});
}

function getSubmissions(params) {
  if(!validToken(params.token))return json({success:false,error:'Unauthorized.'});
  const values=getResources().sheet.getDataRange().getValues(), rows=[];
  const headers=values[0]||[];
  for(let r=1;r<values.length;r++)rows.push(rowToObject(headers,values[r]));
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
  return {folder:folder,sheet:sheet,recordsFolder:recordsFolder};
}

function ensureSchema(sheet) {
  if(sheet.getLastRow()===0){sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);sheet.setFrozenRows(1);return;}
  const existing=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const blank=existing.some(function(h){return !h.trim();});
  if(blank)throw new Error('The NEW2AN master-sheet header row contains a blank column name. Fill or remove that header before continuing.');
  const duplicates=existing.filter(function(h,i){return existing.indexOf(h)!==i;});
  if(duplicates.length)throw new Error('The NEW2AN master-sheet contains duplicate headers: '+duplicates.join(', ')+'. Repair the header row before continuing.');
  const missing=HEADERS.filter(function(h){return existing.indexOf(h)<0;});
  if(missing.length)sheet.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
}

function findRow(sheet, ref, email) {
  const values=sheet.getDataRange().getValues();
  const headers=values[0]||[],map=headerMap(headers),refIndex=map.Reference_ID,emailIndex=map.Email,proofIndex=map.Payment_Proof_Files;
  for(let r=1;r<values.length;r++)if((ref&&String(values[r][refIndex])===ref)||(!ref&&String(values[r][emailIndex]).toLowerCase()===String(email).toLowerCase())){const item=rowToObject(headers,values[r]);return{rowNumber:r+1,referenceId:String(values[r][refIndex]),email:String(values[r][emailIndex]),submissionDate:item.Submission_Date,status:item.Status,paymentStatus:item.Payment_Status,paymentProofFiles:values[r][proofIndex]};}
  return {};
}

function headerMap(headers){
  const map={};headers.forEach(function(header,index){map[String(header)]=index;});
  return map;
}

function rowToObject(headers,row){
  const item={};headers.forEach(function(header,index){if(HEADERS.indexOf(String(header))>=0)item[String(header)]=row[index];});
  return item;
}

function writeSheetRecord(sheet,data,rowNumber){
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),map=headerMap(headers);
  const row=rowNumber?sheet.getRange(rowNumber,1,1,headers.length).getValues()[0]:headers.map(function(){return '';});
  HEADERS.forEach(function(header){if(Object.prototype.hasOwnProperty.call(map,header))row[map[header]]=serialise(data[header]);});
  if(rowNumber)sheet.getRange(rowNumber,1,1,headers.length).setValues([row]);else sheet.appendRow(row);
}

function validateUpload(file){
  if(!file||!file.data)return 'A payment proof file is unreadable.';
  if(ALLOWED_UPLOAD_MIME.indexOf(String(file.mimeType||''))<0)return 'Payment proof must be PDF, JPEG, PNG or WebP.';
  if(Math.ceil(String(file.data).length*3/4)>MAX_UPLOAD_BYTES)return 'Each payment proof must be 5 MB or smaller.';
  return '';
}

function getRegistrationFolder(recordsFolder,referenceId){
  const named=recordsFolder.getFoldersByName(referenceId);
  const folder=named.hasNext()?named.next():recordsFolder.createFolder(referenceId);
  getOrCreateSubfolder(folder,INVOICES_FOLDER);
  getOrCreateSubfolder(folder,PAYMENT_PROOFS_FOLDER);
  return folder;
}

function getOrCreateSubfolder(parent,name){
  const folders=parent.getFoldersByName(name);
  return folders.hasNext()?folders.next():parent.createFolder(name);
}

function saveInvoiceVersion(body){
  const referenceId=clean(body.referenceId,40).toUpperCase();
  const email=clean(body.email,300).toLowerCase();
  if(!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(referenceId))return json({success:false,error:'Invalid reference ID.'});
  const resources=getResources(),existing=findRow(resources.sheet,referenceId,'');
  if(!existing.rowNumber||existing.email.toLowerCase()!==email||!verifyEditToken(body.editToken,referenceId,email))return json({success:false,error:'Invoice archiving requires a valid registration session. Reload the registration using its reference and email.'});
  if(!readPublicSettings().invoiceSettingsApproved)return json({success:false,error:'Invoice archiving is disabled until the organiser verifies the issuer, tax, payment, bank and exchange-rate settings.'});
  const cache=CacheService.getScriptCache(),rateKey='invoice-archive:'+referenceId,archiveCount=Number(cache.get(rateKey)||0);
  if(archiveCount>=20)return json({success:false,error:'Too many invoice versions were requested recently. Please retry later or contact the organiser.'});
  const file=body.file||{};
  if(file.mimeType!=='application/pdf'||!file.data)return json({success:false,error:'A valid PDF invoice is required.'});
  if(Math.ceil(String(file.data).length*3/4)>MAX_UPLOAD_BYTES)return json({success:false,error:'The invoice PDF is too large to archive.'});
  const decoded=Utilities.base64Decode(file.data);
  if(decoded.length<4||decoded[0]!==37||decoded[1]!==80||decoded[2]!==68||decoded[3]!==70)return json({success:false,error:'The archived invoice is not a valid PDF file.'});
  const registrationFolder=getRegistrationFolder(resources.recordsFolder,referenceId);
  const invoiceFolder=getOrCreateSubfolder(registrationFolder,INVOICES_FOLDER);
  const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Colombo','yyyyMMdd_HHmmss_SSS');
  const name='NEW2AN2026_Proforma_'+referenceId+'_'+stamp+'_'+Utilities.getUuid().slice(0,8)+'.pdf';
  const saved=invoiceFolder.createFile(Utilities.newBlob(decoded,'application/pdf',name));
  cache.put(rateKey,String(archiveCount+1),3600);
  return json({success:true,referenceId:referenceId,fileName:saved.getName(),fileUrl:saved.getUrl(),registrationFolderUrl:registrationFolder.getUrl()});
}

function savePaymentProofs(registrationFolder,uploads){
  if(!Array.isArray(uploads)||!uploads.length)return [];
  const folder=getOrCreateSubfolder(registrationFolder,PAYMENT_PROOFS_FOLDER);
  const created=[];
  try {
    uploads.forEach(function(file,index){
      const safeName=clean(file.name,120).replace(/[^A-Za-z0-9._-]/g,'_')||('proof_'+(index+1));
      const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Colombo','yyyyMMdd_HHmmss_SSS');
      const blob=Utilities.newBlob(Utilities.base64Decode(file.data),file.mimeType,'payment_proof_'+stamp+'_'+(index+1)+'_'+Utilities.getUuid().slice(0,8)+'_'+safeName);
      created.push(folder.createFile(blob));
    });
    return created.map(function(file){return file.getUrl();});
  } catch(error) {
    created.forEach(function(file){try{file.setTrashed(true);}catch(_){}});
    throw error;
  }
}

function validateTravelUpload(file){
  if(!file||!file.data)return 'The passport bio-page file is unreadable.';
  if(ALLOWED_UPLOAD_MIME.indexOf(String(file.mimeType||''))<0)return 'The passport bio page must be a PDF, JPEG, PNG or WebP file.';
  if(Math.ceil(String(file.data).length*3/4)>MAX_UPLOAD_BYTES)return 'The passport bio-page file must be 5 MB or smaller.';
  return '';
}

function saveTravelDocuments(registrationFolder,uploads){
  if(!Array.isArray(uploads)||!uploads.length)return [];
  const folder=getOrCreateSubfolder(registrationFolder,TRAVEL_DOCUMENTS_FOLDER),created=[];
  try{
    uploads.forEach(function(file,index){
      const safeName=clean(file.name,120).replace(/[^A-Za-z0-9._-]/g,'_')||('passport_bio_page_'+(index+1));
      const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Colombo','yyyyMMdd_HHmmss_SSS');
      const blob=Utilities.newBlob(Utilities.base64Decode(file.data),file.mimeType,'passport_bio_page_'+stamp+'_'+Utilities.getUuid().slice(0,8)+'_'+safeName);
      created.push(folder.createFile(blob));
    });
    return created.map(function(file){return file.getUrl();});
  }catch(error){created.forEach(function(file){try{file.setTrashed(true);}catch(_){} });throw error;}
}

function saveRecordFile(registrationFolder,data) {
  const name='registration.json', files=registrationFolder.getFilesByName(name), body=JSON.stringify(data,null,2);
  if(files.hasNext()){const file=files.next();file.setContent(body);return file.getUrl();}
  return registrationFolder.createFile(name,body,MimeType.PLAIN_TEXT).getUrl();
}

function registrationPriceFor(date,category){
  const early=date<=EARLY_DEADLINE,local=String(category||'').indexOf('LK_')===0,sriLankanAuthorLate=category==='LK_AUTHOR'&&!early;
  return {
    amount:local?(sriLankanAuthorLate?50000:40000):(early?400:500),
    currency:local?'LKR':'EUR',
    feeBasis:local?(sriLankanAuthorLate?'SRI_LANKAN_AUTHOR_LATE_25_PERCENT_SURCHARGE':'SRI_LANKAN_AFFILIATION_PUBLISHED_FEE'):(early?'INTERNATIONAL_EARLY':'INTERNATIONAL_LATE')
  };
}
function feeFor(date,category){return registrationPriceFor(date,category||'INT_AUTHOR').amount;}
function roundMoney(value){return Math.round(Number(value)*100)/100;}
function roundRate(value){return Math.round(Number(value)*1000000)/1000000;}
function makeReferenceId(){return 'NEW2AN2026-'+Utilities.getUuid().replace(/-/g,'').slice(0,9).toUpperCase();}
function editTokenSecret(){
  const props=PropertiesService.getScriptProperties();let secret=props.getProperty('EDIT_TOKEN_SECRET');
  if(!secret){secret=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();props.setProperty('EDIT_TOKEN_SECRET',secret);}
  return secret;
}
function issueEditToken(referenceId,email){
  const payload=[referenceId,String(email).toLowerCase(),Date.now()+2*60*60*1000].join('|');
  const encoded=Utilities.base64EncodeWebSafe(payload,Utilities.Charset.UTF_8).replace(/=+$/,'');
  const signature=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded,editTokenSecret())).replace(/=+$/,'');
  return encoded+'.'+signature;
}
function verifyEditToken(token,referenceId,email){
  try{
    const parts=String(token||'').split('.');if(parts.length!==2)return false;
    const expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0],editTokenSecret())).replace(/=+$/,'');
    if(expected!==parts[1])return false;
    const payload=Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString().split('|');
    return payload[0]===referenceId&&payload[1]===String(email).toLowerCase()&&Number(payload[2])>=Date.now();
  }catch(_){return false;}
}
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
  editTokenSecret();
  return{success:true,mainFolderName:folder.getName(),mainFolderId:folder.getId(),mainFolderUrl:folder.getUrl(),spreadsheetName:resources.sheet.getParent().getName(),spreadsheetUrl:resources.sheet.getParent().getUrl(),sheetTab:resources.sheet.getName(),registrationFoldersRoot:resources.recordsFolder.getName(),invoiceSubfolder:INVOICES_FOLDER,paymentProofSubfolder:PAYMENT_PROOFS_FOLDER,travelDocumentsSubfolder:TRAVEL_DOCUMENTS_FOLDER,headers:HEADERS.length};
}
