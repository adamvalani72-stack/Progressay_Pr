(function () {
  document.querySelectorAll('a.page-scroll[href*="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      var href = this.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var toggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var contactForm = document.querySelector('#contact form');
  if (contactForm) {
    var success = document.getElementById('success');
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (success) {
      success.setAttribute('role', 'status');
      success.setAttribute('aria-live', 'polite');
    }

    function setFieldError(field, message) {
      var group = field.closest('.form-group');
      var error = group ? group.querySelector('.field-error') : null;

      if (error) {
        error.textContent = message;
      }

      field.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function clearStatus() {
      if (success) {
        success.textContent = '';
      }
    }

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameField = contactForm.elements.name;
      var emailField = contactForm.elements.email;
      var messageField = contactForm.elements.message;
      var isValid = true;

      clearStatus();

      if (nameField) {
        var nameValue = nameField.value.trim();
        if (!nameValue) {
          setFieldError(nameField, 'Please enter your name.');
          isValid = false;
        } else {
          setFieldError(nameField, '');
        }
      }

      if (emailField) {
        var emailValue = emailField.value.trim();
        if (!emailValue) {
          setFieldError(emailField, 'Please enter your email address.');
          isValid = false;
        } else if (!emailPattern.test(emailValue)) {
          setFieldError(emailField, 'Please enter a valid email address.');
          isValid = false;
        } else {
          setFieldError(emailField, '');
        }
      }

      if (messageField) {
        var messageValue = messageField.value.trim();
        if (!messageValue) {
          setFieldError(messageField, 'Please enter a message.');
          isValid = false;
        } else {
          setFieldError(messageField, '');
        }
      }

      if (!isValid) {
        return;
      }

      contactForm.reset();
      contactForm.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
        field.setAttribute('aria-invalid', 'false');
      });

      if (success) {
        success.textContent = 'Thank you! We will get back to you soon.';
      }
    });

    contactForm.querySelectorAll('.field').forEach(function (field) {
      field.addEventListener('input', function () {
        setFieldError(field, '');
      });
    });
  }
})();
