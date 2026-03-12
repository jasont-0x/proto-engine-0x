// ─── Sanitisation helpers ─────────────────────────────────────────────────────

// Escape for use inside a single-quoted JS string
function jsStr(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .trim();
}

// Escape for use inside HTML / Nunjucks text content
function htmlStr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim();
}

// Escape for use inside a Nunjucks double-quoted string attribute
function njkAttr(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

// Safe URL slug
function slug(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'field';
}

// Safe npm package name
function pkgName(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'prototype';
}

// Safe reference prefix
function refPrefix(str) {
  return String(str || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4) || 'REF';
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('Spec is not an object');
  if (!spec.serviceName || typeof spec.serviceName !== 'string') throw new Error('Missing serviceName');
  if (!spec.referencePrefix || typeof spec.referencePrefix !== 'string') throw new Error('Missing referencePrefix');
  if (!spec.startPage || typeof spec.startPage !== 'object') throw new Error('Missing startPage');
  if (!spec.startPage.heading) throw new Error('Missing startPage.heading');
  if (!spec.startPage.description) throw new Error('Missing startPage.description');
  if (!Array.isArray(spec.startPage.whatYouNeed)) spec.startPage.whatYouNeed = ['your details'];
  if (!spec.startPage.timeToComplete) spec.startPage.timeToComplete = '10 minutes';
  if (!Array.isArray(spec.questions) || spec.questions.length < 1) throw new Error('Missing questions array');

  spec.questions = spec.questions.map((q, i) => {
    if (!q.id || typeof q.id !== 'string') q.id = 'question-' + (i + 1);
    q.id = slug(q.id);
    if (!q.type || !['radio', 'text', 'textarea'].includes(q.type)) q.type = 'text';
    if (!q.question || typeof q.question !== 'string') q.question = 'Question ' + (i + 1);
    if (!q.validation || typeof q.validation !== 'string') q.validation = 'Enter an answer';
    if (q.type === 'radio' && (!Array.isArray(q.options) || q.options.length < 2)) {
      q.options = ['Yes', 'No'];
    }
    if (q.type !== 'radio') q.options = null;
    if (!q.hint || typeof q.hint !== 'string') q.hint = null;
    if (!q.ineligibleAnswer || typeof q.ineligibleAnswer !== 'string') q.ineligibleAnswer = null;
    if (!q.ineligibleReason || typeof q.ineligibleReason !== 'string') q.ineligibleReason = null;
    return q;
  });

  if (!spec.checkAnswersHeading) spec.checkAnswersHeading = 'Check your answers before sending';
  if (!spec.confirmationHeading) spec.confirmationHeading = 'Application submitted';
  if (!spec.confirmationBody) spec.confirmationBody = 'We have received your application.';
  if (!spec.confirmationTimeframe) spec.confirmationTimeframe = 'We will be in touch shortly.';

  return spec;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function generateRoutesJs(spec) {
  const prefix = refPrefix(spec.referencePrefix);

  let out = "const govukPrototypeKit = require('govuk-prototype-kit')\n";
  out += "const router = govukPrototypeKit.requests.setupRouter()\n\n";
  out += "function generateReference(prefix) {\n";
  out += "  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'\n";
  out += "  let ref = prefix + '-'\n";
  out += "  for (let i = 0; i < 8; i++) {\n";
  out += "    ref += chars[Math.floor(Math.random() * chars.length)]\n";
  out += "  }\n";
  out += "  return ref\n";
  out += "}\n\n";
  out += "router.get('/', function (req, res) {\n";
  out += "  res.render('start')\n";
  out += "})\n\n";

  spec.questions.forEach(function(q, i) {
    const nextPage = i < spec.questions.length - 1 ? spec.questions[i + 1].id : 'check-answers';
    const validationMsg = jsStr(q.validation);
    const ineligibleValue = q.ineligibleAnswer ? slug(q.ineligibleAnswer) : null;

    out += "router.get('/" + q.id + "', function (req, res) {\n";
    out += "  res.render('" + q.id + "', { errors: null, data: req.session.data })\n";
    out += "})\n\n";

    out += "router.post('/" + q.id + "', function (req, res) {\n";
    out += "  const answer = req.session.data['" + q.id + "']\n";
    out += "  if (!answer || !answer.toString().trim()) {\n";
    out += "    return res.render('" + q.id + "', {\n";
    out += "      errors: { '" + q.id + "': '" + validationMsg + "' },\n";
    out += "      data: req.session.data\n";
    out += "    })\n";
    out += "  }\n";
    if (ineligibleValue) {
      out += "  if (answer === '" + ineligibleValue + "') {\n";
      out += "    return res.redirect('/ineligible-" + q.id + "')\n";
      out += "  }\n";
    }
    out += "  res.redirect('/" + nextPage + "')\n";
    out += "})\n\n";

    if (ineligibleValue) {
      out += "router.get('/ineligible-" + q.id + "', function (req, res) {\n";
      out += "  res.render('ineligible-" + q.id + "')\n";
      out += "})\n\n";
    }
  });

  out += "router.get('/check-answers', function (req, res) {\n";
  out += "  res.render('check-answers', { data: req.session.data })\n";
  out += "})\n\n";
  out += "router.post('/check-answers', function (req, res) {\n";
  out += "  if (!req.session.data['reference']) {\n";
  out += "    req.session.data['reference'] = generateReference('" + prefix + "')\n";
  out += "  }\n";
  out += "  res.redirect('/confirmation')\n";
  out += "})\n\n";
  out += "router.get('/confirmation', function (req, res) {\n";
  out += "  res.render('confirmation', { data: req.session.data })\n";
  out += "})\n\n";
  out += "module.exports = router\n";

  return out;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function generateMainLayout() {
  return '{% extends "govuk-prototype-kit/layouts/govuk-branded.njk" %}\n';
}

function generateStartPage(spec) {
  const items = spec.startPage.whatYouNeed
    .map(function(item) { return '      <li>' + htmlStr(item) + '</li>'; })
    .join('\n');

  return '{% extends "layouts/main.html" %}\n\n' +
    '{% set pageName = "' + njkAttr(spec.startPage.heading) + '" %}\n\n' +
    '{% block content %}\n' +
    '<div class="govuk-grid-row">\n' +
    '  <div class="govuk-grid-column-two-thirds">\n' +
    '    <h1 class="govuk-heading-xl">' + htmlStr(spec.startPage.heading) + '</h1>\n' +
    '    <p class="govuk-body">' + htmlStr(spec.startPage.description) + '</p>\n' +
    '    <p class="govuk-body">You will need:</p>\n' +
    '    <ul class="govuk-list govuk-list--bullet">\n' +
    items + '\n' +
    '    </ul>\n' +
    '    <p class="govuk-body">It takes around <strong>' + htmlStr(spec.startPage.timeToComplete) + '</strong> to complete.</p>\n' +
    '    {{ govukButton({\n' +
    '      text: "Start now",\n' +
    '      href: "/' + spec.questions[0].id + '",\n' +
    '      isStartButton: true\n' +
    '    }) }}\n' +
    '  </div>\n' +
    '</div>\n' +
    '{% endblock %}\n';
}

function generateQuestionPage(q) {
  const questionText = njkAttr(q.question);
  const hintText = q.hint ? njkAttr(q.hint) : null;

  let component = '';

  if (q.type === 'radio') {
    const items = q.options
      .map(function(opt) {
        return '        { value: "' + njkAttr(slug(opt)) + '", text: "' + njkAttr(opt) + '" }';
      })
      .join(',\n');

    component = '    {{ govukRadios({\n' +
      '      name: "' + q.id + '",\n' +
      '      fieldset: {\n' +
      '        legend: {\n' +
      '          text: "' + questionText + '",\n' +
      '          isPageHeading: true,\n' +
      '          classes: "govuk-fieldset__legend--l"\n' +
      '        }\n' +
      '      },\n' +
      (hintText ? '      hint: { text: "' + hintText + '" },\n' : '') +
      "      errorMessage: errors['" + q.id + "'] if errors else null,\n" +
      "      value: data['" + q.id + "'],\n" +
      '      items: [\n' +
      items + '\n' +
      '      ]\n' +
      '    }) }}';
  } else if (q.type === 'textarea') {
    component = '    {{ govukTextarea({\n' +
      '      id: "' + q.id + '",\n' +
      '      name: "' + q.id + '",\n' +
      '      label: {\n' +
      '        text: "' + questionText + '",\n' +
      '        isPageHeading: true,\n' +
      '        classes: "govuk-label--l"\n' +
      '      },\n' +
      (hintText ? '      hint: { text: "' + hintText + '" },\n' : '') +
      "      errorMessage: errors['" + q.id + "'] if errors else null,\n" +
      "      value: data['" + q.id + "'],\n" +
      '      rows: 5\n' +
      '    }) }}';
  } else {
    component = '    {{ govukInput({\n' +
      '      id: "' + q.id + '",\n' +
      '      name: "' + q.id + '",\n' +
      '      label: {\n' +
      '        text: "' + questionText + '",\n' +
      '        isPageHeading: true,\n' +
      '        classes: "govuk-label--l"\n' +
      '      },\n' +
      (hintText ? '      hint: { text: "' + hintText + '" },\n' : '') +
      "      errorMessage: errors['" + q.id + "'] if errors else null,\n" +
      "      value: data['" + q.id + "']\n" +
      '    }) }}';
  }

  return '{% extends "layouts/main.html" %}\n\n' +
    '{% set pageName = "' + questionText + '" %}\n\n' +
    '{% block content %}\n' +
    '<div class="govuk-grid-row">\n' +
    '  <div class="govuk-grid-column-two-thirds">\n\n' +
    '    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}\n\n' +
    "    {% if errors and errors['" + q.id + "'] %}\n" +
    '      {{ govukErrorSummary({\n' +
    '        titleText: "There is a problem",\n' +
    "        errorList: [{ text: errors['" + q.id + "'], href: \"#" + q.id + "\" }]\n" +
    '      }) }}\n' +
    '    {% endif %}\n\n' +
    '    <form method="post" novalidate>\n' +
    '      <input type="hidden" name="_csrf" value="{{ csrf }}">\n' +
    component + '\n' +
    '      {{ govukButton({ text: "Continue" }) }}\n' +
    '    </form>\n\n' +
    '  </div>\n' +
    '</div>\n' +
    '{% endblock %}\n';
}

function generateIneligiblePage(q) {
  const reason = htmlStr(q.ineligibleReason || 'Based on your answer, you cannot use this service.');

  return '{% extends "layouts/main.html" %}\n\n' +
    '{% set pageName = "You cannot use this service" %}\n\n' +
    '{% block content %}\n' +
    '<div class="govuk-grid-row">\n' +
    '  <div class="govuk-grid-column-two-thirds">\n\n' +
    '    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}\n\n' +
    '    <h1 class="govuk-heading-xl">You cannot use this service</h1>\n' +
    '    <p class="govuk-body">' + reason + '</p>\n' +
    '    <h2 class="govuk-heading-m">What you can do</h2>\n' +
    '    <p class="govuk-body">If you think this is wrong, <a href="/" class="govuk-link">start again</a> or contact us for help.</p>\n\n' +
    '  </div>\n' +
    '</div>\n' +
    '{% endblock %}\n';
}

function generateCheckAnswersPage(spec) {
  const rows = spec.questions.map(function(q) {
    return '      {\n' +
      '        key: { text: "' + njkAttr(q.question) + '" },\n' +
      "        value: { text: data['" + q.id + "'] if data['" + q.id + "'] else \"Not provided\" },\n" +
      '        actions: {\n' +
      '          items: [{\n' +
      '            href: "/' + q.id + '",\n' +
      '            text: "Change",\n' +
      '            visuallyHiddenText: "' + njkAttr(q.question.toLowerCase()) + '"\n' +
      '          }]\n' +
      '        }\n' +
      '      }';
  }).join(',\n');

  return '{% extends "layouts/main.html" %}\n\n' +
    '{% set pageName = "' + njkAttr(spec.checkAnswersHeading) + '" %}\n\n' +
    '{% block content %}\n' +
    '<div class="govuk-grid-row">\n' +
    '  <div class="govuk-grid-column-two-thirds">\n\n' +
    '    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}\n\n' +
    '    <h1 class="govuk-heading-xl">' + htmlStr(spec.checkAnswersHeading) + '</h1>\n\n' +
    '    {{ govukSummaryList({\n' +
    '      rows: [\n' +
    rows + '\n' +
    '      ]\n' +
    '    }) }}\n\n' +
    '    <form method="post" novalidate>\n' +
    '      <input type="hidden" name="_csrf" value="{{ csrf }}">\n' +
    '      {{ govukButton({ text: "Confirm and send" }) }}\n' +
    '    </form>\n\n' +
    '  </div>\n' +
    '</div>\n' +
    '{% endblock %}\n';
}

function generateConfirmationPage(spec) {
  return '{% extends "layouts/main.html" %}\n\n' +
    '{% set pageName = "' + njkAttr(spec.confirmationHeading) + '" %}\n\n' +
    '{% block content %}\n' +
    '<div class="govuk-grid-row">\n' +
    '  <div class="govuk-grid-column-two-thirds">\n\n' +
    '    <div class="govuk-panel govuk-panel--confirmation">\n' +
    '      <h1 class="govuk-panel__title">' + htmlStr(spec.confirmationHeading) + '</h1>\n' +
    '      <div class="govuk-panel__body">\n' +
    '        Your reference number<br>\n' +
    "        <strong>{{ data['reference'] }}</strong>\n" +
    '      </div>\n' +
    '    </div>\n\n' +
    '    <h2 class="govuk-heading-m">What happens next</h2>\n' +
    '    <p class="govuk-body">' + htmlStr(spec.confirmationBody) + '</p>\n' +
    '    <p class="govuk-body">' + htmlStr(spec.confirmationTimeframe) + '</p>\n' +
    '    <p class="govuk-body"><a href="/" class="govuk-link">Start a new application</a></p>\n\n' +
    '  </div>\n' +
    '</div>\n' +
    '{% endblock %}\n';
}

function generatePackageJson(spec) {
  return JSON.stringify({
    name: pkgName(spec.serviceName),
    version: '1.0.0',
    description: spec.serviceName,
    main: 'node_modules/govuk-prototype-kit/listen-on-port.js',
    scripts: {
      start: 'node node_modules/govuk-prototype-kit/listen-on-port.js',
      dev: 'node node_modules/govuk-prototype-kit/listen-on-port.js'
    },
    engines: { node: '22.x' },
    dependencies: {
      'govuk-prototype-kit': '^13.16.2'
    }
  }, null, 2);
}

function generateAppConfig(spec) {
  return JSON.stringify({
    serviceName: spec.serviceName,
    serviceUrl: '/',
    useServiceNavigation: false,
    useAuth: false
  }, null, 2);
}

// ─── Main export ──────────────────────────────────────────────────────────────

function buildPrototypeFiles(rawSpec) {
  const spec = validateSpec(rawSpec);
  const files = {};

  files['package.json'] = generatePackageJson(spec);
  files['app/config.json'] = generateAppConfig(spec);
  files['app/routes.js'] = generateRoutesJs(spec);
  files['app/views/layouts/main.html'] = generateMainLayout();
  files['app/views/start.html'] = generateStartPage(spec);

  spec.questions.forEach(function(q) {
    files['app/views/' + q.id + '.html'] = generateQuestionPage(q);
    if (q.ineligibleAnswer) {
      files['app/views/ineligible-' + q.id + '.html'] = generateIneligiblePage(q);
    }
  });

  files['app/views/check-answers.html'] = generateCheckAnswersPage(spec);
  files['app/views/confirmation.html'] = generateConfirmationPage(spec);

  return files;
}

module.exports = { buildPrototypeFiles };
