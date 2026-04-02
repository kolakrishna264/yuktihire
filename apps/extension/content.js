// JobGenie Content Script
console.log('JobGenie content script loaded on:', window.location.href);

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  if (request.action === 'ANALYZE_JOB') {
    var result = extractJobDescription();
    sendResponse(result);
    return true;
  }

  if (request.action === 'FILL_APPLICATION') {
    fillApplication().then(function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'TAILOR_RESUME') {
    sendResponse({ success: false, message: 'Use popup directly' });
    return true;
  }

  return true;
});

// ============================================
// EXTRACT JOB DESCRIPTION
// ============================================

function extractJobDescription() {
  try {
    var url = window.location.href.toLowerCase();
    var pageText = document.body.innerText || '';

    // Known job portals - always treat as job page
    var portals = [
      'greenhouse.io', 'lever.co', 'linkedin.com/jobs',
      'indeed.com', 'glassdoor.com', 'workday.com',
      'myworkdayjobs.com', 'ashbyhq.com', 'jobvite.com',
      'icims.com', 'taleo.net', 'smartrecruiters.com',
      'bamboohr.com', 'workable.com', 'wellfound.com',
      'careers', '/jobs/', '/job/', '/apply', '/hiring',
      'ziprecruiter.com', 'monster.com', 'dice.com'
    ];

    var isPortal = portals.some(function(p) { return url.includes(p); });

    // Check for job page HTML elements
    var jobSelectors = [
      '.job-description', '.job__description', '#job-description',
      '.posting-description', '.job-details', '.job-post',
      '.description__text', '[data-automation-id="job-description"]',
      '.jobsearch-jobDescriptionText', '.job-body'
    ];

    var hasJobElement = jobSelectors.some(function(s) {
      return document.querySelector(s) !== null;
    });

    // Check text keywords
    var keywords = [
      'responsibilities', 'requirements', 'qualifications',
      'we are looking', 'about the role', 'what you will do',
      'benefits', 'compensation', 'years of experience'
    ];
    var lowerText = pageText.toLowerCase();
    var keyCount = keywords.filter(function(k) {
      return lowerText.includes(k);
    }).length;

    var isJobPage = isPortal || hasJobElement || keyCount >= 2;

    if (!isJobPage) {
      return {
        success: false,
        message: 'Not recognized as a job page. Try on LinkedIn, Greenhouse, Lever etc.'
      };
    }

    // Get job title
    var jobTitle = getJobTitle();

    // Get company name
    var companyName = getCompanyName();

    // Get job text
    var jobText = getJobText(pageText);

    return {
      success: true,
      jobTitle: jobTitle,
      companyName: companyName,
      fullText: jobText,
      url: window.location.href
    };

  } catch(e) {
    return { success: false, message: 'Error: ' + e.message };
  }
}

function getJobTitle() {
  var selectors = [
    '.job__title', '.job-title', '.jobTitle',
    '[data-testid="job-title"]', '.posting-headline h2',
    '.top-card-layout__title', 'h1',
    '.job-details-jobs-unified-top-card__job-title',
    '[data-automation-id="jobPostingHeader"]',
    '.jobsearch-JobInfoHeader-title'
  ];

  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.textContent.trim().length > 1) {
      return el.textContent.trim();
    }
  }
  return document.title.split('|')[0].split('-')[0].trim() || 'Job Position';
}

function getCompanyName() {
  var selectors = [
    '.company-name', '.companyName', '.company__name',
    '[data-testid="company-name"]',
    '.topcard__org-name-link',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobsearch-InlineCompanyRating-companyHeader'
  ];

  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.textContent.trim().length > 1) {
      return el.textContent.trim();
    }
  }
  return 'Company';
}

function getJobText(pageText) {
  var selectors = [
    '.job__description', '#job-description', '.job-description',
    '.description__text', '.posting-description',
    '[data-automation-id="job-description"]',
    '#jobDescriptionText', '.job-details'
  ];

  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.innerText && el.innerText.trim().length > 100) {
      return el.innerText.trim().substring(0, 6000);
    }
  }
  return pageText.substring(0, 6000);
}

// ============================================
// FILL APPLICATION FORM
// ============================================

async function fillApplication() {
  try {
    var data = await chrome.storage.local.get('userProfile');
    var profile = data.userProfile;

    if (!profile) {
      return { success: false, message: 'No profile. Setup profile first!' };
    }

    var fields = [];
    document.querySelectorAll('input, textarea, select').forEach(function(el) {
      if (el.type !== 'submit' && el.type !== 'button' &&
          el.type !== 'hidden' && el.type !== 'file' &&
          !el.disabled && !el.readOnly) {
        fields.push(el);
      }
    });

    if (fields.length === 0) {
      return { success: false, message: 'No form fields found on this page' };
    }

    var filled = 0;
    fields.forEach(function(field) {
      if (fillField(field, profile)) filled++;
    });

    return { success: true, filledCount: filled, message: 'Filled ' + filled + ' fields!' };

  } catch(e) {
    return { success: false, message: 'Error: ' + e.message };
  }
}

function fillField(field, profile) {
  var name = (
    field.name + ' ' +
    field.id + ' ' +
    (field.placeholder || '') + ' ' +
    (field.getAttribute('aria-label') || '') + ' ' +
    (field.getAttribute('autocomplete') || '')
  ).toLowerCase();

  // Get label text too
  if (field.id) {
    var label = document.querySelector('label[for="' + field.id + '"]');
    if (label) name += ' ' + label.textContent.toLowerCase();
  }

  var value = null;

  if (name.includes('first') && name.includes('name')) value = profile.firstName;
  else if (name.includes('last') && name.includes('name')) value = profile.lastName;
  else if ((name.includes('full') && name.includes('name')) ||
           (name.includes('name') && !name.includes('company') &&
            !name.includes('file') && !name.includes('user'))) {
    value = (profile.firstName || '') + ' ' + (profile.lastName || '');
  }
  else if (name.includes('email')) value = profile.email;
  else if (name.includes('phone') || name.includes('mobile') || name.includes('tel')) value = profile.phone;
  else if (name.includes('linkedin')) value = profile.linkedin;
  else if (name.includes('github')) value = profile.github;
  else if (name.includes('portfolio') || name.includes('website')) value = profile.portfolio;
  else if (name.includes('city')) value = profile.city;
  else if (name.includes('state') || name.includes('province')) value = profile.state;
  else if (name.includes('zip') || name.includes('postal')) value = profile.zipCode;
  else if (name.includes('country')) value = profile.country;
  else if (name.includes('salary') || name.includes('compensation')) value = profile.salaryExpectation;
  else if (name.includes('cover') || name.includes('letter')) {
    value = 'I am excited to apply for this position. ' + (profile.motivation || profile.personality || '');
  }
  else if (name.includes('summary') || name.includes('about') || name.includes('bio')) {
    value = profile.personality || '';
  }
  else if (name.includes('address')) {
    value = (profile.city || '') + ', ' + (profile.state || '');
  }

  if (value) {
    field.focus();
    field.value = '';
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }
  return false;
}

// This file is complete