document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Upload Elements (Camera / Gallery Split)
  const dropZone = document.getElementById('drop-zone');
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');
  const btnCameraTrigger = document.getElementById('btn-camera-trigger');
  const btnGalleryTrigger = document.getElementById('btn-gallery-trigger');
  
  const previewContainer = document.getElementById('preview-container');
  const imagePreview = document.getElementById('image-preview');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const btnAnalyze = document.getElementById('btn-analyze');

  // Text Input Element
  const mealTextInput = document.getElementById('meal-text-input');

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
  const btnSaveModal = document.getElementById('btn-save-modal');
  
  // Modal Edit Inputs
  const modalDateInput = document.getElementById('modal-date-input');
  const modalTimeInput = document.getElementById('modal-time-input');
  const modalTypeSelect = document.getElementById('modal-type-select');

  // Chart instances
  let caloriesChart = null;
  let pfcChart = null;

  // Selected file reference
  let selectedFile = null;
  let activeMealType = 'snack';
  
  // Current editing history ID (for Modal save)
  let currentEditingHistoryId = null;

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
  // Image Upload / Camera Split Handling
  // ==========================================================================
  btnCameraTrigger.addEventListener('click', () => {
    cameraInput.click();
  });

  btnGalleryTrigger.addEventListener('click', () => {
    galleryInput.click();
  });

  cameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  galleryInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag and Drop (Keep as fallback for gallery)
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      previewContainer.style.display = 'flex';
      validateInputs();
    };
    reader.readAsDataURL(file);
  }

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  function clearImage() {
    selectedFile = null;
    cameraInput.value = '';
    galleryInput.value = '';
    imagePreview.src = '#';
    previewContainer.style.display = 'none';
    validateInputs();
  }

  function clearUpload() {
    clearImage();
    mealTextInput.value = '';
    validateInputs();
    initializeSelectors();
  }

  // ==========================================================================
  // Inputs Validation (Enable/Disable Analyze Button)
  // ==========================================================================
  function validateInputs() {
    const hasImage = !!selectedFile;
    const hasText = mealTextInput.value.trim().length > 0;
    btnAnalyze.disabled = !(hasImage || hasText);
  }

  mealTextInput.addEventListener('input', validateInputs);

  // ==========================================================================
  // Analyze Meal Execution
  // ==========================================================================
  btnAnalyze.addEventListener('click', async () => {
    const hasImage = !!selectedFile;
    const hasText = mealTextInput.value.trim().length > 0;
    if (!hasImage && !hasText) return;

    btnAnalyze.disabled = true;
    
    // ローディング文言の設定
    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = 'AIが栄養素を解析しています...';
    loadingSubTextEl.textContent = 'カロリーやPFCバランスを計算中';
    loadingOverlay.style.display = 'flex';
    resultContainer.style.display = 'none';

    const formData = new FormData();
    if (hasImage) {
      formData.append('image', selectedFile);
    }
    formData.append('textInput', mealTextInput.value.trim());
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
  // Load History Tab (With Daily Grouping & Priority sorting)
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
        
        // 食事区分優先順ソートロジック：夕食 (night:4) ➡ 昼食 (noon:3) ➡ 朝食 (morning:2) ➡ 間食 (snack:1)
        const typeWeight = {
          night: 4,
          noon: 3,
          morning: 2,
          snack: 1
        };
        group.meals.sort((a, b) => {
          const weightA = typeWeight[a.mealType || 'snack'] || 1;
          const weightB = typeWeight[b.mealType || 'snack'] || 1;
          if (weightB !== weightA) {
            return weightB - weightA; // 降順
          }
          // 重みが同じ場合は登録時間の降順
          return new Date(b.mealDate || b.date) - new Date(a.mealDate || a.date);
        });
        
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
          
          // 履歴カードクリックで単独モーダルを開く ＆ 編集用の値バインド
          card.addEventListener('click', () => {
            currentEditingHistoryId = item.id;
            
            // 画像が無い場合のプレースホルダー対応
            const modalImage = document.getElementById('modal-meal-image');
            if (item.imageId) {
              modalImage.src = `/api/image?source=${item.imageSource}&id=${item.imageId}`;
              modalImage.style.display = 'block';
            } else {
              modalImage.style.display = 'none';
            }
            
            // モーダル編集インプットのバインド処理
            const dateObj = new Date(item.mealDate || item.date);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            modalDateInput.value = `${yyyy}-${mm}-${dd}`;
            
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            modalTimeInput.value = `${hours}:${minutes}`;
            
            modalTypeSelect.value = item.mealType || 'snack';

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

          // 画像が無い場合の履歴カードのプレースホルダー
          const imageHtml = item.imageId
            ? `<img class="history-img" src="/api/image?source=${item.imageSource}&id=${item.imageId}" alt="食事画像" loading="lazy">`
            : `<div class="history-no-img">✍️ テキスト入力</div>`;

          // カロリーの右側にPFCをインライン横並びで配置 (history-info-row)
          card.innerHTML = `
            <div class="history-img-wrapper">
              ${imageHtml}
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

          // 削除ボタン (ゴミ箱) の生成と挿入 (削除中の画面ブロック制御を追加)
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn-delete-history';
          deleteBtn.innerHTML = '🗑️';
          deleteBtn.title = '履歴を削除';
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // モーダル展開へのバブリングを防止
            if (confirm('この食事履歴を削除しますか？\n登録されたデータ（および画像ファイル）が完全に削除されます。')) {
              
              // 削除中のローディング画面表示と操作ブロック
              const loadingTextEl = loadingOverlay.querySelector('p');
              const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
              loadingTextEl.textContent = '履歴を削除しています...';
              loadingSubTextEl.textContent = 'Googleドライブからデータを消去中';
              loadingOverlay.style.display = 'flex';

              try {
                const deleteRes = await fetch(`/api/history/${item.id}`, { method: 'DELETE' });
                if (deleteRes.ok) {
                  await loadHistory();
                  await updateDailySummary();
                } else {
                  alert('削除に失敗しました。');
                }
              } catch (err) {
                console.error(err);
                alert('削除処理中にエラーが発生しました。');
              } finally {
                loadingOverlay.style.display = 'none';
                // 表示メッセージの初期復元
                loadingTextEl.textContent = 'AIが栄養素を解析しています...';
                loadingSubTextEl.textContent = 'カロリーやPFCバランスを計算中';
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
  // History Detail Modal Control & Inline Save Handler
  // ==========================================================================
  const closeModal = () => {
    historyDetailModal.style.display = 'none';
    currentEditingHistoryId = null;
  };

  btnCloseModal.addEventListener('click', closeModal);
  
  // モーダルの背景（黒枠）をクリックした際も閉じる
  historyDetailModal.addEventListener('click', (e) => {
    if (e.target === historyDetailModal) {
      closeModal();
    }
  });

  // 日付・区分の変更を保存
  btnSaveModal.addEventListener('click', async () => {
    if (!currentEditingHistoryId) return;

    // 入力値から新しい食事日時（ISO 8601）を結合構築
    const selectedDate = modalDateInput.value; // YYYY-MM-DD
    const selectedTime = modalTimeInput.value; // HH:MM
    if (!selectedDate || !selectedTime) {
      alert('日付と時刻を正しく入力してください。');
      return;
    }

    const newDateTimeStr = `${selectedDate}T${selectedTime}:00`;
    const newMealDate = new Date(newDateTimeStr).toISOString();
    const newMealType = modalTypeSelect.value;

    btnSaveModal.disabled = true;

    // 処理中のローディング表示
    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '変更を保存しています...';
    loadingSubTextEl.textContent = 'Googleドライブと同期中';
    loadingOverlay.style.display = 'flex';

    try {
      const response = await fetch(`/api/history/${currentEditingHistoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mealDate: newMealDate,
          mealType: newMealType
        })
      });

      if (!response.ok) {
        throw new Error('更新に失敗しました。');
      }

      closeModal();
      await loadHistory();
      await updateDailySummary();

    } catch (err) {
      console.error(err);
      alert('変更の保存に失敗しました: ' + err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnSaveModal.disabled = false;
      // 文言の復元
      loadingTextEl.textContent = 'AIが栄養素を解析しています...';
      loadingSubTextEl.textContent = 'カロリーやPFCバランスを計算中';
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
