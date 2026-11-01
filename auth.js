var loginForm = document.getElementById('login-panel');
var signupForm = document.getElementById('signup-panel');
var authForms = [loginForm, signupForm].filter(Boolean);
var statusMessage = document.getElementById('account-status');
var setupNotice = document.getElementById('auth-setup-notice');
var sessionPanel = document.getElementById('auth-session');
var protectedPage = document.querySelector('[data-auth-required]');
var protectedGate = document.querySelector('[data-auth-gate]');

function setStatus(message, state) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.dataset.state = state || '';
}

async function requestAuth(path, body) {
  var response;
  try {
    response = await fetch('/api/auth/' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: body
        ? { 'Content-Type': 'application/json', 'X-Requested-With': 'GamingHub' }
        : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  } catch {
    throw new Error('Could not connect to the Gaming Hub server. Check your connection and try again.');
  }

  var result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The Gaming Hub server returned an invalid response. Please try again.');
  }
  if (!response.ok) throw new Error(result.error || 'Account request failed. Please try again.');
  return result;
}

function getNextPage() {
  return new URLSearchParams(window.location.search).get('next');
}

function goToNextPage() {
  if (getNextPage() === 'members') {
    window.location.assign('member-hub.html');
    return;
  }
  window.location.assign('../index.html#page-top');
}

function showSession(user) {
  if (!sessionPanel) return;
  var hasAccountTabs = Boolean(document.querySelector('.account-tabs'));

  authForms.forEach(function (form) {
    form.hidden = Boolean(user) || form.id === 'signup-panel';
  });
  if (signupForm && !user && !hasAccountTabs) signupForm.hidden = false;
  if (loginForm && !user && signupForm && hasAccountTabs) loginForm.hidden = false;
  sessionPanel.hidden = !user;
  document.querySelectorAll('.account-tabs, .auth-switch').forEach(function (element) {
    element.hidden = Boolean(user);
  });

  if (user) {
    var email = sessionPanel.querySelector('[data-auth-email]');
    if (email) email.textContent = user.email || user.displayName || 'Gaming Hub member';
  }
}

function showProtectedPage(user) {
  if (!protectedPage) return;
  protectedPage.hidden = !user;
  if (protectedGate) protectedGate.hidden = Boolean(user);
  if (user) {
    var memberEmail = protectedPage.querySelector('[data-member-email]');
    if (memberEmail) memberEmail.textContent = user.email || user.displayName || 'Gaming Hub member';
  }
}

function setBusy(button, busy, idleText) {
  button.disabled = busy;
  button.textContent = busy ? 'Please wait…' : idleText;
}

function updateAuthTabVisibility() {
  if (!document.querySelector('.account-tabs')) return;
  var signupIsActive = document.getElementById('signup-tab')?.getAttribute('aria-selected') === 'true';
  if (loginForm) loginForm.hidden = signupIsActive;
  if (signupForm) signupForm.hidden = !signupIsActive;
}

document.querySelectorAll('.account-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.account-tab').forEach(function (accountTab) {
      accountTab.setAttribute('aria-selected', accountTab === tab ? 'true' : 'false');
    });
    updateAuthTabVisibility();
    setStatus('', '');
  });
});

if (getNextPage() === 'members') {
  document.querySelectorAll('.auth-switch a').forEach(function (link) {
    var signupUrl = new URL(link.href);
    signupUrl.searchParams.set('next', 'members');
    link.href = signupUrl.toString();
  });
}

if (setupNotice) {
  setupNotice.textContent = 'Gaming Hub stores account details on its server. Passwords are protected with a salted, computationally expensive hash. Accounts work across devices connected to this server.';
}

authForms.forEach(function (form) {
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var formData = new FormData(form);
    var email = String(formData.get('email') || '').trim();
    var password = String(formData.get('password') || '');
    var isSignup = form === signupForm;
    var submitButton = form.querySelector('[type="submit"]');
    var idleText = isSignup ? 'Create account' : 'Log in';

    if (isSignup) {
      var displayName = String(formData.get('name') || '').trim();
      var confirmationInput = form.querySelector('[name="confirm-password"]');
      if (password !== String(formData.get('confirm-password') || '')) {
        confirmationInput.setCustomValidity('Passwords do not match.');
        confirmationInput.reportValidity();
        return;
      }
      confirmationInput.setCustomValidity('');
      if (password.length < 8 || password.length > 128) {
        setStatus('Choose a password between 8 and 128 characters.', 'error');
        return;
      }
      if (!displayName || displayName.length > 80) {
        setStatus('Enter a display name with no more than 80 characters.', 'error');
        return;
      }
    }

    setBusy(submitButton, true, idleText);
    setStatus('', '');
    try {
      var result = await requestAuth(isSignup ? 'register' : 'login', isSignup
        ? { email: email, password: password, displayName: String(formData.get('name') || '').trim() }
        : { email: email, password: password });
      if (!result.user) throw new Error('The server did not confirm the account session. Please try again.');
      goToNextPage();
    } catch (error) {
      setStatus(error.message || 'Account request failed. Please try again.', 'error');
    } finally {
      setBusy(submitButton, false, idleText);
    }
  });
});

var forgotPasswordButton = document.querySelector('[data-forgot-password]');
if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener('click', function () {
    setStatus('Email password recovery is not set up yet. Contact Gaming Hub support for help with your account.', 'error');
  });
}

var signOutButton = document.querySelector('[data-sign-out]');
if (signOutButton) {
  signOutButton.addEventListener('click', async function () {
    signOutButton.disabled = true;
    try {
      await requestAuth('logout', {});
      if (protectedPage) {
        showProtectedPage(null);
        return;
      }
      showSession(null);
      if (document.querySelector('.account-tabs')) updateAuthTabVisibility();
      setStatus('You are signed out.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not sign out. Please try again.', 'error');
    } finally {
      signOutButton.disabled = false;
    }
  });
}

async function initializeAuthPage() {
  try {
    var result = await requestAuth('session');
    if (protectedPage) {
      showProtectedPage(result.user);
      return;
    }
    if (result.user && getNextPage() === 'members') {
      window.location.replace('member-hub.html');
      return;
    }
    showSession(result.user);
  } catch (error) {
    showProtectedPage(null);
    setStatus(error.message || 'Could not check your account session.', 'error');
  }
}

initializeAuthPage();
