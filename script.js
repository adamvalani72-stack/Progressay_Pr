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

  var cartBlock = document.getElementById('shopping-cart');
  if (cartBlock) {
    var cartList = document.getElementById('cart-items');
    var cartCount = document.getElementById('cart-count');
    var cartTotal = document.getElementById('cart-total');
    var clearCartButton = document.getElementById('clear-cart');
    var checkoutButton = document.getElementById('checkout-button');
    var checkoutModal = document.getElementById('checkout-modal');
    var closeCheckoutButton = document.getElementById('close-checkout');
    var cancelCheckoutButton = document.getElementById('cancel-checkout');
    var checkoutForm = document.getElementById('checkout-form');
    var checkoutSummaryItems = document.getElementById('checkout-summary-items');
    var checkoutTotal = document.getElementById('checkout-total');
    var checkoutSuccess = document.getElementById('checkout-success');
    var storageKey = 'gamingHubCart';

    function getCart() {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (error) {
        return [];
      }
    }

    function saveCart(cart) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      } catch (error) {
        // Ignore storage errors in restricted environments.
      }
    }

    function formatCurrency(value) {
      return '£' + Number(value).toFixed(2);
    }

    function updateCheckoutSummary() {
      var cart = getCart();
      var totalCost = 0;

      if (!checkoutSummaryItems || !checkoutTotal) {
        return;
      }

      if (!cart.length) {
        checkoutSummaryItems.innerHTML = '<li><span>Cart empty</span><span>£0.00</span></li>';
        checkoutTotal.textContent = '£0.00';
        return;
      }

      checkoutSummaryItems.innerHTML = '';
      cart.forEach(function (item) {
        totalCost += item.price * item.quantity;
        var line = document.createElement('li');
        line.innerHTML = '<span>' + item.name + ' x' + item.quantity + '</span><span>' + formatCurrency(item.price * item.quantity) + '</span>';
        checkoutSummaryItems.appendChild(line);
      });

      checkoutTotal.textContent = formatCurrency(totalCost);
    }

    function renderCart() {
      var cart = getCart();
      var totalItems = 0;
      var totalCost = 0;

      if (!cartList || !cartCount || !cartTotal) {
        return;
      }

      if (!cart.length) {
        cartList.innerHTML = '<li>Your cart is empty.</li>';
        cartCount.textContent = '0 items';
        cartTotal.textContent = '£0.00';
        updateCheckoutSummary();
        return;
      }

      cartList.innerHTML = '';
      cart.forEach(function (item, index) {
        totalItems += item.quantity;
        totalCost += item.price * item.quantity;

        var listItem = document.createElement('li');
        var productInfo = document.createElement('span');
        var removeButton = document.createElement('button');

        productInfo.textContent = item.name + ' x' + item.quantity + ' — ' + formatCurrency(item.price * item.quantity);
        removeButton.type = 'button';
        removeButton.className = 'remove-item';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function () {
          var updatedCart = getCart();
          updatedCart.splice(index, 1);
          saveCart(updatedCart);
          renderCart();
        });

        listItem.appendChild(productInfo);
        listItem.appendChild(removeButton);
        cartList.appendChild(listItem);
      });

      cartCount.textContent = totalItems + (totalItems === 1 ? ' item' : ' items');
      cartTotal.textContent = formatCurrency(totalCost);
      updateCheckoutSummary();
    }

    function openCheckout() {
      if (!checkoutModal) return;
      updateCheckoutSummary();
      checkoutModal.classList.add('open');
      checkoutModal.setAttribute('aria-hidden', 'false');
    }

    function closeCheckout() {
      if (!checkoutModal) return;
      checkoutModal.classList.remove('open');
      checkoutModal.setAttribute('aria-hidden', 'true');
      if (checkoutSuccess) {
        checkoutSuccess.classList.remove('visible');
      }
    }

    document.querySelectorAll('.add-to-cart').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.dataset.name;
        var price = Number(button.dataset.price || 0);
        var cart = getCart();
        var existingItem = cart.find(function (item) {
          return item.name === name;
        });

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          cart.push({ name: name, price: price, quantity: 1 });
        }

        saveCart(cart);
        renderCart();
      });
    });

    if (checkoutButton) {
      checkoutButton.addEventListener('click', function () {
        if (!getCart().length) {
          if (checkoutSummaryItems) {
            checkoutSummaryItems.innerHTML = '<li><span>Cart empty</span><span>£0.00</span></li>';
          }
          if (checkoutTotal) {
            checkoutTotal.textContent = '£0.00';
          }
          return;
        }
        openCheckout();
      });
    }

    if (closeCheckoutButton) {
      closeCheckoutButton.addEventListener('click', closeCheckout);
    }

    if (cancelCheckoutButton) {
      cancelCheckoutButton.addEventListener('click', closeCheckout);
    }

    if (checkoutModal) {
      checkoutModal.addEventListener('click', function (event) {
        if (event.target === checkoutModal) {
          closeCheckout();
        }
      });
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (checkoutSuccess) {
          checkoutSuccess.classList.add('visible');
        }
        saveCart([]);
        renderCart();
        checkoutForm.reset();
        setTimeout(function () {
          closeCheckout();
        }, 2000);
      });
    }

    if (clearCartButton) {
      clearCartButton.addEventListener('click', function () {
        saveCart([]);
        renderCart();
      });
    }

    renderCart();
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

      var nameValue = contactForm.elements.name ? contactForm.elements.name.value.trim() : '';
      var emailValue = contactForm.elements.email ? contactForm.elements.email.value.trim() : '';
      var messageValue = contactForm.elements.message ? contactForm.elements.message.value.trim() : '';
      var mailtoLink = 'mailto:info@company.com?subject=' + encodeURIComponent('New message from ' + nameValue) + '&body=' + encodeURIComponent('Name: ' + nameValue + '\nEmail: ' + emailValue + '\n\nMessage:\n' + messageValue);

      window.location.href = mailtoLink;

      if (success) {
        success.textContent = 'Your email app should open with your message ready to send.';
      }
    });

    contactForm.querySelectorAll('.field').forEach(function (field) {
      field.addEventListener('input', function () {
        setFieldError(field, '');
      });
    });
  }
})();
