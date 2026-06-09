document.addEventListener('DOMContentLoaded', () => {
  // Récupération des données depuis l'API
  async function loadData() {
    try {
      const response = await fetch('/api/client-data');
      const data = await response.json();

      // Mise à jour de l'alerte
      if (data.alert_amount) {
        document.getElementById('alertAmount').textContent = 
          parseFloat(data.alert_amount).toLocaleString('fr-FR') + ' €';
      }

      // Mise à jour du compte
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

      // Mise à jour des transactions
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

      // Mise à jour synthèse
      if (data.synthese_total) {
        document.getElementById('syntheseTotal').textContent = 
          parseFloat(data.synthese_total).toLocaleString('fr-FR') + ' €';
      }

      // Mise à jour gestionnaire
      if (data.manager_name) {
        document.getElementById('managerName').textContent = data.manager_name;
      }

      // Mise à jour modal
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

    } catch (err) {
      console.log('Données locales utilisées (Site 2 indisponible)');
    }
  }

  // Charger les données au démarrage
  loadData();

  // Rafraîchir les données toutes les 30 secondes
  setInterval(loadData, 30000);

  // Modal
  const modal = document.getElementById('accountModal');
  const openBtn = document.getElementById('openAccountDetail');
  const closeBtn = document.getElementById('closeModal');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.classList.add('open');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  // Balance toggle
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

  // Nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
});