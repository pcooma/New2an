'use strict';

const extendedStyles = document.createElement('link');
extendedStyles.rel = 'stylesheet';
extendedStyles.href = 'extended.css?v=5';
document.head.appendChild(extendedStyles);

const CONFIG = Object.freeze({
  apiUrl: 'https://script.google.com/macros/s/AKfycbxW-RbC28FXkOlnrwYU2s4UE-YI7UsauUqTUUKoGunyZgdHGAwgyYug6NIkhEPnqS0J/exec',
  earlyDeadline: '2026-10-31T23:59:59+05:30',
  earlyFee: 400,
  lateFee: 500,
  sriLankanEarlyFee: 40000,
  sriLankanLateFee: 50000,
  excursionFeeUsd: 50,
  paymentLinks: Object.freeze({
    LK_AUTHOR: 'https://payhere.lk/pay/ob0887ec5',
    LK_NON_AUTHOR: 'https://payhere.lk/pay/oc78f4e53',
    GALA_LK_AUTHOR: 'https://payhere.lk/pay/o573053c2',
    GALA_LK_NON_AUTHOR: 'https://payhere.lk/pay/o20376354'
  }),
  draftKey: 'new2an2026_registration_draft',
  tokenKey: 'new2an2026_admin_token'
});
const REGISTRATION_CATEGORIES = Object.freeze(['INT_AUTHOR','INT_NON_AUTHOR','LK_AUTHOR','LK_NON_AUTHOR']);
const PARTICIPANT_ROLES = Object.freeze(['Author / presenting author','Non-author attendee','Industry professional']);
const DIETARY_PREFERENCES = Object.freeze(['Vegetarian','Non-vegetarian','Halal']);
const LEGACY_PARTICIPANT_ROLES = Object.freeze({'Non-author academic / researcher':'Non-author attendee','Invited or keynote speaker':'Non-author attendee','Committee member / chair':'Non-author attendee'});
const WHATSAPP_CONTACTS = Object.freeze({
  registration:{name:'Oshadhi Gunathilake',number:'94711390292',display:'+94 71 139 0292',role:'Conference Registration'},
  hackathon:{name:'Dr. Nushara Wedasingha',number:'94764492051',display:'+94 76 449 2051',role:'Global Undergraduate Hackathon'},
  three_mt:{name:'Dr. K. T. Hemachandra',number:'94718957734',display:'+94 71 895 7734',role:'3MT Competition'},
  award:{name:'Dr. Hansani Weeratunge',number:'94743772290',display:'+94 74 377 2290',role:'Excellence Award'},
  travel:{name:'Mr. Ashen Wanniarachchi',number:'94779747973',display:'+94 77 974 7973',role:'Travel, Accommodation & Excursion'},
  industry:{name:'Dr. Pasan Maduranga',number:'94771417275',display:'+94 77 141 7275',role:'Industry Forum & Workshops'},
  panel:{name:'Ms. Anushka Panawenna',number:'94767706612',display:'+94 76 770 6612',role:'Panel Discussion'},
  invoice:{name:'Mr. Pramuditha Coomasaru',number:'94777728081',display:'+94 77 772 8081',role:'Invoice and registration-system support'},
  system:{name:'Mr. Pramuditha Coomasaru',number:'94777728081',display:'+94 77 772 8081',role:'Invoice and registration-system support'},
  other:{name:'Oshadhi Gunathilake',number:'94711390292',display:'+94 71 139 0292',role:'Conference Registration'}
});
const WHATSAPP_TOPICS = Object.freeze({
  registration:['Choosing the correct registration category','Registration submission or reload problem','Payment proof or payment-status query','Registration confirmation or correction','Other — describe the registration query below'],
  hackathon:['Registration link or access','Team eligibility or team composition','Competition guidelines or submission','Schedule, venue or results','Other — describe the hackathon query below'],
  three_mt:['Entry or payment query','Eligibility or participation rules','Submission or presentation requirements','Schedule, venue or results','Other — describe the 3MT query below'],
  award:['Eligibility or award category','Nomination or submission process','Schedule, evaluation or results','Other — describe the award query below'],
  travel:['Visa invitation or travel planning','Airport transfer or local transport','Accommodation assistance','Excursion participation, cost or accessibility','Other — describe the travel query below'],
  industry:['Industry Forum participation','Workshop registration','Schedule, speaker or venue information','Other — describe the forum or workshop query below'],
  panel:['Panel schedule or venue','Speaker or participation query','Panel theme or programme information','Other — describe the panel query below'],
  invoice:['Incorrect registration fee, value or currency','Incorrect billing name, address or reference','Proforma unavailable or cannot be downloaded','Tax wording, due date or payment instructions','Other — describe the invoice issue below'],
  system:['Form does not load or display correctly','Registration cannot be submitted','Saved registration cannot be reopened','Payment proof cannot be uploaded','Payment link or other system problem','Other — describe the technical issue below'],
  other:['Other — describe your question below']
});

const form = document.getElementById('registration-form');
const message = document.getElementById('form-message');
const paperCount = document.getElementById('paper-count');
const papers = document.getElementById('papers');
const role = document.getElementById('participant-role');
const registrationCategory = document.getElementById('registration-category');
let submissions = [];
let adminToken = sessionStorage.getItem(CONFIG.tokenKey) || '';
let currentReferenceId = '';
let editToken = '';
let paymentProofFiles = [];
let paymentProofPreviouslyUploaded = false;
let workshopSettings = [
  {id:'seeing-through-ai-2026',title:'Seeing Through AI: Deep Learning for Computer Vision',date:'2026-07-21',time:'09:30–12:30',venue:'G906, New Building',fee:0,currency:'EUR',status:'completed',contact:'Mr. Amila Karunanayake, +94 77 443 9069'},
  {id:'ai-communications-6g-2026',title:'AI-Based Communications Towards 6G',date:'2026-09-11',time:'11:00 onwards',venue:'SLIIT, Malabe',fee:0,currency:'LKR',status:'completed',contact:'Prof. Dushantha Jayakody, +94 71 402 9161'}
];
let publicSettings = {excursionFeeUsd:CONFIG.excursionFeeUsd,usdToEurRate:0,issuerLegalName:'',issuerAddress:'',issuerRegistrationNumber:'',issuerTaxStatement:'',issuerEmail:'',issuerPhone:'',paymentInstructions:'',paymentDueDays:14,termsUrl:'https://new2an.com/terms.html',invoiceSettingsApproved:false};
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
  document.querySelector('.intro .eyebrow').textContent = 'Conference registration';
  document.querySelector('.intro h2').textContent = 'Register for NEW2AN 2026';
  document.querySelector('.intro>div>p:last-child').textContent = 'Use this form for the main conference. Choose the published category that matches your affiliation. Travel, hotel, visa and excursion requests are not confirmed bookings; separate activities remain outside this registration record.';
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
  const emergencyPhone=form.elements.Emergency_Contact_Phone?.closest('label');
  if(emergencyPhone&&!document.getElementById('emergency-privacy-note'))emergencyPhone.insertAdjacentHTML('afterend','<p class="microcopy span-2" id="emergency-privacy-note">Collected only so the organising team can contact this person in an emergency affecting your Colombo visit. Access is limited to authorised event personnel and the details should be deleted after the event retention period defined in the privacy policy.</p>');
  setLabel('Visit_Notes','Other information about your travel, hotel or accompanying guests');
  setLabel('Support_Category','What do you need help with?');
  setLabel('Support_Reply_Method','How would you prefer us to reply?');
  setLabel('Support_Request','Your question or request');
  const travelConsentText=form.elements.Travel_Data_Consent?.closest('label')?.querySelector('span');
  if(travelConsentText) travelConsentText.textContent='If I request travel or hotel assistance, I allow the organising team to share only the necessary details with its approved service partner.';
  const excursionText=form.elements.Excursion_Acknowledgement?.closest('label')?.querySelector('span');
  if(excursionText) excursionText.textContent='I understand that the excursion is expected to cost approximately USD 50 per participant, is charged separately, and is payable on the day of the excursion. It includes transport and evening refreshment but excludes lunch. The final amount, route, date, insurance information and cancellation terms will be issued separately.';
  setLabel('Excursion_Interest','Would you like to join the planned conference excursion?');
  setLabel('Excursion_Participant_Count','Total number of excursion participants, including you');
  setLabel('Excursion_Participant_Names','Names of additional excursion participants');
  setLabel('Excursion_Group_Details','Who will travel with you?');
  setPlaceholder('Excursion_Group_Details','For example: partner, colleague or family member');
  setLabel('Excursion_Activity_Level','Walking and activity level your group can manage');
  setLabel('Excursion_Mobility_Needs','Mobility or accessibility assistance needed during the excursion');
  setLabel('Excursion_Dietary_Needs','Evening-refreshment allergies or dietary requirements');
  setLabel('Excursion_Guide_Language','Preferred language for the excursion guide');
  setLabel('Bill_To','Who should the pre-payment invoice be addressed to?');
  setLabel('Billing_Legal_Name','Exact legal name to print under Bill to');
  setLabel('Billing_Email','Email address for the invoice or finance office');
  setLabel('Billing_Address','Address to show on the invoice');
  setLabel('Purchase_Order','Purchase order number or tax reference, if required by your institution');
  setLabel('Additional_Info','Other billing information');
  setLabel('Payment_Stage','Current payment status');
  setLabel('Transaction_Reference','Bank or online payment reference');
  setLabel('Amount_Paid','Amount you paid');
  setLabel('Payment_Currency','Registration payment currency');
  document.querySelector('.proforma-box strong').textContent = 'Pre-payment invoice (proforma invoice)';
  document.getElementById('proforma-btn').textContent = 'Download pre-payment invoice PDF';
  document.getElementById('submit-btn').textContent = 'Send registration details';
  document.querySelector('#visit-section .section-heading p').textContent = 'Tell us what assistance you may need. These answers are planning requests only and do not confirm flights, airport transfers, hotels or visa approval.';
  updateExcursionPricingText();
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

const paperNote = papers.nextElementSibling;
if (paperNote) paperNote.innerHTML='Online session access is included in the published registration benefits. Online presentation is available only to international authors on a case-by-case basis and requires approval by 15 November 2026 from new2an@crisglobal.org.<br><strong>Accepted authors:</strong> the official pages state both a 25 October camera-ready deadline and a 31 October registration deadline. Confirm the applicable payment sequence with the conference team.';
updatePublicWorkshopVisibility(false);

function isSriLankanCategory(category) {
  return String(category || '').startsWith('LK_');
}

function isAuthorCategory(category) {
  return category === 'INT_AUTHOR' || category === 'LK_AUTHOR';
}

function currentRegistrationPrice(now = new Date(), category = registrationCategory?.value) {
  const early = now <= new Date(CONFIG.earlyDeadline);
  const local = isSriLankanCategory(category);
  const sriLankanAuthorLate = category === 'LK_AUTHOR' && !early;
  return {
    amount: local ? (sriLankanAuthorLate ? CONFIG.sriLankanLateFee : CONFIG.sriLankanEarlyFee) : (early ? CONFIG.earlyFee : CONFIG.lateFee),
    currency: local ? 'LKR' : 'EUR',
    early,
    feeBasis: local ? (sriLankanAuthorLate ? 'SRI_LANKAN_AUTHOR_LATE_25_PERCENT_SURCHARGE' : 'SRI_LANKAN_AFFILIATION_PUBLISHED_FEE') : (early ? 'INTERNATIONAL_EARLY' : 'INTERNATIONAL_LATE')
  };
}

function currentFee(now = new Date(), category = registrationCategory?.value) {
  return currentRegistrationPrice(now, category).amount;
}

function updateExcursionPricingText(){
  const fee=Number(publicSettings.excursionFeeUsd||CONFIG.excursionFeeUsd);
  const rate=Number(publicSettings.usdToEurRate||0);
  const rateText=rate>0?` The current organiser-set indicative conversion is 1 USD = EUR ${rate.toFixed(4)}.`:' The indicative EUR conversion is awaiting organiser configuration.';
  const heading=document.querySelector('#excursion-section .section-heading p');
  if(heading)heading.textContent=`The excursion is expected to cost approximately USD ${fee.toFixed(2)} per participant, is charged separately from conference registration, and is payable on the day of the excursion. It includes transport and evening refreshment; lunch is not included.${rateText}`;
}

function refreshFee() {
  const category=registrationCategory?.value||'';
  const price=currentRegistrationPrice();
  const categoryLabel=registrationCategory?.selectedOptions?.[0]?.textContent||'Registration';
  document.getElementById('fee-amount').textContent = price.amount.toLocaleString('en-GB');
  document.getElementById('fee-currency').textContent = price.currency;
  document.querySelector('#fee-summary strong .summary-currency').textContent = price.currency;
  document.querySelector('#fee-summary strong span:last-child').textContent = price.amount.toLocaleString('en-GB');
  document.getElementById('fee-label').textContent = category ? categoryLabel : 'Select a registration category';
  document.getElementById('fee-deadline').textContent = price.early ? 'Early fee through 31 October 2026' : 'Late fee after 31 October 2026';
  document.getElementById('fee-note').textContent = `${isSriLankanCategory(category) ? (category==='LK_AUTHOR'&&!price.early ? 'Includes the published author late surcharge.' : 'Sri Lankan-affiliation published fee.') : 'International author and non-author fee.'} No student rate is published.`;
  const paymentCurrency=form.elements.Payment_Currency;
  if(paymentCurrency){paymentCurrency.innerHTML=`<option value="${price.currency}">${price.currency}</option>`;paymentCurrency.value=price.currency;paymentCurrency.disabled=true;}
  const amountPaid=form.elements.Amount_Paid;if(amountPaid)amountPaid.placeholder=String(price.amount);
}

function updateCategoryState() {
  const category=registrationCategory.value;
  const local=isSriLankanCategory(category);
  const author=isAuthorCategory(category);
  const twoPaperOption=Array.from(paperCount.options).find(option=>option.value==='2');
  if(twoPaperOption)twoPaperOption.disabled=category==='LK_AUTHOR';
  if(category==='LK_AUTHOR'&&Number(paperCount.value)>1){paperCount.value='1';renderPapers();}

  const paymentBox=document.getElementById('registration-payment-box');
  const paymentLink=document.getElementById('registration-pay-link');
  const paymentNote=document.getElementById('registration-payment-note');
  const price=currentRegistrationPrice();
  const registrationUrl=CONFIG.paymentLinks[category];
  paymentBox.hidden=!local;
  const checkoutAvailable=registrationUrl&&(price.early||category==='LK_NON_AUTHOR');
  paymentLink.hidden=!checkoutAvailable;
  if(checkoutAvailable){paymentLink.href=registrationUrl;paymentNote.textContent=`${price.currency} ${price.amount.toLocaleString('en-GB')}. Keep the gateway receipt and record its transaction reference below.`;}
  else if(local){paymentNote.textContent=`The published Sri Lankan-author late fee is ${price.currency} ${price.amount.toLocaleString('en-GB')}. No verified late-fee checkout link is configured; contact new2an@crisglobal.org.`;}

  const galaBox=document.getElementById('gala-box');
  galaBox.hidden=!local;
  const galaFee=category==='LK_AUTHOR'?12000:15000;
  const galaUrl=category==='LK_AUTHOR'?CONFIG.paymentLinks.GALA_LK_AUTHOR:CONFIG.paymentLinks.GALA_LK_NON_AUTHOR;
  document.getElementById('gala-price').textContent=`LKR ${galaFee.toLocaleString('en-GB')} · separate ticket`;
  document.getElementById('gala-pay-link').href=galaUrl;
  galaBox.querySelectorAll('input,select').forEach(control=>{control.disabled=!local;});
  if(!local){form.elements.Gala_Dinner_Interest.value='No';form.elements.Gala_Dinner_Payment_Reference.value='';}

  if(category&&author&&role.value&&role.value!=='Author / presenting author')role.value='Author / presenting author';
  if(category&&!author&&role.value==='Author / presenting author'){role.value='';paperCount.value='0';renderPapers();}
  refreshFee();
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
  const price=currentRegistrationPrice();
  data.Registration_Fee = price.amount;
  data.Currency = price.currency;
  data.Fee_Basis = price.feeBasis;
  data.Payment_Currency = price.currency;
  data.Payment_Status = 'AWAITING_INSTRUCTIONS';
  data.Gala_Dinner_Interest = isSriLankanCategory(data.Registration_Category) ? (data.Gala_Dinner_Interest||'No') : 'No';
  data.Gala_Dinner_Fee = data.Gala_Dinner_Interest === 'Yes' ? (data.Registration_Category==='LK_AUTHOR'?12000:15000) : 0;
  data.Gala_Dinner_Currency = data.Gala_Dinner_Interest === 'Yes' ? 'LKR' : '';
  data.Excursion_Fee_Per_Person_USD = publicSettings.excursionFeeUsd;
  data.Excursion_Total_USD = data.Excursion_Interest === 'Yes' ? publicSettings.excursionFeeUsd * Number(data.Excursion_Participant_Count || 0) : 0;
  data.Excursion_USD_to_EUR_Rate = data.Excursion_Interest === 'Yes' ? publicSettings.usdToEurRate : '';
  data.Excursion_Total_EUR_Indicative = data.Excursion_Interest === 'Yes' ? Number((data.Excursion_Total_USD * publicSettings.usdToEurRate).toFixed(2)) : 0;
  if(data.Bill_To==='Participant'){
    data.Billing_Legal_Name=`${data.Title||''} ${data.Full_Name||''}`.trim();
    data.Billing_Email=data.Email||'';
    data.Billing_Address=data.Country_of_Residence||'';
    data.Purchase_Order='';data.Additional_Info='';
  }
  data.Form_Schema_Version = 3;
  data.Workshop_Selections = Array.from(document.querySelectorAll('.future-workshop-choice:checked')).map(el => el.value).join(' | ');
  if (currentReferenceId) data.Reference_ID = currentReferenceId;
  return data;
}

function validateBusinessRules(data) {
  if(!REGISTRATION_CATEGORIES.includes(data.Registration_Category))return 'Select the published registration category that matches your affiliation and role.';
  if(!PARTICIPANT_ROLES.includes(data.Participant_Role))return 'Select Author / presenting author, Non-author attendee or Industry professional as the participant role.';
  const authorCategory=isAuthorCategory(data.Registration_Category);
  if(authorCategory&&data.Participant_Role!=='Author / presenting author')return 'Author registration categories require the “Author / presenting author” role.';
  if(!authorCategory&&data.Participant_Role==='Author / presenting author')return 'Select an author registration category for a presenting author.';
  if(authorCategory&&Number(data.Paper_Count)<1)return 'Presenting authors must enter at least one accepted paper.';
  if(!authorCategory&&Number(data.Paper_Count)>0)return 'Only an author registration category may include accepted papers.';
  if(data.Registration_Category==='LK_AUTHOR'&&Number(data.Paper_Count)>1)return 'Each Sri Lankan-affiliated author registration covers one accepted paper.';
  if(data.Attendance_Mode==='Request online presentation (international author; approval required)'&&data.Registration_Category!=='INT_AUTHOR')return 'Online presentation may be requested only by an international author and still requires organiser approval.';
  if(authorCategory&&data.Attendance_Mode==='Online session access (non-presenting)')return 'An author cannot use non-presenting online access to satisfy the paper-presentation requirement.';
  const assistance = [data.Travel_Agency_Assistance, data.Accommodation_Assistance].some(v => v && v !== 'No' && v !== 'Not sure yet');
  if (assistance && !data.Travel_Data_Consent) return 'To request travel or hotel assistance, please allow the organising team to share the necessary details with its approved service partner.';
  if (data.Arrival_Date && data.Departure_Date && data.Departure_Date < data.Arrival_Date) return 'Departure date cannot be earlier than arrival date.';
  if (String(data.Visa_Support || '').startsWith('Yes') && (!data.Passport_Name.trim() || !data.Passport_Issuing_Country.trim())) return 'To request a visa invitation letter, enter your name exactly as shown in your passport and the country that issued it.';
  if(data.Dietary_Preference&&!DIETARY_PREFERENCES.includes(data.Dietary_Preference))return 'Select Vegetarian, Non-vegetarian or Halal as the dietary preference.';
  if (data.Attendance_Mode === 'In person in Colombo' && data.Excursion_Interest === 'Yes') {
    const count = Number(data.Excursion_Participant_Count);
    if (!Number.isInteger(count) || count < 1 || count > 10) return 'Enter a valid excursion participant count from 1 to 10.';
    if (count > 1 && !data.Excursion_Participant_Names.trim()) return 'Enter the names of everyone joining the excursion with you.';
    if (!data.Excursion_Acknowledgement) return 'Please acknowledge that the excursion details and price are still provisional.';
    if (!(Number(publicSettings.usdToEurRate) > 0)) return 'The organiser has not configured the excursion USD-to-EUR rate yet. Please retry later or contact the organiser.';
  }
  if (data.Payment_Stage !== 'NOT_PAID') {
    if (!data.Transaction_Reference.trim()) return 'Enter the reference number shown on your bank-transfer receipt or online payment confirmation.';
    if (!(Number(data.Amount_Paid) > 0)) return 'Enter the amount paid.';
    if (!paymentProofFiles.length && !paymentProofPreviouslyUploaded) return 'Upload proof of payment or the gateway receipt.';
  }
  if(data.Gala_Dinner_Interest==='Yes'&&!isSriLankanCategory(data.Registration_Category))return 'Published gala dinner tickets are currently available only for Sri Lankan-affiliated registration categories.';
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
    if(currentReferenceId)data.Reference_ID=currentReferenceId;
    data.Payment_Proof_Base64 = paymentProofFiles.length ? await Promise.all(paymentProofFiles.map(fileToBase64)) : (paymentProofPreviouslyUploaded ? '(uploaded — see folder)' : []);
    const uploadedProofs=paymentProofFiles.length>0;
    const result = await api({action:'submitRegistration',data,editToken});
    currentReferenceId=result.referenceId;editToken=result.editToken||'';
    document.getElementById('reference-display').textContent=`Reference ID: ${currentReferenceId}`;
    if(uploadedProofs){paymentProofFiles=[];paymentProofPreviouslyUploaded=true;renderProofList();}
    localStorage.removeItem(CONFIG.draftKey);
    localStorage.setItem('new2an2026_last_reference', JSON.stringify({referenceId:result.referenceId,email:data.Email}));
    const checkoutAvailable=!document.getElementById('registration-pay-link').hidden;
    setMessage(`Registration saved. Your reference is ${result.referenceId}. ${checkoutAvailable?'Use the official checkout shown above and keep its receipt.':'Follow the verified payment instructions on your proforma or contact the conference team.'}`, 'success');
  } catch (error) { setMessage(error.name === 'AbortError' ? 'The server took too long to respond. Please retry; your draft is preserved.' : error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Send registration details'; }
});

let draftTimer;
form.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => localStorage.setItem(CONFIG.draftKey, JSON.stringify(toObject(form))), 300); });

function restore(data) {
  const restoredData={...(data||{})};
  restoredData.Participant_Role=LEGACY_PARTICIPANT_ROLES[restoredData.Participant_Role]||restoredData.Participant_Role;
  if (restoredData.Reference_ID) {
    currentReferenceId = String(restoredData.Reference_ID);
    document.getElementById('reference-display').textContent = `Reference ID: ${currentReferenceId}`;
  }
  Object.entries(restoredData).forEach(([name, value]) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value === true || value === 'true'; else el.value = value ?? '';
  });
  renderPapers();
  Object.entries(restoredData).filter(([key]) => /^Paper_[12]_/.test(key)).forEach(([name,value]) => { const el=form.elements.namedItem(name); if(el){if(el.type==='checkbox')el.checked=value===true||value==='true';else el.value=value;} });
  const workshopIds=String(restoredData.Workshop_Selections||'').split(' | ').filter(Boolean);
  document.querySelectorAll('.future-workshop-choice').forEach(el => {el.checked=workshopIds.includes(el.value);});
  if (restoredData.Payment_Proof_Base64 === '(uploaded — see folder)') paymentProofPreviouslyUploaded = true;
  updateAttendanceVisibility();
  updateBillingVisibility();
  updateCategoryState();
  renderProofList();
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
  const confirmed = document.getElementById('excursion-interest').value === 'Yes';
  const details = document.getElementById('excursion-details');
  details.hidden = !confirmed;
  details.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = !confirmed; });
  document.getElementById('excursion-count').disabled = !confirmed;
  if (!confirmed) form.elements.Excursion_Acknowledgement.checked = false;
}

function updateAttendanceVisibility() {
  const travelling = form.elements.Attendance_Mode.value === 'In person in Colombo';
  ['visit-section','excursion-section'].forEach(id => {
    const section=document.getElementById(id); section.hidden=!travelling;
    section.querySelectorAll('input,select,textarea').forEach(el => { el.disabled=!travelling; });
  });
  if (travelling) updateExcursionVisibility();
}

function updateBillingVisibility(){
  const institutional=form.elements.Bill_To.value==='Institution / organisation';
  ['Billing_Legal_Name','Billing_Email','Billing_Address','Purchase_Order','Additional_Info'].forEach(name=>{
    const control=form.elements[name],label=control&&control.closest('label');
    if(!control)return;
    control.disabled=!institutional;
    control.required=institutional&&['Billing_Legal_Name','Billing_Email','Billing_Address'].includes(name);
    if(label)label.hidden=!institutional;
  });
  const box=document.querySelector('.proforma-box span');
  if(box&&!currentReferenceId)box.textContent=institutional?'Provide the organisation details above for approval or reimbursement.':'A personal proforma will use your participant name, email and country.';
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
  try{const result=await api(null,'?action=getWorkshops');workshopSettings=result.workshops||workshopSettings;publicSettings={...publicSettings,...(result.publicSettings||{}),invoiceSettingsApproved:result.publicSettings?.invoiceSettingsApproved===true};}catch(_){}
  updateExcursionPricingText();
  renderWorkshopChoices();renderWorkshopAdmin();
}

function ensureWorkshopAdmin(){
  const panel=document.getElementById('admin-panel');
  if(document.getElementById('workshop-admin'))return;
  const section=document.createElement('section');section.id='workshop-admin';section.className='workshop-admin';
  section.innerHTML=`<div class="section-heading"><span>I</span><div><h3>Invoice issuer and payment settings</h3><p>Use verified legal details. These values appear on organization-facing proforma invoices.</p></div></div>
    <div class="grid two">
      <label>Issuer legal name<input id="invoice-issuer-name" required></label>
      <label>Issuer email<input id="invoice-issuer-email" type="email" required></label>
      <label class="span-2">Issuer registered address<textarea id="invoice-issuer-address" rows="3" required></textarea></label>
      <label>Registration number, if applicable<input id="invoice-registration-number"></label>
      <label>Issuer telephone<input id="invoice-issuer-phone"></label>
      <label class="span-2">Tax statement<textarea id="invoice-tax-statement" rows="2" required placeholder="For example: No VAT is charged. Confirm this wording with the issuer."></textarea></label>
      <label class="span-2">Payment instructions<textarea id="invoice-payment-instructions" rows="3" required placeholder="Use only organizer-approved payment instructions."></textarea></label>
      <label>Payment due within days<input id="invoice-due-days" type="number" min="1" max="90" value="14" required></label>
      <label>Terms URL<input id="invoice-terms-url" type="url" value="https://new2an.com/terms.html"></label>
      <label>1 USD equals EUR<input id="usd-eur-rate" type="number" min="0.000001" max="10" step="0.000001" placeholder="Required for excursion invoices"></label>
    </div>
    <label class="check"><input type="checkbox" id="invoice-settings-approved"><span>I confirm that the issuer identity, tax wording, payment instructions, bank details and exchange rate above have been verified and approved by the organiser.</span></label>
    <div class="admin-actions"><button type="button" id="currency-save" class="btn primary">Save invoice settings</button></div><p id="currency-message" class="form-message"></p>
    <div class="section-heading"><span>W</span><div><h3>Workshop manager</h3><p>Add future workshops as draft, open, closed or completed. Only open workshops appear as selectable options.</p></div></div><div id="workshop-admin-list"></div><div class="grid two"><label>Title<input id="ws-title"></label><label>Date<input id="ws-date" type="date"></label><label>Time<input id="ws-time" placeholder="09:30-12:30"></label><label>Venue<input id="ws-venue"></label><label>Fee<input id="ws-fee" type="number" min="0" step="0.01" value="0"></label><label>Currency<input id="ws-currency" value="EUR"></label><label>Status<select id="ws-status"><option>draft</option><option>open</option><option>closed</option><option>completed</option></select></label><label>Coordinator / contact<input id="ws-contact"></label></div><div class="admin-actions"><button type="button" id="ws-add" class="btn secondary">Add workshop</button><button type="button" id="ws-save" class="btn primary">Save workshop settings</button></div><p id="ws-message" class="form-message"></p>`;
  panel.insertBefore(section,panel.querySelector('.table-wrap'));
  document.getElementById('ws-add').addEventListener('click',upsertWorkshopDraft);
  document.getElementById('ws-save').addEventListener('click',saveWorkshopSettings);
  document.getElementById('currency-save').addEventListener('click',savePublicSettings);
  document.getElementById('workshop-admin-list').addEventListener('click',event=>{const index=Number(event.target.dataset.edit);if(Number.isInteger(index))editWorkshop(index);});
}

async function savePublicSettings(){
  const box=document.getElementById('currency-message'),rate=Number(document.getElementById('usd-eur-rate').value);
  if(!Number.isFinite(rate)||rate<=0){box.textContent='Enter a valid conversion rate greater than 0.';box.className='form-message error';return;}
  const value=id=>document.getElementById(id).value.trim();
  const payload={action:'savePublicSettings',token:adminToken,usdToEurRate:rate,issuerLegalName:value('invoice-issuer-name'),issuerAddress:value('invoice-issuer-address'),issuerRegistrationNumber:value('invoice-registration-number'),issuerTaxStatement:value('invoice-tax-statement'),issuerEmail:value('invoice-issuer-email'),issuerPhone:value('invoice-issuer-phone'),paymentInstructions:value('invoice-payment-instructions'),paymentDueDays:Number(value('invoice-due-days')),termsUrl:value('invoice-terms-url'),invoiceSettingsApproved:document.getElementById('invoice-settings-approved').checked};
  if(!payload.issuerLegalName||!payload.issuerAddress||!payload.issuerTaxStatement||!payload.issuerEmail||!payload.paymentInstructions||!(payload.paymentDueDays>0)){box.textContent='Complete all required issuer, tax, payment and due-period fields.';box.className='form-message error';return;}
  if(!payload.invoiceSettingsApproved){box.textContent='Confirm that the organiser has verified the issuer, tax, payment, bank and exchange-rate details.';box.className='form-message error';return;}
  try{const result=await api(payload);publicSettings=result.publicSettings;renderInvoiceAdminSettings();updateExcursionPricingText();box.textContent='Invoice and excursion settings saved.';box.className='form-message success';}
  catch(error){box.textContent=error.message;box.className='form-message error';}
}

function renderInvoiceAdminSettings(){
  const fields={
    'invoice-issuer-name':publicSettings.issuerLegalName,'invoice-issuer-address':publicSettings.issuerAddress,'invoice-registration-number':publicSettings.issuerRegistrationNumber,
    'invoice-tax-statement':publicSettings.issuerTaxStatement,'invoice-issuer-email':publicSettings.issuerEmail,'invoice-issuer-phone':publicSettings.issuerPhone,
    'invoice-payment-instructions':publicSettings.paymentInstructions,'invoice-due-days':publicSettings.paymentDueDays,'invoice-terms-url':publicSettings.termsUrl,
    'usd-eur-rate':publicSettings.usdToEurRate>0?Number(publicSettings.usdToEurRate).toFixed(4):''
  };
  Object.entries(fields).forEach(([id,value])=>{const input=document.getElementById(id);if(input&&document.activeElement!==input)input.value=value??'';});
  const approved=document.getElementById('invoice-settings-approved');if(approved)approved.checked=publicSettings.invoiceSettingsApproved===true;
}

function renderWorkshopAdmin(){
  ensureWorkshopAdmin();
  renderInvoiceAdminSettings();
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
form.elements.Bill_To.addEventListener('change',updateBillingVisibility);
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

async function generateProforma() {
  const institutional=form.elements.Bill_To.value==='Institution / organisation';
  const required = ['Title','Full_Name','Email','Phone','Organization','Designation','Country_of_Residence','Nationality','Registration_Category','Participant_Role','Attendance_Mode','Bill_To'].concat(institutional?['Billing_Legal_Name','Billing_Email','Billing_Address']:[]);
  const missing = required.map(name => form.elements[name]).find(el => !el || !String(el.value).trim());
  if (missing) { missing.focus(); setMessage('Complete the required participant, paper and billing fields before downloading the pre-payment invoice.', 'error'); return; }
  if (role.value === 'Author / presenting author' && Number(paperCount.value) < 1) { setMessage('Presenting authors must enter at least one accepted paper.', 'error'); return; }
  for (let i=1;i<=Number(paperCount.value);i++) if (!form.elements[`Paper_${i}_ID`]?.value.trim() || !form.elements[`Paper_${i}_Title`]?.value.trim()) { setMessage(`Complete the ID and title for paper ${i}.`, 'error'); return; }
  if (!window.jspdf) { setMessage('The PDF library is unavailable. Check your connection and retry.', 'error'); return; }
  const settingsMissing=[['issuerLegalName','issuer legal name'],['issuerAddress','issuer address'],['issuerTaxStatement','tax statement'],['issuerEmail','issuer email'],['paymentInstructions','payment instructions']].filter(([key])=>!String(publicSettings[key]||'').trim()).map(([,label])=>label);
  if(settingsMissing.length){setMessage(`The organiser must configure the invoice ${settingsMissing.join(', ')} before an organization-ready proforma can be generated.`,'error');return;}
  if(publicSettings.invoiceSettingsApproved!==true){setMessage('The organiser has not yet verified and approved the invoice issuer, tax, bank, payment and exchange-rate settings. A proforma cannot be generated.','error');return;}
  if(!form.reportValidity()){setMessage('Complete the registration and policy agreement before generating the invoice.','error');return;}
  const data = toObject(form),businessIssue=validateBusinessRules(data);let price=currentRegistrationPrice();
  if(businessIssue){setMessage(businessIssue,'error');return;}
  if(data.Excursion_Interest==='Yes'&&!(Number(publicSettings.usdToEurRate)>0)){setMessage('The organiser has not configured the excursion USD-to-EUR rate yet, so an excursion invoice cannot be generated. Please retry later or contact the organiser.','error');return;}
  const archiveButton=document.getElementById('proforma-btn');archiveButton.disabled=true;archiveButton.textContent='Securing registration...';
  try{
    if(currentReferenceId)data.Reference_ID=currentReferenceId;
    data.Payment_Proof_Base64=paymentProofFiles.length?await Promise.all(paymentProofFiles.map(fileToBase64)):(paymentProofPreviouslyUploaded?'(uploaded — see folder)':[]);
    const uploadedProofs=paymentProofFiles.length>0;
    const saved=await api({action:'submitRegistration',data,editToken});
    currentReferenceId=saved.referenceId;editToken=saved.editToken||'';
    document.getElementById('reference-display').textContent=`Reference ID: ${currentReferenceId}`;
    if(!saved.pricing||!Number.isFinite(Number(saved.pricing.registrationFee))||!saved.pricing.currency)throw new Error(`Registration ${currentReferenceId} was saved, but the backend did not return authoritative invoice pricing. Do not use an invoice until the current backend is deployed.`);
    const authoritative=saved.pricing;
    price={amount:Number(authoritative.registrationFee),currency:String(authoritative.currency),feeBasis:String(authoritative.feeBasis||price.feeBasis),early:String(authoritative.feeBasis||'').indexOf('LATE')<0};
    data.Registration_Fee=price.amount;data.Currency=price.currency;data.Fee_Basis=price.feeBasis;
    data.Gala_Dinner_Fee=Number(authoritative.galaDinnerFee||0);data.Gala_Dinner_Currency=String(authoritative.galaDinnerCurrency||'');
    data.Excursion_Fee_Per_Person_USD=Number(authoritative.excursionFeePerPersonUsd||0);data.Excursion_Total_USD=Number(authoritative.excursionTotalUsd||0);data.Excursion_USD_to_EUR_Rate=Number(authoritative.excursionUsdToEurRate||0);data.Excursion_Total_EUR_Indicative=Number(authoritative.excursionTotalEurIndicative||0);
    if(uploadedProofs){paymentProofFiles=[];paymentProofPreviouslyUploaded=true;renderProofList();}
  }catch(error){archiveButton.disabled=false;archiveButton.textContent='Download pre-payment invoice PDF';setMessage(error.name==='AbortError'?'The registration service took too long to respond. Please retry.':error.message,'error');return;}
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const left=14,right=196,width=right-left,navy=[9,35,60],ink=[23,39,51],muted=[90,105,112],rule=[205,218,222];
  const issueDate=new Date(),dueDate=new Date(issueDate);dueDate.setDate(dueDate.getDate()+Number(publicSettings.paymentDueDays||14));
  const dateText=date=>date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const invoiceNumber=`PRO-${currentReferenceId}`;
  const fit=(text,maxWidth,maxLines=2)=>{let lines=doc.splitTextToSize(String(text||'-'),maxWidth);if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(doc.getTextWidth(last+'...')>maxWidth&&last.length)last=last.slice(0,-1);lines[maxLines-1]=last+'...';}return lines;};
  const small=(label,value,x,y,maxWidth,maxLines=2)=>{doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text(label.toUpperCase(),x,y);doc.setFont('helvetica','normal');doc.setFontSize(7.8);doc.setTextColor(...ink);const lines=fit(value,maxWidth,maxLines);doc.text(lines,x,y+3.5);return y+3.5+lines.length*3.5;};
  doc.setFillColor(...navy);doc.rect(0,0,210,29,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('NEW2AN 2026',left,11);doc.setFontSize(8.5);doc.text('PROFORMA INVOICE',left,21);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(fit(publicSettings.issuerLegalName,85,1),right,10,{align:'right'});doc.setFontSize(7);doc.text('15-17 December 2026  |  Colombo, Sri Lanka',right,21,{align:'right'});
  let y=35;doc.setFillColor(246,249,250);doc.roundedRect(left,y,width,16,1.5,1.5,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.3);doc.setTextColor(...muted);doc.text('PROFORMA NUMBER',left+4,y+5);doc.text('ISSUE DATE',83,y+5);doc.text('PAYMENT DUE',135,y+5);doc.setFontSize(8.7);doc.setTextColor(...ink);doc.text(invoiceNumber,left+4,y+12);doc.text(dateText(issueDate),83,y+12);doc.text(dateText(dueDate),135,y+12);y+=20;
  doc.setFillColor(255,249,235);doc.roundedRect(left,y,width,10,1.5,1.5,'F');doc.setFillColor(202,145,35);doc.roundedRect(left,y,2,10,1,1,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...ink);doc.text('DOCUMENT STATUS',left+5,y+4);doc.setFont('helvetica','normal');doc.setFontSize(6.4);doc.text('For approval and payment processing only - not proof of payment, a tax invoice, or a receipt.',left+30,y+4);doc.setTextColor(...muted);doc.text('For reimbursement, obtain the official paid receipt after payment verification.',left+30,y+7.2);y+=15;
  const colWidth=84,col2=112;doc.setDrawColor(...rule);doc.line(left,y,right,y);y+=5;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...navy);doc.text('Issued by',left,y);doc.text(institutional?'Bill to - institution':'Bill to - participant',col2,y);y+=5;
  let leftY=small('Legal issuer',publicSettings.issuerLegalName,left,y,colWidth,2);leftY=small('Registered address',publicSettings.issuerAddress,left,leftY+2,colWidth,2);if(publicSettings.issuerRegistrationNumber)leftY=small('Registration number',publicSettings.issuerRegistrationNumber,left,leftY+2,colWidth,1);leftY=small('Contact',[publicSettings.issuerEmail,publicSettings.issuerPhone].filter(Boolean).join(' | '),left,leftY+2,colWidth,2);
  const billName=institutional?data.Billing_Legal_Name:`${data.Title} ${data.Full_Name}`,billAddress=institutional?data.Billing_Address:data.Country_of_Residence,billEmail=institutional?data.Billing_Email:data.Email;
  let rightY=small('Name',billName,col2,y,colWidth,2);rightY=small('Address / country',billAddress,col2,rightY+2,colWidth,2);rightY=small('Email',billEmail,col2,rightY+2,colWidth,1);if(institutional&&data.Purchase_Order)rightY=small('PO / tax reference',data.Purchase_Order,col2,rightY+2,colWidth,1);rightY=small('Participant',`${data.Title} ${data.Full_Name}`,col2,rightY+2,colWidth,1);y=Math.max(leftY,rightY)+4;
  doc.line(left,y,right,y);y+=5;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...navy);doc.text('Conference registration',left,y);doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(...ink);doc.text(fit(`NEW2AN 2026 | 15-17 Dec 2026 | ${data.Registration_Category} | ${data.Attendance_Mode}`,width,1),left,y+4);y+=9;for(let i=1;i<=Number(data.Paper_Count||0);i++){doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text(`PAPER ${i}`,left,y);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...ink);doc.text(fit(`${data[`Paper_${i}_ID`]} - ${data[`Paper_${i}_Title`]}`,width-20,1),left+17,y);y+=4;}
  y+=2;doc.setFillColor(...navy);doc.rect(left,y,width,7,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(7.3);doc.text('DESCRIPTION',left+3,y+4.8);doc.text('QTY',134,y+4.8,{align:'center'});doc.text('UNIT PRICE',162,y+4.8,{align:'right'});doc.text('AMOUNT',right-3,y+4.8,{align:'right'});y+=12;doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Full NEW2AN registration - three conference days',left+3,y);doc.text('1',134,y,{align:'center'});doc.text(`${price.currency} ${price.amount.toFixed(2)}`,162,y,{align:'right'});doc.text(`${price.currency} ${price.amount.toFixed(2)}`,right-3,y,{align:'right'});y+=5;doc.setFontSize(6.8);doc.setTextColor(...muted);doc.text('Conference participation, online session access and digital Springer LNCS proceedings.',left+3,y);y+=5;doc.setFillColor(246,249,250);doc.roundedRect(left,y,width,13,1.5,1.5,'F');doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('TOTAL DUE NOW',left+4,y+5);doc.setFontSize(12);doc.text(`${price.currency} ${price.amount.toFixed(2)}`,right-4,y+9,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(6.3);doc.setTextColor(...muted);doc.text('Conference registration only',left+4,y+9);y+=18;
  if(data.Gala_Dinner_Interest==='Yes'){
    doc.setFillColor(255,249,235);doc.roundedRect(left,y,width,13,1.5,1.5,'F');doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('GALA DINNER - PAY SEPARATELY',left+4,y+5);doc.text(`LKR ${Number(data.Gala_Dinner_Fee).toFixed(2)}`,right-4,y+5,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...muted);doc.text('Separate PayHere checkout. This amount is not included in TOTAL DUE NOW.',left+4,y+9.5);y+=17;
  }
  if(data.Excursion_Interest==='Yes'){
    const count=Number(data.Excursion_Participant_Count||1),fee=Number(data.Excursion_Fee_Per_Person_USD),usdTotal=Number(data.Excursion_Total_USD),rate=Number(data.Excursion_USD_to_EUR_Rate),eurTotal=Number(data.Excursion_Total_EUR_Indicative);
    doc.setFillColor(239,246,248);doc.roundedRect(left,y,width,28,1.5,1.5,'F');doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.text('ESTIMATED EXCURSION COST - PAY ON THE EXCURSION DAY',left+4,y+5);doc.setFontSize(6);doc.setTextColor(...muted);doc.text('PARTICIPANTS',left+4,y+11);doc.text('EST. PRICE / PERSON',left+43,y+11);doc.text('EST. USD TOTAL',left+89,y+11);doc.text('INDICATIVE EUR',left+129,y+11);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...ink);doc.text(String(count),left+4,y+15.5);doc.text(`USD ${fee.toFixed(2)}`,left+43,y+15.5);doc.text(`USD ${usdTotal.toFixed(2)}`,left+89,y+15.5);doc.text(`EUR ${eurTotal.toFixed(2)}`,left+129,y+15.5);doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...muted);doc.text(`1 USD = EUR ${rate.toFixed(4)}. Approximate only; separate from registration and not due now.`,left+4,y+21);doc.text('Includes transport and evening refreshment. Lunch is not included.',left+4,y+24.5);y+=32;
  }
  const sriLankanCheckout=isSriLankanCategory(data.Registration_Category)&&price.feeBasis!=='SRI_LANKAN_AUTHOR_LATE_25_PERCENT_SURCHARGE';
  const paymentInstructions=sriLankanCheckout?'Use the category-specific official CRIS PayHere link shown in the registration portal. Keep the gateway receipt.':publicSettings.paymentInstructions;
  doc.setDrawColor(...rule);doc.line(left,y,right,y);y+=5;doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...navy);doc.text('Tax and payment',left,y);y+=4;doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text('TAX TREATMENT',left,y);doc.text('PAYMENT INSTRUCTIONS',107,y);y+=3.5;doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...ink);doc.text(fit(publicSettings.issuerTaxStatement,84,3),left,y);doc.text(fit(paymentInstructions,89,3),107,y);y+=12;doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text('PAYMENT REFERENCE',left,y);doc.text('TERMS',107,y);doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...ink);doc.text(currentReferenceId,left,y+3.5);doc.text(fit(publicSettings.termsUrl,89,1),107,y+3.5);
  doc.setDrawColor(220);doc.line(left,281,right,281);doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text(`System generated | ${publicSettings.issuerEmail}`,left,286);doc.text('Page 1 of 1',right,286,{align:'right'});
  const button=archiveButton;
  button.disabled=true;button.textContent='Archiving invoice...';
  try{
    const pdfData=doc.output('datauristring').split(',')[1];
    await api({action:'saveInvoiceVersion',referenceId:currentReferenceId,email:data.Email,editToken,file:{mimeType:'application/pdf',data:pdfData}});
    doc.save(`NEW2AN2026_Proforma_${currentReferenceId}.pdf`);
    localStorage.setItem('new2an2026_last_reference',JSON.stringify({referenceId:currentReferenceId,email:data.Email}));
    setMessage(`Pre-payment invoice archived in the registration folder and downloaded. Keep reference ID ${currentReferenceId}; you will need it for payment and to reopen this registration.`, 'success');
  }catch(error){
    setMessage(error.name==='AbortError'?'The invoice archive took too long to respond. Please retry; no unarchived download was created.':`The invoice could not be archived, so it was not downloaded. ${error.message}`,'error');
  }finally{button.disabled=false;button.textContent='Download pre-payment invoice PDF';}
}

paperCount.addEventListener('change', renderPapers);
role.addEventListener('change', () => { if (role.value !== 'Author / presenting author' && Number(paperCount.value)) { paperCount.value = '0'; renderPapers(); } });
registrationCategory.addEventListener('change',updateCategoryState);

document.getElementById('lookup-btn').addEventListener('click', async () => {
  const ref = document.getElementById('lookup-ref').value.trim();
  const email = document.getElementById('lookup-email').value.trim();
  if (!ref || !email) { setMessage('Enter both the reference ID and registration email.', 'error'); return; }
  try { const result = await api(null, `?action=getRegistration&ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`); editToken=result.editToken||'';restore(result.data); setMessage(`Loaded ${ref}. You can securely update this registration for the next two hours.`, 'success'); form.scrollIntoView({behavior:'smooth'}); }
  catch(error) { setMessage(error.message, 'error'); }
});

document.querySelectorAll('.nav-link[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-link[data-view]').forEach(x => x.classList.toggle('active', x === button));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById(`${button.dataset.view}-view`).classList.add('active');
  if (button.dataset.view === 'dashboard' && adminToken) loadSubmissions();
}));

function openViewFromHash() {
  const viewByHash={'#admin':'dashboard','#events':'events','#registration':'registration'};
  const view=viewByHash[location.hash];
  if(!view)return;
  const link=document.querySelector(`[data-view="${view}"]`);
  if(link)link.click();
}
window.addEventListener('hashchange', openViewFromHash);

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
  const local = submissions.filter(r => isSriLankanCategory(r.Registration_Category)).length;
  const travel = submissions.filter(r => String(r.Travel_Agency_Assistance || '').startsWith('Yes')).length;
  const hotels = submissions.filter(r => String(r.Accommodation_Assistance || '').startsWith('Yes')).length;
  const support = submissions.filter(r => String(r.Support_Request || '').trim()).length;
  const excursion = submissions.filter(r => r.Excursion_Interest === 'Yes').reduce((sum,r)=>sum+(Number(r.Excursion_Participant_Count)||0),0);
  document.getElementById('metrics').innerHTML = [['Registrations',submissions.length],['Sri Lankan affiliation',local],['In person',inPerson],['Travel help',travel],['Hotel help',hotels],['Payment proofs',submissions.filter(r=>String(r.Payment_Status||'').startsWith('PROOF_SUBMITTED')).length],['Gala tickets',submissions.filter(r=>r.Gala_Dinner_Interest==='Yes').length],['Excursion pax',excursion],['Support requests',support]].map(([label,value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  const columns = ['Submission_Date','Reference_ID','Full_Name','Email','Registration_Category','Country_of_Residence','Participant_Role','Paper_Count','Attendance_Mode','Registration_Fee','Currency','Payment_Status','Transaction_Reference','Gala_Dinner_Interest','Gala_Dinner_Fee','Excursion_Interest','Excursion_Participant_Count','Travel_Agency_Assistance','Accommodation_Assistance'];
  document.getElementById('table-head').innerHTML = `<tr>${columns.map(c=>`<th>${c.replaceAll('_',' ')}</th>`).join('')}</tr>`;
  document.getElementById('table-body').innerHTML = submissions.map(row => `<tr>${columns.map(c=>`<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`).join('');
}

function escapeHtml(value) { const node=document.createElement('div'); node.textContent=String(value); return node.innerHTML; }

function syncWhatsappFromRegistration(){
  const fill=(id,value)=>{const control=document.getElementById(id);if(control&&!control.value&&String(value||'').trim())control.value=String(value).trim();};
  fill('whatsapp-name',form.elements.Full_Name?.value);
  fill('whatsapp-mobile',form.elements.Phone?.value);
  fill('whatsapp-email',form.elements.Email?.value);
  fill('whatsapp-reference',currentReferenceId);
  fill('whatsapp-paper-id',form.elements.Paper_1_ID?.value);
  fill('whatsapp-payment-reference',form.elements.Transaction_Reference?.value);
}

function whatsappMessageData(){
  const category=document.getElementById('whatsapp-category');
  const topic=document.getElementById('whatsapp-topic');
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const categoryKey=category?.value||'';
  const contact=WHATSAPP_CONTACTS[categoryKey]||null;
  const categoryLabel=categoryKey&&category.selectedIndex>=0?category.options[category.selectedIndex].text:'';
  const topicLabel=topic?.value||'';
  const fields={name:value('whatsapp-name'),mobile:value('whatsapp-mobile'),email:value('whatsapp-email'),reference:value('whatsapp-reference').toUpperCase(),paperId:value('whatsapp-paper-id'),paymentReference:value('whatsapp-payment-reference'),details:value('whatsapp-details')};
  const lines=['NEW2AN 2026 — Support request','────────────────────'];
  if(categoryLabel)lines.push(`Area: ${categoryLabel}`);
  if(topicLabel)lines.push(`Topic: ${topicLabel}`);
  lines.push('────────────────────');
  if(fields.name)lines.push(`Name: ${fields.name}`);
  if(fields.mobile)lines.push(`Mobile: ${fields.mobile}`);
  if(fields.email)lines.push(`Email: ${fields.email}`);
  if(fields.reference)lines.push(`Registration ref: ${fields.reference}`);
  if(fields.paperId)lines.push(`Paper / CMT ID: ${fields.paperId}`);
  if(fields.paymentReference)lines.push(`Payment ref: ${fields.paymentReference}`);
  lines.push('────────────────────');
  if(fields.details)lines.push(`Question: ${fields.details}`);
  return {categoryKey,contact,categoryLabel,topicLabel,fields,message:lines.join('\n')};
}

function renderWhatsappSupport(){
  const data=whatsappMessageData();
  const recipient=document.getElementById('whatsapp-recipient');
  const preview=document.getElementById('whatsapp-preview');
  const message=document.getElementById('whatsapp-message');
  if(data.contact){
    recipient.replaceChildren();
    const strong=document.createElement('strong');strong.textContent=`Routed to ${data.contact.name}`;
    const detail=document.createElement('span');detail.textContent=`${data.contact.role} · WhatsApp ${data.contact.display}`;
    recipient.append(strong,detail);recipient.hidden=false;
  }else recipient.hidden=true;
  if(data.categoryKey&&data.topicLabel){message.textContent=data.message;preview.hidden=false;}else preview.hidden=true;
}

function updateWhatsappDetailsRequirement(){
  const topic=document.getElementById('whatsapp-topic');
  const details=document.getElementById('whatsapp-details');
  const marker=document.getElementById('whatsapp-details-required');
  const hint=document.getElementById('whatsapp-details-hint');
  const required=/^Other\b/.test(String(topic?.value||''));
  if(details){details.required=required;details.placeholder=required?'Describe your question or issue. Do not include passwords or card details.':'Optional: add any detail that will help the recipient. Do not include passwords or card details.';}
  if(marker)marker.hidden=!required;
  if(hint)hint.textContent=required?'Required because you selected Other.':'Optional for the selected question.';
}

function populateWhatsappTopics(){
  const category=document.getElementById('whatsapp-category');
  const topic=document.getElementById('whatsapp-topic');
  const topics=WHATSAPP_TOPICS[category.value]||[];
  topic.replaceChildren(new Option(topics.length?'Select the closest question':'Select a query area first',''));
  topics.forEach(label=>topic.add(new Option(label,label)));
  topic.disabled=!topics.length;
  updateWhatsappDetailsRequirement();
  renderWhatsappSupport();
}

function normaliseReplyMobile(value){
  const compact=String(value||'').trim().replace(/[\s()-]/g,'');
  return compact.startsWith('00')?`+${compact.slice(2)}`:compact;
}

function setWhatsappPanel(open){
  const panel=document.getElementById('whatsapp-panel');
  const toggle=document.getElementById('whatsapp-toggle');
  if(!panel||!toggle)return;
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  if(open){syncWhatsappFromRegistration();renderWhatsappSupport();setTimeout(()=>document.getElementById('whatsapp-category')?.focus(),0);}
  else toggle.focus();
}

function initWhatsappSupport(){
  const support=document.querySelector('.whatsapp-support');
  const panel=document.getElementById('whatsapp-panel');
  const toggle=document.getElementById('whatsapp-toggle');
  const close=document.getElementById('whatsapp-close');
  const supportForm=document.getElementById('whatsapp-support-form');
  const category=document.getElementById('whatsapp-category');
  const status=document.getElementById('whatsapp-status');
  if(!support||!panel||!toggle||!close||!supportForm||!category||!status)return;
  toggle.addEventListener('click',()=>setWhatsappPanel(panel.hidden));
  close.addEventListener('click',()=>setWhatsappPanel(false));
  category.addEventListener('change',populateWhatsappTopics);
  document.getElementById('whatsapp-topic').addEventListener('change',()=>{updateWhatsappDetailsRequirement();renderWhatsappSupport();});
  supportForm.addEventListener('input',()=>{status.textContent='';renderWhatsappSupport();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)setWhatsappPanel(false);});
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!support.contains(event.target))setWhatsappPanel(false);});
  supportForm.addEventListener('submit',event=>{
    event.preventDefault();status.textContent='';
    syncWhatsappFromRegistration();
    const mobile=document.getElementById('whatsapp-mobile');
    mobile.value=normaliseReplyMobile(mobile.value);
    if(!supportForm.reportValidity())return;
    if(!/^\+[1-9]\d{7,14}$/.test(mobile.value)){status.textContent='Enter your mobile number with its country code, for example +94 77 123 4567.';mobile.focus();return;}
    const data=whatsappMessageData();
    if(data.fields.reference&&!/^NEW2AN2026-[A-Z0-9]{7,12}$/.test(data.fields.reference)){status.textContent='Check the registration reference format, or leave it blank if you have not registered yet.';document.getElementById('whatsapp-reference').focus();return;}
    if(!data.contact){status.textContent='Select a committee or support area.';category.focus();return;}
    const url=`https://wa.me/${data.contact.number}?text=${encodeURIComponent(data.message)}`;
    window.open(url,'_blank','noopener,noreferrer');
    status.textContent=`WhatsApp opened for ${data.contact.name}. Review the message before sending.`;
  });
}

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
  add('Excursion',submissions.filter(r=>r.Excursion_Interest&&r.Excursion_Interest!=='No').map(r=>pick(r,['Reference_ID','Full_Name','Phone','Excursion_Interest','Excursion_Participant_Count','Excursion_Fee_Per_Person_USD','Excursion_Total_USD','Excursion_USD_to_EUR_Rate','Excursion_Total_EUR_Indicative','Excursion_Participant_Names','Excursion_Group_Details','Excursion_Activity_Level','Excursion_Mobility_Needs','Excursion_Dietary_Needs','Excursion_Guide_Language'])));
  add('Air Ticket Requests',submissions.filter(r=>r.Travel_Details_Status||r.Air_Ticket_Assistance).map(r=>pick(r,['Reference_ID','Full_Name','Passport_Name','Email','Phone','Designation','Organization','Nationality','Travel_Details_Status','Travel_Details_Last_Updated','Air_Ticket_Assistance','Ticket_Departure_City_Airport','Preferred_Departure_Home_Date','Preferred_Arrival_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Date','Preferred_Departure_Sri_Lanka_Time','Ticket_Destination_City_Airport','Passport_Number','Date_of_Birth','Passport_Issue_Date','Passport_Expiry_Date','Place_Country_of_Birth','Passport_Bio_Page_Files','Travel_Details_Consent'])));
  add('Workshops',submissions.map(r=>pick(r,['Reference_ID','Full_Name','Email','Workshop_Attendance','Workshop_Selections','Future_Workshop_Updates','Workshop_Notes'])));
  add('Payments',submissions.map(r=>pick(r,['Reference_ID','Full_Name','Email','Registration_Category','Registration_Fee','Currency','Fee_Basis','Payment_Stage','Payment_Status','Transaction_Reference','Amount_Paid','Payment_Currency','Payment_Proof_Files','Gala_Dinner_Interest','Gala_Dinner_Fee','Gala_Dinner_Currency','Gala_Dinner_Payment_Reference'])));
  add('Gala Dinner',submissions.filter(r=>r.Gala_Dinner_Interest==='Yes').map(r=>pick(r,['Reference_ID','Full_Name','Email','Registration_Category','Gala_Dinner_Fee','Gala_Dinner_Currency','Gala_Dinner_Payment_Reference'])));
  add('Support Requests',submissions.filter(r=>r.Support_Request||r.Support_Category).map(r=>pick(r,['Reference_ID','Full_Name','Email','Phone','Country_of_Residence','Support_Category','Support_Reply_Method','Support_Request','Visa_Support','Travel_Agency_Assistance','Accommodation_Assistance'])));
  XLSX.writeFile(book,`NEW2AN_2026_Operations_${new Date().toISOString().slice(0,10)}.xlsx`);
});

refreshFee(); renderPapers(); updateCategoryState(); updateAttendanceVisibility(); updateBillingVisibility(); renderProofList(); ensureWorkshopAdmin(); loadWorkshopSettings(); initWhatsappSupport();
const savedDraft = localStorage.getItem(CONFIG.draftKey); if (savedDraft) { try { restore(JSON.parse(savedDraft)); } catch (_) {} }
openViewFromHash();
