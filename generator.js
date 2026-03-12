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
  if (!spec.referencePrefix || typeof spec.referencePrefix !== 'string') throw new Error('Missing referencePrefix');
  if (!spec.startPage || typeof spec.startPage !== 'object') throw new Error('Missing startPage');
  if (!spec.startPage.heading) throw new Error('Missing startPage.heading');
  if (!spec.startPage.description) throw new Error('Missing startPage.description');
  if (!Array.isArray(spec.startPage.whatYouNeed)) spec.startPage.whatYouNeed = ['your details'];
  if (!spec.startPage.timeToComplete) spec.startPage.timeToComplete = '10 minutes';
  if (!Array.isArray(spec.questions) || spec.questions.length < 1) throw new Error('Missing questions array');

  spec.questions = spec.questions.map((q, i) => {
    if (!q.id || typeof q.id !== 'string') q.id = `question-${i + 1}`;
    q.id = slug(q.id);
    if (!q.type || !['radio', 'text', 'textarea'].includes(q.type)) q.type = 'text';
    if (!q.question || typeof q.question !== 'string') q.question = `Question ${i + 1}`;
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

// ─── Route generation ─────────────────────────────────────────────────────────

function generateRoutesJs(spec) {
  const prefix = refPrefix(spec.referencePrefix);

  let out = `const router = require('govuk-prototype-kit/lib/utils').getRouter()

function generateReference(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = prefix + '-'
  for (let i = 0; i < 8; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

// Start
router.get('/', function (req, res) {
  res.render('start')
})

`;

  spec.questions.forEach((q, i) => {
    const nextPage = i < spec.questions.length - 1 ? spec.questions[i + 1].id : 'check-answers';
    const validationMsg = jsStr(q.validation);

    // For radio ineligible matching, use the slugged option value
    const ineligibleValue = q.ineligibleAnswer
      ? slug(q.ineligibleAnswer)
      : null;

    out += `router.get('/${q.id}', function (req, res) {
  res.render('${q.id}', { errors: null, data: req.session.data })
})

router.post('/${q.id}', function (req, res) {
  const answer = req.session.data['${q.id}']
  if (!answer || !answer.toString().trim()) {
    return res.render('${q.id}', {
      errors: { '${q.id}': '${validationMsg}' },
      data: req.session.data
    })
  }
${ineligibleValue ? `  if (answer === '${ineligibleValue}') {
    return res.redirect('/ineligible-${q.id}')
  }` : ''}
  res.redirect('/${nextPage}')
})

`;

    if (ineligibleValue) {
      out += `router.get('/ineligible-${q.id}', function (req, res) {
  res.render('ineligible-${q.id}')
})

`;
    }
  });

  out += `router.get('/check-answers', function (req, res) {
  res.render('check-answers', { data: req.session.data })
})

router.post('/check-answers', function (req, res) {
  if (!req.session.data['reference']) {
    req.session.data['reference'] = generateReference('${prefix}')
  }
  res.redirect('/confirmation')
})

router.get('/confirmation', function (req, res) {
  res.render('confirmation', { data: req.session.data })
})

module.exports = router
`;

  return out;
}

// ─── Template generation ──────────────────────────────────────────────────────

function header(serviceName) {
  return `  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: "${njkAttr(serviceName)}",
    serviceUrl: "/"
  }) }}`;
}

function generateStartPage(spec) {
  const items = spec.startPage.whatYouNeed
    .map(item => `      <li>${htmlStr(item)}</li>`)
    .join('\n');

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${htmlStr(spec.startPage.heading)} – GOV.UK{% endblock %}

{% block header %}
${header(spec.serviceName)}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">
    <h1 class="govuk-heading-xl">${htmlStr(spec.startPage.heading)}</h1>
    <p class="govuk-body">${htmlStr(spec.startPage.description)}</p>
    <p class="govuk-body">You will need:</p>
    <ul class="govuk-list govuk-list--bullet">
${items}
    </ul>
    <p class="govuk-body">It takes around <strong>${htmlStr(spec.startPage.timeToComplete)}</strong> to complete.</p>
    {{ govukButton({
      text: "Start now",
      href: "/${spec.questions[0].id}",
      isStartButton: true
    }) }}
  </div>
</div>
{% endblock %}
`;
}

function generateQuestionPage(q) {
  const questionText = njkAttr(q.question);
  const hintText = q.hint ? njkAttr(q.hint) : null;
  const errorKey = q.id;

  let component = '';

  if (q.type === 'radio') {
    const items = q.options
      .map(opt => `        { value: "${njkAttr(slug(opt))}", text: "${njkAttr(opt)}" }`)
      .join(',\n');

    component = `    {{ govukRadios({
      name: "${q.id}",
      fieldset: {
        legend: {
          text: "${questionText}",
          isPageHeading: true,
          classes: "govuk-fieldset__legend--l"
        }
      },${hintText ? `\n      hint: { text: "${hintText}" },` : ''}
      errorMessage: errors and errors['${errorKey}'] and { text: errors['${errorKey}'] },
      value: data['${q.id}'],
      items: [
${items}
      ]
    }) }}`;
  } else if (q.type === 'textarea') {
    component = `    {{ govukTextarea({
      id: "${q.id}",
      name: "${q.id}",
      label: {
        text: "${questionText}",
        isPageHeading: true,
        classes: "govuk-label--l"
      },${hintText ? `\n      hint: { text: "${hintText}" },` : ''}
      errorMessage: errors and errors['${errorKey}'] and { text: errors['${errorKey}'] },
      value: data['${q.id}'],
      rows: 5
    }) }}`;
  } else {
    component = `    {{ govukInput({
      id: "${q.id}",
      name: "${q.id}",
      label: {
        text: "${questionText}",
        isPageHeading: true,
        classes: "govuk-label--l"
      },${hintText ? `\n      hint: { text: "${hintText}" },` : ''}
      errorMessage: errors and errors['${errorKey}'] and { text: errors['${errorKey}'] },
      value: data['${q.id}']
    }) }}`;
  }

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}{% if errors and errors['${errorKey}'] %}Error: {% endif %}${htmlStr(q.question)} – GOV.UK{% endblock %}

{% block header %}
${header(q.question)}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    {% if errors and errors['${errorKey}'] %}
      {{ govukErrorSummary({
        titleText: "There is a problem",
        errorList: [{ text: errors['${errorKey}'], href: "#${q.id}" }]
      }) }}
    {% endif %}

    <form method="post" novalidate>
      <input type="hidden" name="_csrf" value="{{ csrf }}">
${component}
      {{ govukButton({ text: "Continue" }) }}
    </form>

  </div>
</div>
{% endblock %}
`;
}

function generateIneligiblePage(q, serviceName) {
  const reason = htmlStr(q.ineligibleReason || 'Based on your answer, you cannot use this service.');

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}You cannot use this service – GOV.UK{% endblock %}

{% block header %}
${header(serviceName)}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    <h1 class="govuk-heading-xl">You cannot use this service</h1>
    <p class="govuk-body">${reason}</p>
    <h2 class="govuk-heading-m">What you can do</h2>
    <p class="govuk-body">If you think this is wrong, <a href="/" class="govuk-link">start again</a> or contact us for help.</p>

  </div>
</div>
{% endblock %}
`;
}

function generateCheckAnswersPage(spec) {
  const rows = spec.questions.map(q => `      {
        key: { text: "${njkAttr(q.question)}" },
        value: { text: data['${q.id}'] if data['${q.id}'] else "Not provided" },
        actions: {
          items: [{
            href: "/${q.id}",
            text: "Change",
            visuallyHiddenText: "${njkAttr(q.question.toLowerCase())}"
          }]
        }
      }`).join(',\n');

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${htmlStr(spec.checkAnswersHeading)} – GOV.UK{% endblock %}

{% block header %}
${header(spec.serviceName)}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    <h1 class="govuk-heading-xl">${htmlStr(spec.checkAnswersHeading)}</h1>

    {{ govukSummaryList({
      rows: [
${rows}
      ]
    }) }}

    <form method="post" novalidate>
      <input type="hidden" name="_csrf" value="{{ csrf }}">
      {{ govukButton({ text: "${njkAttr(spec.confirmationHeading === 'Application submitted' ? 'Confirm and send' : 'Confirm and send')}" }) }}
    </form>

  </div>
</div>
{% endblock %}
`;
}

function generateConfirmationPage(spec) {
  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${htmlStr(spec.confirmationHeading)} – GOV.UK{% endblock %}

{% block header %}
${header(spec.serviceName)}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    <div class="govuk-panel govuk-panel--confirmation">
      <h1 class="govuk-panel__title">${htmlStr(spec.confirmationHeading)}</h1>
      <div class="govuk-panel__body">
        Your reference number<br>
        <strong>{{ data['reference'] }}</strong>
      </div>
    </div>

    <h2 class="govuk-heading-m">What happens next</h2>
    <p class="govuk-body">${htmlStr(spec.confirmationBody)}</p>
    <p class="govuk-body">${htmlStr(spec.confirmationTimeframe)}</p>
    <p class="govuk-body"><a href="/" class="govuk-link">Start a new application</a></p>

  </div>
</div>
{% endblock %}
`;
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
    headerNavigationItems: []
  }, null, 2);
}

// ─── Main export ──────────────────────────────────────────────────────────────

function buildPrototypeFiles(rawSpec) {
  // Validate and sanitise the spec — throws if fundamentally broken
  const spec = validateSpec(rawSpec);
  const files = {};

  files['package.json'] = generatePackageJson(spec);
  files['app/config.json'] = generateAppConfig(spec);
  files['app/routes.js'] = generateRoutesJs(spec);
  files['app/views/start.html'] = generateStartPage(spec);

  spec.questions.forEach(q => {
    files[`app/views/${q.id}.html`] = generateQuestionPage(q);
    if (q.ineligibleAnswer) {
      files[`app/views/ineligible-${q.id}.html`] = generateIneligiblePage(q, spec.serviceName);
    }
  });

  files['app/views/check-answers.html'] = generateCheckAnswersPage(spec);
  files['app/views/confirmation.html'] = generateConfirmationPage(spec);

  return files;
}

module.exports = { buildPrototypeFiles };
