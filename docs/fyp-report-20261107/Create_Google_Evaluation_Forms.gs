/**
 * Optional Google Apps Script: create two forms in YOUR Google account.
 * Paste into https://script.new and run createFypEvaluationForms.
 * Review the forms before enabling/publishing responses. This script sends no messages.
 */
const DATA = {
  "client_tasks": [
    [
      "C1",
      "O3",
      "Find and change the kitchen story or a menu detail in a supervised test record."
    ],
    [
      "C2",
      "O1, O3",
      "Set/check delivery areas, their fees, 07:30–11:00 hours and enabled collection."
    ],
    [
      "C3",
      "O2",
      "Create a received ingredient batch using the appropriate printed or documented-life mode; explain its effective deadline."
    ],
    [
      "C4",
      "O2",
      "Explain why a held, expired or future-received batch is excluded from available stock."
    ],
    [
      "C5",
      "O1, O2",
      "Check 3 units of every offered menu; identify the total units and a shortfall without adding stock."
    ],
    [
      "C6",
      "O1, O4",
      "Check packaging assignment and the ingredient/packaging movement for a prepared test order."
    ],
    [
      "C7",
      "O1, O4",
      "Review a synthetic receipt, distinguish unverified proof from paid status, and explain the cash versus collection rule."
    ],
    [
      "C8",
      "O1",
      "Confirm actual food receipt for eligible test orders; explain why payment is separate."
    ],
    [
      "C9",
      "O1, O4",
      "Open a daily menu summary and print preview; check the saved name, address and phone."
    ],
    [
      "C10",
      "O4",
      "Read a sales period and a price scenario; distinguish sales, known-cost contribution and net profit."
    ],
    [
      "C11",
      "O5",
      "Review one-menu/mixed suggestions and their whole-order budget totals."
    ],
    [
      "C12",
      "O1, O3",
      "Try customer/staff access and discuss whether passkeys and contact entry are practical for this business."
    ]
  ],
  "client_questions": [
    "Which parts fit your actual ordering, stock and handover routine?",
    "Which steps were unclear, unnecessary or difficult? Please refer to a task or screen.",
    "Are the current menu prices/days, estimated recipes, packaging and area fees correct? List any corrections; estimates must not be treated as verified production data.",
    "Is requiring a passkey account acceptable for your customers? What device/access or support concern remains?",
    "What must change before you would use this with genuine customer orders?",
    "Which decisions could the sales/stock information help you make, and what information is still missing?"
  ],
  "student_likert": [
    [
      "S1",
      "O3",
      "I could identify which kitchen I was ordering from."
    ],
    [
      "S2",
      "O3",
      "The menu price and the meaning of a meal, box or pack were clear."
    ],
    [
      "S3",
      "O1",
      "I could find an offered date and an allowed delivery/collection time."
    ],
    [
      "S4",
      "O1",
      "I could see the delivery fee and complete order total before placing an order."
    ],
    [
      "S5",
      "O1",
      "I understood that uploading a receipt does not mean the kitchen has verified payment."
    ],
    [
      "S6",
      "O1",
      "The customer account and passkey sign-in instructions were understandable."
    ],
    [
      "S7",
      "O1, O3",
      "I could return from a dialog or recover from an input error without losing my place."
    ],
    [
      "S8",
      "O5",
      "The suggestions were relevant to the date, quantity and preferences in my task."
    ],
    [
      "S9",
      "O5",
      "I understood the difference between Allow a mix and One menu only."
    ],
    [
      "S10",
      "O5",
      "I could tell whether the suggested complete basket was within or above my budget."
    ]
  ],
  "student_open": [
    "Which screen or step was most confusing, and why?",
    "What would you change to make ordering easier?",
    "Was there anything you could not test, including passkey/device access?"
  ]
};

function createFypEvaluationForms() {
  const properties = PropertiesService.getUserProperties();
  const saved = properties.getProperty('FYP2_EVALUATION_FORMS_V1');
  if (saved) {
    console.log('Previously created forms (no duplicates created):');
    console.log(saved);
    return JSON.parse(saved);
  }
  const result = {};
  const student = FormApp.create('Customer Usability Evaluation — Wrap & Bowl Kuch');
  student.setAcceptingResponses(false);
  student.setCollectEmail(false).setLimitOneResponsePerUser(false).setProgressBar(true);
  student.setDescription('Voluntary academic evaluation of a home-kitchen preorder website. Try the supervised customer tasks first, using test contact details provided by the researcher. Stop before real payment or actual order placement. Do not upload a real bank receipt or enter your name, phone or email in this questionnaire. Confirm the consent and recruitment arrangements with the project supervisor before distributing this form.');
  student.setConfirmationMessage('Thank you. Your response will be reviewed for this academic project.');
  const consent = student.addMultipleChoiceItem().setTitle('I have read the purpose and voluntarily agree to take part.').setRequired(true);
  const questions = student.addPageBreakItem().setTitle('Customer experience');
  consent.setChoices([consent.createChoice('I agree', questions), consent.createChoice('I do not agree', FormApp.PageNavigationType.SUBMIT)]);
  student.addMultipleChoiceItem().setTitle('Device used').setChoiceValues(['Phone','Tablet','Laptop or desktop','Other']);
  student.addMultipleChoiceItem().setTitle('How often do you order food online?').setChoiceValues(['Never','Occasionally','Frequently']);
  student.addMultipleChoiceItem().setTitle('Passkey access in this test').setChoiceValues(['Supported and tried','Not supported','Not attempted']);
  student.addSectionHeaderItem().setTitle('Tasks before rating').setHelpText('Task A: use ordinary browsing to choose three selling units within a feasible whole-order budget, such as RM60, for an offered date and agreed delivery area. Task B: try a comparable choice using date suggestions. The researcher assigns/counterbalances the task order. A meal, box or pack is one unit. Stop before actual payment or placement. The researcher records task success, help and measured time separately.');
  student.addMultipleChoiceItem().setTitle('Task order assigned by the researcher').setChoiceValues(['A then B','B then A','Only one task attempted','No task attempted']);
  student.addGridItem().setTitle('Please rate only the functions you tried.').setRows(DATA.student_likert.map(row => row[0] + ': ' + row[2])).setColumns(['Strongly disagree','Disagree','Neither agree nor disagree','Agree','Strongly agree','Not tried / not applicable']).setRequired(true);
  student.addMultipleChoiceItem().setTitle('S11: Compared with ordinary browsing, the suggestions required…').setChoiceValues(['Much less effort','Less effort','About the same','More effort','Much more effort','Not compared']);
  student.addMultipleChoiceItem().setTitle('S12: If the real menu, price and date suited you, how likely would you be to preorder?').setHelpText('This measures intention, not a real paid purchase.').setChoiceValues(['Very unlikely','Unlikely','Unsure','Likely','Very likely']);
  student.addMultipleChoiceItem().setTitle('S13: Do recorded batch dates alone guarantee that food is physically fresh and safe?').setChoiceValues(['Yes','No','Not sure']);
  DATA.student_open.forEach((question, index) => student.addParagraphTextItem().setTitle('S' + (index + 14) + ': ' + question));
  result.student = {edit:student.getEditUrl(),respond:student.getPublishedUrl()};
  // Save immediately so a later failure cannot silently create a second student form.
  properties.setProperty('FYP2_EVALUATION_FORMS_V1', JSON.stringify(result));
  const client = FormApp.create('Client Follow-up and Acceptance — Wrap & Bowl Kuch');
  client.setAcceptingResponses(false);
  client.setCollectEmail(false).setLimitOneResponsePerUser(false).setProgressBar(true);
  client.setDescription('Complete after trying the current system with supervised test records. The earlier client meetings are informal requirements feedback; this form is not a backdated interview. Do not make a real transfer, contact a genuine customer or change real stock solely for this evaluation.');
  client.addTextItem().setTitle('Client name and business (optional)');
  client.addTextItem().setTitle('Date, website revision and device tested');
  const clientConsent = client.addMultipleChoiceItem().setTitle('I agree that this feedback may be used in the academic project.').setRequired(true);
  const clientQuestions = client.addPageBreakItem().setTitle('Tasks actually tried');
  clientConsent.setChoices([clientConsent.createChoice('I agree',clientQuestions),clientConsent.createChoice('I do not agree',FormApp.PageNavigationType.SUBMIT)]);
  client.addGridItem().setTitle('Outcome of each observed task').setHelpText('Do not assume that watching a demonstration means completing or accepting the task.').setRows(DATA.client_tasks.map(row => row[0] + ': ' + row[2])).setColumns(['Completed independently','Completed with help','Not completed','Not attempted']).setRequired(true);
  DATA.client_questions.forEach((question,index) => client.addParagraphTextItem().setTitle((index+1) + '. ' + question));
  client.addMultipleChoiceItem().setTitle('Overall assessment of the tasks tried').setChoiceValues(['Suitable for the tested use','Suitable after listed changes','Not yet suitable','Not enough tried to decide']);
  client.addParagraphTextItem().setTitle('Agreed changes, priority and any actual retest result');
  client.addTextItem().setTitle('Optional typed acknowledgement and actual date').setHelpText('This is feedback acknowledgement, not a certified digital signature, food-safety certificate or university mark.');
  result.client = {edit:client.getEditUrl(),respond:client.getPublishedUrl()};
  properties.setProperty('FYP2_EVALUATION_FORMS_V1',JSON.stringify(result));
  console.log('FORMS CREATED WITH RESPONSES CLOSED. Review settings, consent and tasks, then publish/enable responses in Google Forms. Share responder links; keep edit links private.');
  console.log(JSON.stringify(result,null,2));
  return result;
}
