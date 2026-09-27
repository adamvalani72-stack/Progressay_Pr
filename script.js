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
    var paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
    var paymentCardFields = document.getElementById('payment-card-fields');
    var secureCheck = document.getElementById('secure-check');
    var placeOrderButton = document.getElementById('place-order-button');
    var checkoutSummaryItems = document.getElementById('checkout-summary-items');
    var checkoutTotal = document.getElementById('checkout-total');
    var checkoutSuccess = document.getElementById('checkout-success');
    var promoCodeInput = document.getElementById('promo-code');
    var applyPromoButton = document.getElementById('apply-promo');
    var promoMessage = document.getElementById('promo-message');
    var storageKey = 'gamingHubCart';
    var promoCode = '5833';
    var freeOrderPromoCode = '8547';

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
      var numeric = toBigInt(value);
      var sign = numeric < 0n ? '-' : '';
      var digits = sign ? numeric.toString().slice(1) : numeric.toString();
      digits = digits.padStart(3, '0');
      var wholeUnits = digits.slice(0, -2);
      var fractionalUnits = digits.slice(-2);

      var groups = [];
      while (wholeUnits.length > 3) {
        groups.unshift(wholeUnits.slice(-3));
        wholeUnits = wholeUnits.slice(0, -3);
      }
      groups.unshift(wholeUnits);

      return '£' + sign + groups.join(',') + '.' + fractionalUnits;
    }

    function toBigInt(value) {
      if (typeof value === 'bigint') {
        return value;
      }

      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          return 0n;
        }
        return BigInt(Math.trunc(value));
      }

      var cleanValue = String(value).replace(/[^0-9-]/g, '');
      if (!cleanValue || cleanValue === '-') {
        return 0n;
      }

      return BigInt(cleanValue);
    }

    function getItemPrice(item) {
      if (item.pricePence !== undefined) {
        return toBigInt(item.pricePence);
      }
      return toBigInt(item.price) * 100n;
    }

    function getFreeSubscriptionTotal(cart) {
      var currentCart = cart || getCart();
      var freeAmount = 0n;

      if (!currentCart || !currentCart.length) {
        return freeAmount;
      }

      currentCart.forEach(function (item) {
        var name = String(item && item.name ? item.name : '').toLowerCase();
        if (name.indexOf('pro gaming hub subscription') !== -1) {
          freeAmount += getItemPrice(item) * BigInt(item.quantity || 1);
        }
      });

      return freeAmount;
    }

    function getPromoStatus() {
      if (!promoCodeInput) {
        return false;
      }

      var value = promoCodeInput.value.trim();
      return value === promoCode || value === freeOrderPromoCode;
    }

    function hasFreeOrderPromo() {
      return Boolean(promoCodeInput && promoCodeInput.value.trim() === freeOrderPromoCode);
    }

    function renderPromoMessage() {
      if (!promoMessage || !promoCodeInput) {
        return;
      }

      var value = promoCodeInput.value.trim();
      if (!value) {
        promoMessage.textContent = 'Enter a valid promo code';
        promoMessage.style.color = '#ffd166';
        return;
      }

      if (value === promoCode || value === freeOrderPromoCode) {
        promoMessage.textContent = 'Promo applied';
        promoMessage.style.color = '#2ecc71';
      } else {
        promoMessage.textContent = 'Invalid promo code';
        promoMessage.style.color = '#ff6b6b';
      }
    }

    function getTotalWithPromo(totalCost, cart) {
      var cost = toBigInt(totalCost);
      if (hasFreeOrderPromo()) {
        return 0n;
      }

      if (!getPromoStatus()) {
        return cost;
      }

      var subscriptionDiscount = getFreeSubscriptionTotal(cart);
      if (subscriptionDiscount > 0n) {
        return cost > subscriptionDiscount ? cost - subscriptionDiscount : 0n;
      }

      return cost;
    }

    function updateCheckoutSummary() {
      var cart = getCart();
      var totalCost = 0n;

      if (!checkoutSummaryItems || !checkoutTotal) {
        return;
      }

      if (!cart.length) {
        checkoutSummaryItems.innerHTML = '<li><span>Cart empty</span><span>£0</span></li>';
        checkoutTotal.textContent = '£0';
        return;
      }

      checkoutSummaryItems.innerHTML = '';
      cart.forEach(function (item) {
        var lineTotal = getItemPrice(item) * BigInt(item.quantity);
        totalCost += lineTotal;
        var line = document.createElement('li');
        line.innerHTML = '<span>' + item.name + ' x' + item.quantity + '</span><span>' + formatCurrency(lineTotal) + '</span>';
        checkoutSummaryItems.appendChild(line);
      });

      checkoutTotal.textContent = formatCurrency(getTotalWithPromo(totalCost, cart));
    }

    function renderCart() {
      var cart = getCart();
      var totalItems = 0;
      var totalCost = 0n;

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
        var lineTotal = getItemPrice(item) * BigInt(item.quantity);
        totalCost += lineTotal;

        var listItem = document.createElement('li');
        var productInfo = document.createElement('span');
        var removeButton = document.createElement('button');

        productInfo.textContent = item.name + ' x' + item.quantity + ' — ' + formatCurrency(lineTotal);
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
      cartTotal.textContent = formatCurrency(getTotalWithPromo(totalCost, cart));
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

    function updatePaymentMethod() {
      var selectedMethod = document.querySelector('input[name="payment-method"]:checked');
      var isInstantPay = selectedMethod && selectedMethod.value === 'instant';
      var isFreeOrder = hasFreeOrderPromo();
      var skipsCardDetails = Boolean(isInstantPay || isFreeOrder);

      paymentMethodRadios.forEach(function (radio) {
        var option = radio.closest('.payment-option');
        if (option) {
          option.classList.toggle('selected', radio.checked);
        }
      });

      if (paymentCardFields) {
        paymentCardFields.hidden = skipsCardDetails;
        paymentCardFields.querySelectorAll('input, select').forEach(function (field) {
          field.required = !skipsCardDetails;
        });
      }

      if (secureCheck) {
        secureCheck.hidden = skipsCardDetails;
        var secureConfirmation = secureCheck.querySelector('input');
        if (secureConfirmation) {
          secureConfirmation.required = !skipsCardDetails;
        }
      }

      if (placeOrderButton) {
        placeOrderButton.textContent = isFreeOrder
          ? 'Complete free order'
          : isInstantPay ? 'Pay instantly (demo)' : 'Place order';
      }
    }

    paymentMethodRadios.forEach(function (radio) {
      radio.addEventListener('change', updatePaymentMethod);
    });

    document.querySelectorAll('.add-to-cart').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.dataset.name;
          var price = button.dataset.pricePence !== undefined
            ? toBigInt(button.dataset.pricePence)
            : toBigInt(button.dataset.price || '0') * 100n;
        var cart = getCart();
        var existingItem = cart.find(function (item) {
          return item.name === name;
        });

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
            cart.push({ name: name, pricePence: String(price), quantity: 1 });
        }

        saveCart(cart);
        renderCart();
      });
    });

    if (checkoutButton) {
      checkoutButton.addEventListener('click', function () {
        if (!getCart().length) {
          if (checkoutSummaryItems) {
            checkoutSummaryItems.innerHTML = '<li><span>Cart empty</span><span>£0</span></li>';
          }
          if (checkoutTotal) {
            checkoutTotal.textContent = '£0';
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

    function validateCardDetails() {
      var cardNumber = document.getElementById('card-number');
      var cardExpiry = document.getElementById('card-expiry');
      var cardCvv = document.getElementById('card-cvv');
      var cardPostcode = document.getElementById('card-postcode');
      var isValid = true;

      if (cardNumber) {
        var digits = cardNumber.value.replace(/\D/g, '');
        if (digits.length < 15 || digits.length > 19) {
          cardNumber.setCustomValidity('Enter a valid card number.');
          isValid = false;
        } else {
          cardNumber.setCustomValidity('');
        }
      }

      if (cardExpiry) {
        var expiry = cardExpiry.value.trim();
        var expiryMatch = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2,4})$/;
        if (!expiryMatch.test(expiry)) {
          cardExpiry.setCustomValidity('Use MM / YY format.');
          isValid = false;
        } else {
          cardExpiry.setCustomValidity('');
        }
      }

      if (cardCvv) {
        var cvv = cardCvv.value.replace(/\D/g, '');
        if (cvv.length < 3 || cvv.length > 4) {
          cardCvv.setCustomValidity('Enter a valid CVV.');
          isValid = false;
        } else {
          cardCvv.setCustomValidity('');
        }
      }

      if (cardPostcode) {
        var postcode = cardPostcode.value.trim();
        if (!postcode) {
          cardPostcode.setCustomValidity('Billing postcode is required.');
          isValid = false;
        } else {
          cardPostcode.setCustomValidity('');
        }
      }

      return isValid;
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var selectedMethod = document.querySelector('input[name="payment-method"]:checked');
        var isInstantPay = selectedMethod && selectedMethod.value === 'instant';
        var isFreeOrder = hasFreeOrderPromo();

        if (!isInstantPay && !isFreeOrder && !validateCardDetails()) {
          checkoutForm.reportValidity();
          return;
        }

        if (checkoutSuccess) {
          checkoutSuccess.textContent = isFreeOrder
            ? 'Free demo order complete. No payment was charged.'
            : isInstantPay
              ? 'Demo instant payment complete. No real payment was charged.'
              : 'Your order has been placed successfully.';
          checkoutSuccess.classList.add('visible');
        }
        saveCart([]);
        renderCart();
        checkoutForm.reset();
        updatePaymentMethod();
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

    if (promoCodeInput) {
      promoCodeInput.addEventListener('input', function () {
        renderPromoMessage();
        renderCart();
        updatePaymentMethod();
      });
    }

    if (applyPromoButton) {
      applyPromoButton.addEventListener('click', function () {
        renderPromoMessage();
        renderCart();
        updatePaymentMethod();
      });
    }

    updatePaymentMethod();
    renderCart();
    renderPromoMessage();
  }

  var accountTabs = document.querySelectorAll('.account-tab');
  var accountForms = document.querySelectorAll('.account-form');
  var accountStatus = document.getElementById('account-status');

  accountTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var activePanelId = tab.getAttribute('aria-controls');

      accountTabs.forEach(function (accountTab) {
        accountTab.setAttribute('aria-selected', accountTab === tab ? 'true' : 'false');
      });

      accountForms.forEach(function (form) {
        form.hidden = form.id !== activePanelId;
      });

      if (accountStatus) {
        accountStatus.textContent = '';
      }
    });
  });

  accountForms.forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      form.reset();
      if (accountStatus) {
        accountStatus.textContent = 'Authentication is not connected yet. Contact the site owner for account access.';
      }
    });
  });

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
