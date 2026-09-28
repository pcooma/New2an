'use strict';

const TRAVEL_CONFIG=Object.freeze({
  apiUrl:'https://script.google.com/macros/s/AKfycbxW-RbC28FXkOlnrwYU2s4UE-YI7UsauUqTUUKoGunyZgdHGAwgyYug6NIkhEPnqS0J/exec',
  maxFileBytes:5*1024*1024,
  acceptedTypes:Object.freeze(['application/pdf','image/jpeg','image/png','image/webp'])
});
const travelForm=document.getElementById('travel-form');
const loadMessage=document.getElementById('travel-load-message');
const submitMessage=document.getElementById('travel-message');
let editToken='',currentReference='',passportFile=null,passportOnFile=false;

async function travelApi(body,query=''){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(`${TRAVEL_CONFIG.apiUrl}${query}`,body?{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:controller.signal}:{signal:controller.signal});
    const result=await response.json();
    if(!result.success)throw new Error(result.error||'The request could not be completed.');
    return result;
  }finally{clearTimeout(timer);}
}

function showMessage(node,text,type=''){
  node.textContent=text;node.className=`form-message${type?` ${type}`:''}`;
}

function setField(name,value){
  const field=travelForm.elements.namedItem(name);if(!field)return;
  if(field instanceof RadioNodeList){const match=Array.from(field).find(item=>item.value===String(value||''));if(match)match.checked=true;return;}
  field.value=value??'';
}

function restoreTravel(data){
  ['Email','Ticket_Departure_City_Airport','Preferred_Departure_Home_Date','Preferred_Arrival_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Time','Ticket_Destination_City_Airport','Passport_Number','Date_of_Birth','Passport_Issue_Date','Passport_Expiry_Date','Place_Country_of_Birth'].forEach(key=>setField(key,data[key]));
  document.getElementById('loaded-participant').textContent=data.Full_Name||'Registered participant';
  document.getElementById('reused-identity').textContent=[data.Passport_Name||data.Full_Name,data.Nationality,data.Designation,data.Organization].filter(Boolean).join(' · ');
  passportOnFile=data.Passport_Bio_Page_Base64==='(uploaded — see folder)';
  updatePassportStatus();
}

function updatePassportStatus(){
  const node=document.getElementById('passport-file-status');
  node.textContent=passportFile?`${passportFile.name} · ${(passportFile.size/1024/1024).toFixed(2)} MB selected.`:(passportOnFile?'A passport bio page is already stored. Choose a file only to add a replacement version.':'No passport file selected.');
}

function fileToPayload(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,mimeType:file.type,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(new Error(`Could not read ${file.name}.`));reader.readAsDataURL(file);});
}

document.getElementById('travel-load').addEventListener('click',async()=>{
  const button=document.getElementById('travel-load'),ref=document.getElementById('travel-reference').value.trim().toUpperCase(),email=document.getElementById('travel-email').value.trim().toLowerCase();
  if(!ref||!email){showMessage(loadMessage,'Enter both the registration reference and email.','error');return;}
  button.disabled=true;showMessage(loadMessage,'Checking your registration…');
  try{
    const result=await travelApi(null,`?action=getRegistration&ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
    if(result.data.Excursion_Interest!=='Yes')throw new Error('This follow-up is only for participants who selected Yes for the excursion. Update your main registration first.');
    const flightRequested=result.data.Travel_Agency_Assistance==='Yes — flight options'||result.data.Travel_Agency_Assistance==='Yes — flights and transfer';
    if(!flightRequested)throw new Error('Your registration does not request organiser flight assistance, so no additional passport or ticket details are needed.');
    currentReference=ref;editToken=result.editToken||'';document.getElementById('loaded-reference').textContent=ref;restoreTravel(result.data);travelForm.hidden=false;
    showMessage(loadMessage,'Registration verified. Complete or review the details below.','success');travelForm.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){travelForm.hidden=true;showMessage(loadMessage,error.name==='AbortError'?'The server took too long to respond. Please retry.':error.message,'error');}
  finally{button.disabled=false;}
});

document.getElementById('passport-file').addEventListener('change',event=>{
  const file=event.target.files[0]||null;
  if(file&&(!TRAVEL_CONFIG.acceptedTypes.includes(file.type)||file.size>TRAVEL_CONFIG.maxFileBytes)){passportFile=null;event.target.value='';showMessage(submitMessage,'Passport bio page must be a PDF, JPEG, PNG or WebP file no larger than 5 MB.','error');}
  else{passportFile=file;showMessage(submitMessage,'');}
  updatePassportStatus();
});

travelForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!travelForm.reportValidity())return;
  if(!passportFile&&!passportOnFile){showMessage(submitMessage,'Upload the passport bio page before submitting an organiser-arranged ticket request.','error');document.getElementById('passport-file').focus();return;}
  if(travelForm.elements.Passport_Expiry_Date.value&&travelForm.elements.Passport_Issue_Date.value&&travelForm.elements.Passport_Expiry_Date.value<=travelForm.elements.Passport_Issue_Date.value){showMessage(submitMessage,'Passport expiry date must be after its issue date.','error');return;}
  const button=document.getElementById('travel-submit'),data={Reference_ID:currentReference,Email:travelForm.elements.Email.value};
  new FormData(travelForm).forEach((value,key)=>{data[key]=value;});
  data.Travel_Details_Consent=travelForm.elements.Travel_Details_Consent.checked;
  data.Passport_Bio_Page_Base64=passportFile?[await fileToPayload(passportFile)]:(passportOnFile?'(uploaded — see folder)':[]);
  button.disabled=true;button.textContent='Saving securely…';showMessage(submitMessage,'');
  try{
    const result=await travelApi({action:'submitTravelDetails',data,editToken});editToken=result.editToken||editToken;passportOnFile=result.passportOnFile;passportFile=null;document.getElementById('passport-file').value='';updatePassportStatus();showMessage(submitMessage,`Saved successfully against ${result.referenceId}. The organising team can now review your travel request.`,'success');
  }catch(error){showMessage(submitMessage,error.name==='AbortError'?'The server took too long to respond. Please retry; do not assume the details were saved.':error.message,'error');}
  finally{button.disabled=false;button.textContent='Save travel & excursion details';}
});
