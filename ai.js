(function () {
  var providerSelect = document.getElementById('ai-provider');
  var providerStatus = document.getElementById('ai-provider-status');
  var transcript = document.getElementById('ai-transcript');
  var chatForm = document.getElementById('ai-chat-form');
  var messageInput = document.getElementById('ai-message');
  var sendButton = document.getElementById('ai-send');
  var newChatButton = document.getElementById('ai-new-chat');
  var characterCount = document.getElementById('ai-char-count');
  var conversation = [];
  var introMessage = 'Hi! Tell me what kind of game you enjoy, or ask for a strategy tip to get started.';

  if (!providerSelect || !providerStatus || !transcript || !chatForm || !messageInput || !sendButton ||
      !newChatButton || !characterCount) return;

  function updateCharacterCount() {
    characterCount.textContent = messageInput.value.length + ' / 4000';
  }

  function addMessage(role, text) {
    var message = document.createElement('article');
    message.className = 'member-ai-message member-ai-message-' + role;

    var label = document.createElement('span');
    label.className = 'member-ai-message-label';
    label.textContent = role === 'user' ? 'You' : 'Gaming Hub AI';

    var content = document.createElement('p');
    content.textContent = text;
    message.append(label, content);
    transcript.appendChild(message);
    transcript.scrollTop = transcript.scrollHeight;
    return message;
  }

  function resetConversation() {
    conversation = [];
    transcript.replaceChildren();
    addMessage('assistant', introMessage);
  }

  newChatButton.addEventListener('click', function () {
    if (sendButton.disabled && sendButton.textContent === 'Thinking…') return;
    resetConversation();
    messageInput.value = '';
    updateCharacterCount();
    messageInput.focus();
  });

  messageInput.addEventListener('input', updateCharacterCount);
  messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  async function loadProviders() {
    try {
      var response = await fetch('/api/ai/providers', { credentials: 'same-origin', cache: 'no-store' });
      var data = await response.json();
      if (!response.ok || !Array.isArray(data.providers)) {
        throw new Error(data.error || 'Could not load AI providers.');
      }

      providerSelect.replaceChildren();
      var availableProviders = data.providers.filter(function (provider) {
        return provider.configured;
      }).sort(function (first, second) {
        return (first.id === 'local' ? 1 : 0) - (second.id === 'local' ? 1 : 0);
      });

      data.providers.forEach(function (provider) {
        var option = document.createElement('option');
        option.value = provider.id;
        option.disabled = !provider.configured;
        option.textContent = provider.configured
          ? provider.model ? provider.label + ' · ' + provider.model : provider.label
          : provider.label + ' · not set up';
        providerSelect.appendChild(option);
      });

      if (!availableProviders.length) {
        providerSelect.disabled = true;
        sendButton.disabled = true;
        messageInput.disabled = false;
        providerStatus.textContent = 'Gaming Hub AI needs a provider to generate replies. Configure an AI provider key and model on the server, then restart it. In GitHub Codespaces, add the key as a Codespaces secret and the model as a variable. Ollama can run locally without an external AI key.';
        return;
      }

      providerSelect.value = availableProviders[0].id;
      providerSelect.disabled = false;
      messageInput.disabled = false;
      sendButton.disabled = false;
      providerStatus.textContent = availableProviders[0].id === 'local'
        ? 'Offline guide ready—fast answers with built-in gaming tips. Choose a hosted provider when available for open-ended AI responses.'
        : 'Choose any configured provider. Your messages are sent to that provider and are not saved by Gaming Hub.';
    } catch (error) {
      providerSelect.disabled = true;
      sendButton.disabled = true;
      messageInput.disabled = false;
      providerStatus.textContent = (error.message || 'Could not load AI providers.') + ' Reload this page to try again.';
    }
  }

  providerSelect.addEventListener('change', function () {
    resetConversation();
    providerStatus.textContent = providerSelect.value === 'local'
      ? 'Offline guide ready—fast answers with built-in gaming tips. Choose a hosted provider for open-ended AI responses.'
      : 'Your messages are sent to the selected provider and are not saved by Gaming Hub.';
  });

  document.querySelectorAll('[data-ai-prompt]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (messageInput.disabled || sendButton.disabled) return;
      messageInput.value = button.dataset.aiPrompt || '';
      messageInput.focus();
    });
  });

  chatForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var message = messageInput.value.trim();
    var provider = providerSelect.value;
    if (!message || !provider || message.length > 4000 || sendButton.disabled) return;

    while (conversation.length > 10) conversation.splice(0, 2);
    conversation.push({ role: 'user', content: message });
    var userMessage = addMessage('user', message);
    messageInput.value = '';
    messageInput.disabled = true;
    providerSelect.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Thinking…';
    var pendingMessage = addMessage('assistant', 'Thinking…');
    pendingMessage.setAttribute('aria-busy', 'true');

    try {
      var response = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'GamingHub'
        },
        body: JSON.stringify({ provider: provider, messages: conversation })
      });
      var data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Gaming Hub received an invalid AI response. Please try again.');
      }
      if (!response.ok) throw new Error(data.error || 'The AI could not answer right now.');
      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('The AI returned an empty response. Please try again.');
      }
      pendingMessage.querySelector('p').textContent = data.answer;
      conversation.push({ role: 'assistant', content: data.answer });
    } catch (error) {
      pendingMessage.classList.add('member-ai-message-error');
      var errorMessage = error.message || 'Could not reach the AI provider. Please try again.';
      if (response && response.status === 429) {
        var retryAfter = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          errorMessage += ' You can try again in about ' + Math.ceil(retryAfter / 60) + ' minute(s).';
        }
      }
      pendingMessage.querySelector('p').textContent = errorMessage;
      userMessage.remove();
      messageInput.value = message;
      updateCharacterCount();
      conversation.pop();
    } finally {
      pendingMessage.removeAttribute('aria-busy');
      messageInput.disabled = false;
      providerSelect.disabled = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      messageInput.focus();
    }
  });

  updateCharacterCount();
  loadProviders();
})();
