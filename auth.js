import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

var authConfig = window.GAMING_HUB_AUTH || {};
var authClient = authConfig.projectUrl && authConfig.publishableKey
  ? createClient(authConfig.projectUrl, authConfig.publishableKey)
  : null;
var loginForm = document.getElementById('login-panel');
var signupForm = document.getElementById('signup-panel');
var primaryForm = loginForm || signupForm;
var resetForm = document.getElementById('reset-password-form');
var statusMessage = document.getElementById('account-status');
var setupNotice = document.getElementById('auth-setup-notice');
var sessionPanel = document.getElementById('auth-session');
var isRecoveryFlow = new URLSearchParams(window.location.search).has('recovery');

function setStatus(message, state) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.dataset.state = state || '';
}

function setRecoveryMode(enabled) {
  isRecoveryFlow = enabled;
  if (primaryForm) primaryForm.hidden = enabled;
  if (resetForm) resetForm.hidden = !enabled;

  document.querySelectorAll('.auth-google-button, .auth-divider, .auth-switch').forEach(function (element) {
    element.hidden = enabled;
  });
  if (sessionPanel && enabled) sessionPanel.hidden = true;
}

function showSession(user) {
  if (isRecoveryFlow || !primaryForm || !sessionPanel) return;

  var isSignedIn = Boolean(user);
  primaryForm.hidden = isSignedIn;
  sessionPanel.hidden = !isSignedIn;
  document.querySelectorAll('.auth-google-button, .auth-divider, .auth-switch').forEach(function (element) {
    element.hidden = isSignedIn;
  });

  if (isSignedIn) {
    var email = sessionPanel.querySelector('[data-auth-email]');
    if (email) email.textContent = user.email || 'Google account';
  }
}

function authUnavailable() {
  setStatus('Add the Supabase project URL and publishable key to auth-config.js to enable account access.', 'error');
}

function getRedirectUrl() {
  var redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.delete('recovery');
  redirectUrl.hash = '';
  return redirectUrl.toString();
}

function getRecoveryRedirectUrl() {
  var redirectUrl = new URL(getRedirectUrl());
  redirectUrl.searchParams.set('recovery', '1');
  return redirectUrl.toString();
}

async function setBusy(button, busy, idleText) {
  button.disabled = busy;
  button.textContent = busy ? 'Please wait…' : idleText;
}

if (setupNotice && !authClient) {
  setupNotice.textContent = 'Connect a Supabase project to enable secure sign-in. Setup steps are in README.md.';
}

if (isRecoveryFlow) {
  setRecoveryMode(true);
}

if (primaryForm) {
  primaryForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!authClient) {
      authUnavailable();
      return;
    }

    var formData = new FormData(primaryForm);
    var email = String(formData.get('email') || '').trim();
    var password = String(formData.get('password') || '');
    var submitButton = primaryForm.querySelector('[type="submit"]');
    var idleText = signupForm ? 'Create account' : 'Log in';

    if (signupForm) {
      var confirmPassword = primaryForm.querySelector('[name="confirm-password"]');
      if (password !== String(formData.get('confirm-password') || '')) {
        confirmPassword.setCustomValidity('Passwords do not match.');
        confirmPassword.reportValidity();
        return;
      }
      confirmPassword.setCustomValidity('');
    }

    await setBusy(submitButton, true, idleText);
    setStatus('', '');

    try {
      if (signupForm) {
        var displayName = String(formData.get('name') || '').trim();
        var signupResult = await authClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: getRedirectUrl()
          }
        });

        if (signupResult.error) throw signupResult.error;
        if (signupResult.data.session) {
          setStatus('Your account is ready.', 'success');
          showSession(signupResult.data.user);
        } else {
          setStatus('Check your email for a confirmation link to finish creating your account.', 'success');
        }
      } else {
        var loginResult = await authClient.auth.signInWithPassword({ email: email, password: password });
        if (loginResult.error) throw loginResult.error;
        setStatus('You are signed in.', 'success');
        showSession(loginResult.data.user);
      }
    } catch (error) {
      setStatus(error.message || 'Authentication failed. Please try again.', 'error');
    } finally {
      await setBusy(submitButton, false, idleText);
    }
  });
}

document.querySelectorAll('[data-google-auth]').forEach(function (button) {
  button.addEventListener('click', async function () {
    if (!authClient) {
      authUnavailable();
      return;
    }

    button.disabled = true;
    setStatus('', '');
    try {
      var result = await authClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getRedirectUrl() }
      });
      if (result.error) throw result.error;
    } catch (error) {
      button.disabled = false;
      setStatus(error.message || 'Google sign-in failed. Please try again.', 'error');
    }
  });
});

var forgotPasswordButton = document.querySelector('[data-forgot-password]');
if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener('click', async function () {
    var emailInput = loginForm.querySelector('[name="email"]');
    var email = emailInput.value.trim();
    if (!email) {
      setStatus('Enter your email address to request a password reset.', 'error');
      emailInput.focus();
      return;
    }
    if (!emailInput.checkValidity()) {
      emailInput.reportValidity();
      return;
    }
    if (!authClient) {
      authUnavailable();
      return;
    }

    forgotPasswordButton.disabled = true;
    try {
      var result = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: getRecoveryRedirectUrl()
      });
      if (result.error) throw result.error;
      setStatus('If an account exists for that address, a password reset link is on its way.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not request a password reset. Please try again.', 'error');
    } finally {
      forgotPasswordButton.disabled = false;
    }
  });
}

if (resetForm) {
  var resetPassword = resetForm.querySelector('#reset-password');
  var resetConfirmation = resetForm.querySelector('#reset-confirm-password');

  function validateResetConfirmation() {
    resetConfirmation.setCustomValidity(resetConfirmation.value && resetConfirmation.value !== resetPassword.value
      ? 'Passwords do not match.'
      : '');
  }

  resetPassword.addEventListener('input', validateResetConfirmation);
  resetConfirmation.addEventListener('input', validateResetConfirmation);
  resetForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    validateResetConfirmation();
    if (!resetForm.reportValidity()) return;
    if (!authClient) {
      authUnavailable();
      return;
    }

    var submitButton = resetForm.querySelector('[type="submit"]');
    await setBusy(submitButton, true, 'Update password');
    try {
      var result = await authClient.auth.updateUser({ password: resetPassword.value });
      if (result.error) throw result.error;
      window.history.replaceState({}, document.title, window.location.pathname);
      setRecoveryMode(false);
      setStatus('Password updated. You are signed in.', 'success');
      showSession(result.data.user);
    } catch (error) {
      setStatus(error.message || 'Could not update your password. Please try again.', 'error');
    } finally {
      await setBusy(submitButton, false, 'Update password');
    }
  });
}

var signOutButton = document.querySelector('[data-sign-out]');
if (signOutButton) {
  signOutButton.addEventListener('click', async function () {
    if (!authClient) return;
    signOutButton.disabled = true;
    var result = await authClient.auth.signOut();
    signOutButton.disabled = false;
    if (result.error) {
      setStatus(result.error.message, 'error');
      return;
    }
    setStatus('You are signed out.', 'success');
  });
}

if (authClient) {
  authClient.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      setRecoveryMode(true);
      setStatus('Choose a new password for your account.', '');
      return;
    }
    showSession(session && session.user);
  });

  authClient.auth.getSession().then(function (result) {
    if (result.error) {
      setStatus(result.error.message, 'error');
      return;
    }
    showSession(result.data.session && result.data.session.user);
  });
}