// ─── Sanitisation helpers ─────────────────────────────────────────────────────

// Escape for use inside a single-quoted JS string
function jsStr(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .trim();
}

// Escape for use inside HTML text content
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

// Safe URL slug — only lowercase letters, numbers, hyphens
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

// Safe reference prefix — uppercase letters only
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
  if (!spec.referencePrefix || typeof spec.referencePrefix !== 'string') spec.referencePrefix = 'REF';
  if (!spec.startPage || typeof spec.startPage !== 'object') throw new Error('Missing startPage');
  if (!spec.startPage.heading) throw new Error('Missing startPage.heading');
  if (!spec.startPage.description) spec.startPage.description = spec.startPage.heading;
  if (!Array.isArray(spec.startPage.whatYouNeed) || spec.startPage.whatYouNeed.length === 0) {
    spec.startPage.whatYouNeed = ['your details'];
  }
  if (!spec.startPage.timeToComplete) spec.startPage.timeToComplete = '10 minutes';
  if (!Array.isArray(spec.questions) || spec.questions.length < 1) throw new Error('Missing questions array');

  spec.questions = spec.questions.map(function(q, i) {
    if (!q.id || typeof q.id !== 'string') q.id = 'question-' + (i + 1);
    q.id = slug(q.id);
    if (!q.type || !['radio', 'text', 'textarea'].includes(q.type)) q.type = 'text';
    if (!q.question || typeof q.question !== 'string') q.question = 'Question ' + (i + 1);
    if (!q.validation || typeof q.validation !== 'string') q.validation = 'Enter an answer';
    if (q.type === 'radio') {
      if (!Array.isArray(q.options) || q.options.length < 2) q.options = ['Yes', 'No'];
      // Ensure options are strings
      q.options = q.options.map(function(o) { return String(o || '').trim() || 'Option'; });
    } else {
      q.options = null;
    }
    if (!q.hint || typeof q.hint !== 'string') q.hint = null;
    // Only allow ineligible if radio type with a matching option
    if (q.type === 'radio' && q.ineligibleAnswer && typeof q.ineligibleAnswer === 'string') {
      q.ineligibleAnswer = q.ineligibleAnswer.trim();
      if (!q.ineligibleReason || typeof q.ineligibleReason !== 'string') {
        q.ineligibleReason = 'Based on your answer, you cannot use this service.';
      }
    } else {
      q.ineligibleAnswer = null;
      q.ineligibleReason = null;
    }
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
  const lines = [];

  lines.push("const govukPrototypeKit = require('govuk-prototype-kit')");
  lines.push("const router = govukPrototypeKit.requests.setupRouter()");
  lines.push('');
  lines.push('function generateReference (prefix) {');
  lines.push("  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'");
  lines.push("  let ref = prefix + '-'");
  lines.push('  for (let i = 0; i < 8; i++) {');
  lines.push('    ref += chars[Math.floor(Math.random() * chars.length)]');
  lines.push('  }');
  lines.push('  return ref');
  lines.push('}');
  lines.push('');
  lines.push("router.get('/', function (req, res) {");
  lines.push("  res.redirect('/start')");
  lines.push('})');
  lines.push('');

  spec.questions.forEach(function(q, i) {
    const nextPage = i < spec.questions.length - 1 ? spec.questions[i + 1].id : 'check-answers';
    const validationMsg = jsStr(q.validation);
    // ineligible answer value is the slug of the option text
    const ineligibleValue = q.ineligibleAnswer ? slug(q.ineligibleAnswer) : null;

    lines.push("router.get('/" + q.id + "', function (req, res) {");
    lines.push("  res.render('" + q.id + "')");
    lines.push('})');
    lines.push('');

    lines.push("router.post('/" + q.id + "', function (req, res) {");
    lines.push("  const answer = req.session.data['" + q.id + "']");
    lines.push('  if (!answer || !answer.toString().trim()) {');
    lines.push("    res.locals.errors = { '" + q.id + "': '" + validationMsg + "' }");
    lines.push("    return res.render('" + q.id + "')");
    lines.push('  }');
    if (ineligibleValue) {
      lines.push("  if (answer === '" + ineligibleValue + "') {");
      lines.push("    return res.redirect('/ineligible-" + q.id + "')");
      lines.push('  }');
    }
    lines.push("  res.redirect('/" + nextPage + "')");
    lines.push('})');
    lines.push('');

    if (ineligibleValue) {
      lines.push("router.get('/ineligible-" + q.id + "', function (req, res) {");
      lines.push("  res.render('ineligible-" + q.id + "')");
      lines.push('})');
      lines.push('');
    }
  });

  lines.push("router.get('/check-answers', function (req, res) {");
  lines.push("  res.render('check-answers')");
  lines.push('})');
  lines.push('');

  lines.push("router.post('/check-answers', function (req, res) {");
  lines.push("  if (!req.session.data['reference']) {");
  lines.push("    req.session.data['reference'] = generateReference('" + prefix + "')");
  lines.push('  }');
  lines.push("  res.redirect('/confirmation')");
  lines.push('})');
  lines.push('');

  lines.push("router.get('/confirmation', function (req, res) {");
  lines.push("  res.render('confirmation')");
  lines.push('})');
  lines.push('');
  lines.push('module.exports = router');
  lines.push('');

  return lines.join('\n');
}

// ─── Layout ───────────────────────────────────────────────────────────────────

// The kit auto-registers all govuk macros globally via govuk-prototype-kit.config.json
// so no explicit imports needed - just extend the branded layout
function generateMainLayout() {
  return '{% extends "govuk-prototype-kit/layouts/govuk-branded.njk" %}\n';
}

// ─── Start page ───────────────────────────────────────────────────────────────

function generateStartPage(spec) {
  const items = spec.startPage.whatYouNeed
    .map(function(item) { return '      <li>' + htmlStr(item) + '</li>'; })
    .join('\n');

  const lines = [];
  lines.push('{% extends "layouts/main.html" %}');
  lines.push('');
  lines.push('{% set pageName = "' + njkAttr(spec.startPage.heading) + '" %}');
  lines.push('');
  lines.push('{% block content %}');
  lines.push('<div class="govuk-grid-row">');
  lines.push('  <div class="govuk-grid-column-two-thirds">');
  lines.push('    <h1 class="govuk-heading-xl">' + htmlStr(spec.startPage.heading) + '</h1>');
  lines.push('    <p class="govuk-body">' + htmlStr(spec.startPage.description) + '</p>');
  lines.push('    <p class="govuk-body">You will need:</p>');
  lines.push('    <ul class="govuk-list govuk-list--bullet">');
  lines.push(items);
  lines.push('    </ul>');
  lines.push('    <p class="govuk-body">It takes around <strong>' + htmlStr(spec.startPage.timeToComplete) + '</strong> to complete.</p>');
  lines.push('    {{ govukButton({');
  lines.push('      text: "Start now",');
  lines.push('      href: "/' + spec.questions[0].id + '",');
  lines.push('      isStartButton: true');
  lines.push('    }) }}');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('{% endblock %}');
  lines.push('');
  return lines.join('\n');
}

// ─── Question pages ───────────────────────────────────────────────────────────

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

    component = [
      '    {{ govukRadios({',
      '      name: "' + q.id + '",',
      '      fieldset: {',
      '        legend: {',
      '          text: "' + questionText + '",',
      '          isPageHeading: true,',
      '          classes: "govuk-fieldset__legend--l"',
      '        }',
      '      },',
      (hintText ? '      hint: { text: "' + hintText + '" },' : null),
      '      errorMessage: errors["' + q.id + '"] if errors else null,',
      '      value: data["' + q.id + '"],',
      '      items: [',
      items,
      '      ]',
      '    }) }}'
    ].filter(function(l) { return l !== null; }).join('\n');

  } else if (q.type === 'textarea') {
    component = [
      '    {{ govukTextarea({',
      '      id: "' + q.id + '",',
      '      name: "' + q.id + '",',
      '      label: {',
      '        text: "' + questionText + '",',
      '        isPageHeading: true,',
      '        classes: "govuk-label--l"',
      '      },',
      (hintText ? '      hint: { text: "' + hintText + '" },' : null),
      '      errorMessage: errors["' + q.id + '"] if errors else null,',
      '      value: data["' + q.id + '"],',
      '      rows: 5',
      '    }) }}'
    ].filter(function(l) { return l !== null; }).join('\n');

  } else {
    component = [
      '    {{ govukInput({',
      '      id: "' + q.id + '",',
      '      name: "' + q.id + '",',
      '      label: {',
      '        text: "' + questionText + '",',
      '        isPageHeading: true,',
      '        classes: "govuk-label--l"',
      '      },',
      (hintText ? '      hint: { text: "' + hintText + '" },' : null),
      '      errorMessage: errors["' + q.id + '"] if errors else null,',
      '      value: data["' + q.id + '"]',
      '    }) }}'
    ].filter(function(l) { return l !== null; }).join('\n');
  }

  const lines = [];
  lines.push('{% extends "layouts/main.html" %}');
  lines.push('');
  lines.push('{% set pageName = "' + questionText + '" %}');
  lines.push('');
  lines.push('{% block content %}');
  lines.push('<div class="govuk-grid-row">');
  lines.push('  <div class="govuk-grid-column-two-thirds">');
  lines.push('');
  lines.push('    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}');
  lines.push('');
  lines.push('    {% if errors and errors["' + q.id + '"] %}');
  lines.push('    {{ govukErrorSummary({');
  lines.push('      titleText: "There is a problem",');
  lines.push('      errorList: [{ text: errors["' + q.id + '"], href: "#' + q.id + '" }]');
  lines.push('    }) }}');
  lines.push('    {% endif %}');
  lines.push('');
  lines.push('    <form method="post" novalidate>');
  lines.push(component);
  lines.push('      {{ govukButton({ text: "Continue" }) }}');
  lines.push('    </form>');
  lines.push('');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('{% endblock %}');
  lines.push('');
  return lines.join('\n');
}

// ─── Ineligible page ──────────────────────────────────────────────────────────

function generateIneligiblePage(q) {
  const reason = htmlStr(q.ineligibleReason || 'Based on your answer, you cannot use this service.');
  const lines = [];
  lines.push('{% extends "layouts/main.html" %}');
  lines.push('');
  lines.push('{% set pageName = "You cannot use this service" %}');
  lines.push('');
  lines.push('{% block content %}');
  lines.push('<div class="govuk-grid-row">');
  lines.push('  <div class="govuk-grid-column-two-thirds">');
  lines.push('');
  lines.push('    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}');
  lines.push('');
  lines.push('    <h1 class="govuk-heading-xl">You cannot use this service</h1>');
  lines.push('    <p class="govuk-body">' + reason + '</p>');
  lines.push('    <h2 class="govuk-heading-m">What you can do</h2>');
  lines.push('    <p class="govuk-body">If you think this is wrong, <a href="/start" class="govuk-link">start again</a> or contact us for help.</p>');
  lines.push('');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('{% endblock %}');
  lines.push('');
  return lines.join('\n');
}

// ─── Check answers page ───────────────────────────────────────────────────────

function generateCheckAnswersPage(spec) {
  const rows = spec.questions.map(function(q) {
    return [
      '      {',
      '        key: { text: "' + njkAttr(q.question) + '" },',
      '        value: { text: data["' + q.id + '"] if data["' + q.id + '"] else "Not answered" },',
      '        actions: {',
      '          items: [{',
      '            href: "/' + q.id + '",',
      '            text: "Change",',
      '            visuallyHiddenText: "' + njkAttr(q.question.toLowerCase()) + '"',
      '          }]',
      '        }',
      '      }'
    ].join('\n');
  }).join(',\n');

  const lines = [];
  lines.push('{% extends "layouts/main.html" %}');
  lines.push('');
  lines.push('{% set pageName = "' + njkAttr(spec.checkAnswersHeading) + '" %}');
  lines.push('');
  lines.push('{% block content %}');
  lines.push('<div class="govuk-grid-row">');
  lines.push('  <div class="govuk-grid-column-two-thirds">');
  lines.push('');
  lines.push('    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}');
  lines.push('');
  lines.push('    <h1 class="govuk-heading-xl">' + htmlStr(spec.checkAnswersHeading) + '</h1>');
  lines.push('');
  lines.push('    {{ govukSummaryList({');
  lines.push('      rows: [');
  lines.push(rows);
  lines.push('      ]');
  lines.push('    }) }}');
  lines.push('');
  lines.push('    <form method="post" novalidate>');
  lines.push('      {{ govukButton({ text: "Confirm and send" }) }}');
  lines.push('    </form>');
  lines.push('');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('{% endblock %}');
  lines.push('');
  return lines.join('\n');
}

// ─── Confirmation page ────────────────────────────────────────────────────────

function generateConfirmationPage(spec) {
  const lines = [];
  lines.push('{% extends "layouts/main.html" %}');
  lines.push('');
  lines.push('{% set pageName = "' + njkAttr(spec.confirmationHeading) + '" %}');
  lines.push('');
  lines.push('{% block content %}');
  lines.push('<div class="govuk-grid-row">');
  lines.push('  <div class="govuk-grid-column-two-thirds">');
  lines.push('');
  lines.push('    <div class="govuk-panel govuk-panel--confirmation">');
  lines.push('      <h1 class="govuk-panel__title">' + htmlStr(spec.confirmationHeading) + '</h1>');
  lines.push('      <div class="govuk-panel__body">');
  lines.push('        Your reference number<br>');
  lines.push('        <strong>{{ data["reference"] }}</strong>');
  lines.push('      </div>');
  lines.push('    </div>');
  lines.push('');
  lines.push('    <h2 class="govuk-heading-m">What happens next</h2>');
  lines.push('    <p class="govuk-body">' + htmlStr(spec.confirmationBody) + '</p>');
  lines.push('    <p class="govuk-body">' + htmlStr(spec.confirmationTimeframe) + '</p>');
  lines.push('    <p class="govuk-body"><a href="/start" class="govuk-link">Start a new application</a></p>');
  lines.push('');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('{% endblock %}');
  lines.push('');
  return lines.join('\n');
}

// ─── package.json ─────────────────────────────────────────────────────────────

function generatePackageJson(spec) {
  return JSON.stringify({
    name: pkgName(spec.serviceName),
    version: '1.0.0',
    description: spec.serviceName,
    main: 'node_modules/govuk-prototype-kit/listen-on-port.js',
    scripts: {
      start: 'node node_modules/govuk-prototype-kit/listen-on-port.js'
    },
    engines: { node: '22.x' },
    dependencies: {
      'govuk-prototype-kit': '^13.16.2'
    }
  }, null, 2);
}

// ─── app/config.json ──────────────────────────────────────────────────────────

function generateAppConfig(spec) {
  return JSON.stringify({
    serviceName: spec.serviceName,
    serviceUrl: '/start',
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
