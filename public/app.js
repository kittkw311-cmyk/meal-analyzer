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
  const ratioProtein = document.getElementById('ratio-protein');
  const ratioFat = document.getElementById('ratio-fat');
  const ratioCarbs = document.getElementById('ratio-carbs');
  const resComment = document.getElementById('res-comment');

  // History & Stats Elements
  const historyList = document.getElementById('history-list');
  const statsTotalMeals = document.getElementById('stats-total-meals');
  const statsAvgCalories = document.getElementById('stats-avg-calories');

  // History Detail Modal Elements
  const historyDetailModal = document.getElementById('history-detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');

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
      
      // 今日の合計表示をリアルタイム更新
      updateDailySummary();

    } catch (err) {
      console.error(err);
      alert('解析に失敗しました: ' + err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnAnalyze.disabled = false;
    }
  });

  // ==========================================================================
  // Display Result on Analysis Tab
  // ==========================================================================
  function displayResult(nutrition) {
    resCalories.textContent = nutrition.calories;
    resProtein.textContent = nutrition.protein;
    resFat.textContent = nutrition.fat;
    resCarbs.textContent = nutrition.carbohydrates;
    resComment.textContent = nutrition.comment;

    // PFC比率バー（1本統合型）のアニメーション
    const total = nutrition.protein + nutrition.fat + nutrition.carbohydrates;
    if (total > 0) {
      const pPercent = (nutrition.protein / total) * 100;
      const fPercent = (nutrition.fat / total) * 100;
      const cPercent = (nutrition.carbohydrates / total) * 100;

      setTimeout(() => {
        ratioProtein.style.width = `${pPercent}%`;
        ratioFat.style.width = `${fPercent}%`;
        ratioCarbs.style.width = `${cPercent}%`;
      }, 100);
    } else {
      ratioProtein.style.width = '0%';
      ratioFat.style.width = '0%';
      ratioCarbs.style.width = '0%';
    }

    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // ==========================================================================
  // Update Daily Summary (Always Visible Card on Analyze Tab)
  // ==========================================================================
  async function updateDailySummary() {
    try {
      const response = await fetch('/api/history');
      const history = await response.json();

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let totalCal = 0;
      let totalP = 0;
      let totalF = 0;
      let totalC = 0;

      history.forEach(item => {
        const itemDate = new Date(item.mealDate || item.date);
        const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
        
        if (itemDateStr === todayStr) {
          totalCal += item.nutrition.calories;
          totalP += item.nutrition.protein;
          totalF += item.nutrition.fat;
          totalC += item.nutrition.carbohydrates;
        }
      });

      // DOM要素の更新
      document.getElementById('daily-total-calories').textContent = totalCal;
      document.getElementById('daily-total-protein').textContent = Math.round(totalP * 10) / 10;
      document.getElementById('daily-total-fat').textContent = Math.round(totalF * 10) / 10;
      document.getElementById('daily-total-carbs').textContent = Math.round(totalC * 10) / 10;

    } catch (err) {
      console.error('Failed to update daily summary:', err);
    }
  }

  // 起動時に今日の合計をロード
  updateDailySummary();

  // ==========================================================================
  // Load History Tab (With Daily Grouping)
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

      // 日付ごとにグループ化する (キー: YYYY-MM-DD)
      const groups = {};
      history.forEach(item => {
        const dateObj = new Date(item.mealDate || item.date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        
        if (!groups[dateKey]) {
          groups[dateKey] = {
            dateLabel: dateObj.toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            }),
            meals: [],
            totalCalories: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCarbs: 0
          };
        }
        
        groups[dateKey].meals.push(item);
        groups[dateKey].totalCalories += item.nutrition.calories;
        groups[dateKey].totalProtein += item.nutrition.protein;
        groups[dateKey].totalFat += item.nutrition.fat;
        groups[dateKey].totalCarbs += item.nutrition.carbohydrates;
      });

      historyList.innerHTML = '';

      // 日付の降順でソートして描画
      const sortedKeys = Object.keys(groups).sort().reverse();
      
      sortedKeys.forEach(dateKey => {
        const group = groups[dateKey];
        
        // 1. 日別合計ヘッダーの生成 (日付の右側にインラインで並べる)
        const headerEl = document.createElement('div');
        headerEl.className = 'history-date-header';
        
        const pTotal = Math.round(group.totalProtein * 10) / 10;
        const fTotal = Math.round(group.totalFat * 10) / 10;
        const cTotal = Math.round(group.totalCarbs * 10) / 10;

        headerEl.innerHTML = `
          <span class="history-date-title">${group.dateLabel}</span>
          <div class="history-daily-total-inline">
            <span class="history-daily-calories">${group.totalCalories} kcal</span>
            <div class="history-daily-pfc">
              <span class="p">P:${pTotal}</span>
              <span class="f">F:${fTotal}</span>
              <span class="c">C:${cTotal}</span>
            </div>
          </div>
        `;
        historyList.appendChild(headerEl);

        // 2. その日の食事カードの生成
        group.meals.forEach(item => {
          const mealTypeJa = {
            morning: '朝食 🌅',
            noon: '昼食 ☀️',
            night: '夕食 🌙',
            snack: '間食 🍰'
          }[item.mealType || 'snack'];

          const card = document.createElement('div');
          card.className = 'card history-card';
          
          // 履歴カードクリックで単独モーダルを開く
          card.addEventListener('click', () => {
            document.getElementById('modal-meal-image').src = `/api/image?source=${item.imageSource}&id=${item.imageId}`;
            
            const dateObj = new Date(item.mealDate || item.date);
            const formattedDate = dateObj.toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            });
            const timeStr = dateObj.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit'
            });
            document.getElementById('modal-meal-date').textContent = `${formattedDate} ${timeStr}`;
            
            const typeBadge = document.getElementById('modal-meal-type');
            typeBadge.className = `history-meal-badge ${item.mealType || 'snack'}`;
            typeBadge.textContent = mealTypeJa;

            document.getElementById('modal-calories').textContent = item.nutrition.calories;
            document.getElementById('modal-protein').textContent = item.nutrition.protein;
            document.getElementById('modal-fat').textContent = item.nutrition.fat;
            document.getElementById('modal-carbs').textContent = item.nutrition.carbohydrates;
            document.getElementById('modal-comment').textContent = item.nutrition.comment;

            // モーダルを表示
            historyDetailModal.style.display = 'flex';
          });

          // 時刻部分を抽出
          const timeStr = new Date(item.mealDate || item.date).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
          });

          // カロリーの右側にPFCをインライン横並びで配置 (history-info-row)
          card.innerHTML = `
            <div class="history-img-wrapper">
              <img class="history-img" src="/api/image?source=${item.imageSource}&id=${item.imageId}" alt="食事画像" loading="lazy">
            </div>
            <div class="history-info">
              <div class="history-date">
                ${timeStr} 
                <span class="history-meal-badge ${item.mealType || 'snack'}">${mealTypeJa}</span>
              </div>
              <div class="history-info-row">
                <div class="history-calories">${item.nutrition.calories} <span>kcal</span></div>
                <div class="history-pfc-tags">
                  <span class="history-pfc-tag p">P: ${item.nutrition.protein}g</span>
                  <span class="history-pfc-tag f">F: ${item.nutrition.fat}g</span>
                  <span class="history-pfc-tag c">C: ${item.nutrition.carbohydrates}g</span>
                </div>
              </div>
            </div>
          `;

          // 削除ボタン (ゴミ箱) の生成と挿入
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn-delete-history';
          deleteBtn.innerHTML = '🗑️';
          deleteBtn.title = '履歴を削除';
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // モーダル展開へのバブリングを防止
            if (confirm('この食事履歴を削除しますか？\n画像ファイルもGoogleドライブ（またはローカル）から完全に削除されます。')) {
              try {
                const deleteRes = await fetch(`/api/history/${item.id}`, { method: 'DELETE' });
                if (deleteRes.ok) {
                  loadHistory();
                  updateDailySummary();
                } else {
                  alert('削除に失敗しました。');
                }
              } catch (err) {
                console.error(err);
                alert('削除処理中にエラーが発生しました。');
              }
            }
          });
          card.appendChild(deleteBtn);

          historyList.appendChild(card);
        });
      });

    } catch (err) {
      console.error('Failed to load history:', err);
      historyList.innerHTML = `<p class="error-text">履歴の読み込みに失敗しました。</p>`;
    }
  }

  // ==========================================================================
  // History Detail Modal Control
  // ==========================================================================
  const closeModal = () => {
    historyDetailModal.style.display = 'none';
  };

  btnCloseModal.addEventListener('click', closeModal);
  
  // モーダルの背景（黒枠）をクリックした際も閉じる
  historyDetailModal.addEventListener('click', (e) => {
    if (e.target === historyDetailModal) {
      closeModal();
    }
  });

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
