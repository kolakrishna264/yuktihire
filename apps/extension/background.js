// JobGenie Background Service Worker

chrome.runtime.onInstalled.addListener(function() {
  console.log('JobGenie installed');
});

chrome.runtime.onStartup.addListener(function() {
  console.log('JobGenie started');
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  if (request.action === 'PING') {
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'EXTRACT_PROFILE') {
    // Decode base64 string back to binary
    try {
      var b64 = request.fileBase64;
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      var blob = new Blob([bytes], { type: request.fileType });
      var formData = new FormData();
      formData.append('file', blob, request.fileName);

      fetch('http://127.0.0.1:5000/extract-profile', {
        method: 'POST',
        body: formData
      })
      .then(function(r) {
        if (!r.ok) throw new Error('Server error ' + r.status);
        return r.json();
      })
      .then(function(d) {
        sendResponse({ success: true, data: d });
      })
      .catch(function(e) {
        console.error('Extract failed:', e.message);
        sendResponse({ success: false, error: e.message });
      });
    } catch(e) {
      console.error('Background error:', e.message);
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  if (request.action === 'TAILOR_RESUME') {
    fetch('http://127.0.0.1:5000/tailor-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { sendResponse({ success: true, data: d }); })
    .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  if (request.action === 'GENERATE_PDF') {
    fetch('http://127.0.0.1:5000/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
    .then(function(r) {
      if (!r.ok) throw new Error('PDF error ' + r.status);
      return r.arrayBuffer();
    })
    .then(function(buf) {
      // Convert to base64 for safe message passing
      var bytes = new Uint8Array(buf);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      sendResponse({
        success: true,
        dataBase64: btoa(binary),
        filename: request.payload.filename
      });
    })
    .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  return true;
});