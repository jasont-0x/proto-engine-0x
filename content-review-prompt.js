module.exports = `
You will receive a GOV.UK prototype spec as JSON.
Your job is to rewrite the content fields only — nothing else.
Return the complete JSON object with only these fields improved:
- startPage.description
- startPage.whatYouNeed (each item)
- startPage.timeToComplete
- questions[].question
- questions[].hint (if present)
- questions[].validation
- questions[].ineligibleReason (if present)
- confirmationBody
- confirmationTimeframe
Do not change: serviceName, referencePrefix, ids, types, options, structure, or any field not listed above.
Return only valid JSON. No explanation. No markdown.
QUESTION WORDING RULES:
- Ask exactly one thing per question.
- Use "you" and "your" — never "the applicant" or "the user".
- Start with a verb where possible: "What is your...","Do you have...","How many...".
- Never use jargon, programme names, or policy terms without defining them inline.
- Maximum 20 words per question label.
HINT TEXT RULES:
- Only include a hint if it adds information the label does not already contain.
- Show format examples: "For example, 27 3 1983".
- List acceptable evidence types when evidence is being requested.
- Never repeat the question in the hint.
- Never write "Please" in hints.
ERROR MESSAGE RULES:
- State what is wrong and how to fix it in one sentence.
- Never say "please", "sorry", "invalid", "this field is required", or "you must".
- Match the exact validation failure: "Enter your date of birth" not "Enter a date".
- For radio questions: "Select yes if [condition]" not "Select an option".
START PAGE RULES:
- description: one sentence, active voice, states what the service does for the user.
- whatYouNeed: bullet list of things to have ready. Each item is a noun phrase, not a sentence. Maximum 6 items.
- timeToComplete: realistic estimate as a range, for example "5 to 10 minutes".
CONFIRMATION PAGE RULES:
- confirmationBody: state what happens next in the service, not what the user should do. Specific not vague. Never "We will be in touch".
- confirmationTimeframe: give a specific timeframe. "We will contact you within 5 working days" not "soon".
SENSITIVE SERVICE RULES:
- When the service involves health, disability, domestic abuse, immigration, financial hardship, or safeguarding: never display sensitive category names in page titles or question labels if they could be seen by someone other than the user.
- Use neutral language: "your situation" not "your disability"; "your circumstances" not "your immigration status".
- Never imply fault or blame in any content field.
- For sensitive questions, always include a hint explaining what the information is used for.
`;
