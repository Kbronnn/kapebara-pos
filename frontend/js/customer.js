document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';
  let currentCustomerId = 1; // Mocking logged-in customer

  // DOM Elements
  const welcomeMessage = document.getElementById('welcome-message');
  const tierBadge = document.getElementById('tier-badge');
  const pointsDisplay = document.getElementById('points-display');
  const benefitsList = document.getElementById('benefits-list');
  const eventsGrid = document.getElementById('events-grid');
  const hostEventForm = document.getElementById('host-event-form');
  const formMessage = document.getElementById('form-message');

  // Benefits configuration
  const tierBenefits = {
    'Bronze': ['Free Wi-Fi', '10% off pastry on birthday'],
    'Silver': ['Free Wi-Fi', '10% off pastry on birthday', 'Free upsize on Wednesdays'],
    'Gold': ['Free Wi-Fi', '15% off all items', 'Free upsize any day', 'Priority seating']
  };

  // Auth Views and Forms
  const landingView = document.getElementById('landing-view');
  const authView = document.getElementById('auth-view');
  const portalView = document.getElementById('portal-view');
  const portalHeader = document.getElementById('portal-header');
  const loginFormContainer = document.getElementById('login-form-container');
  const registerFormContainer = document.getElementById('register-form-container');
  const authTitle = document.getElementById('auth-title');
  const authMessage = document.getElementById('auth-message');
  const logoutBtn = document.getElementById('logout-btn');

  // Init
  checkAuth();

  function checkAuth() {
    const savedId = sessionStorage.getItem('customerId');
    if (savedId) {
      currentCustomerId = savedId;
      landingView.style.display = 'none';
      authView.style.display = 'none';
      portalView.style.display = 'block';
      portalHeader.style.display = 'flex';
      loadCustomerInfo();
      loadEvents();
      loadRatings();
    } else {
      landingView.style.display = 'flex';
      authView.style.display = 'none';
      portalView.style.display = 'none';
      portalHeader.style.display = 'none';
      welcomeMessage.innerHTML = '';
      loadEvents(); // Load events for the landing page too
      loadRatings();
    }
  }

  // Landing Page Handlers
  document.getElementById('nav-login-btn').addEventListener('click', () => {
    landingView.style.display = 'none';
    authView.style.display = 'block';
    portalHeader.style.display = 'flex';
    loginFormContainer.style.display = 'block';
    registerFormContainer.style.display = 'none';
    authTitle.textContent = 'Customer Login';
  });

  document.getElementById('hero-join-btn').addEventListener('click', () => {
    landingView.style.display = 'none';
    authView.style.display = 'block';
    portalHeader.style.display = 'flex';
    loginFormContainer.style.display = 'none';
    registerFormContainer.style.display = 'block';
    authTitle.textContent = 'Register Account';
  });


  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.style.display = 'none';
    registerFormContainer.style.display = 'block';
    authTitle.textContent = 'Register Account';
    authMessage.textContent = '';
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerFormContainer.style.display = 'none';
    loginFormContainer.style.display = 'block';
    authTitle.textContent = 'Customer Login';
    authMessage.textContent = '';
  });


  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('customerId');
    sessionStorage.removeItem('customerName');
    checkAuth();
  });


  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', data.name);
      e.target.reset();
      authMessage.textContent = '';
      checkAuth();
    } catch (err) {
      authMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });


  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', name);
      e.target.reset();
      authMessage.textContent = '';
      checkAuth();
    } catch (err) {
      authMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });


  async function loadCustomerInfo() {
    try {
      const res = await fetch(`${API_BASE}/customer/info?id=${currentCustomerId}`);
      if (!res.ok) throw new Error('Failed to load customer');
      const customer = await res.json();

      welcomeMessage.innerHTML = `Welcome back, <strong>${customer.name}</strong>!`;
      tierBadge.textContent = customer.loyalty_level;
      pointsDisplay.innerHTML = `${customer.points} <span style="font-size: 0.4em; font-family: 'Inter', sans-serif;">Pts</span>`;

      const avatarImg = document.getElementById('user-avatar');
      if (customer.avatar_url) avatarImg.src = customer.avatar_url;


      document.getElementById('settings-name').value = customer.name || '';
      document.getElementById('settings-email').value = customer.email || '';



      if (customer.loyalty_level === 'Bronze') tierBadge.style.backgroundColor = '#cd7f32';
      if (customer.loyalty_level === 'Silver') tierBadge.style.backgroundColor = '#c0c0c0';
      if (customer.loyalty_level === 'Gold') tierBadge.style.backgroundColor = '#ffd700';


      const benefits = tierBenefits[customer.loyalty_level] || tierBenefits['Bronze'];
      benefitsList.innerHTML = benefits.map(b => `<li>${b}</li>`).join('');

    } catch (err) {
      console.error(err);
      welcomeMessage.textContent = 'Welcome, Guest!';
    }
  }


  async function loadEvents() {
    const landingEventsGrid = document.getElementById('events-grid-landing');
    try {
      const res = await fetch(`${API_BASE}/events`);
      if (!res.ok) throw new Error('Failed to load events');
      const events = await res.json();

      if (events.length === 0) {
        const noEventsHtml = '<p style="text-align:center; width:100%; grid-column: 1/-1;">No upcoming events at the moment.</p>';
        if (eventsGrid) eventsGrid.innerHTML = noEventsHtml;
        if (landingEventsGrid) landingEventsGrid.innerHTML = noEventsHtml;
        return;
      }

      const eventsHtml = events.map(event => {
        const dateObj = new Date(event.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const isShop = event.type === 'shop';
        const typeLabel = isShop ? 'Shop Event' : 'Community Event';


        const isGuest = !sessionStorage.getItem('customerId');
        const joinAction = isGuest ? "alert('Please login to join events!')" : `joinEvent(${event.id})`;

        return `
          <div class="event-card">
            <div class="event-type">${typeLabel}</div>
            <div class="event-date">${formattedDate}</div>
            <h3 class="event-title">${event.title}</h3>
            <p class="event-desc">${event.description || 'No description provided.'}</p>
            <p style="font-size: 0.8em; color: var(--text-light); margin-bottom: 15px;">Hosted by: ${event.host_name}</p>
            <button onclick="${joinAction}" id="join-btn-${event.id}">${isGuest ? 'Login to Join' : 'Appoint (Join)'}</button>
          </div>
        `;
      }).join('');

      if (eventsGrid) eventsGrid.innerHTML = eventsHtml;
      if (landingEventsGrid) landingEventsGrid.innerHTML = eventsHtml;

    } catch (err) {
      console.error(err);
      if (eventsGrid) eventsGrid.innerHTML = '<p>Error loading events.</p>';
      if (landingEventsGrid) landingEventsGrid.innerHTML = '<p>Error loading events.</p>';
    }
  }


  window.joinEvent = async (eventId) => {
    const btn = document.getElementById(`join-btn-${eventId}`);
    const originalText = btn.textContent;
    btn.textContent = 'Joining...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: currentCustomerId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join event');
      }

      btn.textContent = 'Joined ✓';
      btn.style.backgroundColor = 'var(--success)';
    } catch (err) {
      alert(err.message);
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };

  // Host Event Submit
  hostEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const description = document.getElementById('event-desc').value;
    const btn = hostEventForm.querySelector('button');

    btn.disabled = true;
    btn.textContent = 'Submitting...';
    formMessage.textContent = '';

    try {
      const hostName = sessionStorage.getItem('customerName') || 'Customer';

      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, description, hostName })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Submission failed');

      formMessage.style.color = 'var(--success)';
      formMessage.textContent = 'Event request submitted successfully! Pending shop approval.';
      hostEventForm.reset();

      // Reload events to see the newly proposed one if we want (it's pending so maybe not shown, but we return all for now)
      loadEvents();
    } catch (err) {
      formMessage.style.color = 'red';
      formMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Request';
    }
  });

  // Load Ratings
  async function loadRatings() {
    const ratingsGrid = document.getElementById('ratings-display-grid');
    try {
      const res = await fetch(`${API_BASE}/ratings`);
      if (!res.ok) throw new Error('Failed to load ratings');
      const ratings = await res.json();

      if (ratings.length === 0) {
        ratingsGrid.innerHTML = '<p style="text-align:center; width:100%;">No reviews yet. Be the first to rate us!</p>';
        return;
      }

      ratingsGrid.innerHTML = ratings.map(r => {
        const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return `
          <div class="rating-card">
            <div class="rating-stars">${stars}</div>
            <div class="rating-author">${r.customer_name}</div>
            <p class="rating-comment">"${r.comment || 'No comment provided.'}"</p>
            <div class="rating-date">${date}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      ratingsGrid.innerHTML = '<p>Error loading reviews.</p>';
    }
  }

  // Submit Rating
  const ratingForm = document.getElementById('rating-form');
  if (ratingForm) {
    ratingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = ratingForm.querySelector('input[name="rating"]:checked')?.value;
      const comment = document.getElementById('rating-comment').value;
      const msg = document.getElementById('rating-message');
      const btn = ratingForm.querySelector('button');

      if (!rating) {
        msg.style.color = 'red';
        msg.textContent = 'Please select a star rating.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const loggedInId = sessionStorage.getItem('customerId');
        const res = await fetch(`${API_BASE}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: loggedInId || null, rating: parseInt(rating), comment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');

        msg.style.color = 'var(--success)';
        msg.textContent = 'Thank you for your feedback!';
        ratingForm.reset();
        loadRatings();
      } catch (err) {
        msg.style.color = 'red';
        msg.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Rating';
      }
    });
  }

  // Account Settings Submission
  const settingsForm = document.getElementById('account-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('settings-name').value;
      const email = document.getElementById('settings-email').value;
      const avatarInput = document.getElementById('settings-avatar');
      const password = document.getElementById('settings-password').value;
      const msg = document.getElementById('settings-message');
      const btn = settingsForm.querySelector('button');

      btn.disabled = true;
      btn.textContent = 'Updating...';

      try {
        const formData = new FormData();
        // id sent via query param so multer body parsing can't lose it
        if (name) formData.append('name', name);
        if (email) formData.append('email', email);
        if (password) formData.append('password', password);
        if (avatarInput.files.length > 0) {
          formData.append('avatar', avatarInput.files[0]);
        }

        const res = await fetch(`${API_BASE}/customer/update?id=${currentCustomerId}`, {
          method: 'PUT',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        msg.style.color = 'var(--success)';
        msg.textContent = 'Account details updated successfully!';
        if (password) document.getElementById('settings-password').value = '';

        // Refresh info
        loadCustomerInfo();
      } catch (err) {
        msg.style.color = 'red';
        msg.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Update Account Details';
      }
    });
  }

});
