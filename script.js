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
    var checkoutProductsButton = document.getElementById('checkout-products-button');
    var checkoutSubscriptionsButton = document.getElementById('checkout-subscriptions-button');
    var checkoutModal = document.getElementById('checkout-modal');
    var checkoutTitle = document.getElementById('checkout-title');
    var checkoutSummaryTitle = document.getElementById('checkout-summary-title');
    var paymentDemoNote = document.getElementById('payment-demo-note');
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
    var checkoutType = 'product';

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

    function getItemType(item) {
      if (item.type === 'subscription' || item.type === 'product') {
        return item.type;
      }
      return String(item.name || '').toLowerCase().indexOf('subscription') !== -1
        ? 'subscription'
        : 'product';
    }

    function getCheckoutCart(cart) {
      return (cart || getCart()).filter(function (item) {
        return getItemType(item) === checkoutType;
      });
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
      var cart = getCheckoutCart();
      var totalCost = 0n;

      if (!checkoutSummaryItems || !checkoutTotal) {
        return;
      }

      if (!cart.length) {
        checkoutSummaryItems.innerHTML = '<li><span>No ' + (checkoutType === 'subscription' ? 'subscriptions' : 'products') + ' selected</span><span>£0.00</span></li>';
        checkoutTotal.textContent = '£0.00';
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
        if (checkoutProductsButton) checkoutProductsButton.disabled = true;
        if (checkoutSubscriptionsButton) checkoutSubscriptionsButton.hidden = true;
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

        productInfo.textContent = (getItemType(item) === 'subscription' ? 'Subscription: ' : 'Product: ') + item.name + ' x' + item.quantity + ' — ' + formatCurrency(lineTotal);
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
      if (checkoutProductsButton) {
        checkoutProductsButton.disabled = !cart.some(function (item) { return getItemType(item) === 'product'; });
      }
      if (checkoutSubscriptionsButton) {
        var hasSubscriptions = cart.some(function (item) { return getItemType(item) === 'subscription'; });
        checkoutSubscriptionsButton.hidden = !hasSubscriptions;
        checkoutSubscriptionsButton.disabled = !hasSubscriptions;
      }
      updateCheckoutSummary();
    }

    function openCheckout(type) {
      if (!checkoutModal) return;
      checkoutType = type;
      var isSubscription = checkoutType === 'subscription';
      if (checkoutTitle) checkoutTitle.textContent = isSubscription ? 'Subscription checkout' : 'Product checkout';
      if (checkoutSummaryTitle) checkoutSummaryTitle.textContent = isSubscription ? 'Subscription Summary' : 'Product Summary';
      if (paymentDemoNote) {
        paymentDemoNote.textContent = isSubscription
          ? 'Annual subscription demo. No recurring payment will be charged.'
          : 'Product checkout demo. No real payment will be charged.';
      }
      document.querySelectorAll('.subscription-shipping-field').forEach(function (field) {
        field.hidden = isSubscription;
        field.querySelectorAll('input, select').forEach(function (input) {
          input.required = !isSubscription;
        });
      });
      updatePaymentMethod();
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
          : isInstantPay ? 'Pay instantly (demo)' : checkoutType === 'subscription' ? 'Start subscription (demo)' : 'Place order';
      }
    }

    paymentMethodRadios.forEach(function (radio) {
      radio.addEventListener('change', updatePaymentMethod);
    });

    document.querySelectorAll('.add-to-cart').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.dataset.name;
          var itemType = button.dataset.itemType || 'product';
          var price = button.dataset.pricePence !== undefined
            ? toBigInt(button.dataset.pricePence)
            : toBigInt(button.dataset.price || '0') * 100n;
        var cart = getCart();
        var existingItem = cart.find(function (item) {
            return item.name === name && getItemType(item) === itemType;
        });

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
            cart.push({ name: name, type: itemType, pricePence: String(price), quantity: 1 });
        }

        saveCart(cart);
        renderCart();
      });
    });

    if (checkoutProductsButton) {
      checkoutProductsButton.addEventListener('click', function () {
        if (!checkoutProductsButton.disabled) openCheckout('product');
      });
    }

    if (checkoutSubscriptionsButton) {
      checkoutSubscriptionsButton.addEventListener('click', function () {
        if (!checkoutSubscriptionsButton.disabled) openCheckout('subscription');
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
            ? 'Free demo checkout complete. No payment was charged.'
            : isInstantPay
              ? 'Demo instant payment complete. No real payment was charged.'
              : checkoutType === 'subscription'
                ? 'Demo subscription started. No recurring payment was charged.'
                : 'Demo product order complete. No real payment was charged.';
          checkoutSuccess.classList.add('visible');
        }
        saveCart(getCart().filter(function (item) {
          return getItemType(item) !== checkoutType;
        }));
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

  var planButtons = document.querySelectorAll('[data-start-plan]');
  var membershipCheckout = document.getElementById('membership-checkout');
  var membershipDialog = membershipCheckout && membershipCheckout.querySelector('.membership-dialog');
  var accountStep = document.getElementById('membership-account-step');
  var paymentStep = document.getElementById('membership-payment-step');
  var membershipComplete = document.getElementById('membership-complete');
  var accountStepForm = document.getElementById('membership-account-form');
  var paymentStepForm = document.getElementById('membership-payment-form');
  var membershipEmail = document.getElementById('membership-email');
  var membershipStatus = document.getElementById('membership-status');
  var membershipError = document.getElementById('membership-error');
  var selectedPlan = null;
  var previousPlanButton = null;

  function setMembershipStep(step) {
    if (!accountStep || !paymentStep || !membershipComplete) return;
    accountStep.hidden = step !== 'account';
    paymentStep.hidden = step !== 'payment';
    membershipComplete.hidden = step !== 'complete';
    document.querySelectorAll('[data-membership-step]').forEach(function (label) {
      if (step === 'complete') {
        label.removeAttribute('aria-current');
      } else if (label.dataset.membershipStep === step) {
        label.setAttribute('aria-current', 'step');
      } else {
        label.removeAttribute('aria-current');
      }
    });
  }

  function closeMembershipCheckout() {
    if (!membershipCheckout) return;
    membershipCheckout.hidden = true;
    document.body.classList.remove('membership-checkout-open');
    if (previousPlanButton) previousPlanButton.focus();
  }

  function openMembershipCheckout(button) {
    if (!membershipCheckout || !button) return;
    previousPlanButton = button;
    selectedPlan = {
      id: button.dataset.planId,
      name: button.dataset.planName,
      price: button.dataset.planPrice
    };

    document.querySelectorAll('[data-selected-plan-name]').forEach(function (element) {
      element.textContent = selectedPlan.name;
    });
    document.querySelectorAll('[data-selected-plan-price]').forEach(function (element) {
      element.textContent = selectedPlan.price;
    });
    accountStepForm.reset();
    paymentStepForm.reset();
    if (membershipStatus) membershipStatus.textContent = '';
    if (membershipError) {
      membershipError.hidden = true;
      membershipError.textContent = '';
    }
    setMembershipStep('account');
    membershipCheckout.hidden = false;
    document.body.classList.add('membership-checkout-open');
    membershipEmail.focus();
  }

  planButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      openMembershipCheckout(button);
    });
  });

  var checkoutParams = new URLSearchParams(window.location.search);
  var selectedPlanFromUrl = checkoutParams.get('plan');
  if (selectedPlanFromUrl) {
    var selectedPlanButton = Array.prototype.find.call(planButtons, function (button) {
      return button.dataset.planId === selectedPlanFromUrl;
    });
    if (selectedPlanButton) {
      openMembershipCheckout(selectedPlanButton);
      if (checkoutParams.get('checkout') === 'success') {
        setMembershipStep('complete');
        if (membershipStatus) membershipStatus.textContent = 'Verifying your Stripe checkout…';
        var sessionId = checkoutParams.get('session_id');
        fetch('/api/checkout-session?session_id=' + encodeURIComponent(sessionId || ''))
          .then(function (response) {
            return response.json().then(function (result) {
              if (!response.ok) throw new Error(result.error || 'Could not verify payment.');
              return result;
            });
          })
          .then(function (result) {
            membershipStatus.textContent = result.active
              ? selectedPlanButton.dataset.planName + ' membership is active.'
              : 'Stripe has not confirmed an active membership for this checkout.';
          })
          .catch(function (error) {
            if (membershipError) {
              membershipError.hidden = false;
              membershipError.textContent = error.message || 'Could not verify the checkout session.';
            }
            if (membershipStatus) membershipStatus.textContent = '';
          })
          .finally(function () {
            var cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('plan');
            cleanUrl.searchParams.delete('checkout');
            cleanUrl.searchParams.delete('session_id');
            window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
          });
      } else if (checkoutParams.get('checkout') === 'cancelled') {
        if (membershipError) {
          membershipError.hidden = false;
          membershipError.textContent = 'Checkout was canceled. You have not been charged.';
        }
        var canceledUrl = new URL(window.location.href);
        canceledUrl.searchParams.delete('plan');
        canceledUrl.searchParams.delete('checkout');
        window.history.replaceState({}, document.title, canceledUrl.pathname + canceledUrl.hash);
      }
    }
  }

  if (accountStepForm) {
    accountStepForm.addEventListener('submit', function (event) {
      event.preventDefault();
      setMembershipStep('payment');
      document.querySelector('[name="membership-payment-method"]').focus();
    });
  }

  var membershipBackButton = document.querySelector('[data-membership-back]');
  if (membershipBackButton) {
    membershipBackButton.addEventListener('click', function () {
      setMembershipStep('account');
      membershipEmail.focus();
    });
  }

  if (paymentStepForm) {
    paymentStepForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!selectedPlan || !membershipEmail) return;

      var submitButton = paymentStepForm.querySelector('[type="submit"]');
      var submitLabel = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Connecting to Stripe…';
      if (membershipError) {
        membershipError.hidden = true;
        membershipError.textContent = '';
      }

      try {
        var response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan.id, email: membershipEmail.value.trim() })
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(result.error || 'Secure checkout could not be started.');
        if (!result.url) throw new Error('Stripe did not return a checkout link.');
        window.location.assign(result.url);
      } catch (error) {
        if (membershipError) {
          membershipError.hidden = false;
          membershipError.textContent = error.message || 'Could not connect to secure checkout.';
        }
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    });
  }

  document.querySelectorAll('[data-close-membership]').forEach(function (button) {
    button.addEventListener('click', closeMembershipCheckout);
  });

  if (membershipCheckout) {
    membershipCheckout.addEventListener('click', function (event) {
      if (event.target === membershipCheckout) closeMembershipCheckout();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !membershipCheckout.hidden) closeMembershipCheckout();
    });
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
    if (form.classList.contains('auth-form')) {
      return;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      form.reset();
      if (accountStatus) {
        accountStatus.textContent = 'Authentication is not connected yet. Contact the site owner for account access.';
      }
    });
  });

  document.querySelectorAll('.auth-password-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var field = button.closest('.auth-password-input').querySelector('input');
      var showPassword = field.type === 'password';
      field.type = showPassword ? 'text' : 'password';
      button.textContent = showPassword ? 'Hide' : 'Show';
      button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', showPassword ? 'true' : 'false');
      field.focus();
    });
  });

  var signupPassword = document.getElementById('signup-password');
  var confirmPassword = document.getElementById('signup-confirm-password');
  var passwordStrength = document.getElementById('password-strength');

  function updatePasswordFeedback() {
    if (signupPassword && passwordStrength) {
      var value = signupPassword.value;
      var score = 0;
      if (value.length >= 8) score += 1;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
      if (/\d/.test(value)) score += 1;
      if (/[^A-Za-z0-9]/.test(value)) score += 1;

      var strength = value.length === 0 ? '' : score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong';
      passwordStrength.dataset.strength = strength;
      passwordStrength.querySelector('.auth-strength-label').textContent = value.length === 0
        ? 'Password strength'
        : strength.charAt(0).toUpperCase() + strength.slice(1);
    }

    if (signupPassword && confirmPassword) {
      confirmPassword.setCustomValidity(confirmPassword.value && confirmPassword.value !== signupPassword.value
        ? 'Passwords do not match.'
        : '');
    }
  }

  if (signupPassword && confirmPassword) {
    signupPassword.addEventListener('input', updatePasswordFeedback);
    confirmPassword.addEventListener('input', updatePasswordFeedback);
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
