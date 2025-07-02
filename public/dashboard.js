// Affichage des pronostics depuis le localStorage
function renderPronos() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  const lists = {
    basket: document.getElementById('prono-basket-list'),
    foot: document.getElementById('prono-foot-list'),
    tennis: document.getElementById('prono-tennis-list')
  };
  // Vider les listes
  Object.values(lists).forEach(list => list.innerHTML = '');
  // Trier les pronos : en cours d'abord, puis gagnés/perdus
  const pronosSorted = pronos.slice().sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });
  pronosSorted.forEach((prono, idx) => {
    // Choix de la section
    let section = '';
    if (prono.sport === 'basketball' || prono.sport === 'basket') section = 'basket';
    else if (prono.sport === 'football' || prono.sport === 'foot') section = 'foot';
    else if (prono.sport === 'tennis') section = 'tennis';
    if (!section) return;
    // Création de l'élément
    const li = document.createElement('li');
    // Ajout du badge New si c'est le plus récent
    const isNew = idx === 0;
    li.style.position = 'relative';
    let cotesHtml = '';
    if (prono.cote_winamax) {
      cotesHtml += `<span class="cote-site"><img src='winamax.png' alt='Winamax' class='logo-site-paris'>${prono.cote_winamax}</span> `;
    }
    if (prono.cote_unibet) {
      cotesHtml += `<span class="cote-site"><img src='unibet.png' alt='Unibet' class='logo-site-paris'>${prono.cote_unibet}</span> `;
    }
    if (prono.cote_betclic) {
      cotesHtml += `<span class="cote-site"><img src='betclic.png' alt='Betclic' class='logo-site-paris'>${prono.cote_betclic}</span> `;
    }
    // Format date sans minutes
    let dateStr = '';
    if (prono.datetime) {
      const d = new Date(prono.datetime);
      dateStr = d.toLocaleDateString('fr-FR') + ' - ' + d.getHours() + 'h';
    }
    // Détermination du texte du pronostic pour les résultats
    let pronoType = prono.betType || '';
    if (prono.betType === 'result' && prono.result) {
      let equipe = '';
      if (prono.result === '1') equipe = prono.team1;
      else if (prono.result === '2') equipe = prono.team2;
      else if (prono.result === 'X') equipe = 'Match nul';
      pronoType = `Pronostic : ${equipe}`;
    } else if (prono.betType && prono.result) {
      pronoType = prono.betType + ' - ' + prono.result;
    }
    // Ajout des boutons suivi
    const suivis = JSON.parse(localStorage.getItem('neurobet_suivis') || '[]');
    const suivi = suivis.find(s => s.id === prono.id);
    li.innerHTML = `
      ${isNew ? `<div class='badge-new' style='text-align:center;background:#ff4d4d;color:#fff;font-weight:700;padding:4px 12px;border-radius:12px;font-size:1em;margin-bottom:8px;animation:blink 1s infinite;'>Paris du jour</div>` : ''}
      ${prono.image ? `<img src="${prono.image}" alt="Capture d'écran" class="prono-img-thumb" data-img="${prono.image}" style="max-width:100%;border-radius:12px;margin-bottom:10px;cursor:pointer;">` : ''}
      <div class="prono-suivi-btns" style="display:flex;gap:18px;justify-content:center;margin-bottom:16px;">
        <button class="btn-suivi${suivi && suivi.suivi===1 ? ' btn-suivi-active' : ' btn-suivi-inactive'}" data-id="${prono.id}" data-suivi="1" style="background:#2de1c2;color:#101926;padding:16px 32px;font-size:1.25em;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Je suis</button>
        <button class="btn-suivi${suivi && suivi.suivi===0 ? ' btn-suivi-active' : ' btn-suivi-inactive'}" data-id="${prono.id}" data-suivi="0" style="background:#ff4d4d;color:#fff;padding:16px 32px;font-size:1.25em;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Je suis pas</button>
      </div>
      ${prono.postDate ? `<div class='prono-post-date' style='text-align:center;color:#7ffb72;font-weight:600;margin-bottom:8px;'>Publié le ${(() => { const d = prono.postDate.split('-'); return d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : prono.postDate; })()}</div>` : ''}
      <div class="prono-details">
        <span class="prono-type">${pronoType}</span>
      </div>
      <div class="prono-cotes-sites">${cotesHtml}</div>
      <div class="prono-time">${dateStr}</div>
      <div class="prono-status ${prono.status}" style="font-size:1.4em;margin-top:12px;">${prono.status === 'won' ? 'Gagné' : prono.status === 'lost' ? 'Perdu' : 'En cours'}</div>
      ${prono.comment ? `<div class="prono-comment">${prono.comment}</div>` : ''}
    `;
    lists[section].appendChild(li);
  });
  // Gestion du clic sur l'image pour modal
  setTimeout(() => {
    document.querySelectorAll('.prono-img-thumb').forEach(img => {
      img.addEventListener('click', function() {
        let modal = document.getElementById('modalImagePreview');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'modalImagePreview';
          modal.style = 'display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(16,25,38,0.85);z-index:9999;align-items:center;justify-content:center;';
          modal.innerHTML = `<span id='closeModalImage' style='position:absolute;top:24px;right:40px;font-size:3em;color:#ff4d4d;cursor:pointer;font-weight:bold;'>&times;</span><img id='modalImage' src='' alt='Aperçu' style='max-width:90vw;max-height:90vh;border-radius:18px;box-shadow:0 8px 32px rgba(45,225,194,0.13);'>`;
          document.body.appendChild(modal);
          document.getElementById('closeModalImage').onclick = function() {
            modal.style.display = 'none';
            document.getElementById('modalImage').src = '';
          };
          modal.onclick = function(e) {
            if(e.target === modal) {
              modal.style.display = 'none';
              document.getElementById('modalImage').src = '';
            }
          };
        }
        document.getElementById('modalImage').src = this.getAttribute('data-img');
        modal.style.display = 'flex';
      });
    });
    // Gestion des boutons suivi
    document.querySelectorAll('.btn-suivi').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = parseInt(this.getAttribute('data-id'));
        const suiviVal = parseInt(this.getAttribute('data-suivi'));
        let suivis = JSON.parse(localStorage.getItem('neurobet_suivis') || '[]');
        const idx = suivis.findIndex(s => s.id === id);
        if(idx !== -1) suivis[idx].suivi = suiviVal;
        else suivis.push({id, suivi: suiviVal});
        localStorage.setItem('neurobet_suivis', JSON.stringify(suivis));
        renderPronos();
      });
    });
  }, 0);
}

// Ajout affichage stats utilisateur
function renderStats() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  const suivis = JSON.parse(localStorage.getItem('neurobet_suivis') || '[]');
  // Répartition suivis / non suivis
  let nbSuivi = 0, nbNonSuivi = 0;
  pronos.forEach(prono => {
    const suivi = suivis.find(s => s.id === prono.id);
    if (suivi && suivi.suivi === 1) nbSuivi++;
    else nbNonSuivi++;
  });
  // Camembert
  if(window.suiviChart) window.suiviChart.destroy();
  const ctx = document.getElementById('chart-suivi').getContext('2d');
  let dataSuivi = [nbSuivi, nbNonSuivi];
  let labelsSuivi = ['Suivi', 'Non suivi'];
  let colorsSuivi = ['#2de1c2', '#ff4d4d'];
  let showChart = true;
  if (pronos.length === 0) {
    dataSuivi = [1, 1];
    labelsSuivi = ['Aucun pari', ''];
    colorsSuivi = ['#cccccc', '#eeeeee'];
    showChart = false;
  } else if (nbSuivi === 0 && nbNonSuivi === 0) {
    dataSuivi = [1, 1];
    labelsSuivi = ['Aucun suivi', ''];
    colorsSuivi = ['#cccccc', '#eeeeee'];
  }
  window.suiviChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labelsSuivi,
      datasets: [{
        data: dataSuivi,
        backgroundColor: colorsSuivi
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {position: 'bottom'},
        datalabels: {
          color: '#fff',
          font: {weight: 'bold', size: 18},
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            if (!total || value === 0) return '';
            return Math.round(100 * value / total) + '%';
          }
        },
        tooltip: { enabled: false }
      }
    },
    plugins: window.ChartDataLabels ? [ChartDataLabels] : []
  });
  // Message si aucun pari
  const chartContainer = document.getElementById('chart-suivi').parentElement;
  let msg = chartContainer.querySelector('.no-pari-msg');
  if (pronos.length === 0) {
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'no-pari-msg';
      msg.style = 'color:#aaa;text-align:center;margin-top:12px;font-size:1.1em;';
      msg.textContent = 'Aucun pari posté pour le moment.';
      chartContainer.appendChild(msg);
    }
  } else if (msg) {
    msg.remove();
  }
  // % victoire quand suivi
  let winSuivi = 0, totalSuivi = 0;
  let winNonSuivi = 0, totalNonSuivi = 0;
  pronos.forEach(prono => {
    const suivi = suivis.find(s => s.id === prono.id);
    if (suivi && suivi.suivi === 1) {
      totalSuivi++;
      if (prono.status === 'won') winSuivi++;
    } else {
      totalNonSuivi++;
      if (prono.status === 'won') winNonSuivi++;
    }
  });
  const pctWinSuivi = totalSuivi ? Math.round(100 * winSuivi / totalSuivi) : 0;
  const pctWinNonSuivi = totalNonSuivi ? Math.round(100 * winNonSuivi / totalNonSuivi) : 0;
  document.getElementById('stat-win-suivi').textContent = pctWinSuivi + '%';
  document.getElementById('stat-win-nonsuivi').textContent = pctWinNonSuivi + '%';
}

function updatePerformanceStatsClient() {
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

  document.getElementById('global-performance-client').textContent = globalPerf + '%';
  document.getElementById('basket-performance-client').textContent = basketPerf + '%';
  document.getElementById('foot-performance-client').textContent = footPerf + '%';
  document.getElementById('tennis-performance-client').textContent = tennisPerf + '%';
}

document.addEventListener('DOMContentLoaded', function() {
  const links = document.querySelectorAll('.sidebar-link');
  const sections = [
    document.getElementById('section-accueil'),
    document.getElementById('section-basket'),
    document.getElementById('section-foot'),
    document.getElementById('section-tennis'),
    document.getElementById('section-compte'),
    document.getElementById('section-stats'),
    document.getElementById('section-historique')
  ];

  links.forEach(link => {
    link.addEventListener('click', () => {
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      // Masquer toutes les sections
      sections.forEach(sec => sec && (sec.style.display = 'none'));
      // Afficher la bonne section
      const section = document.getElementById('section-' + link.dataset.section);
      if (section) section.style.display = 'block';
      if (link.dataset.section === 'stats') {
        renderStats();
      }
      if (link.dataset.section === 'historique') {
        updatePerformanceStatsClient();
      }
    });
  });
  // Par défaut, seule la section accueil est visible
  sections.forEach((sec, i) => sec && (sec.style.display = i === 0 ? 'block' : 'none'));
  renderPronos();

  // Affichage des infos utilisateur dans Mon compte
  const user = JSON.parse(localStorage.getItem('neurobet_current_user') || '{}');
  if (user && user.email && user.pseudo) {
    const emailSpan = document.getElementById('user-email');
    const pseudoSpan = document.getElementById('user-pseudo');
    if (emailSpan) emailSpan.textContent = user.email;
    if (pseudoSpan) pseudoSpan.textContent = user.pseudo;
  }

  // Affichage dynamique de la section stats
  if (document.querySelector('.sidebar-link[data-section="stats"]')) {
    document.querySelector('.sidebar-link[data-section="stats"]').addEventListener('click', function() {
      // Masquer toutes les sections
      document.querySelectorAll('.pro-card').forEach(s => s.style.display = 'none');
      document.getElementById('section-stats').style.display = 'block';
      renderStats();
    });
  }

  // Ajout du style CSS dynamique pour la surbrillance
  if (!document.getElementById('btn-suivi-style')) {
    const style = document.createElement('style');
    style.id = 'btn-suivi-style';
    style.innerHTML = `
      .btn-suivi-active { box-shadow: 0 0 0 4px #2de1c2, 0 2px 12px rgba(45,225,194,0.13); filter: brightness(1.1); z-index:1; }
      .btn-suivi-inactive { opacity: 0.6; filter: grayscale(0.3); }
      .btn-suivi[data-suivi="0"].btn-suivi-active { box-shadow: 0 0 0 4px #ff4d4d, 0 2px 12px rgba(255,77,77,0.13); }
    `;
    document.head.appendChild(style);
  }

  // Ajout de la règle CSS pour l'animation de clignotement
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  updatePerformanceStatsClient();
  // Affichage dynamique de la section historique
  if (document.querySelector('.sidebar-link[data-section="historique"]')) {
    document.querySelector('.sidebar-link[data-section="historique"]').addEventListener('click', function() {
      document.querySelectorAll('.pro-card').forEach(s => s.style.display = 'none');
      document.getElementById('section-historique').style.display = 'block';
      updatePerformanceStatsClient();
    });
  }
});

// Dans la fonction showAccueil, remplacer le bouton "Voir les pronostics" par "Voir le paris du jour"
// et ajouter un gestionnaire d'événement pour rediriger vers le dernier pari
function showAccueil() {
  const main = document.querySelector('main');
  main.innerHTML = `
    <div class="welcome-container" style="text-align:center;padding:40px;background:#1a1a1a;border-radius:12px;margin:20px auto;max-width:600px;">
      <h1 style="color:#fff;font-size:2.5em;margin-bottom:20px;">Bienvenue sur votre espace client</h1>
      <p style="color:#ccc;font-size:1.2em;margin-bottom:30px;">Retrouvez tous vos pronostics et statistiques ici.</p>
      <button id="btnVoirPronos" style="background:#2de1c2;color:#101926;padding:16px 32px;font-size:1.25em;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Voir le paris du jour</button>
    </div>
  `;
  document.getElementById('btnVoirPronos').addEventListener('click', () => {
    const pronos = JSON.parse(localStorage.getItem('pronos') || '[]');
    if (pronos.length > 0) {
      const lastProno = pronos.sort((a, b) => new Date(b.postDate) - new Date(a.postDate))[0];
      showPronos();
      // Scroll to the last prono
      const pronoElement = document.querySelector(`[data-id="${lastProno.id}"]`);
      if (pronoElement) pronoElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      showPronos();
    }
  });
}

// Fonction pour afficher directement le dernier pari
function showLastProno() {
  const pronos = JSON.parse(localStorage.getItem('neurobet_pronos') || '[]');
  if (pronos.length > 0) {
    const lastProno = pronos.sort((a, b) => new Date(b.postDate) - new Date(a.postDate))[0];
    // Déterminer la section appropriée
    let section = '';
    if (lastProno.sport === 'basketball' || lastProno.sport === 'basket') section = 'basket';
    else if (lastProno.sport === 'football' || lastProno.sport === 'foot') section = 'foot';
    else if (lastProno.sport === 'tennis') section = 'tennis';
    
    // Afficher la section appropriée
    document.querySelectorAll('.pro-card').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${section}`).style.display = 'block';
    
    // Mettre à jour le lien actif dans la sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`.sidebar-link[data-section="${section}"]`).classList.add('active');
    
    // Rendre les pronostics
    renderPronos();
  } else {
    // Si aucun pari n'existe, afficher la section basket par défaut
    document.querySelectorAll('.pro-card').forEach(s => s.style.display = 'none');
    document.getElementById('section-basket').style.display = 'block';
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.sidebar-link[data-section="basket"]').classList.add('active');
  }
} 