(function () {
  var providerSelect = document.getElementById('ai-provider');
  var providerStatus = document.getElementById('ai-provider-status');
  var transcript = document.getElementById('ai-transcript');
  var chatForm = document.getElementById('ai-chat-form');
  var messageInput = document.getElementById('ai-message');
  var sendButton = document.getElementById('ai-send');
  var conversation = [];
  var introMessage = 'Hi! Tell me what kind of game you enjoy, or ask for a strategy tip to get started.';

  if (!providerSelect || !providerStatus || !transcript || !chatForm || !messageInput || !sendButton) return;

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

  async function loadProviders() {
    try {
      var response = await fetch('/api/ai/providers', { credentials: 'same-origin', cache: 'no-store' });
      var data = await response.json();
      if (response.status === 401) {
        window.location.replace('login.html?next=members');
        return;
      }
      if (!response.ok || !Array.isArray(data.providers)) {
        throw new Error(data.error || 'Could not load AI providers.');
      }

      providerSelect.replaceChildren();
      var availableProviders = data.providers.filter(function (provider) {
        return provider.configured;
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
        messageInput.disabled = true;
        providerStatus.textContent = 'Gaming Hub AI is not configured yet. Add an AI provider key and model to the Gaming Hub server .env file, then restart the server. Ollama can run locally without an external AI key.';
        return;
      }

      providerSelect.value = availableProviders[0].id;
      providerSelect.disabled = false;
      messageInput.disabled = false;
      sendButton.disabled = false;
      providerStatus.textContent = 'Choose any configured provider. Your messages are sent to that provider and are not saved by Gaming Hub.';
    } catch (error) {
      providerSelect.disabled = true;
      sendButton.disabled = true;
      messageInput.disabled = true;
      providerStatus.textContent = error.message || 'Could not load AI providers. Please reload the page.';
    }
  }

  providerSelect.addEventListener('change', resetConversation);

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
    if (!message || !provider || message.length > 1200 || sendButton.disabled) return;

    while (conversation.length > 10) conversation.splice(0, 2);
    conversation.push({ role: 'user', content: message });
    addMessage('user', message);
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
      if (response.status === 401) {
        window.location.replace('login.html?next=members');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'The AI could not answer right now.');
      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('The AI returned an empty response. Please try again.');
      }
      pendingMessage.querySelector('p').textContent = data.answer;
      conversation.push({ role: 'assistant', content: data.answer });
    } catch (error) {
      pendingMessage.classList.add('member-ai-message-error');
      pendingMessage.querySelector('p').textContent = error.message || 'Could not reach the AI provider. Please try again.';
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

  loadProviders();
})();
