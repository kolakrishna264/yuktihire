// JobGenie Profile Script
var profileData = {};

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('saveBtn').addEventListener('click', saveProfile);
  document.getElementById('addExpBtn').addEventListener('click', function() { addExperience({}); });
  document.getElementById('addEduBtn').addEventListener('click', function() { addEducation({}); });
  document.getElementById('addCertBtn').addEventListener('click', function() { addCertification(''); });
  document.getElementById('resumeFile').addEventListener('change', function() {
    if (this.files && this.files[0]) handleResumeUpload(this.files[0]);
  });
  loadExistingProfile();
});

function handleResumeUpload(file) {
  var name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.doc')) {
    showStatus('Upload PDF or Word (.docx) only', 'error');
    return;
  }

  showStatus('Reading file...', 'info');

  var reader = new FileReader();
  reader.onerror = function() { showStatus('Could not read file', 'error'); };

  reader.onload = function(e) {
    // Convert ArrayBuffer to base64 string - safe to pass through sendMessage
    var buffer = e.target.result;
    var bytes = new Uint8Array(buffer);
    var binary = '';
    var chunkSize = 8192;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      var chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    var base64 = btoa(binary);

    showStatus('Sending to AI... please wait 15-30 seconds', 'info');

    var fileType = name.endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    chrome.runtime.sendMessage({
      action: 'EXTRACT_PROFILE',
      fileBase64: base64,
      fileName: file.name,
      fileType: fileType
    }, function(response) {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      if (!response) {
        showStatus('No response. Is python app.py running?', 'error');
        return;
      }
      if (!response.success) {
        showStatus('Error: ' + (response.error || 'Failed'), 'error');
        return;
      }
      fillProfileFromResult(response.data);
    });
  };

  reader.readAsArrayBuffer(file);
}

function showStatus(msg, type) {
  var el = document.getElementById('uploadStatus');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#667eea';
}

function fillProfileFromResult(result) {
  var p = result.profile || {};
  profileData.resume = (result.rawText || '').substring(0, 5000);

  setVal('firstName', p.firstName);
  setVal('lastName', p.lastName);
  setVal('email', p.email);
  setVal('phone', p.phone);
  setVal('city', p.city);
  setVal('state', p.state);
  setVal('country', p.country);
  setVal('linkedin', p.linkedin);
  setVal('github', p.github);
  setVal('portfolio', p.portfolio);
  setVal('skills', p.skills);
  setVal('summary', p.summary);
  setVal('yearsExp', p.yearsExp);
  setVal('personality', p.personality);

  document.getElementById('experienceList').innerHTML = '';
  (p.experiences || []).forEach(function(e) { addExperience(e); });

  document.getElementById('educationList').innerHTML = '';
  var edus = p.educations || [];
  if (edus.length > 0) {
    edus.forEach(function(e) { addEducation(e); });
  } else {
    parseEduFromText(result.rawText || '').forEach(function(e) { addEducation(e); });
  }

  document.getElementById('certificationList').innerHTML = '';
  if (p.certifications) {
    p.certifications.split('\n').forEach(function(c) {
      if (c.trim()) addCertification(c.trim());
    });
  }

  var ec = document.querySelectorAll('.exp-block').length;
  var dc = document.querySelectorAll('.edu-block').length;
  showStatus('Done! ' + ec + ' job(s) and ' + dc + ' education(s) found. Review and save!', 'success');
  updateProgress();
}

function parseEduFromText(text) {
  var results = [];
  if (!text) return results;
  var lines = text.split('\n');
  var dw = ['Master','Bachelor','MS ','BS ','MBA','PhD','B.Tech','M.Tech',
    'Master of Science','Bachelor of Science','Bachelor of Technology'];
  var uw = ['University','College','Institute'];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var hd = dw.some(function(k) { return line.includes(k); });
    var hu = uw.some(function(k) { return line.includes(k); });
    if (!hd && !hu) continue;
    if (hd && hu) {
      var sep = line.includes(' - ') ? ' - ' : ',';
      var pts = line.split(sep);
      results.push({ degree: pts[0].trim(), university: (pts[1]||'').trim(), year: getYear(line), gpa: '', courses: '' });
    } else if (hd) {
      var edu = { degree: line.split(/[-,]/)[0].trim(), university: '', year: getYear(line), gpa: '', courses: '' };
      if (i + 1 < lines.length) {
        var nx = lines[i+1].trim();
        if (uw.some(function(k) { return nx.includes(k); })) {
          edu.university = nx.split(',')[0].trim(); i++;
        }
      }
      results.push(edu);
    }
  }
  return results;
}

function getYear(t) { var m = t.match(/\b(19|20)\d{2}\b/); return m ? m[0] : ''; }

function addExperience(data) {
  data = data || {};
  var list = document.getElementById('experienceList');
  var n = list.querySelectorAll('.exp-block').length + 1;
  var div = document.createElement('div');
  div.className = 'exp-block block-item';
  div.innerHTML =
    '<div class="block-label">Job #'+n+'</div>'+
    '<div class="block-grid">'+
      '<div class="form-group"><label>Job Title</label><input class="form-input exp-title" value="'+esc(data.title)+'" placeholder="AI/ML Engineer"></div>'+
      '<div class="form-group"><label>Company</label><input class="form-input exp-company" value="'+esc(data.company)+'" placeholder="Company Name"></div>'+
      '<div class="form-group"><label>Start Date</label><input class="form-input exp-start" value="'+esc(data.start)+'" placeholder="July 2024"></div>'+
      '<div class="form-group"><label>End Date</label><input class="form-input exp-end" value="'+esc(data.end)+'" placeholder="Present"></div>'+
      '<div class="form-group"><label>Location</label><input class="form-input exp-location" value="'+esc(data.location)+'" placeholder="Arlington, TX"></div>'+
      '<div class="form-group"><label>Industry</label><input class="form-input exp-industry" value="'+esc(data.industry)+'" placeholder="Tech"></div>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:8px"><label>Achievements</label><textarea class="form-input exp-achievements" rows="2">'+esc(data.achievements)+'</textarea></div>'+
    '<div class="form-group" style="margin-bottom:8px"><label>Skills Used</label><input class="form-input exp-skills" value="'+esc(data.skillsUsed)+'" placeholder="Python, PyTorch"></div>';
  var rb = document.createElement('button');
  rb.className = 'remove-btn'; rb.textContent = 'Remove';
  rb.addEventListener('click', function() { div.remove(); updateProgress(); });
  div.appendChild(rb); list.appendChild(div);
}

function addEducation(data) {
  data = data || {};
  var list = document.getElementById('educationList');
  var div = document.createElement('div');
  div.className = 'edu-block block-item';
  div.innerHTML =
    '<div class="block-grid">'+
      '<div class="form-group"><label>Degree</label><input class="form-input edu-degree" value="'+esc(data.degree)+'" placeholder="MS in Applied Statistics"></div>'+
      '<div class="form-group"><label>University</label><input class="form-input edu-university" value="'+esc(data.university)+'" placeholder="University of Texas"></div>'+
      '<div class="form-group"><label>Graduation Date</label><input class="form-input edu-year" value="'+esc(data.year)+'" placeholder="May 2019"></div>'+
      '<div class="form-group"><label>GPA (optional)</label><input class="form-input edu-gpa" value="'+esc(data.gpa)+'" placeholder="3.8/4.0"></div>'+
    '</div>';
  var rb = document.createElement('button');
  rb.className = 'remove-btn'; rb.textContent = 'Remove';
  rb.addEventListener('click', function() { div.remove(); updateProgress(); });
  div.appendChild(rb); list.appendChild(div);
}

function addCertification(value) {
  var list = document.getElementById('certificationList');
  var div = document.createElement('div');
  div.className = 'cert-row';
  var inp = document.createElement('input');
  inp.className = 'form-input cert-input';
  inp.placeholder = 'AWS Certified ML Specialty (2023)';
  inp.value = value || '';
  var rb = document.createElement('button');
  rb.className = 'cert-remove'; rb.textContent = 'x';
  rb.addEventListener('click', function() { div.remove(); updateProgress(); });
  div.appendChild(inp); div.appendChild(rb); list.appendChild(div);
}

function getExperiences() {
  var r = [];
  document.querySelectorAll('.exp-block').forEach(function(b) {
    r.push({
      title: b.querySelector('.exp-title') ? b.querySelector('.exp-title').value.trim() : '',
      company: b.querySelector('.exp-company') ? b.querySelector('.exp-company').value.trim() : '',
      start: b.querySelector('.exp-start') ? b.querySelector('.exp-start').value.trim() : '',
      end: b.querySelector('.exp-end') ? b.querySelector('.exp-end').value.trim() : '',
      location: b.querySelector('.exp-location') ? b.querySelector('.exp-location').value.trim() : '',
      industry: b.querySelector('.exp-industry') ? b.querySelector('.exp-industry').value.trim() : '',
      achievements: b.querySelector('.exp-achievements') ? b.querySelector('.exp-achievements').value.trim() : '',
      skillsUsed: b.querySelector('.exp-skills') ? b.querySelector('.exp-skills').value.trim() : ''
    });
  });
  return r;
}

function getEducations() {
  var r = [];
  document.querySelectorAll('.edu-block').forEach(function(b) {
    r.push({
      degree: b.querySelector('.edu-degree') ? b.querySelector('.edu-degree').value.trim() : '',
      university: b.querySelector('.edu-university') ? b.querySelector('.edu-university').value.trim() : '',
      year: b.querySelector('.edu-year') ? b.querySelector('.edu-year').value.trim() : '',
      gpa: b.querySelector('.edu-gpa') ? b.querySelector('.edu-gpa').value.trim() : '',
      courses: ''
    });
  });
  return r;
}

function getCertifications() {
  var r = [];
  document.querySelectorAll('.cert-input').forEach(function(i) {
    if (i.value.trim()) r.push(i.value.trim());
  });
  return r;
}

function saveProfile() {
  var btn = document.getElementById('saveBtn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  var profile = {
    firstName: getVal('firstName'), lastName: getVal('lastName'),
    email: getVal('email'), phone: getVal('phone'),
    city: getVal('city'), state: getVal('state'), country: getVal('country'),
    linkedin: getVal('linkedin'), github: getVal('github'), portfolio: getVal('portfolio'),
    skills: getVal('skills'), summary: getVal('summary'),
    workAuth: getVal('workAuth'), yearsExp: getVal('yearsExp'),
    salaryExpectation: getVal('salaryExpectation'), desiredTitle: getVal('desiredTitle'),
    personality: getVal('personality'),
    experiences: getExperiences(),
    educations: getEducations(),
    certifications: getCertifications().join('\n'),
    resume: (profileData.resume || '').substring(0, 5000)
  };
  chrome.storage.local.set({ userProfile: profile }, function() {
    if (chrome.runtime.lastError) {
      btn.textContent = 'Save Error!'; btn.style.background = '#e53e3e'; btn.disabled = false;
      setTimeout(function() { btn.textContent = 'Save Profile'; btn.style.background = ''; }, 3000);
      return;
    }
    btn.textContent = 'Saved!'; btn.style.background = 'linear-gradient(135deg,#4ade80,#22c55e)';
    btn.disabled = false; updateProgress();
    setTimeout(function() { btn.textContent = 'Save Profile'; btn.style.background = ''; }, 2000);
  });
}

function loadExistingProfile() {
  chrome.storage.local.get('userProfile', function(d) {
    if (chrome.runtime.lastError || !d.userProfile) return;
    profileData = d.userProfile; var p = profileData;
    setVal('firstName',p.firstName); setVal('lastName',p.lastName);
    setVal('email',p.email); setVal('phone',p.phone);
    setVal('city',p.city); setVal('state',p.state); setVal('country',p.country);
    setVal('linkedin',p.linkedin); setVal('github',p.github); setVal('portfolio',p.portfolio);
    setVal('skills',p.skills); setVal('summary',p.summary);
    setVal('workAuth',p.workAuth); setVal('yearsExp',p.yearsExp);
    setVal('salaryExpectation',p.salaryExpectation); setVal('desiredTitle',p.desiredTitle);
    setVal('personality',p.personality);
    if (p.experiences && p.experiences.length > 0) {
      document.getElementById('experienceList').innerHTML = '';
      p.experiences.forEach(function(e) { addExperience(e); });
    }
    if (p.educations && p.educations.length > 0) {
      document.getElementById('educationList').innerHTML = '';
      p.educations.forEach(function(e) { addEducation(e); });
    }
    if (p.certifications) {
      document.getElementById('certificationList').innerHTML = '';
      p.certifications.split('\n').forEach(function(c) { if(c.trim()) addCertification(c.trim()); });
    }
    updateProgress();
  });
}

function updateProgress() {
  var fields = ['firstName','email','phone','skills'];
  var f = fields.filter(function(x) { var e=document.getElementById(x); return e&&e.value.trim(); }).length;
  if (document.querySelectorAll('.exp-block').length > 0) f += 2;
  if (document.querySelectorAll('.edu-block').length > 0) f += 1;
  if (profileData && profileData.resume) f += 3;
  var pct = Math.min(100, Math.round((f/10)*100));
  var bar = document.getElementById('progressBar');
  var lbl = document.getElementById('progressLabel');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = pct + '% Complete';
}

function setVal(id,v){var e=document.getElementById(id);if(e&&v)e.value=v;}
function getVal(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function esc(t){
  if(!t)return '';
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}