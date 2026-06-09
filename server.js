const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// URL du Site 2 (Admin) - API
const ADMIN_API_URL = process.env.ADMIN_API_URL || 'https://mybank-admin.onrender.com/api/data';

app.use(express.static(__dirname));

// API Proxy - Récupère les données du Site 2
app.get('/api/client-data', async (req, res) => {
  try {
    const response = await fetch(ADMIN_API_URL, { timeout: 5000 });
    if (!response.ok) throw new Error('Site 2 indisponible');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    // Données par défaut si le Site 2 est inaccessible
    res.json({
      alert_amount: '12649',
      account_number: '**** 4073',
      account_date: '09/06/2026',
      account_balance: '2500000',
      account_frozen: 'true',
      account_pending: '0.00',
      holder_lastname: 'Gauthier',
      holder_firstname: 'Jean Pierre',
      holder_birthdate: '05/07/1939',
      holder_country: 'France',
      holder_city: 'Lens',
      holder_region: 'Pas-de-Calais',
      manager_name: 'François Guinard',
      transaction1_name: 'Virement — Mme Rejeanne',
      transaction1_date: '10 Mai 2023',
      transaction1_status: 'Bloqué · Non conforme',
      transaction1_amount: '200000',
      transaction2_name: 'Facture EDF',
      transaction2_date: '2001 · 2010 · 2013',
      transaction2_status: 'Payé',
      transaction2_amount: '0',
      transaction3_name: 'Facture Eau',
      transaction3_date: '2012',
      transaction3_status: 'Payé',
      transaction3_amount: '0',
      synthese_total: '162350.95'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Site 1 (MyBank Client) démarré sur le port ${PORT}`);
  console.log(`Connexion API Admin: ${ADMIN_API_URL}`);
});