function generateRoutesJs(spec) {
  const { questions, referencePrefix } = spec;

  let routes = `const express = require('express')
const router = express.Router()

function generateReference(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = prefix + '-'
  for (let i = 0; i < 8; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

// Start page
router.get('/', function (req, res) {
  res.render('start')
})

`;

  questions.forEach((q, index) => {
    const nextPage = index < questions.length - 1 ? questions[index + 1].id : 'check-answers';
    const ineligibleBlock = q.ineligibleAnswer
      ? `
  if (answer === ${JSON.stringify(q.ineligibleAnswer)}) {
    return res.redirect('/ineligible-${q.id}')
  }`
      : '';

    routes += `// ${q.question}
router.get('/${q.id}', function (req, res) {
  res.render('${q.id}', { errors: null, data: req.session.data })
})

router.post('/${q.id}', function (req, res) {
  const answer = req.session.data['${q.id}']
  if (!answer || answer.trim() === '') {
    return res.render('${q.id}', {
      errors: { '${q.id}': '${q.validation}' },
      data: req.session.data
    })
  }
${ineligibleBlock}
  res.redirect('/${nextPage}')
})

`;

    if (q.ineligibleAnswer) {
      routes += `// Ineligible — ${q.id}
router.get('/ineligible-${q.id}', function (req, res) {
  res.render('ineligible-${q.id}')
})

`;
    }
  });

  routes += `// Check answers
router.get('/check-answers', function (req, res) {
  res.render('check-answers', { data: req.session.data })
})

router.post('/check-answers', function (req, res) {
  if (!req.session.data['reference']) {
    req.session.data['reference'] = generateReference('${referencePrefix}')
  }
  res.redirect('/confirmation')
})

// Confirmation
router.get('/confirmation', function (req, res) {
  res.render('confirmation', { data: req.session.data })
})

module.exports = router
`;

  return routes;
}

function generateStartPage(spec) {
  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}{{ serviceName }} – GOV.UK{% endblock %}

{% block header %}
  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: serviceName,
    serviceUrl: "/"
  }) }}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">
    <h1 class="govuk-heading-xl">${spec.startPage.heading}</h1>
    <p class="govuk-body">${spec.startPage.description}</p>

    <p class="govuk-body">Use this service to:</p>
    <ul class="govuk-list govuk-list--bullet">
${spec.startPage.whatYouNeed.map(item => `      <li>${item}</li>`).join('\n')}
    </ul>

    <p class="govuk-body">It takes around <strong>${spec.startPage.timeToComplete}</strong> to complete.</p>

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
  const titlePrefix = "{{ 'Error: ' if errors and errors['" + q.id + "'] }}"

  let componentMacro = '';

  if (q.type === 'radio') {
    const items = q.options.map(opt => `        { value: "${opt.toLowerCase().replace(/\s+/g, '-')}", text: "${opt}" }`).join(',\n');
    componentMacro = `    {{ govukRadios({
      name: "${q.id}",
      fieldset: {
        legend: {
          text: "${q.question}",
          isPageHeading: true,
          classes: "govuk-fieldset__legend--l"
        }
      },
      ${q.hint ? `hint: { text: "${q.hint}" },` : ''}
      errorMessage: errors and errors['${q.id}'] and { text: errors['${q.id}'] },
      value: data['${q.id}'],
      items: [
${items}
      ]
    }) }}`;
  } else if (q.type === 'textarea') {
    componentMacro = `    {{ govukTextarea({
      id: "${q.id}",
      name: "${q.id}",
      label: {
        text: "${q.question}",
        isPageHeading: true,
        classes: "govuk-label--l"
      },
      ${q.hint ? `hint: { text: "${q.hint}" },` : ''}
      errorMessage: errors and errors['${q.id}'] and { text: errors['${q.id}'] },
      value: data['${q.id}'],
      rows: 5
    }) }}`;
  } else {
    componentMacro = `    {{ govukInput({
      id: "${q.id}",
      name: "${q.id}",
      label: {
        text: "${q.question}",
        isPageHeading: true,
        classes: "govuk-label--l"
      },
      ${q.hint ? `hint: { text: "${q.hint}" },` : ''}
      errorMessage: errors and errors['${q.id}'] and { text: errors['${q.id}'] },
      value: data['${q.id}']
    }) }}`;
  }

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${titlePrefix}${q.question} – {{ serviceName }} – GOV.UK{% endblock %}

{% block header %}
  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: serviceName,
    serviceUrl: "/"
  }) }}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    {% if errors and errors['${q.id}'] %}
      {{ govukErrorSummary({
        titleText: "There is a problem",
        errorList: [{ text: errors['${q.id}'], href: "#${q.id}" }]
      }) }}
    {% endif %}

    <form method="post" novalidate>
      <input type="hidden" name="_csrf" value="{{ csrf }}">

${componentMacro}

      {{ govukButton({ text: "Continue" }) }}
    </form>

  </div>
</div>
{% endblock %}
`;
}

function generateIneligiblePage(q) {
  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}You cannot use this service – {{ serviceName }} – GOV.UK{% endblock %}

{% block header %}
  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: serviceName,
    serviceUrl: "/"
  }) }}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    <h1 class="govuk-heading-xl">You cannot use this service</h1>

    <p class="govuk-body">${q.ineligibleReason || 'Based on your answer, you are not eligible for this service.'}</p>

    <h2 class="govuk-heading-m">What you can do</h2>
    <p class="govuk-body">If you think this is wrong, <a href="/" class="govuk-link">start again</a> or contact us for help.</p>

  </div>
</div>
{% endblock %}
`;
}

function generateCheckAnswersPage(spec) {
  const rows = spec.questions.map(q => `      {
        key: { text: "${q.question}" },
        value: { text: data['${q.id}'] or "Not provided" },
        actions: {
          items: [{ href: "/${q.id}", text: "Change", visuallyHiddenText: "${q.question.toLowerCase()}" }]
        }
      }`).join(',\n');

  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${spec.checkAnswersHeading} – {{ serviceName }} – GOV.UK{% endblock %}

{% block header %}
  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: serviceName,
    serviceUrl: "/"
  }) }}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    {{ govukBackLink({ text: "Back", href: "javascript:history.back()" }) }}

    <h1 class="govuk-heading-xl">${spec.checkAnswersHeading}</h1>

    {{ govukSummaryList({
      rows: [
${rows}
      ]
    }) }}

    <form method="post" novalidate>
      <input type="hidden" name="_csrf" value="{{ csrf }}">
      {{ govukButton({ text: "Confirm and send" }) }}
    </form>

  </div>
</div>
{% endblock %}
`;
}

function generateConfirmationPage(spec) {
  return `{% extends "govuk/template.njk" %}

{% block pageTitle %}${spec.confirmationHeading} – {{ serviceName }} – GOV.UK{% endblock %}

{% block header %}
  {{ govukHeader({
    homepageUrl: "https://www.gov.uk",
    serviceName: serviceName,
    serviceUrl: "/"
  }) }}
{% endblock %}

{% block content %}
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">

    <div class="govuk-panel govuk-panel--confirmation">
      <h1 class="govuk-panel__title">${spec.confirmationHeading}</h1>
      <div class="govuk-panel__body">
        Your reference number<br>
        <strong>{{ data['reference'] }}</strong>
      </div>
    </div>

    <h2 class="govuk-heading-m">What happens next</h2>
    <p class="govuk-body">${spec.confirmationBody}</p>
    <p class="govuk-body">${spec.confirmationTimeframe}</p>

    <p class="govuk-body">
      <a href="/" class="govuk-link">Start a new application</a>
    </p>

  </div>
</div>
{% endblock %}
`;
}

function generatePackageJson(spec) {
  return JSON.stringify({
    name: spec.serviceName.toLowerCase().replace(/\s+/g, '-'),
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

function buildPrototypeFiles(spec) {
  const files = {};

  files['package.json'] = generatePackageJson(spec);
  files['app/config.json'] = generateAppConfig(spec);
  files['app/routes.js'] = generateRoutesJs(spec);
  files['app/views/start.html'] = generateStartPage(spec);

  spec.questions.forEach(q => {
    files[`app/views/${q.id}.html`] = generateQuestionPage(q);
    if (q.ineligibleAnswer) {
      files[`app/views/ineligible-${q.id}.html`] = generateIneligiblePage(q);
    }
  });

  files['app/views/check-answers.html'] = generateCheckAnswersPage(spec);
  files['app/views/confirmation.html'] = generateConfirmationPage(spec);

  return files;
}

module.exports = { buildPrototypeFiles };
