document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Upload Elements
  const dropZone = document.getElementById('drop-zone');
  const imageInput = document.getElementById('image-input');
  const uploadPrompt = document.getElementById('upload-prompt');
  const previewContainer = document.getElementById('preview-container');
  const imagePreview = document.getElementById('image-preview');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const btnAnalyze = document.getElementById('btn-analyze');

  // Selectors (Date & Meal Type)
  const mealDateInput = document.getElementById('meal-date-input');
  const mealTypeChips = document.querySelectorAll('.meal-type-chips .chip');
  
  // Loading & Result Elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const resultContainer = document.getElementById('result-container');
  const resCalories = document.getElementById('res-calories');
  const resProtein = document.getElementById('res-protein');
  const resFat = document.getElementById('res-fat');
  const resCarbs = document.getElementById('res-carbs');
  const barProtein = document.getElementById('bar-protein');
  const barFat = document.getElementById('bar-fat');
  const barCarbs = document.getElementById('bar-carbs');
  const resComment = document.getElementById('res-comment');

  // History & Stats Elements
  const historyList = document.getElementById('history-list');
  const statsTotalMeals = document.getElementById('stats-total-meals');
  const statsAvgCalories = document.getElementById('stats-avg-calories');

  // Chart instances
  let caloriesChart = null;
  let pfcChart = null;

  // Selected file reference
  let selectedFile = null;
  let activeMealType = 'snack';

  // ==========================================================================
  // Selector Initializer
  // ==========================================================================
  const initializeSelectors = () => {
    // 日付 (YYYY-MM-DD 形式)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    mealDateInput.value = `${yyyy}-${mm}-${dd}`;

    // 時間帯による食事区分の初期値自動設定
    const hour = today.getHours();
    let defaultType = 'snack';
    if (hour >= 5 && hour < 11) {
      defaultType = 'morning';
    } else if (hour >= 11 && hour < 16) {
      defaultType = 'noon';
    } else if (hour >= 16 && hour < 22) {
      defaultType = 'night';
    }
    
    setMealTypeActive(defaultType);
  };

  function setMealTypeActive(type) {
    activeMealType = type;
    mealTypeChips.forEach(chip => {
      if (chip.getAttribute('data-type') === type) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // チップクリック時のイベント
  mealTypeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setMealTypeActive(chip.getAttribute('data-type'));
    });
  });

  // 初期実行
  initializeSelectors();

  // ==========================================================================
  // Navigation (Tab Switch)
  // ==========================================================================
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTabId = item.getAttribute('data-tab');
      
      // Active tab class switch
      navItems.forEach(nav => nav.classList.remove('active'));
      tabContents.forEach(tab => tab.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(targetTabId).classList.add('active');

      // Load data based on selected tab
      if (targetTabId === 'tab-history') {
        loadHistory();
      } else if (targetTabId === 'tab-stats') {
        loadStats();
      }
    });
  });

  // ==========================================================================
  // Image Upload & Preview Handling
  // ==========================================================================
  dropZone.addEventListener('click', (e) => {
    if (e.target !== btnRemoveImage) {
      imageInput.click();
    }
  });

  imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.backgroundColor = 'rgba(156, 212, 176, 0.1)';
  });

  const resetDropZoneStyle = () => {
    dropZone.style.borderColor = '#c3d9cc';
    dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
  };

  dropZone.addEventListener('dragleave', resetDropZoneStyle);
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    resetDropZoneStyle();
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      uploadPrompt.style.display = 'none';
      previewContainer.style.display = 'flex';
      btnAnalyze.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearUpload();
  });

  function clearUpload() {
    selectedFile = null;
    imageInput.value = '';
    imagePreview.src = '#';
    uploadPrompt.style.display = 'block';
    previewContainer.style.display = 'none';
    btnAnalyze.disabled = true;
    initializeSelectors();
  }

  // ==========================================================================
  // Analyze Meal Execution
  // ==========================================================================
  btnAnalyze.addEventListener('click', async () => {
    if (!selectedFile) return;

    btnAnalyze.disabled = true;
    loadingOverlay.style.display = 'flex';
    resultContainer.style.display = 'none';

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('mealDate', mealDateInput.value);
    formData.append('mealType', activeMealType);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'サーバーエラーが発生しました。');
      }

      const record = await response.json();
      displayResult(record.nutrition);

    } catch (err) {
      console.error(err);
      alert('解析に失敗しました: ' + err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnAnalyze.disabled = false;
    }
  });

  function displayResult(nutrition) {
    resCalories.textContent = nutrition.calories;
    resProtein.textContent = nutrition.protein;
    resFat.textContent = nutrition.fat;
    resCarbs.textContent = nutrition.carbohydrates;
    resComment.textContent = nutrition.comment;

    // PFC割合バーのアニメーション
    const total = nutrition.protein + nutrition.fat + nutrition.carbohydrates;
    if (total > 0) {
      const pPercent = (nutrition.protein / total) * 100;
      const fPercent = (nutrition.fat / total) * 100;
      const cPercent = (nutrition.carbohydrates / total) * 100;

      setTimeout(() => {
        barProtein.style.width = `${pPercent}%`;
        barFat.style.width = `${fPercent}%`;
        barCarbs.style.width = `${cPercent}%`;
      }, 100);
    } else {
      barProtein.style.width = '0%';
      barFat.style.width = '0%';
      barCarbs.style.width = '0%';
    }

    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // ==========================================================================
  // Load History Tab
  // ==========================================================================
  async function loadHistory() {
    try {
      const response = await fetch('/api/history');
      const history = await response.json();

      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <p>まだ解析履歴がありません。</p>
            <span>食事を解析するとここに保存されます。</span>
          </div>
        `;
        return;
      }

      historyList.innerHTML = '';
      history.forEach(item => {
        // 表示用日付フォーマット (指定された食事日を優先)
        const dateObj = new Date(item.mealDate || item.date);
        const formattedDate = dateObj.toLocaleDateString('ja-JP', {
          month: '2-digit',
          day: '2-digit',
          weekday: 'short'
        });

        const mealTypeJa = {
          morning: '朝食 🌅',
          noon: '昼食 ☀️',
          night: '夕食 🌙',
          snack: '間食 🍰'
        }[item.mealType || 'snack'];

        const card = document.createElement('div');
        card.className = 'card history-card';
        
        // クリックしたら詳細を復元して「解析」タブへ切り替え
        card.addEventListener('click', () => {
          imagePreview.src = `/api/image?source=${item.imageSource}&id=${item.imageId}`;
          uploadPrompt.style.display = 'none';
          previewContainer.style.display = 'flex';
          
          // 日付と食事区分を復元
          if (item.mealDate) {
            mealDateInput.value = item.mealDate.substring(0, 10);
          }
          if (item.mealType) {
            setMealTypeActive(item.mealType);
          }
          
          navItems[0].click(); 
          displayResult(item.nutrition);
        });

        card.innerHTML = `
          <div class="history-img-wrapper">
            <img class="history-img" src="/api/image?source=${item.imageSource}&id=${item.imageId}" alt="食事画像" loading="lazy">
          </div>
          <div class="history-info">
            <div>
              <div class="history-date">
                ${formattedDate} 
                <span class="history-meal-badge ${item.mealType || 'snack'}">${mealTypeJa}</span>
              </div>
              <div class="history-calories">${item.nutrition.calories} <span>kcal</span></div>
            </div>
            <div class="history-pfc-tags">
              <span class="history-pfc-tag p">P: ${item.nutrition.protein}g</span>
              <span class="history-pfc-tag f">F: ${item.nutrition.fat}g</span>
              <span class="history-pfc-tag c">C: ${item.nutrition.carbohydrates}g</span>
            </div>
            <div class="history-comment-preview">${item.nutrition.comment}</div>
          </div>
        `;
        historyList.appendChild(card);
      });

    } catch (err) {
      console.error('Failed to load history:', err);
      historyList.innerHTML = `<p class="error-text">履歴の読み込みに失敗しました。</p>`;
    }
  }

  // ==========================================================================
  // Load Stats Tab (Chart.js Integration)
  // ==========================================================================
  async function loadStats() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();

      statsTotalMeals.textContent = stats.totalMeals;
      statsAvgCalories.textContent = stats.averageCalories;

      // 1. カロリー推移グラフの描画
      const caloriesCtx = document.getElementById('calories-chart').getContext('2d');
      if (caloriesChart) {
        caloriesChart.destroy();
      }
      
      const labels = stats.dailyCalories.map(d => d.label);
      const calorieValues = stats.dailyCalories.map(d => d.calories);

      caloriesChart = new Chart(caloriesCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: '摂取エネルギー (kcal)',
            data: calorieValues,
            borderColor: '#80c498',
            backgroundColor: 'rgba(156, 212, 176, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#80c498',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(200, 220, 210, 0.3)' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });

      // 2. PFCバランス比率グラフの描画
      const pfcCtx = document.getElementById('pfc-chart').getContext('2d');
      if (pfcChart) {
        pfcChart.destroy();
      }

      const pfcData = stats.pfcAverage;
      const totalPfc = pfcData.protein + pfcData.fat + pfcData.carbohydrates;

      pfcChart = new Chart(pfcCtx, {
        type: 'doughnut',
        data: {
          labels: ['タンパク質 (g)', '脂質 (g)', '炭水化物 (g)'],
          datasets: [{
            data: totalPfc > 0 ? [pfcData.protein, pfcData.fat, pfcData.carbohydrates] : [0, 0, 0],
            backgroundColor: ['#9ac2f4', '#fbd87f', '#f7a8b8'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { family: 'Noto Sans JP', size: 11 },
                boxWidth: 12
              }
            }
          },
          cutout: '65%'
        }
      });

    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }
});
