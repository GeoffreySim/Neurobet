// Gestion du formulaire d'ajout de prono et stockage dans localStorage

document.addEventListener('DOMContentLoaded', function() {
  const pronoForm = document.getElementById('pronoForm');
  if (pronoForm) {
    pronoForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(pronoForm);
      const prono = {
        sport: formData.get('sport'),
        team1: formData.get('team1'),
        team2: formData.get('team2'),
        betType: formData.get('betType'),
        result: formData.get('result'),
        goals: formData.get('goals'),
        overUnder: formData.get('overUnder'),
        bothTeams: formData.get('bothTeams'),
        handicap: formData.get('handicap'),
        handicapTeam: formData.get('handicapTeam'),
        odds: formData.get('odds'),
        datetime: formData.get('datetime'),
        comment: formData.get('comment'),
        status: 'pending',
        createdAt: new Date().toISOString(),
        cote_winamax: formData.get('cote_winamax'),
        cote_unibet: formData.get('cote_unibet'),
        cote_betclic: formData.get('cote_betclic')
      };
      // Récupérer les pronos existants
      let pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
      pronos.push(prono);
      localStorage.setItem('neurobet_pronos', JSON.stringify(pronos));
      alert('Pronostic publié !');
      pronoForm.reset();
    });
  }

  // Navigation sidebar admin
  const links = document.querySelectorAll('.sidebar-link');
  const sections = [
    document.getElementById('section-new-prono'),
    document.getElementById('section-manage-pronos'),
    document.getElementById('section-stats')
  ];
  links.forEach(link => {
    link.addEventListener('click', () => {
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      // Masquer toutes les sections
      sections.forEach(sec => sec.style.display = 'none');
      // Afficher la bonne section
      const section = document.getElementById('section-' + link.dataset.section);
      if (section) section.style.display = 'block';
    });
  });
  // Par défaut, seule la première section est visible
  sections.forEach((sec, i) => sec.style.display = i === 0 ? 'block' : 'none');

  // Ajout du formulaire d'ajout rapide en haut du tableau Clients
  function renderAddClientForm() {
    const form = document.createElement('form');
    form.innerHTML = `
      <tr>
        <td><input type="text" name="pseudo" placeholder="Pseudo" required style="width:90px;"></td>
        <td><input type="email" name="email" placeholder="Email" required style="width:140px;"></td>
        <td colspan="2"><input type="password" name="password" placeholder="Mot de passe" required style="width:120px;"></td>
        <td colspan="3"><button type="submit" style="padding:4px 12px;">Ajouter</button></td>
      </tr>
    `;
    form.onsubmit = async function(e) {
      e.preventDefault();
      const pseudo = form.pseudo.value;
      const email = form.email.value;
      const password = form.password.value;
      try {
        const res = await fetch('/admin/api/clients/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pseudo, email, password })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Erreur lors de l\'ajout');
        } else {
          form.reset();
          renderClients();
        }
      } catch (err) {
        alert('Erreur réseau lors de l\'ajout');
      }
    };
    return form;
  }

  // Pop-up de modification/ajout utilisateur
  function showUserPopup(user) {
    let modal = document.getElementById('user-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'user-modal';
      modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,144,255,0.13);display:flex;align-items:center;justify-content:center;z-index:9999;';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="user-modal-content" style="font-family:Montserrat,sans-serif;">
        <button id="close-user-modal" class="user-modal-close">&times;</button>
        <h3 style="color:#1e90ff;margin-bottom:8px;">${user ? 'Modifier' : 'Ajouter'} un client</h3>
        <hr style="border:none;border-top:1.5px solid #e0e7ef;margin-bottom:18px;">
        <form id="user-form" autocomplete="off">
          <label><span>Pseudo</span><input type="text" name="pseudo" value="${user?.pseudo||''}" required placeholder="Pseudo"></label>
          <label><span>Email</span><input type="email" name="email" value="${user?.email||''}" required placeholder="Email"></label>
          <label><span>Type abonnement</span>
            <select name="abonnement_type" style="padding:7px 10px;border-radius:6px;border:1px solid #d0d0d0;font-size:1em;">
              <option value="">-</option>
              <option value="weekly" ${user?.abonnement_type==='weekly'?'selected':''}>Hebdomadaire</option>
              <option value="monthly" ${user?.abonnement_type==='monthly'?'selected':''}>Mensuel</option>
              <option value="yearly" ${user?.abonnement_type==='yearly'?'selected':''}>Annuel</option>
              <option value="lifetime" ${user?.abonnement_type==='lifetime'?'selected':''}>À vie</option>
            </select>
          </label>
          <div style="display:flex;gap:12px;">
            <label style="flex:1;"><span>Date début</span><input type="date" name="abonnement_debut" value="${user?.abonnement_debut ? user.abonnement_debut.substr(0,10) : ''}"></label>
            <label style="flex:1;"><span>Date fin</span><input type="date" name="abonnement_fin" value="${user?.abonnement_fin ? user.abonnement_fin.substr(0,10) : ''}"></label>
          </div>
          <label class="user-modal-switch" style="margin-top:10px;">
            <input type="checkbox" name="abonnement_actif" id="abonnement_actif" ${user?.abonnement_actif ? 'checked' : ''}>
            <span class="switch-label">Abonnement actif</span>
          </label>
          ${user ? '' : '<label><span>Mot de passe</span><input type="password" name="password" required placeholder="Mot de passe"></label>'}
          <div class="user-modal-actions">
            <button type="submit" class="user-modal-save">Enregistrer</button>
            ${user ? '<button type="button" id="delete-user-btn" class="user-modal-delete">Supprimer</button>' : ''}
          </div>
        </form>
      </div>
    `;
    document.getElementById('close-user-modal').onclick = () => { modal.remove(); };
    document.getElementById('user-form').onsubmit = async function(e) {
      e.preventDefault();
      const form = e.target;
      const data = {
        pseudo: form.pseudo.value,
        email: form.email.value,
        abonnement_type: form.abonnement_type.value,
        abonnement_debut: form.abonnement_debut.value || null,
        abonnement_fin: form.abonnement_fin.value || null,
        abonnement_actif: form.abonnement_actif.checked
      };
      if (user) {
        try {
          let res = await fetch(`/admin/api/clients/${user.id}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          let resp = await res.json();
          if (!res.ok) return alert(resp.error || 'Erreur lors de la modification');
          res = await fetch(`/admin/api/clients/${user.id}/${data.abonnement_actif ? 'activate' : 'deactivate'}`, { method: 'POST' });
        } catch (err) {
          return alert('Erreur réseau lors de la modification');
        }
      } else {
        data.password = form.password.value;
        try {
          const res = await fetch('/admin/api/clients/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          const resp = await res.json();
          if (!res.ok) return alert(resp.error || 'Erreur lors de l\'ajout');
        } catch (err) {
          return alert('Erreur réseau lors de l\'ajout');
        }
      }
      modal.remove();
      renderClients();
    };
    if (user) {
      document.getElementById('delete-user-btn').onclick = async function() {
        if (confirm('Supprimer ce client ?')) {
          try {
            const res = await fetch(`/admin/api/clients/${user.id}/delete`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Erreur lors de la suppression');
            modal.remove();
            renderClients();
          } catch (err) {
            alert('Erreur réseau lors de la suppression');
          }
        }
      };
    }
  }

  // Affichage des clients inscrits dans l'admin (depuis la base)
  async function renderClients() {
    const section = document.getElementById('section-clients') || document.getElementById('section-clients-inscrits') || document.getElementById('section-clients-list');
    const table = document.getElementById('clientsTable');
    const thead = document.getElementById('clientsTableHead');
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Supprimer le bouton d'ajout dans le tableau, ne garder que celui en haut à droite
    // (Supposons que le bouton en haut à droite a l'id 'add-client-btn-top')
    // Affichage des clients
    try {
      const res = await fetch('/admin/api/clients');
      const data = await res.json();
      if (!data.clients || data.clients.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4">Aucun client inscrit</td>';
        tbody.appendChild(tr);
        return;
      }
      data.clients.forEach(client => {
        const debut = client.abonnement_debut ? new Date(client.abonnement_debut) : null;
        const fin = client.abonnement_type === 'lifetime' ? 'À vie' : (client.abonnement_fin ? new Date(client.abonnement_fin) : null);
        let duree = '-';
        if (fin === 'À vie') {
          duree = 'À vie';
        } else if (debut && fin) {
          const diff = Math.round((fin - debut) / (1000*60*60*24));
          duree = diff + ' jours';
        } else if (fin && !debut) {
          duree = new Date(fin).toLocaleDateString();
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;color:#1e90ff;">${client.pseudo || ''}</td>
          <td style="color:#fff;">${client.email}</td>
          <td style="color:#7ffb72;">${duree}</td>
          <td><button class="btn-edit-user" style="background:#1e90ff;color:#fff;border:none;border-radius:7px;padding:7px 18px;font-weight:600;cursor:pointer;">Modifier</button></td>
        `;
        tr.querySelector('.btn-edit-user').onclick = () => showUserPopup(client);
        tbody.appendChild(tr);
      });
    } catch (e) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4">Erreur chargement clients</td>';
      tbody.appendChild(tr);
    }
  }
  // Appel lors du clic sur l'onglet clients
  const clientsLink = document.querySelector('.sidebar-link[data-section="clients"]');
  if (clientsLink) {
    clientsLink.addEventListener('click', renderClients);
  }

  const addClientBtnTop = document.getElementById('add-client-btn-top');
  if (addClientBtnTop) {
    addClientBtnTop.onclick = () => showUserPopup(null);
  }

  // Ajouter l'appel à calculateSportStats lors du clic sur l'onglet stats
  document.querySelector('.sidebar-link[data-section="stats"]').addEventListener('click', function() {
    calculateSportStats();
  });

  updatePerformanceStats();
});

// Affichage des pronostics dans le tableau admin
function renderAdminPronos() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  const tbody = document.getElementById('pronoTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  pronos.forEach((prono, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${prono.team1} vs ${prono.team2}</td>
      <td>${prono.betType || ''}${prono.result ? ' - ' + prono.result : ''}</td>
      <td>
        <select data-idx="${idx}" class="prono-status-select">
          <option value="pending" ${prono.status === 'pending' ? 'selected' : ''}>En cours</option>
          <option value="won" ${prono.status === 'won' ? 'selected' : ''}>Gagné</option>
          <option value="lost" ${prono.status === 'lost' ? 'selected' : ''}>Perdu</option>
        </select>
      </td>
      <td>
        <button data-idx="${idx}" class="edit-prono-btn">Modifier</button>
        <button data-idx="${idx}" class="delete-prono-btn">✖️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // Gestion du changement de statut
  document.querySelectorAll('.prono-status-select').forEach(select => {
    select.addEventListener('change', function() {
      const idx = this.getAttribute('data-idx');
      let pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
      pronos[idx].status = this.value;
      localStorage.setItem('neurobet_pronos', JSON.stringify(pronos));
      renderAdminPronos();
    });
  });
  // Suppression d'un prono
  document.querySelectorAll('.delete-prono-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.getAttribute('data-idx');
      let pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
      pronos.splice(idx, 1);
      localStorage.setItem('neurobet_pronos', JSON.stringify(pronos));
      renderAdminPronos();
    });
  });
  // Modification d'un prono (pop-up)
  document.querySelectorAll('.edit-prono-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.getAttribute('data-idx');
      let pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
      const prono = pronos[idx];
      const modal = document.getElementById('editPronoModal');
      const form = document.getElementById('editPronoForm');
      if (modal && form && prono) {
        form.innerHTML = `
          <label>Sport
            <input type="text" name="sport" value="${prono.sport}" required>
          </label>
          <label>Équipe 1
            <input type="text" name="team1" value="${prono.team1}" required>
          </label>
          <label>Équipe 2
            <input type="text" name="team2" value="${prono.team2}" required>
          </label>
          <label>Type de pari
            <input type="text" name="betType" value="${prono.betType}" required>
          </label>
          <label>Résultat
            <input type="text" name="result" value="${prono.result || ''}">
          </label>
          <label>Cote Winamax
            <input type="number" name="cote_winamax" value="${prono.cote_winamax || ''}" step="0.01">
          </label>
          <label>Cote Unibet
            <input type="number" name="cote_unibet" value="${prono.cote_unibet || ''}" step="0.01">
          </label>
          <label>Cote Betclic
            <input type="number" name="cote_betclic" value="${prono.cote_betclic || ''}" step="0.01">
          </label>
          <label>Date et heure
            <input type="datetime-local" name="datetime" value="${prono.datetime || ''}">
          </label>
          <label>Commentaire
            <textarea name="comment">${prono.comment || ''}</textarea>
          </label>
          <button type="submit">Enregistrer</button>
        `;
        // Gestion de la soumission du formulaire de modification
        form.onsubmit = function(e) {
          e.preventDefault();
          const data = new FormData(form);
          const updated = {
            ...prono,
            sport: data.get('sport'),
            team1: data.get('team1'),
            team2: data.get('team2'),
            betType: data.get('betType'),
            result: data.get('result'),
            cote_winamax: data.get('cote_winamax'),
            cote_unibet: data.get('cote_unibet'),
            cote_betclic: data.get('cote_betclic'),
            datetime: data.get('datetime'),
            comment: data.get('comment')
          };
          pronos[idx] = updated;
          localStorage.setItem('neurobet_pronos', JSON.stringify(pronos));
          document.getElementById('editPronoModal').style.display = 'none';
          renderAdminPronos();
        };
        modal.style.display = 'flex';
      }
    });
  });
}

// Gestion fermeture du modal
const closeEditPronoModal = document.getElementById('closeEditPronoModal');
if (closeEditPronoModal) {
  closeEditPronoModal.onclick = function() {
    document.getElementById('editPronoModal').style.display = 'none';
  };
}

// Appel au chargement
if (document.getElementById('pronoTableBody')) {
  renderAdminPronos();
}
// Rafraîchir après ajout d'un prono
if (document.getElementById('pronoForm')) {
  document.getElementById('pronoForm').addEventListener('submit', function() {
    setTimeout(renderAdminPronos, 100);
  });
}

// Fonction pour calculer les stats par sport
function calculateSportStats() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  const stats = {
    basket: { total: 0, won: 0, lost: 0 },
    foot: { total: 0, won: 0, lost: 0 },
    tennis: { total: 0, won: 0, lost: 0 }
  };

  pronos.forEach(prono => {
    let sport = '';
    if (prono.sport === 'basketball' || prono.sport === 'basket') sport = 'basket';
    else if (prono.sport === 'football' || prono.sport === 'foot') sport = 'foot';
    else if (prono.sport === 'tennis') sport = 'tennis';
    if (sport && prono.status !== 'pending') {
      stats[sport].total++;
      if (prono.status === 'won') stats[sport].won++;
      else if (prono.status === 'lost') stats[sport].lost++;
    }
  });

  Object.keys(stats).forEach(sport => {
    const total = stats[sport].total;
    const won = stats[sport].won;
    const lost = stats[sport].lost;
    // Camembert
    const ctx = document.getElementById(`chart${sport.charAt(0).toUpperCase() + sport.slice(1)}`);
    if (ctx) {
      if (window[`chart${sport}`]) window[`chart${sport}`].destroy();
      window[`chart${sport}`] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Gagnés', 'Perdus'],
          datasets: [{
            data: [won, lost],
            backgroundColor: ['#7ffb72', '#ff4d4d'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#fff', font: { size: 12 } }
            },
            datalabels: {
              display: true,
              color: '#fff',
              font: { weight: 'bold', size: 16 },
              formatter: function(value, context) {
                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                if (!total) return '0%';
                return Math.round(100 * value / total) + '%';
              },
              anchor: 'center',
              align: 'center',
              offset: 0,
              clamp: true
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const value = context.raw;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total ? Math.round((value / total) * 100) : 0;
                  return `${context.label}: ${value} (${percentage}%)`;
                }
              }
            }
          },
          cutout: '70%'
        },
        plugins: [ChartDataLabels]
      });
    }
  });
}

// Appeler une première fois au chargement
calculateSportStats(); 

function updatePerformanceStats() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  let total = 0, won = 0;
  let basketTotal = 0, basketWon = 0;
  let footTotal = 0, footWon = 0;
  let tennisTotal = 0, tennisWon = 0;

  pronos.forEach(prono => {
    if (prono.status !== 'pending') {
      total++;
      if (prono.status === 'won') won++;
      if (prono.sport === 'basketball' || prono.sport === 'basket') {
        basketTotal++;
        if (prono.status === 'won') basketWon++;
      } else if (prono.sport === 'football' || prono.sport === 'foot') {
        footTotal++;
        if (prono.status === 'won') footWon++;
      } else if (prono.sport === 'tennis') {
        tennisTotal++;
        if (prono.status === 'won') tennisWon++;
      }
    }
  });

  const globalPerf = total ? Math.round((won / total) * 100) : 0;
  const basketPerf = basketTotal ? Math.round((basketWon / basketTotal) * 100) : 0;
  const footPerf = footTotal ? Math.round((footWon / footTotal) * 100) : 0;
  const tennisPerf = tennisTotal ? Math.round((tennisWon / tennisTotal) * 100) : 0;

  document.getElementById('global-performance').textContent = globalPerf + '%';
  document.getElementById('basket-performance').textContent = basketPerf + '%';
  document.getElementById('foot-performance').textContent = footPerf + '%';
  document.getElementById('tennis-performance').textContent = tennisPerf + '%';
} 

async function loadAdminStats() {
  try {
    const res = await fetch('/admin/api/stats');
    const data = await res.json();
    
    // Vérifier que les éléments existent avant de les modifier
    const visitsTodayEl = document.getElementById('visits_today');
    const visitsMonthEl = document.getElementById('visits_month');
    const transactionsEl = document.getElementById('transactions');
    const totalClientsEl = document.getElementById('total-clients');
    const visitsChartEl = document.getElementById('visitsChart');
    
    if (visitsTodayEl) visitsTodayEl.textContent = data.visits_today || '0';
    if (visitsMonthEl) visitsMonthEl.textContent = data.visits_month || '0';
    if (transactionsEl) transactionsEl.textContent = data.transactions || '0';
    if (totalClientsEl) totalClientsEl.textContent = data.users || '0';
    
    // Bar chart Chart.js
    if (visitsChartEl) {
      if (window.visitsChartInstance) window.visitsChartInstance.destroy();
      const ctx = visitsChartEl.getContext('2d');
      const labels = (data.visits_by_day||[]).map(row => row.day);
      const values = (data.visits_by_day||[]).map(row => +row.count);
      window.visitsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.reverse(),
          datasets: [{
            label: 'Visites',
            data: values.reverse(),
            backgroundColor: '#1e90ff',
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#fff' } },
            y: { grid: { color: '#333' }, ticks: { color: '#fff', beginAtZero: true } }
          }
        }
      });
    }
  } catch (e) {
    console.error('Erreur loadAdminStats:', e);
    const visitsTodayEl = document.getElementById('visits_today');
    const visitsMonthEl = document.getElementById('visits_month');
    const transactionsEl = document.getElementById('transactions');
    const totalClientsEl = document.getElementById('total-clients');
    
    if (visitsTodayEl) visitsTodayEl.textContent = 'Erreur';
    if (visitsMonthEl) visitsMonthEl.textContent = 'Erreur';
    if (transactionsEl) transactionsEl.textContent = 'Erreur';
    if (totalClientsEl) totalClientsEl.textContent = 'Erreur';
  }
}

async function loadRevenusStats() {
  try {
    const res = await fetch('/admin/api/revenus');
    const data = await res.json();
    
    const revenusTransactionsEl = document.getElementById('revenus-transactions');
    const revenusTotalEl = document.getElementById('revenus-total');
    
    if (revenusTransactionsEl) revenusTransactionsEl.textContent = data.transactions || '0';
    if (revenusTotalEl) revenusTotalEl.textContent = (data.total_revenue || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  } catch (e) {
    console.error('Erreur loadRevenusStats:', e);
    const revenusTransactionsEl = document.getElementById('revenus-transactions');
    const revenusTotalEl = document.getElementById('revenus-total');
    
    if (revenusTransactionsEl) revenusTransactionsEl.textContent = 'Erreur';
    if (revenusTotalEl) revenusTotalEl.textContent = 'Erreur';
  }
}

// Charger les stats revenus lors de l'affichage de la section revenus
const revenusSidebar = document.querySelector('.sidebar-link[data-section="revenus"]');
if (revenusSidebar) {
  revenusSidebar.addEventListener('click', function() {
    loadRevenusStats();
    // Affiche la section revenus, masque les autres
    document.querySelectorAll('.pro-card').forEach(sec => sec.style.display = 'none');
    const section = document.getElementById('section-revenus');
    if (section) section.style.display = 'block';
  });
}
// Charger les stats revenus lors de l'affichage de la section analyse
const analyseSidebar = document.querySelector('.sidebar-link[data-section="analyse"]');
if (analyseSidebar) {
  analyseSidebar.addEventListener('click', function() {
    loadRevenusStats();
    loadAdminStats();
  });
} 