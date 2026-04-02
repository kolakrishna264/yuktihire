// JobGenie Popup Script

document.addEventListener('DOMContentLoaded', function() {

  var analyzeBtn = document.getElementById('analyzeBtn');
  var fillBtn = document.getElementById('fillBtn');
  var resumeBtn = document.getElementById('resumeBtn');
  var profileBtn = document.getElementById('profileBtn');
  var status = document.getElementById('status');

  function updateStatus(message, isActive) {
    status.textContent = message;
    status.className = isActive ? 'status active' : 'status';
  }

  // ============================================
  // OPEN PROFILE PAGE
  // ============================================

  profileBtn.addEventListener('click', function() {
    var url = chrome.runtime.getURL('profile.html');
    chrome.tabs.create({ url: url });
  });

  // ============================================
  // CHECK PROFILE ON LOAD
  // ============================================

  chrome.storage.local.get('userProfile', function(data) {
    if (chrome.runtime.lastError) {
      updateStatus('Storage error - reload extension');
      return;
    }
    if (data.userProfile && data.userProfile.firstName) {
      updateStatus('Ready! Open a job page to start.', true);
    } else {
      updateStatus('Click Setup Profile to get started');
    }
  });

  // ============================================
  // SEND MESSAGE TO PAGE
  // ============================================

  function sendToPage(action) {
    return new Promise(function(resolve, reject) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || tabs.length === 0) {
          reject(new Error('No active tab'));
          return;
        }
        var tabId = tabs[0].id;
        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: ['content.js'] },
          function() {
            setTimeout(function() {
              chrome.tabs.sendMessage(tabId, { action: action }, function(response) {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(response);
                }
              });
            }, 800);
          }
        );
      });
    });
  }

  // ============================================
  // ANALYZE JOB PAGE
  // ============================================

  analyzeBtn.addEventListener('click', function() {
    updateStatus('Analyzing job page...', true);
    analyzeBtn.disabled = true;

    sendToPage('ANALYZE_JOB')
      .then(function(response) {
        if (response && response.success) {
          updateStatus('Found: ' + response.jobTitle + ' at ' + response.companyName, true);
        } else {
          updateStatus('No job found. Open a job listing page.');
        }
        analyzeBtn.disabled = false;
      })
      .catch(function(err) {
        updateStatus('Error: ' + err.message);
        analyzeBtn.disabled = false;
      });
  });

  // ============================================
  // AUTO FILL
  // ============================================

  fillBtn.addEventListener('click', function() {
    updateStatus('Filling application...', true);
    fillBtn.disabled = true;
    fillBtn.textContent = 'Filling...';

    chrome.storage.local.get('userProfile', function(data) {
      if (!data.userProfile) {
        updateStatus('Setup your profile first!');
        fillBtn.disabled = false;
        fillBtn.textContent = 'Auto Fill Application';
        return;
      }
      sendToPage('FILL_APPLICATION')
        .then(function(response) {
          if (response && response.success) {
            updateStatus('Filled ' + response.filledCount + ' fields!', true);
          } else {
            updateStatus('No form fields found on this page');
          }
          fillBtn.disabled = false;
          fillBtn.textContent = 'Auto Fill Application';
        })
        .catch(function(err) {
          updateStatus('Error: ' + err.message);
          fillBtn.disabled = false;
          fillBtn.textContent = 'Auto Fill Application';
        });
    });
  });

  // ============================================
  // TAILOR RESUME
  // ============================================

  resumeBtn.addEventListener('click', function() {
    updateStatus('Reading job page...', true);
    resumeBtn.disabled = true;
    resumeBtn.textContent = 'Working...';

    // Remove old results
    ['tailoredResumeBox', 'copyResumeBtn', 'downloadResumeBtn', 'atsScoreBox'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    sendToPage('ANALYZE_JOB')
      .then(function(jobResponse) {
        if (!jobResponse || !jobResponse.success) {
          updateStatus('Open a job listing page first!');
          resumeBtn.disabled = false;
          resumeBtn.textContent = 'Tailor My Resume';
          return;
        }

        updateStatus('Tailoring resume with AI...', true);

        chrome.storage.local.get('userProfile', function(data) {
          var profile = data.userProfile;
          if (!profile || !profile.resume) {
            updateStatus('No resume! Setup your profile first.');
            resumeBtn.disabled = false;
            resumeBtn.textContent = 'Tailor My Resume';
            return;
          }

          fetch('http://localhost:5000/tailor-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resume: profile.resume,
              jobDescription: jobResponse.fullText,
              profile: profile
            })
          })
          .then(function(r) { return r.json(); })
          .then(function(result) {
            resumeBtn.disabled = false;
            resumeBtn.textContent = 'Tailor My Resume';

            if (!result.success) {
              updateStatus('Error: ' + result.error);
              return;
            }

            var ats = result.atsScore || {};
            var score = ats.overallScore || 0;
            var words = result.stats ? result.stats.outputWords : 0;
            updateStatus('Done! ' + words + ' words | ATS: ' + score + '%', true);

            // ATS box
            var col = score >= 90 ? '#4ade80' : score >= 75 ? '#facc15' : '#f87171';
            var box = document.createElement('div');
            box.id = 'atsScoreBox';
            box.style.cssText = 'margin:5px 15px;padding:10px;background:#16213e;border-radius:8px;border:1px solid ' + col + ';font-size:10px;';

            var row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:6px;';
            row.innerHTML = '<span style="color:#fff;font-weight:bold;">ATS Score</span><span style="font-size:16px;font-weight:bold;color:' + col + ';">' + score + '%</span>';
            box.appendChild(row);

            var bg = document.createElement('div');
            bg.style.cssText = 'background:#333;border-radius:3px;height:5px;margin-bottom:8px;';
            var fill = document.createElement('div');
            fill.style.cssText = 'background:' + col + ';height:100%;border-radius:3px;width:' + score + '%;';
            bg.appendChild(fill);
            box.appendChild(bg);

            var items = [
              { l: 'Keywords', v: ats.keywordMatch || 0 },
              { l: 'Skills', v: ats.skillsMatch || 0 },
              { l: 'Experience', v: ats.experienceMatch || 0 },
              { l: 'Education', v: ats.educationMatch || 0 },
              { l: 'Format', v: ats.formatScore || 0 }
            ];
            var grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px;';
            items.forEach(function(item) {
              var c = item.v >= 90 ? '#4ade80' : item.v >= 75 ? '#facc15' : '#f87171';
              var d = document.createElement('div');
              d.style.cssText = 'background:#0f3460;padding:3px 6px;border-radius:4px;';
              d.innerHTML = '<span style="color:#aaa;">' + item.l + '</span><span style="float:right;color:' + c + ';font-weight:bold;">' + item.v + '%</span>';
              grid.appendChild(d);
            });
            box.appendChild(grid);

            if (ats.matchedKeywords && ats.matchedKeywords.length > 0) {
              var m = document.createElement('div');
              m.style.cssText = 'margin-bottom:3px;font-size:10px;color:#aaa;';
              m.innerHTML = '<span style="color:#4ade80;">Matched: </span>' + ats.matchedKeywords.slice(0, 4).join(', ');
              box.appendChild(m);
            }
            if (ats.missingKeywords && ats.missingKeywords.length > 0) {
              var ms = document.createElement('div');
              ms.style.cssText = 'margin-bottom:3px;font-size:10px;color:#aaa;';
              ms.innerHTML = '<span style="color:#f87171;">Missing: </span>' + ats.missingKeywords.slice(0, 3).join(', ');
              box.appendChild(ms);
            }
            if (ats.recommendation) {
              var rec = document.createElement('div');
              rec.style.cssText = 'font-size:10px;color:#888;font-style:italic;border-top:1px solid #333;padding-top:4px;margin-top:4px;';
              rec.textContent = ats.recommendation;
              box.appendChild(rec);
            }
            document.body.appendChild(box);

            // Resume preview
            var preview = document.createElement('div');
            preview.id = 'tailoredResumeBox';
            preview.style.cssText = 'margin:5px 15px;padding:8px;background:#0f3460;border-radius:8px;font-size:10px;max-height:120px;overflow-y:auto;white-space:pre-wrap;color:#ccc;border:1px solid #667eea;';
            preview.textContent = result.tailoredResume;
            document.body.appendChild(preview);

            // Copy button
            var copyBtn = document.createElement('button');
            copyBtn.id = 'copyResumeBtn';
            copyBtn.className = 'btn btn-secondary';
            copyBtn.style.cssText = 'margin:5px 15px 3px 15px;width:calc(100% - 30px);';
            copyBtn.textContent = 'Copy Resume Text';
            copyBtn.addEventListener('click', function() {
              navigator.clipboard.writeText(result.tailoredResume).then(function() {
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = 'linear-gradient(135deg,#4ade80,#22c55e)';
                setTimeout(function() {
                  copyBtn.textContent = 'Copy Resume Text';
                  copyBtn.style.background = '';
                }, 2000);
              });
            });
            document.body.appendChild(copyBtn);

            // Download PDF button
            var dlBtn = document.createElement('button');
            dlBtn.id = 'downloadResumeBtn';
            dlBtn.className = 'btn btn-primary';
            dlBtn.style.cssText = 'margin:3px 15px 10px 15px;width:calc(100% - 30px);';
            dlBtn.textContent = 'Download Resume (PDF)';
            dlBtn.addEventListener('click', function() {
              dlBtn.textContent = 'Generating PDF...';
              dlBtn.disabled = true;
              var co = (jobResponse.companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
              var jt = (jobResponse.jobTitle || 'Resume').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
              var fn = co + '_' + jt + '_Resume.pdf';
              fetch('http://localhost:5000/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resumeText: result.tailoredResume, filename: fn })
              })
              .then(function(r) {
                if (!r.ok) throw new Error('PDF failed ' + r.status);
                return r.blob();
              })
              .then(function(blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = fn; a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                dlBtn.textContent = 'Downloaded!';
                dlBtn.style.background = 'linear-gradient(135deg,#4ade80,#22c55e)';
                setTimeout(function() {
                  dlBtn.textContent = 'Download Resume (PDF)';
                  dlBtn.style.background = '';
                  dlBtn.disabled = false;
                }, 3000);
              })
              .catch(function(err) {
                dlBtn.textContent = 'Error: ' + err.message;
                dlBtn.disabled = false;
              });
            });
            document.body.appendChild(dlBtn);
          })
          .catch(function() {
            updateStatus('Backend not running! Run: python app.py');
            resumeBtn.disabled = false;
            resumeBtn.textContent = 'Tailor My Resume';
          });
        });
      })
      .catch(function(err) {
        updateStatus('Error: ' + err.message);
        resumeBtn.disabled = false;
        resumeBtn.textContent = 'Tailor My Resume';
      });
  });

});