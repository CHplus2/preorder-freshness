// Creates blank Google Forms in the account that runs this script.
// No responses, messages or emails are generated. Review before enabling responses.
const DATA = {
  "client_tasks": [
    [
      "C1",
      "O3",
      "Review the kitchen profile and one menu, including price, selling unit, offered days and recipe."
    ],
    [
      "C2",
      "O1",
      "Check delivery areas and fees, morning hours and the collection option."
    ],
    [
      "C3",
      "O2",
      "Try an ingredient batch in the test setup; explain its date method, deadline and hold status."
    ],
    [
      "C4",
      "O1, O2",
      "Review packaging stock and the pieces assigned to one menu."
    ],
    [
      "C5",
      "O1, O2",
      "Check a stock target and compare the ingredient and packaging deductions for an example order."
    ],
    [
      "C6",
      "O1",
      "Review payment evidence and food-received status; explain the difference."
    ],
    [
      "C7",
      "O1, O4",
      "Open a daily order summary and preview a slip containing the customer name, address and phone."
    ],
    [
      "C8",
      "O4",
      "Read a sales period and compare a price scenario; explain what the cost estimate includes."
    ]
  ],
  "client_questions": [
    "Which parts fit your business routine, and which are difficult or unnecessary?",
    "Are name, phone and passkey accounts practical for your customers? What concern remains?",
    "Which menu, recipe, packaging, delivery-fee or other details still need correcting?",
    "What must change before you would use this system for actual orders?"
  ],
  "student_likert": [
    [
      "S1",
      "O3",
      "I could identify the business I was ordering from."
    ],
    [
      "S2",
      "O3",
      "The price and contents of a selling unit were clear."
    ],
    [
      "S3",
      "O1",
      "I could find an offered date and an allowed delivery or collection time."
    ],
    [
      "S4",
      "O1",
      "I could see the delivery fee and complete order total."
    ],
    [
      "S5",
      "O1",
      "The account and passkey instructions were understandable."
    ],
    [
      "S6",
      "O1",
      "I understood that an uploaded receipt still needs payment verification."
    ],
    [
      "S7",
      "O2",
      "The ingredient storage summary was understandable."
    ],
    [
      "S8",
      "O5",
      "The suggestions matched my date, quantity and budget choices."
    ],
    [
      "S9",
      "O5",
      "The difference between Allow a mix and One menu only was clear."
    ]
  ],
  "student_open": [
    "Which step was most confusing, and what would you change?"
  ],
  "student_effort": {
    "id": "S10",
    "objective": "O5",
    "question": "Compared with ordinary browsing, how much effort did choosing with suggestions require?",
    "options": [
      "Much less effort",
      "Less effort",
      "About the same effort",
      "More effort",
      "Much more effort",
      "I did not try both"
    ]
  },
  "student_tasks": [
    "Browse the menu and open Ingredient storage records. Review what is recorded and the explanation of date-based status.",
    "Task A: start with an empty basket and use ordinary browsing to choose three selling units for an assigned offered date and area, within the agreed budget. Stop at checkout review.",
    "Task B: start again with an empty basket and use Suggestions for a date for a comparable date, area, quantity and budget. Review an option and checkout guidance. Stop before payment or order placement."
  ],
  "rating_scale": [
    "1 — Strongly disagree",
    "2 — Disagree",
    "3 — Neither agree nor disagree",
    "4 — Agree",
    "5 — Strongly agree",
    "Not tried / not applicable"
  ],
  "client_outcomes": [
    "Completed independently",
    "Completed with help",
    "Could not complete",
    "Not tried"
  ]
};
function createWrapBowlEvaluationForms() {
  const properties = PropertiesService.getScriptProperties();
  const registryName = 'wrap_bowl_forms_v2';
  const existing = properties.getProperty(registryName);
  if (existing) {
    const saved = JSON.parse(existing);
    saved.forEach(id => {
      const form = FormApp.openById(id);
      Logger.log(form.getTitle() + '\nEdit: ' + form.getEditUrl() + '\nShare after review: ' + form.getPublishedUrl());
    });
    return;
  }
  const student = FormApp.create('Wrap & Bowl Kuch — customer experience');
  student.setDescription('Voluntary academic feedback on a home-kitchen preorder website. Try the agreed customer tasks using example details, then answer only about steps you tried. Stop before a real payment or live order placement. Do not enter your personal phone, email or bank receipt. Please allow about 10–15 minutes for the tasks and form; you may stop at any time.');
  configurePrivateForm(student);
  addConsent(student, 'I am 18 or over and voluntarily agree to take part.');
  student.addTextItem().setTitle('Participant code supplied by the researcher (optional)').setHelpText('Use the assigned code, not your name or contact details.');
  student.addMultipleChoiceItem().setTitle('Device used').setChoiceValues(['Phone', 'Tablet', 'Laptop or desktop', 'Other']);
  student.addSectionHeaderItem().setTitle('Tasks to try').setHelpText(DATA.student_tasks.join('\n\n') + '\n\nThe researcher assigns feasible dates, areas and budgets. Empty the basket before each task. Alternate A/B order as assigned. Do not make a real payment or place a live order. If you cannot try account access, select Not tried for that rating.');
  student.addMultipleChoiceItem().setTitle('Which comparison tasks did you try?').setChoiceValues(['Both: A then B', 'Both: B then A', 'Only A (ordinary browsing)', 'Only B (suggestions)', 'Neither']).setRequired(true);
  student.addSectionHeaderItem().setTitle('Your experience').setHelpText('Choose Not tried / not applicable for anything you did not try.');
  DATA.student_likert.forEach(row => student.addMultipleChoiceItem().setTitle(row[0] + ': ' + row[2]).setChoiceValues(DATA.rating_scale).setRequired(true));
  student.addMultipleChoiceItem().setTitle(DATA.student_effort.id + ': ' + DATA.student_effort.question).setChoiceValues(DATA.student_effort.options).setRequired(true);
  student.addParagraphTextItem().setTitle('S11: ' + DATA.student_open[0]);
  student.setConfirmationMessage('Thank you. Responses will be used for this academic project.');

  const client = FormApp.create('Wrap & Bowl Kuch — client follow-up');
  client.setDescription('Complete this after trying the current website. Earlier meetings remain requirements feedback. Use the supervised example setup for stock, order and payment changes. This form records your current assessment; it does not perform a payment or certify food safety.');
  configurePrivateForm(client);
  addConsent(client, 'I agree that my feedback can be recorded for this project.');
  client.addDateItem().setTitle('Date of evaluation').setRequired(true);
  client.addGridItem().setTitle('Tasks tried').setHelpText('Use Not tried if a task was only described, rather than attempted.').setRows(DATA.client_tasks.map(row => row[0] + ': ' + row[2])).setColumns(DATA.client_outcomes).setRequired(true);
  DATA.client_questions.forEach((question,index) => client.addParagraphTextItem().setTitle((index+1) + '. ' + question));
  client.addMultipleChoiceItem().setTitle('Overall assessment of the tasks tried').setChoiceValues(['Suitable for the tasks tried','Suitable after changes','Not yet suitable','Not enough tried to decide']).setRequired(true);
  client.addParagraphTextItem().setTitle('Changes agreed (optional)');
  client.setConfirmationMessage('Thank you. Your comments will be reviewed with the project author.');
  const created=[student,client];
  properties.setProperty(registryName,JSON.stringify(created.map(form=>form.getId())));
  created.forEach(form=>Logger.log(form.getTitle()+'\nEdit: '+form.getEditUrl()+'\nShare after review: '+form.getPublishedUrl()));
}
function configurePrivateForm(form) {
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setPublishingSummary(false);
  form.setAcceptingResponses(false);
}
function addConsent(form, title) {
  const consent=form.addMultipleChoiceItem().setTitle(title).setRequired(true);
  const questions=form.addPageBreakItem().setTitle('Feedback');
  consent.setChoices([consent.createChoice('I agree',questions),consent.createChoice('I do not agree',FormApp.PageNavigationType.SUBMIT)]);
}
