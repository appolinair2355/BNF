document.addEventListener('DOMContentLoaded', () => {
  // ========== RÉCUPÉRATION DES DONNÉES DEPUIS L'API ==========
  async function loadData() {
    try {
      const response = await fetch('/api/client-data');
      const data = await response.json();

      // Alerte
      if (data.alert_amount) {
        document.getElementById('alertAmount').textContent = 
          parseFloat(data.alert_amount).toLocaleString('fr-FR') + ' €';
      }

      // Compte
      if (data.account_number) {
        document.getElementById('accountNumber').textContent = 'N° ' + data.account_number;
      }
      if (data.account_date) {
        document.getElementById('accountDate').textContent = data.account_date;
      }
      if (data.account_balance) {
        const balance = parseFloat(data.account_balance).toLocaleString('fr-FR');
        document.getElementById('mainBalance').textContent = balance + ' €';
      }
      if (data.account_pending) {
        document.getElementById('accountPending').textContent = 
          parseFloat(data.account_pending).toLocaleString('fr-FR');
      }
      if (data.account_frozen === 'false') {
        document.getElementById('frozenBadge').style.display = 'none';
      }

      // Transactions
      if (data.transaction1_name) {
        document.getElementById('t1Name').textContent = data.transaction1_name;
      }
      if (data.transaction1_date) {
        document.getElementById('t1Date').textContent = data.transaction1_date;
      }
      if (data.transaction1_status) {
        document.getElementById('t1Status').textContent = data.transaction1_status;
      }
      if (data.transaction1_amount) {
        const amount = parseFloat(data.transaction1_amount);
        document.getElementById('t1Amount').textContent = amount > 0 ? 
          '−' + amount.toLocaleString('fr-FR') + ' €' : 'Réglée';
      }

      if (data.transaction2_name) {
        document.getElementById('t2Name').textContent = data.transaction2_name;
      }
      if (data.transaction2_date) {
        document.getElementById('t2Date').textContent = data.transaction2_date;
      }
      if (data.transaction2_status) {
        document.getElementById('t2Status').textContent = data.transaction2_status;
      }

      if (data.transaction3_name) {
        document.getElementById('t3Name').textContent = data.transaction3_name;
      }
      if (data.transaction3_date) {
        document.getElementById('t3Date').textContent = data.transaction3_date;
      }
      if (data.transaction3_status) {
        document.getElementById('t3Status').textContent = data.transaction3_status;
      }

      // Synthèse
      if (data.synthese_total) {
        document.getElementById('syntheseTotal').textContent = 
          parseFloat(data.synthese_total).toLocaleString('fr-FR') + ' €';
      }

      // Gestionnaire
      if (data.manager_name) {
        document.getElementById('managerName').textContent = data.manager_name;
        document.getElementById('contactManager').textContent = data.manager_name;
      }

      // Modal
      if (data.holder_lastname) {
        document.getElementById('modalLastname').textContent = data.holder_lastname;
      }
      if (data.holder_firstname) {
        document.getElementById('modalFirstname').textContent = data.holder_firstname;
      }
      if (data.holder_birthdate) {
        document.getElementById('modalBirthdate').textContent = data.holder_birthdate;
      }
      if (data.holder_country) {
        document.getElementById('modalCountry').textContent = data.holder_country;
      }
      if (data.holder_city) {
        document.getElementById('modalCity').textContent = data.holder_city;
      }
      if (data.holder_region) {
        document.getElementById('modalRegion').textContent = data.holder_region;
      }
      if (data.account_number) {
        document.getElementById('modalAccountNumber').textContent = '**** **** ' + data.account_number.replace('*', '').trim();
      }
      if (data.account_balance) {
        const bal = parseFloat(data.account_balance).toLocaleString('fr-FR');
        const frozen = data.account_frozen === 'true' ? ' (gelé)' : '';
        document.getElementById('modalBalance').textContent = bal + ' €' + frozen;
      }
      if (data.account_pending) {
        document.getElementById('modalPending').textContent = 
          parseFloat(data.account_pending).toLocaleString('fr-FR') + ' €';
      }
      if (data.alert_amount) {
        document.getElementById('modalAlert').textContent = 
          parseFloat(data.alert_amount).toLocaleString('fr-FR') + ' € à payer';
      }
      if (data.manager_name) {
        document.getElementById('modalManager').textContent = data.manager_name;
      }

      // Profil
      if (data.holder_firstname && data.holder_lastname) {
        document.getElementById('profileName').textContent = 
          data.holder_firstname + ' ' + data.holder_lastname;
      }

    } catch (err) {
      console.log('Données locales utilisées (Site 2 indisponible)');
    }
  }

  // Charger les données au démarrage
  loadData();

  // Rafraîchir les données toutes les 30 secondes
  setInterval(loadData, 30000);

  // ========== NAVIGATION ==========
  window.navigateTo = function(page) {
    // Cacher toutes les pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Afficher la page demandée
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    // Mettre à jour la navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === page) {
        item.classList.add('active');
      }
    });

    // Scroll en haut
    window.scrollTo(0, 0);
  };

  // ========== MODALS ==========
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  // Fermer modal en cliquant sur l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });

  // ========== BOUTONS ACTIONS ==========
  window.showVirement = function() {
    openModal('virementModal');
  };

  window.showWero = function() {
    alert('Wero : Fonctionnalité en cours de développement');
  };

  window.showRIB = function() {
    openModal('ribModal');
  };

  window.showPlafonds = function() {
    openModal('plafondsModal');
  };

  window.showNotifications = function() {
    openModal('notifModal');
  };

  // ========== NAVIGATION PAGES ==========
  window.showAllAccounts = function() {
    alert('Tous les comptes : Fonctionnalité en cours de développement');
  };

  window.showInsurance = function() {
    alert('Assurances : Fonctionnalité en cours de développement');
  };

  window.showAllTransactions = function() {
    alert('Toutes les opérations : Fonctionnalité en cours de développement');
  };

  window.showTransactionDetail = function(id) {
    alert('Détail transaction ' + id + ' : Fonctionnalité en cours de développement');
  };

  window.showSynthese = function() {
    alert('Synthèse complète : Fonctionnalité en cours de développement');
  };

  window.contactManager = function() {
    alert('Contact gestionnaire : Fonctionnalité en cours de développement');
  };

  window.activateCashback = function() {
    alert('Cashback activé !');
  };

  window.showOpportunities = function() {
    alert('Opportunités : Fonctionnalité en cours de développement');
  };

  window.showImmobilier = function() {
    alert('Crédit immobilier : Fonctionnalité en cours de développement');
  };

  window.showChat = function() {
    alert('Messagerie : Fonctionnalité en cours de développement');
  };

  window.showPhone = function() {
    window.location.href = 'tel:+33140142000';
  };

  window.showSettings = function() {
    alert('Paramètres : Fonctionnalité en cours de développement');
  };

  window.showSecurity = function() {
    alert('Sécurité : Fonctionnalité en cours de développement');
  };

  window.showHelp = function() {
    alert('Aide & Support : Fonctionnalité en cours de développement');
  };

  window.logout = function() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      alert('Déconnexion...');
    }
  };

  window.goBack = function() {
    navigateTo('accueil');
  };

  // ========== BALANCE TOGGLE ==========
  const toggleBtn = document.getElementById('toggleBalance');
  const balanceEl = document.getElementById('mainBalance');
  let shown = false;

  if (toggleBtn && balanceEl) {
    toggleBtn.addEventListener('click', () => {
      shown = !shown;
      if (shown) {
        balanceEl.classList.remove('hidden');
      } else {
        balanceEl.classList.add('hidden');
      }
    });
  }
});