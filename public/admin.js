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

  // Affichage des clients inscrits dans l'admin
  const clientsLink = document.querySelector('.sidebar-link[data-section="clients"]');
  if (clientsLink) {
    clientsLink.addEventListener('click', renderClients);
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

// Affichage des clients inscrits dans l'admin
function renderClients() {
  const clients = JSON.parse(localStorage.getItem('neurobet_users') || '[]');
  const tbody = document.getElementById('clientsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  // Afficher du plus récent au plus ancien
  clients.slice().reverse().forEach(client => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${client.pseudo || ''}</td><td>${client.email}</td><td>${client.abo || ''}</td><td>${client.prix || ''}</td><td>${client.paymentMethod || ''}</td>`;
    tbody.appendChild(tr);
  });
}
// On n'appelle plus renderClients au chargement, seulement lors du clic sur la catégorie 

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