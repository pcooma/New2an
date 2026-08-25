'use strict';

const extendedStyles = document.createElement('link');
extendedStyles.rel = 'stylesheet';
extendedStyles.href = 'extended.css?v=1';
document.head.appendChild(extendedStyles);

const CONFIG = Object.freeze({
  apiUrl: '', // Set to the NEW2AN Apps Script web-app URL after deployment.
  earlyDeadline: '2026-10-31T23:59:59+05:30',
  earlyFee: 400,
  lateFee: 500,
  currency: 'EUR',
  draftKey: 'new2an2026_registration_draft',
  tokenKey: 'new2an2026_admin_token'
});

const form = document.getElementById('registration-form');
const message = document.getElementById('form-message');
const paperCount = document.getElementById('paper-count');
const papers = document.getElementById('papers');
const role = document.getElementById('participant-role');
let submissions = [];
let adminToken = sessionStorage.getItem(CONFIG.tokenKey) || '';
let currentReferenceId = '';
let paymentProofFiles = [];
let paymentProofPreviouslyUploaded = false;
let workshopSettings = [{id:'seeing-through-ai-2026',title:'Seeing Through AI: Deep Learning for Computer Vision',date:'2026-07-21',time:'09:30–12:30',venue:'G906, New Building',fee:0,currency:'EUR',status:'completed',contact:'Mr. Amila Karunanayake, +94 77 443 9069'}];
let editingWorkshopIndex = -1;

function ensureOperationalFields() {
  const participantGrid = document.querySelector('#registration-form .form-section .grid.two');
  if (participantGrid && !form.elements.Certificate_Name) {
    participantGrid.insertAdjacentHTML('afterbegin', '<label>Name for badge and certificate<input name="Certificate_Name" placeholder="Leave blank to use your full name"></label>');
  }
  if (!form.elements.CMT_Changes) {
    papers.insertAdjacentHTML('afterend', '<label>Changes from the CMT submission<textarea name="CMT_Changes" rows="2" placeholder="Presenting-author, affiliation, title or other approved changes. Leave blank if none."></textarea></label>');
  }
  const visitConsent = form.elements.Travel_Data_Consent?.closest('label');
  if (visitConsent && !form.elements.Support_Category) {
    visitConsent.insertAdjacentHTML('beforebegin', '<div class="grid two"><label>Help request category<select name="Support_Category"><option value="">No separate request</option><option>Visa or invitation letter</option><option>Travel or airport transfer</option><option>Accommodation</option><option>Workshop</option><option>Excursion</option><option>Registration or payment</option><option>Technical problem</option><option>Other</option></select></label><label>Preferred reply method<select name="Support_Reply_Method"><option>Email</option><option>WhatsApp</option><option>Either email or WhatsApp</option></select></label></div><label>Question or follow-up request<textarea name="Support_Request" rows="2" placeholder="The team can review this in the admin support export. For urgent matters, use a verified organiser contact once published."></textarea></label>');
  }
}

ensureOperationalFields();

function clarifyParticipantCopy() {
  const setLabel = (name, text) => {
    const control = form.elements.namedItem(name);
    const label = control?.closest('label');
    const textNode = label && [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = `${text} `;
  };
  const setPlaceholder = (name, text) => { const control=form.elements.namedItem(name); if(control) control.placeholder=text; };
  document.querySelector('.intro .eyebrow').textContent = 'International participant registration';
  document.querySelector('.intro h2').textContent = 'Register for NEW2AN 2026';
  document.querySelector('.intro>div>p:last-child').textContent = 'Use this form to register for the conference and tell the organising team if you need help planning your visit to Sri Lanka. Travel, hotel, visa and excursion requests are not confirmed bookings.';
  document.querySelector('.lookup-card strong').textContent = 'Returning to your registration?';
  document.querySelector('.lookup-card span').textContent = 'Enter the reference ID issued by this form and the same email address you used previously.';
  setLabel('Full_Name','Full name as entered in your paper-submission record');
  setPlaceholder('Full_Name','For example, Prof. Maria Chen');
  setLabel('Certificate_Name','Name to print on your badge and certificate');
  setPlaceholder('Certificate_Name','Leave blank to use your full name above');
  setLabel('Phone','Mobile or WhatsApp number');
  setLabel('Country_of_Residence','Country where you currently live');
  setLabel('Attendance_Mode','How will you attend?');
  setLabel('CMT_Changes','Changes from your paper-submission record (CMT)');
  setPlaceholder('CMT_Changes','List any approved change to the presenter, paper title or affiliation. Leave blank if nothing changed.');
  setLabel('Workshop_Attendance','Did you attend the workshop held on 21 July 2026?');
  setLabel('Future_Workshop_Updates','Would you like email updates about any new workshops?');
  setLabel('Passport_Name','Full name exactly as shown in your passport');
  setLabel('Passport_Issuing_Country','Country that issued your passport');
  setLabel('Visa_Support','Do you need an invitation letter for your visa application?');
  setLabel('Travel_Agency_Assistance','Would you like the team to connect you with travel-booking assistance?');
  setLabel('Accommodation_Assistance','Would you like help finding or arranging a hotel?');
  setLabel('Room_Preference','Preferred room arrangement');
  const room=form.elements.Room_Preference;
  if(room){room.options[0].textContent='Not decided';room.options[1].textContent='Single room — one guest';room.options[2].textContent='Twin room — two separate beds';room.options[3].textContent='Double room — one bed for two guests';}
  setLabel('Arrival_Date','Expected arrival date in Sri Lanka');
  setLabel('Departure_Date','Expected departure date from Sri Lanka');
  setLabel('Arrival_Details','Arrival flight details');
  setPlaceholder('Arrival_Details','Flight number, arrival airport and local arrival time, if known');
  setLabel('Departure_Details','Departure flight details');
  setPlaceholder('Departure_Details','Flight number, departure airport and local departure time, if known');
  setLabel('Venue_Transport','How do you expect to travel between your hotel and the conference venue?');
  setLabel('Accessibility_Needs','Accessibility or mobility assistance you may need');
  setLabel('Emergency_Contact_Name','Emergency contact name');
  setLabel('Emergency_Contact_Phone','Emergency contact telephone number');
  setLabel('Visit_Notes','Other information about your travel, hotel or accompanying guests');
  setLabel('Support_Category','What do you need help with?');
  setLabel('Support_Reply_Method','How would you prefer us to reply?');
  setLabel('Support_Request','Your question or request');
  const eligibilityText=form.elements.International_Eligibility_Confirmed?.closest('label')?.querySelector('span');
  if(eligibilityText) eligibilityText.innerHTML='I confirm that I am not a Sri Lankan citizen and do not currently live in Sri Lanka. <b>*</b>';
  const travelConsentText=form.elements.Travel_Data_Consent?.closest('label')?.querySelector('span');
  if(travelConsentText) travelConsentText.textContent='If I request travel or hotel assistance, I allow the organising team to share only the necessary details with its approved service partner.';
  const excursionText=form.elements.Excursion_Acknowledgement?.closest('label')?.querySelector('span');
  if(excursionText) excursionText.textContent='I understand that expressing interest does not reserve a place. The team will send the final route, date, price, inclusions, insurance information and cancellation terms separately.';
  setLabel('Excursion_Interest','Would you like to join the planned conference excursion?');
  setLabel('Excursion_Participant_Count','Total number of excursion participants, including you');
  setLabel('Excursion_Participant_Names','Names of additional excursion participants');
  setLabel('Excursion_Group_Details','Who will travel with you?');
  setPlaceholder('Excursion_Group_Details','For example: partner, colleague or family member');
  setLabel('Excursion_Activity_Level','Walking and activity level your group can manage');
  setLabel('Excursion_Mobility_Needs','Mobility or accessibility assistance needed during the excursion');
  setLabel('Excursion_Dietary_Needs','Excursion meal allergies or dietary requirements');
  setLabel('Excursion_Guide_Language','Preferred language for the excursion guide');
  setLabel('Bill_To','Who should the pre-payment invoice be addressed to?');
  setLabel('Billing_Email','Email address for the invoice or finance office');
  setLabel('Billing_Address','Address to show on the invoice');
  setLabel('Purchase_Order','Purchase order number or tax reference, if required by your institution');
  setLabel('Additional_Info','Other billing information');
  setLabel('Payment_Stage','Current payment status');
  setLabel('Transaction_Reference','Bank or online payment reference');
  setLabel('Amount_Paid','Amount you paid');
  setLabel('Payment_Currency','Payment currency (fixed)');
  const paymentCurrency=form.elements.Payment_Currency;
  if(paymentCurrency){paymentCurrency.innerHTML='<option value="EUR">EUR — euro</option>';paymentCurrency.value='EUR';paymentCurrency.disabled=true;}
  document.querySelector('.proforma-box strong').textContent = 'Pre-payment invoice (proforma invoice)';
  document.getElementById('proforma-btn').textContent = 'Download pre-payment invoice PDF';
  document.getElementById('submit-btn').textContent = 'Send registration details';
  document.querySelector('#visit-section .section-heading p').textContent = 'Tell us what assistance you may need. These answers are planning requests only and do not confirm flights, airport transfers, hotels or visa approval.';
  document.querySelector('#excursion-section .section-heading p').textContent = 'The route, date and price have not been confirmed. Your answer helps the team estimate numbers and accessibility needs.';
  const workshop=document.querySelector('#workshop-section .section-heading p');
  if(workshop) workshop.textContent='Tell us whether you attended the workshop already held on 21 July 2026, and whether you want announcements about any new workshops.';
}

clarifyParticipantCopy();

function updatePublicWorkshopVisibility(hasOpenWorkshops) {
  const section=document.getElementById('workshop-section');
  section.hidden=!hasOpenWorkshops;
  section.querySelector('.past-event').hidden=true;
  section.querySelectorAll(':scope > .grid, :scope > label, :scope > .microcopy').forEach(element=>{
    element.hidden=true;
    element.querySelectorAll?.('input,select,textarea').forEach(control=>control.disabled=true);
  });
  const progress=document.querySelector('.progress');
  progress.innerHTML=hasOpenWorkshops
    ? '<span class="active">1 Participant</span><span>2 Papers</span><span>3 Workshops</span><span>4 Visit</span><span>5 Excursion</span><span>6 Payment</span>'
    : '<span class="active">1 Participant</span><span>2 Papers</span><span>3 Visit</span><span>4 Excursion</span><span>5 Payment</span>';
  progress.style.gridTemplateColumns=`repeat(${hasOpenWorkshops?6:5},1fr)`;
  document.querySelector('#visit-section .section-heading > span').textContent=hasOpenWorkshops?'04':'03';
  document.querySelector('#excursion-section .section-heading > span').textContent=hasOpenWorkshops?'05':'04';
  document.querySelector('#excursion-section + .form-section .section-heading > span').textContent=hasOpenWorkshops?'06':'05';
  if(hasOpenWorkshops) document.querySelector('#workshop-section .section-heading p').textContent='Select any pre-conference workshop you want to attend. Workshop registration is recorded with your conference registration.';
}

const onlineOption = Array.from(form.elements.Attendance_Mode.options).find(option => option.value === 'Online access');
if (onlineOption) onlineOption.textContent = 'Online participation — subject to organiser approval';
const paperNote = papers.nextElementSibling;
if (paperNote) paperNote.insertAdjacentHTML('beforeend', '<br><strong>Accepted authors:</strong> published pages also state that payment is required before camera-ready submission. Because the camera-ready and registration dates do not align, confirm your applicable payment deadline with new2an@crisglobal.org.');
updatePublicWorkshopVisibility(false);

function currentFee(now = new Date()) {
  return now <= new Date(CONFIG.earlyDeadline) ? CONFIG.earlyFee : CONFIG.lateFee;
}

function refreshFee() {
  const fee = currentFee();
  const early = fee === CONFIG.earlyFee;
  document.getElementById('fee-amount').textContent = fee;
  document.querySelector('#fee-summary strong span').textContent = fee;
  document.getElementById('fee-label').textContent = early ? 'Early registration fee' : 'Late registration fee';
  document.getElementById('fee-deadline').textContent = early ? 'Available through 31 October 2026' : 'Applicable after 31 October 2026';
}

function renderPapers() {
  const count = Number(paperCount.value || 0);
  papers.innerHTML = Array.from({length: count}, (_, i) => `<div class="paper-card"><h4>Accepted paper ${i + 1}</h4><div class="grid two"><label>Paper-submission ID (CMT ID) <b>*</b><input name="Paper_${i + 1}_ID" required placeholder="For example, 195"></label><label>Full paper title <b>*</b><input name="Paper_${i + 1}_Title" required></label></div><label class="check"><input type="checkbox" name="Paper_${i + 1}_Presenter" required><span>I confirm that I will present this paper at NEW2AN 2026. <b>*</b></span></label></div>`).join('');
}

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function toObject(targetForm) {
  const data = {};
  new FormData(targetForm).forEach((value, key) => { data[key] = value; });
  targetForm.querySelectorAll('input[type="checkbox"]').forEach(el => { data[el.name] = el.checked; });
  data.Registration_Fee = currentFee();
  data.Currency = CONFIG.currency;
  data.Payment_Currency = CONFIG.currency;
  data.Payment_Status = 'AWAITING_INSTRUCTIONS';
  data.Form_Schema_Version = 1;
  data.Workshop_Selections = Array.from(document.querySelectorAll('.future-workshop-choice:checked')).map(el => el.value).join(' | ');
  if (currentReferenceId) data.Reference_ID = currentReferenceId;
  return data;
}

function validateBusinessRules(data) {
  if (/^sri\s*lanka$/i.test(data.Country_of_Residence.trim()) || /^sri\s*lankan$/i.test(data.Nationality.trim()) || !data.International_Eligibility_Confirmed) return 'This registration form is for participants who are not Sri Lankan citizens and do not live in Sri Lanka.';
  if (data.Participant_Role === 'Author / presenting author' && Number(data.Paper_Count) < 1) return 'Presenting authors must enter at least one accepted paper.';
  if (Number(data.Paper_Count) > 0 && data.Participant_Role !== 'Author / presenting author') return 'Select “Author / presenting author” when associating accepted papers.';
  const assistance = [data.Travel_Agency_Assistance, data.Accommodation_Assistance].some(v => v && v !== 'No' && v !== 'Not sure yet');
  if (assistance && !data.Travel_Data_Consent) return 'To request travel or hotel assistance, please allow the organising team to share the necessary details with its approved service partner.';
  if (data.Arrival_Date && data.Departure_Date && data.Departure_Date < data.Arrival_Date) return 'Departure date cannot be earlier than arrival date.';
  if (String(data.Visa_Support || '').startsWith('Yes') && (!data.Passport_Name.trim() || !data.Passport_Issuing_Country.trim())) return 'To request a visa invitation letter, enter your name exactly as shown in your passport and the country that issued it.';
  if (data.Attendance_Mode === 'In person in Colombo' && data.Excursion_Interest !== 'No') {
    const count = Number(data.Excursion_Participant_Count);
    if (!Number.isInteger(count) || count < 1 || count > 10) return 'Enter a valid excursion participant count from 1 to 10.';
    if (count > 1 && !data.Excursion_Participant_Names.trim()) return 'Enter the names of everyone joining the excursion with you.';
    if (!data.Excursion_Acknowledgement) return 'Please acknowledge that the excursion details and price are still provisional.';
  }
  if (data.Payment_Stage !== 'NOT_PAID') {
    if (!data.Transaction_Reference.trim()) return 'Enter the reference number shown on your bank-transfer receipt or online payment confirmation.';
    if (!(Number(data.Amount_Paid) > 0)) return 'Enter the amount paid.';
    if (!paymentProofFiles.length && !paymentProofPreviouslyUploaded) return 'Upload proof of payment or the gateway receipt.';
  }
  return '';
}

async function api(payload, query = '') {
  if (!CONFIG.apiUrl) throw new Error('The NEW2AN Google backend has not been deployed yet. Your draft remains safely on this device.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = query
      ? await fetch(`${CONFIG.apiUrl}${query}`, {signal: controller.signal})
      : await fetch(CONFIG.apiUrl, {method:'POST', body:JSON.stringify(payload), signal:controller.signal});
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}.`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'The request was not accepted.');
    return result;
  } finally { clearTimeout(timer); }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('');
  if (!form.reportValidity()) { setMessage('Please complete the highlighted required fields.', 'error'); return; }
  const data = toObject(form);
  const issue = validateBusinessRules(data);
  if (issue) { setMessage(issue, 'error'); return; }
  const button = document.getElementById('submit-btn');
  button.disabled = true; button.textContent = 'Saving securely…';
  try {
    if (!currentReferenceId) currentReferenceId = makeReferenceId();
    data.Reference_ID = currentReferenceId;
    data.Payment_Proof_Base64 = paymentProofFiles.length ? await Promise.all(paymentProofFiles.map(fileToBase64)) : (paymentProofPreviouslyUploaded ? '(uploaded — see folder)' : []);
    const result = await api({action:'submitRegistration', data});
    localStorage.removeItem(CONFIG.draftKey);
    localStorage.setItem('new2an2026_last_reference', JSON.stringify({referenceId:result.referenceId,email:data.Email}));
    setMessage(`Registration saved. Your reference is ${result.referenceId}. Payment instructions will follow when officially approved.`, 'success');
  } catch (error) { setMessage(error.name === 'AbortError' ? 'The server took too long to respond. Please retry; your draft is preserved.' : error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Send registration details'; }
});

let draftTimer;
form.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => localStorage.setItem(CONFIG.draftKey, JSON.stringify(toObject(form))), 300); });

function restore(data) {
  if (data && data.Reference_ID) {
    currentReferenceId = String(data.Reference_ID);
    document.getElementById('reference-display').textContent = `Reference ID: ${currentReferenceId}`;
  }
  Object.entries(data || {}).forEach(([name, value]) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value === true || value === 'true'; else el.value = value ?? '';
  });
  renderPapers();
  Object.entries(data || {}).filter(([key]) => /^Paper_[12]_/.test(key)).forEach(([name,value]) => { const el=form.elements.namedItem(name); if(el){if(el.type==='checkbox')el.checked=value===true||value==='true';else el.value=value;} });
  const workshopIds=String(data && data.Workshop_Selections || '').split(' | ').filter(Boolean);
  document.querySelectorAll('.future-workshop-choice').forEach(el => {el.checked=workshopIds.includes(el.value);});
  if (data && data.Payment_Proof_Base64 === '(uploaded — see folder)') paymentProofPreviouslyUploaded = true;
  updateAttendanceVisibility();
  renderProofList();
}

function makeReferenceId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `NEW2AN2026-${Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('').slice(0,9).toUpperCase()}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({name:file.name,mimeType:file.type,data:String(reader.result).split(',')[1]});
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function updateExcursionVisibility() {
  const interested = document.getElementById('excursion-interest').value !== 'No';
  document.getElementById('excursion-details').hidden = !interested;
  document.getElementById('excursion-count').disabled = !interested;
  if (!interested) form.elements.Excursion_Acknowledgement.checked = false;
}

function updateAttendanceVisibility() {
  const travelling = form.elements.Attendance_Mode.value !== 'Online access';
  ['visit-section','excursion-section'].forEach(id => {
    const section=document.getElementById(id); section.hidden=!travelling;
    section.querySelectorAll('input,select,textarea').forEach(el => { el.disabled=!travelling; });
  });
  if (travelling) updateExcursionVisibility();
}

function renderProofList() {
  const box = document.getElementById('proof-list');
  if (!paymentProofFiles.length) { box.textContent = paymentProofPreviouslyUploaded ? 'Previously uploaded proof will be retained.' : 'No proof selected.'; return; }
  box.textContent = paymentProofFiles.map(f => `${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`).join(' · ');
}

function renderWorkshopChoices() {
  let host=document.getElementById('future-workshop-list');
  if(!host){host=document.createElement('div');host.id='future-workshop-list';document.querySelector('#workshop-section .past-event').after(host);}
  const available=workshopSettings.filter(w=>w.status==='open');
  updatePublicWorkshopVisibility(available.length>0);
  host.innerHTML=available.length?`<div class="future-events"><h4>Additional workshops open for registration</h4>${available.map(w=>`<label class="check event-choice"><input type="checkbox" class="future-workshop-choice" value="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.title)}</strong><small>${escapeHtml(w.date)} · ${escapeHtml(w.time||'Time TBA')} · ${escapeHtml(w.venue||'Venue TBA')} · ${Number(w.fee)===0?'Free':`${escapeHtml(w.currency)} ${Number(w.fee).toFixed(2)}`}</small></span></label>`).join('')}</div>`:'<p class="microcopy">No additional workshop is currently open. Select future-workshop notifications to receive official announcements.</p>';
}

async function loadWorkshopSettings(){
  if(!CONFIG.apiUrl){renderWorkshopChoices();renderWorkshopAdmin();return;}
  try{const result=await api(null,'?action=getWorkshops');workshopSettings=result.workshops||workshopSettings;}catch(_){}
  renderWorkshopChoices();renderWorkshopAdmin();
}

function ensureWorkshopAdmin(){
  const panel=document.getElementById('admin-panel');
  if(document.getElementById('workshop-admin'))return;
  const section=document.createElement('section');section.id='workshop-admin';section.className='workshop-admin';
  section.innerHTML=`<div class="section-heading"><span>W</span><div><h3>Workshop manager</h3><p>Add future workshops as draft, open, closed or completed. Only open workshops appear as selectable options.</p></div></div><div id="workshop-admin-list"></div><div class="grid two"><label>Title<input id="ws-title"></label><label>Date<input id="ws-date" type="date"></label><label>Time<input id="ws-time" placeholder="09:30–12:30"></label><label>Venue<input id="ws-venue"></label><label>Fee<input id="ws-fee" type="number" min="0" step="0.01" value="0"></label><label>Currency<input id="ws-currency" value="EUR"></label><label>Status<select id="ws-status"><option>draft</option><option>open</option><option>closed</option><option>completed</option></select></label><label>Coordinator / contact<input id="ws-contact"></label></div><div class="admin-actions"><button type="button" id="ws-add" class="btn secondary">Add workshop</button><button type="button" id="ws-save" class="btn primary">Save workshop settings</button></div><p id="ws-message" class="form-message"></p>`;
  panel.insertBefore(section,panel.querySelector('.table-wrap'));
  document.getElementById('ws-add').addEventListener('click',upsertWorkshopDraft);
  document.getElementById('ws-save').addEventListener('click',saveWorkshopSettings);
  document.getElementById('workshop-admin-list').addEventListener('click',event=>{const index=Number(event.target.dataset.edit);if(Number.isInteger(index))editWorkshop(index);});
}

function renderWorkshopAdmin(){
  ensureWorkshopAdmin();
  document.getElementById('workshop-admin-list').innerHTML=workshopSettings.map((w,i)=>`<div class="admin-workshop-row"><div><strong>${escapeHtml(w.title)}</strong><span>${escapeHtml(w.date)} · ${escapeHtml(w.status)} · ${Number(w.fee)===0?'Free':`${escapeHtml(w.currency)} ${Number(w.fee).toFixed(2)}`}</span></div><button type="button" class="btn secondary" data-edit="${i}">Edit</button></div>`).join('');
}

function editWorkshop(index){
  editingWorkshopIndex=index;const w=workshopSettings[index];
  ['title','date','time','venue','fee','currency','status','contact'].forEach(key=>{document.getElementById(`ws-${key}`).value=w[key]??'';});
  document.getElementById('ws-add').textContent='Update workshop';
}

function upsertWorkshopDraft(){
  const value=id=>document.getElementById(id).value.trim();
  const title=value('ws-title'),date=value('ws-date');
  if(!title||!date){document.getElementById('ws-message').textContent='Title and date are required.';return;}
  const row={id:(editingWorkshopIndex>=0?workshopSettings[editingWorkshopIndex].id:`${date}-${title}`).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),title,date,time:value('ws-time'),venue:value('ws-venue'),fee:Number(value('ws-fee')||0),currency:value('ws-currency')||'EUR',status:value('ws-status'),contact:value('ws-contact')};
  if(editingWorkshopIndex>=0)workshopSettings[editingWorkshopIndex]=row;else workshopSettings.push(row);
  editingWorkshopIndex=-1;document.getElementById('ws-add').textContent='Add workshop';renderWorkshopAdmin();renderWorkshopChoices();
  ['ws-title','ws-date','ws-time','ws-venue','ws-contact'].forEach(id=>document.getElementById(id).value='');
}

async function saveWorkshopSettings(){
  const box=document.getElementById('ws-message');
  try{const result=await api({action:'saveWorkshops',token:adminToken,workshops:workshopSettings});workshopSettings=result.workshops;renderWorkshopAdmin();renderWorkshopChoices();box.textContent='Workshop settings saved.';box.className='form-message success';}
  catch(error){box.textContent=error.message;box.className='form-message error';}
}

document.getElementById('excursion-interest').addEventListener('change', updateExcursionVisibility);
form.elements.Attendance_Mode.addEventListener('change', updateAttendanceVisibility);
document.getElementById('payment-proof').addEventListener('change', event => {
  const allowed = ['application/pdf','image/jpeg','image/png','image/webp'];
  const selected = Array.from(event.target.files || []);
  if (selected.length > 3) { setMessage('Upload no more than three proof files.', 'error'); event.target.value=''; return; }
  const invalid = selected.find(f => !allowed.includes(f.type) || f.size > 5 * 1024 * 1024);
  if (invalid) { setMessage(`${invalid.name} must be a PDF, JPEG, PNG or WebP file no larger than 5 MB.`, 'error'); event.target.value=''; return; }
  paymentProofFiles = selected;
  paymentProofPreviouslyUploaded = false;
  renderProofList();
});

document.getElementById('proforma-btn').addEventListener('click', generateProforma);

function generateProforma() {
  const required = ['Title','Full_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Participant_Role','Attendance_Mode','Bill_To','Billing_Address'];
  const missing = required.map(name => form.elements[name]).find(el => !el || !String(el.value).trim());
  if (missing) { missing.focus(); setMessage('Complete the required participant, paper and billing fields before downloading the pre-payment invoice.', 'error'); return; }
  if (role.value === 'Author / presenting author' && Number(paperCount.value) < 1) { setMessage('Presenting authors must enter at least one accepted paper.', 'error'); return; }
  for (let i=1;i<=Number(paperCount.value);i++) if (!form.elements[`Paper_${i}_ID`]?.value.trim() || !form.elements[`Paper_${i}_Title`]?.value.trim()) { setMessage(`Complete the ID and title for paper ${i}.`, 'error'); return; }
  if (!window.jspdf) { setMessage('The PDF library is unavailable. Check your connection and retry.', 'error'); return; }
  if (!currentReferenceId) currentReferenceId = makeReferenceId();
  document.getElementById('reference-display').textContent = `Reference ID: ${currentReferenceId}`;
  const data = toObject(form);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const left=18, right=192;
  doc.setFillColor(9,35,60); doc.rect(0,0,210,35,'F');
  doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.text('NEW2AN 2026',left,16);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.text('PROFORMA INVOICE',left,25); doc.text('15-17 December 2026 | Colombo, Sri Lanka',right,25,{align:'right'});
  doc.setTextColor(23,39,51); doc.setFontSize(10); let y=48;
  const line=(label,value)=>{doc.setFont('helvetica','bold');doc.text(label,left,y);doc.setFont('helvetica','normal');const wrapped=doc.splitTextToSize(String(value||'-'),128);doc.text(wrapped,60,y);y+=Math.max(7,wrapped.length*5);};
  line('Reference',currentReferenceId); line('Issue date',new Date().toLocaleDateString('en-GB')); line('Participant',`${data.Title} ${data.Full_Name}`); line('Email',data.Email); line('Organisation',data.Organization); line('Bill to',data.Bill_To); line('Billing address',data.Billing_Address);
  y+=5; doc.setDrawColor(205,218,222);doc.line(left,y,right,y);y+=10;
  doc.setFont('helvetica','bold');doc.text('Description',left,y);doc.text('Amount',right,y,{align:'right'});y+=7;doc.setFont('helvetica','normal');doc.text('Full NEW2AN registration - three conference days',left,y);doc.text(`EUR ${currentFee().toFixed(2)}`,right,y,{align:'right'});y+=6;doc.setFontSize(8);doc.text('Includes online session access and digital Springer LNCS proceedings.',left,y);y+=10;doc.line(left,y,right,y);y+=9;doc.setFontSize(12);doc.setFont('helvetica','bold');doc.text('TOTAL',left,y);doc.text(`EUR ${currentFee().toFixed(2)}`,right,y,{align:'right'});
  y+=18;doc.setFontSize(9);doc.setFont('helvetica','normal');const notes=['This is a proforma invoice, not a payment receipt or tax invoice.','Registration is complete only after successful payment confirmation by NEW2AN.','Excursion, travel, accommodation, visa, insurance and personal costs are not included.','Use the reference above consistently during registration and payment.','Official payment contact: new2an@crisglobal.org'];notes.forEach(note=>{doc.text(note,left,y);y+=6;});
  doc.setTextColor(100);doc.setFontSize(8);doc.text('System generated. No signature required.',left,286);doc.save(`NEW2AN2026_Proforma_${currentReferenceId}.pdf`);
  localStorage.setItem('new2an2026_last_reference',JSON.stringify({referenceId:currentReferenceId,email:data.Email}));
  setMessage(`Pre-payment invoice downloaded. Keep reference ID ${currentReferenceId}; you will need it for payment and to reopen this registration.`, 'success');
}

paperCount.addEventListener('change', renderPapers);
role.addEventListener('change', () => { if (role.value !== 'Author / presenting author' && Number(paperCount.value)) { paperCount.value = '0'; renderPapers(); } });

document.getElementById('lookup-btn').addEventListener('click', async () => {
  const ref = document.getElementById('lookup-ref').value.trim();
  const email = document.getElementById('lookup-email').value.trim();
  if (!ref || !email) { setMessage('Enter both the reference ID and registration email.', 'error'); return; }
  try { const result = await api(null, `?action=getRegistration&ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`); restore(result.data); setMessage(`Loaded ${ref}.`, 'success'); form.scrollIntoView({behavior:'smooth'}); }
  catch(error) { setMessage(error.message, 'error'); }
});

document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x === button));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById(`${button.dataset.view}-view`).classList.add('active');
  if (button.dataset.view === 'dashboard' && adminToken) loadSubmissions();
}));

document.getElementById('login-btn').addEventListener('click', async () => {
  const loginMessage = document.getElementById('login-message');
  try {
    const result = await api({action:'adminLogin', email:document.getElementById('admin-email').value.trim(), password:document.getElementById('admin-password').value});
    adminToken = result.token; sessionStorage.setItem(CONFIG.tokenKey, adminToken); loginMessage.textContent = '';
    document.getElementById('login-panel').hidden = true; document.getElementById('admin-panel').hidden = false; await loadSubmissions();
  } catch(error) { loginMessage.textContent = error.message; loginMessage.className = 'form-message error'; }
});

async function loadSubmissions() {
  try {
    const result = await api(null, `?action=getSubmissions&token=${encodeURIComponent(adminToken)}`); submissions = result.submissions || [];
    document.getElementById('login-panel').hidden = true; document.getElementById('admin-panel').hidden = false; renderDashboard();
  } catch(error) { sessionStorage.removeItem(CONFIG.tokenKey); adminToken=''; document.getElementById('login-panel').hidden=false; document.getElementById('admin-panel').hidden=true; }
}

function renderDashboard() {
  const inPerson = submissions.filter(r => r.Attendance_Mode === 'In person in Colombo').length;
  const travel = submissions.filter(r => String(r.Travel_Agency_Assistance || '').startsWith('Yes')).length;
  const hotels = submissions.filter(r => String(r.Accommodation_Assistance || '').startsWith('Yes')).length;
  const support = submissions.filter(r => String(r.Support_Request || '').trim()).length;
  const excursion = submissions.filter(r => r.Excursion_Interest === 'Yes').reduce((sum,r)=>sum+(Number(r.Excursion_Participant_Count)||0),0);
  document.getElementById('metrics').innerHTML = [['Registrations',submissions.length],['In person',inPerson],['Travel help',travel],['Hotel help',hotels],['Support requests',support],['Payment proofs',submissions.filter(r=>r.Payment_Status==='PROOF_SUBMITTED').length],['Excursion pax',excursion]].map(([label,value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  const columns = ['Submission_Date','Reference_ID','Full_Name','Email','Country_of_Residence','Participant_Role','Paper_Count','Workshop_Attendance','Future_Workshop_Updates','Attendance_Mode','Registration_Fee','Payment_Status','Transaction_Reference','Excursion_Interest','Excursion_Participant_Count','Travel_Agency_Assistance','Accommodation_Assistance'];
  document.getElementById('table-head').innerHTML = `<tr>${columns.map(c=>`<th>${c.replaceAll('_',' ')}</th>`).join('')}</tr>`;
  document.getElementById('table-body').innerHTML = submissions.map(row => `<tr>${columns.map(c=>`<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`).join('');
}

function escapeHtml(value) { const node=document.createElement('div'); node.textContent=String(value); return node.innerHTML; }
document.getElementById('refresh-btn').addEventListener('click', loadSubmissions);
document.getElementById('export-btn').addEventListener('click', () => {
  if (!submissions.length) return;
  if (!window.XLSX) { alert('Excel library is unavailable. Please check your connection and retry.'); return; }
  const book=XLSX.utils.book_new();
  const add=(name,rows)=>XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),name);
  const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]??'']));
  add('Registrations',submissions);
  add('Certificates',submissions.map(r=>pick(r,['Reference_ID','Full_Name','Certificate_Name','Title','Organization','Designation','Email'])));
  add('Meals',submissions.filter(r=>r.Attendance_Mode==='In person in Colombo').map(r=>pick(r,['Reference_ID','Full_Name','Organization','Dietary_Preference','Excursion_Interest','Excursion_Dietary_Needs','Visit_Notes'])));
  add('Travel Logistics',submissions.filter(r=>r.Attendance_Mode==='In person in Colombo').map(r=>pick(r,['Reference_ID','Full_Name','Phone','Arrival_Date','Arrival_Details','Departure_Date','Departure_Details','Travel_Agency_Assistance','Venue_Transport','Visa_Support','Accessibility_Needs','Emergency_Contact_Name','Emergency_Contact_Phone'])));
  add('Accommodation',submissions.filter(r=>r.Accommodation_Assistance&&r.Accommodation_Assistance!=='No').map(r=>pick(r,['Reference_ID','Full_Name','Email','Phone','Accommodation_Assistance','Room_Preference','Arrival_Date','Departure_Date','Visit_Notes'])));
  add('Excursion',submissions.filter(r=>r.Excursion_Interest&&r.Excursion_Interest!=='No').map(r=>pick(r,['Reference_ID','Full_Name','Phone','Excursion_Interest','Excursion_Participant_Count','Excursion_Participant_Names','Excursion_Group_Details','Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language'])));
  add('Workshops',submissions.map(r=>pick(r,['Reference_ID','Full_Name','Email','Workshop_Attendance','Workshop_Selections','Future_Workshop_Updates','Workshop_Notes'])));
  add('Payments',submissions.map(r=>pick(r,['Reference_ID','Full_Name','Email','Registration_Fee','Currency','Payment_Stage','Payment_Status','Transaction_Reference','Amount_Paid','Payment_Currency','Payment_Proof_Files'])));
  add('Support Requests',submissions.filter(r=>r.Support_Request||r.Support_Category).map(r=>pick(r,['Reference_ID','Full_Name','Email','Phone','Country_of_Residence','Support_Category','Support_Reply_Method','Support_Request','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance'])));
  XLSX.writeFile(book,`NEW2AN_2026_Operations_${new Date().toISOString().slice(0,10)}.xlsx`);
});

refreshFee(); renderPapers(); updateAttendanceVisibility(); renderProofList(); ensureWorkshopAdmin(); loadWorkshopSettings();
const savedDraft = localStorage.getItem(CONFIG.draftKey); if (savedDraft) { try { restore(JSON.parse(savedDraft)); } catch (_) {} }
