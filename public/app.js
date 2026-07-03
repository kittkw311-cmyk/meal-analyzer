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
  const btnReanalyzeModal = document.getElementById('btn-reanalyze-modal');
  
  // Modal Edit Inputs
  const modalDateInput = document.getElementById('modal-date-input');
  const modalTimeInput = document.getElementById('modal-time-input');
  const modalTypeSelect = document.getElementById('modal-type-select');
  const modalTextInput = document.getElementById('modal-text-input');

  // Chart instances
  let caloriesChart = null;
  let pfcChart = null;

  // Selected file reference
  let selectedFile = null;
  let activeMealType = 'snack';
  
  // Current editing history ID (for Modal save & reanalyze)
  let currentEditingHistoryId = null;

  // 体組成 (Weight / Body Comp) Elements
  const weightDropZone = document.getElementById('weight-drop-zone');
  const weightCameraInput = document.getElementById('weight-camera-input');
  const weightGalleryInput = document.getElementById('weight-gallery-input');
  const btnWeightCameraTrigger = document.getElementById('btn-weight-camera-trigger');
  const btnWeightGalleryTrigger = document.getElementById('btn-weight-gallery-trigger');
  const weightPreviewContainer = document.getElementById('weight-preview-container');
  const weightImagePreview = document.getElementById('weight-image-preview');
  const btnRemoveWeightImage = document.getElementById('btn-remove-weight-image');
  const weightTextInput = document.getElementById('weight-text-input');
  const weightDateInput = document.getElementById('weight-date-input');
  const weightTypeSelect = document.getElementById('weight-type-select');
  const btnAnalyzeWeight = document.getElementById('btn-analyze-weight');
  const weightResultEditContainer = document.getElementById('weight-result-edit-container');
  const inputWeightVal = document.getElementById('input-weight-val');
  const inputFatVal = document.getElementById('input-fat-val');
  const inputMuscleVal = document.getElementById('input-muscle-val');
  const btnSaveWeight = document.getElementById('btn-save-weight');
  const weightHistoryTbody = document.getElementById('weight-history-tbody');

  let selectedWeightFile = null;

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
    weightDateInput.value = `${yyyy}-${mm}-${dd}`;

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

  // 詳細モーダルを開いてデータをバインドする共通関数
  function openDetailModal(item) {
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
    modalTextInput.value = item.textInput || '';

    // モーダル表示用料理名タイトル
    const displayTitle = item.mealName || item.nutrition.mealName || (item.textInput && item.textInput.trim() ? item.textInput.trim() : '食事詳細');
    document.getElementById('modal-meal-title').textContent = displayTitle;

    document.getElementById('modal-calories').textContent = item.nutrition.calories;
    document.getElementById('modal-protein').textContent = item.nutrition.protein;
    document.getElementById('modal-fat').textContent = item.nutrition.fat;
    document.getElementById('modal-carbs').textContent = item.nutrition.carbohydrates;
    
    const modalInference = document.getElementById('modal-inference');
    const modalInferenceCard = document.getElementById('modal-inference-card');
    if (item.nutrition.inference) {
      modalInference.textContent = item.nutrition.inference;
      modalInferenceCard.style.display = 'block';
      document.getElementById('modal-comment').textContent = item.nutrition.advice || item.nutrition.comment;
    } else {
      modalInferenceCard.style.display = 'none';
      document.getElementById('modal-comment').textContent = item.nutrition.comment;
    }

    // モーダルを表示
    historyDetailModal.style.display = 'flex';
  }

  // 解析画面のフォームをリセットする関数
  function resetAnalyzeForm() {
    selectedFile = null;
    cameraInput.value = '';
    galleryInput.value = '';
    
    // プレビューコンテナの非表示化
    previewContainer.style.display = 'none';
    imagePreview.src = '';
    
    // 食事テキスト入力欄をクリア
    mealTextInput.value = '';
    
    // 日付・食事区分セレクタを現在時刻で初期化
    initializeSelectors();
  }

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
    
    // 日付 (YYYY-MM-DD) にアップロードした瞬間の現在時刻 (HH:MM:SS) をマージして送信
    const selectedDate = mealDateInput.value;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const fullDateTimeStr = `${selectedDate}T${hours}:${minutes}:${seconds}`;
    const mealDateToSend = new Date(fullDateTimeStr).toISOString();

    formData.append('mealDate', mealDateToSend);
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

      // 履歴一覧も同期してリロード
      await loadHistory();

      // 作成された履歴の詳細モーダルを表示
      openDetailModal(record);

      // 解析画面の入力値を初期化
      resetAnalyzeForm();

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\nただいまAIへのアクセスが一時的に集中しています（無料枠の上限に達しました）。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度「食事を解析する」ボタンを押してください。');
      } else {
        alert('解析に失敗しました。\n詳細: ' + msg);
      }
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

    const resInference = document.getElementById('res-inference');
    const resInferenceCard = document.getElementById('res-inference-card');
    if (nutrition.inference) {
      resInference.textContent = nutrition.inference;
      resInferenceCard.style.display = 'block';
      resComment.textContent = nutrition.advice || nutrition.comment;
    } else {
      resInferenceCard.style.display = 'none';
      resComment.textContent = nutrition.comment;
    }

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

        // 理想PFC比率 (P:15%, F:25%, C:60% カロリーベース) との乖離の計算
        const pCal = group.totalProtein * 4;
        const fCal = group.totalFat * 9;
        const cCal = group.totalCarbs * 4;
        const totalPfcCal = pCal + fCal + cCal;
        
        let pfcDiffText = '';
        if (totalPfcCal > 0) {
          const pPct = Math.round((pCal / totalPfcCal) * 100);
          const fPct = Math.round((fCal / totalPfcCal) * 100);
          const cPct = 100 - pPct - fPct; // 合計が100%になるよう調整
          
          const pDiff = pPct - 15;
          const fDiff = fPct - 25;
          const cDiff = cPct - 60;
          
          const formatDiff = (val) => (val >= 0 ? `+${val}%` : `${val}%`);
          pfcDiffText = `理想差 P:${formatDiff(pDiff)} F:${formatDiff(fDiff)} C:${formatDiff(cDiff)}`;
        }

        headerEl.innerHTML = `
          <span class="history-date-title">${group.dateLabel}</span>
          <div class="history-daily-total-inline">
            <span class="history-daily-calories">${group.totalCalories} kcal</span>
            <div class="history-daily-pfc">
              <span class="p">P:${pTotal}</span>
              <span class="f">F:${fTotal}</span>
              <span class="c">C:${cTotal}</span>
              ${pfcDiffText ? `<span class="history-pfc-diff">${pfcDiffText}</span>` : ''}
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
            openDetailModal(item);
          });

          // 画像が無い場合の履歴カードのプレースホルダー
          const imageHtml = item.imageId
            ? `<img class="history-img" src="/api/image?source=${item.imageSource}&id=${item.imageId}" alt="食事画像" loading="lazy">`
            : `<div class="history-no-img">✍️ テキスト入力</div>`;

          // 表示用の料理名・テキスト（Geminiが解析した具体的な料理名 mealName を優先表示）
          const displayText = item.textInput && item.textInput.trim() 
            ? item.textInput.trim() 
            : (item.imageId ? '📸 画像から解析' : '🍽️ 食事データ');
          const displayMealName = item.mealName || (item.nutrition && item.nutrition.mealName) || displayText;

          // カロリーの右側にPFCをインライン横並びで配置 (history-info-row-v3) - 添付画像と同等スタイル
          card.innerHTML = `
            <div class="history-img-wrapper">
              ${imageHtml}
            </div>
            <div class="history-info">
              <div class="history-date">
                <span class="history-meal-badge ${item.mealType || 'snack'}">${mealTypeJa}</span>
                <span class="history-meal-text">${displayMealName}</span>
              </div>
              <div class="history-info-row-v3">
                <div class="history-calories-v3">${item.nutrition.calories}<span class="unit">kcal</span></div>
                <div class="history-pfc-boxes-v3">
                  <div class="history-pfc-box-v3 protein">
                    <span class="label">P</span>
                    <span class="val">${item.nutrition.protein}<span class="unit">g</span></span>
                  </div>
                  <div class="history-pfc-box-v3 fat">
                    <span class="label">F</span>
                    <span class="val">${item.nutrition.fat}<span class="unit">g</span></span>
                  </div>
                  <div class="history-pfc-box-v3 carbs">
                    <span class="label">C</span>
                    <span class="val">${item.nutrition.carbohydrates}<span class="unit">g</span></span>
                  </div>
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
  // History Detail Modal Control & Inline Save/Reanalyze Handlers
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
    const newTextInput = modalTextInput.value.trim();

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
          mealType: newMealType,
          textInput: newTextInput
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'サーバーとの通信に失敗しました。');
      }

      closeModal();
      await loadHistory();
      await updateDailySummary();

    } catch (err) {
      console.error(err);
      alert('変更の保存に失敗しました。\n詳細: ' + err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnSaveModal.disabled = false;
      // 文言の復元
      loadingTextEl.textContent = 'AIが栄養素を解析しています...';
      loadingSubTextEl.textContent = 'カロリーやPFCバランスを計算中';
    }
  });

  // 履歴詳細から再分析（再計算）を実行
  btnReanalyzeModal.addEventListener('click', async () => {
    if (!currentEditingHistoryId) return;

    const selectedDate = modalDateInput.value;
    const selectedTime = modalTimeInput.value;
    if (!selectedDate || !selectedTime) {
      alert('日付と時刻を正しく入力してください。');
      return;
    }

    const newDateTimeStr = `${selectedDate}T${selectedTime}:00`;
    const newMealDate = new Date(newDateTimeStr).toISOString();
    const newMealType = modalTypeSelect.value;
    const newTextInput = modalTextInput.value.trim();

    btnReanalyzeModal.disabled = true;

    // 処理中ローディング表示
    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '食事データを再計算中...';
    loadingSubTextEl.textContent = 'AIが隠れカロリー・調味料を再推測しています';
    loadingOverlay.style.display = 'flex';

    try {
      const response = await fetch(`/api/history/${currentEditingHistoryId}/reanalyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mealDate: newMealDate,
          mealType: newMealType,
          textInput: newTextInput
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'サーバーとの通信に失敗しました。');
      }

      const updatedRecord = await response.json();

      // モーダル内の表示値をリアルタイムで上書き（アニメーション反映）
      document.getElementById('modal-meal-title').textContent = updatedRecord.mealName || updatedRecord.textInput || '食事詳細';
      document.getElementById('modal-calories').textContent = updatedRecord.nutrition.calories;
      document.getElementById('modal-protein').textContent = updatedRecord.nutrition.protein;
      document.getElementById('modal-fat').textContent = updatedRecord.nutrition.fat;
      document.getElementById('modal-carbs').textContent = updatedRecord.nutrition.carbohydrates;
      
      const modalInference = document.getElementById('modal-inference');
      const modalInferenceCard = document.getElementById('modal-inference-card');
      if (updatedRecord.nutrition.inference) {
        modalInference.textContent = updatedRecord.nutrition.inference;
        modalInferenceCard.style.display = 'block';
        document.getElementById('modal-comment').textContent = updatedRecord.nutrition.advice || updatedRecord.nutrition.comment;
      } else {
        modalInferenceCard.style.display = 'none';
        document.getElementById('modal-comment').textContent = updatedRecord.nutrition.comment;
      }

      // 履歴一覧と今日の合計を非同期でリロード
      await loadHistory();
      await updateDailySummary();



    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\nただいまAIへのアクセスが一時的に集中しています（無料枠の上限に達しました）。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度「再計算する」ボタンを押してください。');
      } else {
        alert('再計算に失敗しました。\n詳細: ' + msg);
      }
    } finally {
      loadingOverlay.style.display = 'none';
      btnReanalyzeModal.disabled = false;
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

  // ==========================================================================
  // 体組成 (Weight / Body Composition) OCR & 記録ロジック
  // ==========================================================================

  // 1. 画像アップロードイベント
  btnWeightCameraTrigger.addEventListener('click', () => weightCameraInput.click());
  btnWeightGalleryTrigger.addEventListener('click', () => weightGalleryInput.click());

  const handleWeightFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }
    selectedWeightFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      weightImagePreview.src = e.target.result;
      weightPreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
  };

  weightCameraInput.addEventListener('change', (e) => handleWeightFileSelect(e.target.files[0]));
  weightGalleryInput.addEventListener('change', (e) => handleWeightFileSelect(e.target.files[0]));

  btnRemoveWeightImage.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedWeightFile = null;
    weightCameraInput.value = '';
    weightGalleryInput.value = '';
    weightPreviewContainer.style.display = 'none';
    weightImagePreview.src = '';
  });

  // ドラッグ＆ドロップイベント (体組成用)
  weightDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    weightDropZone.classList.add('dragover');
  });

  weightDropZone.addEventListener('dragleave', () => {
    weightDropZone.classList.remove('dragover');
  });

  weightDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    weightDropZone.classList.remove('dragover');
    handleWeightFileSelect(e.dataTransfer.files[0]);
  });

  // 2. 体組成データのOCR解析
  btnAnalyzeWeight.addEventListener('click', async () => {
    if (!selectedWeightFile && !weightTextInput.value.trim()) {
      alert('画像を選択するか、または数値を入力してください。');
      return;
    }

    loadingOverlay.style.display = 'flex';
    btnAnalyzeWeight.disabled = true;

    const formData = new FormData();
    if (selectedWeightFile) {
      formData.append('image', selectedWeightFile);
    }
    formData.append('textInput', weightTextInput.value);

    try {
      const response = await fetch('/api/body-composition/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '解析に失敗しました。');
      }

      const result = await response.json();

      // 数値を結果編集フォームにバインド
      inputWeightVal.value = result.weight !== null ? result.weight : '';
      inputFatVal.value = result.fatRate !== null ? result.fatRate : '';
      inputMuscleVal.value = result.muscleMass !== null ? result.muscleMass : '';

      // 解析された計測日時に基づいて日付と区分を自動バインド
      if (result.measuredAt) {
        const dateObj = new Date(result.measuredAt);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        weightDateInput.value = `${yyyy}-${mm}-${dd}`;

        const hour = dateObj.getHours();
        if (hour >= 5 && hour < 12) {
          weightTypeSelect.value = 'morning';
        } else if (hour >= 18 && hour < 24) {
          weightTypeSelect.value = 'night';
        } else {
          weightTypeSelect.value = 'other';
        }
      }

      // 結果編集コンテナを表示
      weightResultEditContainer.style.display = 'block';

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\n体組成解析が一時的に混み合っています。\n10秒〜20秒ほど待ってからもう一度お試しください。');
      } else {
        alert('解析に失敗しました。\n詳細: ' + msg);
      }
    } finally {
      loadingOverlay.style.display = 'none';
      btnAnalyzeWeight.disabled = false;
    }
  });

  // 3. 解析結果の保存処理
  btnSaveWeight.addEventListener('click', async () => {
    const weight = inputWeightVal.value ? parseFloat(inputWeightVal.value) : null;
    const fatRate = inputFatVal.value ? parseFloat(inputFatVal.value) : null;
    const muscleMass = inputMuscleVal.value ? parseFloat(inputMuscleVal.value) : null;

    if (weight === null && fatRate === null && muscleMass === null) {
      alert('体重、体脂肪率、筋肉量のいずれかを入力してください。');
      return;
    }

    loadingOverlay.style.display = 'flex';
    btnSaveWeight.disabled = true;

    // 選択された日付に現在の時間を補正して送信
    const selectedDate = weightDateInput.value;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const fullDateTimeStr = `${selectedDate}T${hours}:${minutes}:${seconds}`;
    const measuredAtToSend = new Date(fullDateTimeStr).toISOString();

    const formData = new FormData();
    formData.append('weight', weight || '');
    formData.append('fatRate', fatRate || '');
    formData.append('muscleMass', muscleMass || '');
    formData.append('measuredAt', measuredAtToSend);
    formData.append('measurementType', weightTypeSelect.value);
    formData.append('textInput', weightTextInput.value);
    if (selectedWeightFile) {
      formData.append('image', selectedWeightFile);
    }

    try {
      const response = await fetch('/api/body-composition', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('データの保存に失敗しました。');
      }

      // 入力フォームおよびプレビューを初期化
      selectedWeightFile = null;
      weightCameraInput.value = '';
      weightGalleryInput.value = '';
      weightPreviewContainer.style.display = 'none';
      weightImagePreview.src = '';
      weightTextInput.value = '';
      weightResultEditContainer.style.display = 'none';
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      weightDateInput.value = `${yyyy}-${mm}-${dd}`;
      weightTypeSelect.value = 'other';

      // 履歴テーブルの更新
      await loadWeightHistory();
      alert('体組成データを保存しました。');

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnSaveWeight.disabled = false;
    }
  });

  // 4. 体組成履歴のロードと描画
  async function loadWeightHistory() {
    try {
      const response = await fetch('/api/body-composition');
      if (!response.ok) throw new Error('履歴の読み込みに失敗しました。');
      
      const weightHistory = await response.json();
      weightHistoryTbody.innerHTML = '';

      if (weightHistory.length === 0) {
        weightHistoryTbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-row">測定データがありません。</td>
          </tr>
        `;
        return;
      }

      weightHistory.forEach(item => {
        const dateObj = new Date(item.measuredAt || item.date);
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        const typeJa = {
          morning: '朝 🌅',
          night: '夜 🌙',
          other: '他 ⚙️'
        }[item.measurementType || 'other'];

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-datetime">
            <span class="date">${mm}/${dd} ${hh}:${min}</span>
            <span class="badge ${item.measurementType || 'other'}">${typeJa}</span>
          </td>
          <td class="td-weight">${item.weight !== null ? `${item.weight} kg` : '--.-'}</td>
          <td class="td-fat">${item.fatRate !== null ? `${item.fatRate} %` : '--.-'}</td>
          <td class="td-muscle">${item.muscleMass !== null ? `${item.muscleMass} kg` : '--.-'}</td>
          <td class="td-action">
            <button class="btn-delete-weight" data-id="${item.id}">🗑️</button>
          </td>
        `;

        // 削除ボタンイベント
        tr.querySelector('.btn-delete-weight').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('この測定データを削除しますか？')) return;

          try {
            const delRes = await fetch(`/api/body-composition/${item.id}`, { method: 'DELETE' });
            if (!delRes.ok) throw new Error('削除に失敗しました。');
            
            await loadWeightHistory();
          } catch (err) {
            console.error(err);
            alert(err.message);
          }
        });

        weightHistoryTbody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      weightHistoryTbody.innerHTML = `
        <tr>
          <td colspan="5" class="error-row">履歴の読み込みに失敗しました。</td>
        </tr>
      `;
    }
  }

  // 初期ロードに体組成履歴のロードを追加
  loadWeightHistory();
});
