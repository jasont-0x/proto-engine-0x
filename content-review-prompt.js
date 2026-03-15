module.exports = `
You will receive a GOV.UK prototype spec as JSON.
Rewrite the content fields only. Return the complete JSON object.
CRITICAL: Return ONLY valid JSON. No explanation. No markdown. No backticks.
Fields to rewrite:
- startPage.description
- startPage.whatYouNeed (each item)
- startPage.timeToComplete
- questions[].question
- questions[].hint (if present)
- questions[].validation
- questions[].ineligibleReason (if present)
- confirmationBody
- confirmationTimeframe
Do not change: serviceName, referencePrefix, ids, types, options, structure.
<language_rules>
- Keep sentences to 15 words or fewer. If longer, split into two sentences.
- Use one or two syllable words where a longer word means the same thing.
- Never use nominalisations. Write "apply" not "make an application". Write "decide" not "make a decision". Write "help" not "provide assistance". Write "use" not "utilise".
- Use words a 12-year-old would recognise. If you would not say it out loud, do not write it.
- Use "you" and "your" throughout. Never "the applicant" or "the user".
- Never use jargon without immediately defining it in plain English.
</language_rules>
<question_rules>
- Each question asks exactly one thing.
- Start with a verb: "What is your...", "Do you have...", "How many..."
- Maximum 15 words.
</question_rules>
<hint_rules>
- Only write hint text when it adds something the label does not already contain.
- Show real format examples: "For example, 27 3 1983"
- List acceptable evidence types when requesting evidence.
- State time windows when relevant: "in the last 3 months"
- Never repeat the label. Never write "Please".
- If hint text would restate the obvious, set it to null.
</hint_rules>
<error_rules>
- State exactly what went wrong and exactly how to fix it. One sentence.
- Never use: please, sorry, invalid, required, must, this field.
- Match the specific failure: "Enter your date of birth" not "Enter a date".
- For radio questions: "Select yes if [specific condition]".
- Blame-free. The service failed, not the user.
</error_rules>
<start_page_rules>
- description: one sentence, active voice, what the service does for the user not the department.
- whatYouNeed: noun phrases only, not sentences. Only things that would genuinely cause a problem if missing.
- timeToComplete: honest range, not vague.
</start_page_rules>
<confirmation_rules>
- confirmationBody: name the actual next step. Not "we will be in touch". Not "your application is being processed".
- confirmationTimeframe: specific timeframe plus what to do if no response.
- Never congratulate the user.
</confirmation_rules>
<ineligibility_rules>
- Never leave a user at a dead end.
- State the specific reason without blame.
- Always offer a concrete alternative: a different service, a phone number, a next step.
- Never write "you do not qualify". State the specific reason instead.
</ineligibility_rules>
<sensitive_service_rules>
- When the service involves health, disability, domestic abuse, immigration, financial hardship, or safeguarding: use neutral language.
- "Your situation" not "your disability". "Your circumstances" not "your immigration status".
- Never display sensitive category names in question labels.
- For sensitive questions, the hint must explain what the information is used for and who will see it.
- Never imply fault or blame.
</sensitive_service_rules>
`;
