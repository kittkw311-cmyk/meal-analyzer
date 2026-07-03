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
  const weightTypeChips = document.querySelectorAll('#weight-type-chips .weight-chip');
  let activeWeightType = 'morning';
  const btnAnalyzeWeight = document.getElementById('btn-analyze-weight');
  const weightResultEditContainer = document.getElementById('weight-result-edit-container');
  
  // 16個の確認インプット要素
  const inputWeightVal = document.getElementById('input-weight-val');
  const inputBmiVal = document.getElementById('input-bmi-val');
  const inputFatVal = document.getElementById('input-fat-val');
  const inputHeartVal = document.getElementById('input-heart-val');
  const inputMuscleVal = document.getElementById('input-muscle-val');
  const inputBmrVal = document.getElementById('input-bmr-val');
  const inputWaterVal = document.getElementById('input-water-val');
  const inputFatMassVal = document.getElementById('input-fatmass-val');
  const inputLeanBodyVal = document.getElementById('input-leanbody-val');
  const inputBoneVal = document.getElementById('input-bone-val');
  const inputVisceralFatVal = document.getElementById('input-visceralfat-val');
  const inputProteinRateVal = document.getElementById('input-proteinrate-val');
  const inputSkeletalMuscleVal = document.getElementById('input-skeletalmuscle-val');
  const inputSubcutaneousVal = document.getElementById('input-subcutaneous-val');
  const inputBodyAgeVal = document.getElementById('input-bodyage-val');
  const inputBodyTypeVal = document.getElementById('input-bodytype-val');

  const btnSaveWeight = document.getElementById('btn-save-weight');
  const weightHistoryTbody = document.getElementById('weight-history-tbody');

  // 体組成詳細モーダルの要素
  const weightDetailModal = document.getElementById('weight-detail-modal');
  const btnCloseWeightModal = document.getElementById('btn-close-weight-modal');
  const weightModalDateInput = document.getElementById('weight-modal-date-input');
  const weightModalTypeSelect = document.getElementById('weight-modal-type-select');
  const btnSaveWeightModal = document.getElementById('btn-save-weight-modal');
  const weightModalImageContainer = document.getElementById('weight-modal-image-container');
  const weightModalImage = document.getElementById('weight-modal-image');

  // 解析タブのサマリー要素
  const dailyWeightSummaryBar = document.getElementById('daily-weight-box');
  const summaryWeightVal = document.getElementById('summary-weight-val');
  const dailyBmrDivider = document.getElementById('daily-bmr-divider');
  const dailyBmrCalories = document.getElementById('daily-bmr-calories');
  
  // バッジおよびクリアボタン要素
  const mealUploadBadge = document.getElementById('meal-upload-badge');
  const btnClearMealBadge = document.getElementById('btn-clear-meal-badge');
  const weightUploadBadge = document.getElementById('weight-upload-badge');
  const btnClearWeightBadge = document.getElementById('btn-clear-weight-badge');

  // 詳細モーダル内の値表示
  const wModalWeight = document.getElementById('w-modal-weight');
  const wModalBmi = document.getElementById('w-modal-bmi');
  const wModalFat = document.getElementById('w-modal-fat');
  const wModalHeart = document.getElementById('w-modal-heart');
  const wModalMuscle = document.getElementById('w-modal-muscle');
  const wModalBmr = document.getElementById('w-modal-bmr');
  const wModalWater = document.getElementById('w-modal-water');
  const wModalFatMass = document.getElementById('w-modal-fatmass');
  const wModalLeanBody = document.getElementById('w-modal-leanbody');
  const wModalBone = document.getElementById('w-modal-bone');
  const wModalVisceralFat = document.getElementById('w-modal-visceralfat');
  const wModalProteinRate = document.getElementById('w-modal-proteinrate');
  const wModalSkeletalMuscle = document.getElementById('w-modal-skeletalmuscle');
  const wModalSubcutaneous = document.getElementById('w-modal-subcutaneous');
  const wModalBodyAge = document.getElementById('w-modal-bodyage');
  const wModalBodyType = document.getElementById('w-modal-bodytype');

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

    // 体組成測定区分の初期値自動設定 (朝5時〜夕方5時までは朝、それ以外は夜)
    if (hour >= 5 && hour < 17) {
      setWeightTypeActive('morning');
    } else {
      setWeightTypeActive('night');
    }
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

  function setWeightTypeActive(type) {
    activeWeightType = type;
    weightTypeChips.forEach(chip => {
      if (chip.getAttribute('data-type') === type) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // 体組成区分チップスのクリックイベント登録
  weightTypeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setWeightTypeActive(chip.getAttribute('data-type'));
    });
  });

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
      } else if (targetTabId === 'tab-weight') {
        loadWeightHistory();
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
      previewContainer.style.display = 'none'; // 画像はそのまま表示しない
      mealUploadBadge.style.display = 'inline-flex'; // 件数バッジを表示
      validateInputs();
    };
    reader.readAsDataURL(file);
  }

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  if (btnClearMealBadge) {
    btnClearMealBadge.addEventListener('click', (e) => {
      e.stopPropagation(); // Galleryダイアログ起動を防止
      clearImage();
    });
  }

  function clearImage() {
    selectedFile = null;
    cameraInput.value = '';
    galleryInput.value = '';
    imagePreview.src = '#';
    previewContainer.style.display = 'none';
    mealUploadBadge.style.display = 'none'; // バッジを非表示
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
        const error = new Error(errData.error || 'サーバーエラーが発生しました。');
        error.status = response.status;
        throw error;
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
      if (err.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\nただいまAIへのアクセスが一時的に集中しています（無料枠の上限に達しました）。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度「食事を解析する」ボタンを押してください。');
      } else if (err.status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('temporary') || msg.includes('high demand')) {
        alert('【AIサーバー一時混雑】\n現在、GoogleのAIサーバーが非常に混み合っています。\n\n一時的な制限ですので、10秒〜15秒ほど待ってから、もう一度「食事を解析する」ボタンを押してください。');
      } else {
        alert('解析に失敗しました。\n\n少し時間をおいてからもう一度お試しください。\n詳細: ' + msg);
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
            dateLabel: (() => {
              const mmStr = String(dateObj.getMonth() + 1).padStart(2, '0');
              const ddStr = String(dateObj.getDate()).padStart(2, '0');
              const wday = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
              return `${mmStr}/${ddStr}(${wday})`;
            })(),
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
        
        const pTotal = Math.round(group.totalProtein);
        const fTotal = Math.round(group.totalFat);
        const cTotal = Math.round(group.totalCarbs);

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
          <span class="history-daily-calories">${group.totalCalories} kcal</span>
          <div class="history-daily-pfc">
            <span class="p">P:${pTotal}</span>
            <span class="f">F:${fTotal}</span>
            <span class="c">C:${cTotal}</span>
          </div>
          ${pfcDiffText ? `<span class="history-pfc-diff">${pfcDiffText}</span>` : '<span class="history-pfc-diff" style="visibility: hidden; pointer-events: none;">--</span>'}
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
        const error = new Error(errData.error || 'サーバーとの通信に失敗しました。');
        error.status = response.status;
        throw error;
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
      if (err.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\nただいまAIへのアクセスが一時的に集中しています（無料枠の上限に達しました）。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度「再計算する」ボタンを押してください。\n\n詳細: ' + msg);
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

  // 現在選択されている食事日付に対応する最新体重・基礎代謝サマリーの更新
  async function updateDailyWeightSummary() {
    try {
      const response = await fetch('/api/body-composition');
      if (!response.ok) throw new Error('データ取得失敗');
      
      const weightHistory = await response.json();
      const targetDate = mealDateInput.value; // YYYY-MM-DD
      
      // 同じ日付の測定データを抽出
      const sameDayRecords = weightHistory.filter(item => {
        const itemDate = item.date ? item.date.substring(0, 10) : '';
        return itemDate === targetDate;
      });

      if (sameDayRecords.length > 0) {
        // ソート順（夜 -> 朝 -> 他）なので、最初の要素が最新（最も優先度が高い時間帯または最新）
        const latest = sameDayRecords[0];
        summaryWeightVal.textContent = latest.weight !== null ? latest.weight.toFixed(1) : '--.-';
        
        // 前日比 (前回の測定値との差) の算出
        const sortedAll = [...weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestTime = new Date(latest.date).getTime();
        // 今回のレコードより過去で、体重データが存在する直近のレコードを検索
        const prevRecord = sortedAll.find(r => new Date(r.date).getTime() < latestTime && r.weight !== null);
        const diffEl = document.getElementById('daily-weight-diff');
        
        if (diffEl) {
          if (prevRecord && latest.weight !== null && prevRecord.weight !== null) {
            const diff = latest.weight - prevRecord.weight;
            if (diff > 0) {
              diffEl.textContent = `(+${diff.toFixed(1)})`;
              diffEl.style.color = '#ff7676'; // 上昇 (赤)
            } else if (diff < 0) {
              diffEl.textContent = `(${diff.toFixed(1)})`;
              diffEl.style.color = '#4dbf77'; // 下降 (緑)
            } else {
              diffEl.textContent = `(±0)`;
              diffEl.style.color = 'var(--text-muted)';
            }
          } else {
            diffEl.textContent = ''; // 比較対象がない場合は何も表示しない
          }
        }
        
        // 基礎代謝を食事カロリー表示の横にマージする
        if (latest.bmr !== null) {
          if (dailyBmrCalories) dailyBmrCalories.textContent = latest.bmr;
          if (dailyBmrDivider) dailyBmrDivider.style.display = 'inline';
        } else {
          if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
        }
        
        dailyWeightSummaryBar.style.display = 'flex';
      } else {
        // データがない場合は非表示
        if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
        dailyWeightSummaryBar.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to update daily weight summary:', err);
      if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
      dailyWeightSummaryBar.style.display = 'none';
    }
  }

  // 食事の日付変更時に体組成サマリーも連動更新
  mealDateInput.addEventListener('change', () => {
    updateDailyWeightSummary();
  });

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
      weightPreviewContainer.style.display = 'none'; // 画像はそのまま表示しない
      weightUploadBadge.style.display = 'inline-flex'; // 件数バッジを表示
    };
    reader.readAsDataURL(file);
  };

  weightCameraInput.addEventListener('change', (e) => handleWeightFileSelect(e.target.files[0]));
  weightGalleryInput.addEventListener('change', (e) => handleWeightFileSelect(e.target.files[0]));

  const clearWeightImage = () => {
    selectedWeightFile = null;
    weightCameraInput.value = '';
    weightGalleryInput.value = '';
    weightPreviewContainer.style.display = 'none';
    weightImagePreview.src = '';
    weightUploadBadge.style.display = 'none'; // バッジを非表示
  };

  btnRemoveWeightImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearWeightImage();
  });

  if (btnClearWeightBadge) {
    btnClearWeightBadge.addEventListener('click', (e) => {
      e.stopPropagation(); // Galleryダイアログ起動を防止
      clearWeightImage();
    });
  }

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

  // 2. 体組成データの登録 (自動解析＆保存)
  btnAnalyzeWeight.addEventListener('click', async () => {
    if (!selectedWeightFile && !weightTextInput.value.trim()) {
      alert('画像を選択するか、または数値を入力してください。');
      return;
    }

    loadingOverlay.style.display = 'flex';
    btnAnalyzeWeight.disabled = true;

    // A. まずOCR解析を実行
    const analyzeFormData = new FormData();
    if (selectedWeightFile) {
      analyzeFormData.append('image', selectedWeightFile);
    }
    analyzeFormData.append('textInput', weightTextInput.value);

    try {
      const response = await fetch('/api/body-composition/analyze', {
        method: 'POST',
        body: analyzeFormData
      });

      if (!response.ok) {
        const errData = await response.json();
        const error = new Error(errData.error || '解析に失敗しました。');
        error.status = response.status;
        throw error;
      }

      const result = await response.json();

      // B. 取得した解析結果をそのまま自動でGoogle Driveに保存する
      const selectedDate = weightDateInput.value; // YYYY-MM-DD
      const activeChip = document.querySelector('#weight-type-chips .weight-chip.active');
      const measurementType = activeChip ? activeChip.getAttribute('data-type') : 'other';

      const saveFormData = new FormData();
      saveFormData.append('date', selectedDate);
      saveFormData.append('measurementType', measurementType);
      
      // OCR結果の数値をすべてセット
      saveFormData.append('weight', result.weight !== null ? result.weight : '');
      saveFormData.append('bmi', result.bmi !== null ? result.bmi : '');
      saveFormData.append('fatRate', result.fatRate !== null ? result.fatRate : '');
      saveFormData.append('heartRate', result.heartRate !== null ? result.heartRate : '');
      saveFormData.append('muscleMass', result.muscleMass !== null ? result.muscleMass : '');
      saveFormData.append('bmr', result.bmr !== null ? result.bmr : '');
      saveFormData.append('waterRate', result.waterRate !== null ? result.waterRate : '');
      saveFormData.append('fatMass', result.fatMass !== null ? result.fatMass : '');
      saveFormData.append('leanBodyMass', result.leanBodyMass !== null ? result.leanBodyMass : '');
      saveFormData.append('boneMass', result.boneMass !== null ? result.boneMass : '');
      saveFormData.append('visceralFat', result.visceralFat !== null ? result.visceralFat : '');
      saveFormData.append('proteinRate', result.proteinRate !== null ? result.proteinRate : '');
      saveFormData.append('skeletalMuscleMass', result.skeletalMuscleMass !== null ? result.skeletalMuscleMass : '');
      saveFormData.append('subcutaneousFat', result.subcutaneousFat !== null ? result.subcutaneousFat : '');
      saveFormData.append('bodyAge', result.bodyAge !== null ? result.bodyAge : '');
      saveFormData.append('bodyType', result.bodyType || '');

      // 画像があれば添付して保存 (画像IDを紐付けて保存)
      if (selectedWeightFile) {
        saveFormData.append('image', selectedWeightFile);
      }

      const saveResponse = await fetch('/api/body-composition', {
        method: 'POST',
        body: saveFormData
      });

      if (!saveResponse.ok) {
        throw new Error('解析結果の自動登録に失敗しました。');
      }

      // C. 保存完了後のフォーム初期化処理
      clearWeightImage();
      weightTextInput.value = '';
      weightResultEditContainer.style.display = 'none';

      // 測定日は本日の日付、測定区分は現在時刻に応じたデフォルトへ自動再設定
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      weightDateInput.value = `${yyyy}-${mm}-${dd}`;
      
      const currentHour = today.getHours();
      if (currentHour >= 5 && currentHour < 17) {
        setWeightTypeActive('morning');
      } else {
        setWeightTypeActive('night');
      }

      // 履歴テーブルの更新＆サマリー更新
      await loadWeightHistory();
      await updateDailyWeightSummary();
      alert('体組成データを登録しました。');

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (err.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('【AIアクセス制限】\n体組成解析のアクセスが一時的に集中しています。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度お試しください。');
      } else if (err.status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('temporary') || msg.includes('high demand')) {
        alert('【AIサーバー一時混雑】\n現在、GoogleのAIサーバーが非常に混み合っています。\n\n一時的な制限ですので、10秒〜15秒ほど待ってから、もう一度お試しください。');
      } else {
        alert('登録に失敗しました。\n\n少し時間をおいてからもう一度お試しください。\n詳細: ' + msg);
      }
    } finally {
      loadingOverlay.style.display = 'none';
      btnAnalyzeWeight.disabled = false;
    }
  });

  // 3. 解析結果の保存処理
  btnSaveWeight.addEventListener('click', async () => {
    const weight = inputWeightVal.value ? parseFloat(inputWeightVal.value) : null;
    const bmi = inputBmiVal.value ? parseFloat(inputBmiVal.value) : null;
    const fatRate = inputFatVal.value ? parseFloat(inputFatVal.value) : null;
    const heartRate = inputHeartVal.value ? parseInt(inputHeartVal.value, 10) : null;
    const muscleMass = inputMuscleVal.value ? parseFloat(inputMuscleVal.value) : null;
    const bmr = inputBmrVal.value ? parseInt(inputBmrVal.value, 10) : null;
    const waterRate = inputWaterVal.value ? parseFloat(inputWaterVal.value) : null;
    const fatMass = inputFatMassVal.value ? parseFloat(inputFatMassVal.value) : null;
    const leanBodyMass = inputLeanBodyVal.value ? parseFloat(inputLeanBodyVal.value) : null;
    const boneMass = inputBoneVal.value ? parseFloat(inputBoneVal.value) : null;
    const visceralFat = inputVisceralFatVal.value ? parseFloat(inputVisceralFatVal.value) : null;
    const proteinRate = inputProteinRateVal.value ? parseFloat(inputProteinRateVal.value) : null;
    const skeletalMuscleMass = inputSkeletalMuscleVal.value ? parseFloat(inputSkeletalMuscleVal.value) : null;
    const subcutaneousFat = inputSubcutaneousVal.value ? parseFloat(inputSubcutaneousVal.value) : null;
    const bodyAge = inputBodyAgeVal.value ? parseInt(inputBodyAgeVal.value, 10) : null;
    const bodyType = inputBodyTypeVal.value || null;

    if (weight === null && fatRate === null && muscleMass === null) {
      alert('体重、体脂肪率、筋肉量のいずれかを入力してください。');
      return;
    }

    loadingOverlay.style.display = 'flex';
    btnSaveWeight.disabled = true;

    // 選択された測定日をそのまま送信
    const selectedDate = weightDateInput.value; // YYYY-MM-DD

    const formData = new FormData();
    formData.append('weight', weight || '');
    formData.append('bmi', bmi || '');
    formData.append('fatRate', fatRate || '');
    formData.append('heartRate', heartRate || '');
    formData.append('muscleMass', muscleMass || '');
    formData.append('bmr', bmr || '');
    formData.append('waterRate', waterRate || '');
    formData.append('fatMass', fatMass || '');
    formData.append('leanBodyMass', leanBodyMass || '');
    formData.append('boneMass', boneMass || '');
    formData.append('visceralFat', visceralFat || '');
    formData.append('proteinRate', proteinRate || '');
    formData.append('skeletalMuscleMass', skeletalMuscleMass || '');
    formData.append('subcutaneousFat', subcutaneousFat || '');
    formData.append('bodyAge', bodyAge || '');
    formData.append('bodyType', bodyType || '');
    formData.append('date', selectedDate);
    formData.append('measurementType', activeWeightType);
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
      clearWeightImage();
      weightTextInput.value = '';
      weightResultEditContainer.style.display = 'none';
      
      inputWeightVal.value = '';
      inputBmiVal.value = '';
      inputFatVal.value = '';
      inputHeartVal.value = '';
      inputMuscleVal.value = '';
      inputBmrVal.value = '';
      inputWaterVal.value = '';
      inputFatMassVal.value = '';
      inputLeanBodyVal.value = '';
      inputBoneVal.value = '';
      inputVisceralFatVal.value = '';
      inputProteinRateVal.value = '';
      inputSkeletalMuscleVal.value = '';
      inputSubcutaneousVal.value = '';
      inputBodyAgeVal.value = '';
      inputBodyTypeVal.value = '';

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      weightDateInput.value = `${yyyy}-${mm}-${dd}`;
      
      // デフォルト区分自動再設定 (朝5時〜夕方5時までは朝、それ以外は夜)
      const currentHour = today.getHours();
      if (currentHour >= 5 && currentHour < 17) {
        setWeightTypeActive('morning');
      } else {
        setWeightTypeActive('night');
      }

      // 履歴テーブルの更新＆サマリー更新
      await loadWeightHistory();
      await updateDailyWeightSummary();
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
            <td colspan="4" class="empty-row">測定データがありません。</td>
          </tr>
        `;
        return;
      }

      weightHistory.forEach((item, i) => {
        const typeJa = {
          morning: '朝',
          night: '夜',
          other: '他'
        }[item.measurementType || 'other'];

        // 日付のフォーマット (例: 2026-07-03 -> 2026/07/03)
        const dateDisp = item.date ? item.date.replace(/-/g, '/') : '----/--/--';

        // 体重の増減差分の計算 (過去実績 i + 1 との比較)
        let diffStr = '';
        if (i < weightHistory.length - 1) {
          const prevItem = weightHistory[i + 1];
          if (item.weight !== null && prevItem.weight !== null) {
            const diff = item.weight - prevItem.weight;
            const sign = diff > 0 ? '+' : '';
            const diffClass = diff > 0 ? 'weight-diff-up' : diff < 0 ? 'weight-diff-down' : 'weight-diff-stable';
            diffStr = `<span class="weight-diff ${diffClass}">(${sign}${diff.toFixed(2)})</span>`;
          }
        }

        const tdWeightHTML = `<span class="weight-num">${item.weight !== null ? item.weight.toFixed(2) : '--.--'}</span> ${diffStr}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-date-only">
            <span class="date-text">${dateDisp}</span>
            <span class="badge ${item.measurementType || 'other'}" style="margin-left: 6px;">${typeJa}</span>
          </td>
          <td class="td-weight">${tdWeightHTML}</td>
          <td class="td-bmr-only"><span class="bmr-num">${item.bmr !== null ? item.bmr : '----'}</span></td>
          <td class="td-action">
            <button class="btn-delete-weight" data-id="${item.id}">🗑️</button>
          </td>
        `;

        // 行自体をクリックした際の遷移（詳細モーダル起動）
        tr.addEventListener('click', () => {
          openWeightDetailModal(item);
        });

        // 削除ボタンイベント (イベント伝播を防止して詳細画面が開くのを防ぐ)
        tr.querySelector('.btn-delete-weight').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('この測定データを削除しますか？')) return;

          try {
            const delRes = await fetch(`/api/body-composition/${item.id}`, { method: 'DELETE' });
            if (!delRes.ok) throw new Error('削除に失敗しました。');
            
            await loadWeightHistory();
            await updateDailyWeightSummary();
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
          <td colspan="4" class="error-row">履歴の読み込みに失敗しました。</td>
        </tr>
      `;
    }
  }

  // 現在編集中の体組成データのIDを保持する変数
  let currentEditingWeightId = null;

  // 体組成詳細モーダルの開閉とバインド (スパンからインプット要素への変更に伴う調整)
  // 体組成詳細モーダルの開閉とバインド (スパンからインプット要素への変更に伴う調整)
  const openWeightDetailModal = async (item) => {
    currentEditingWeightId = item.id;

    // 測定日と区分をモーダル上部フォームにセット
    weightModalDateInput.value = item.date ? item.date.substring(0, 10) : '';
    weightModalTypeSelect.value = item.measurementType || 'other';

    // 各インプットに数値をバインド
    // 各インプットに数値をバインド (小数点1桁に統一して小数点を揃える)
    wModalWeight.value = item.weight !== null ? item.weight.toFixed(1) : '';
    wModalBmi.value = item.bmi !== null ? item.bmi.toFixed(1) : '';
    wModalFat.value = item.fatRate !== null ? item.fatRate.toFixed(1) : '';
    wModalHeart.value = item.heartRate !== null ? item.heartRate.toFixed(1) : '';
    wModalMuscle.value = item.muscleMass !== null ? item.muscleMass.toFixed(1) : '';
    wModalBmr.value = item.bmr !== null ? item.bmr.toFixed(1) : '';
    wModalWater.value = item.waterRate !== null ? item.waterRate.toFixed(1) : '';
    wModalFatMass.value = item.fatMass !== null ? item.fatMass.toFixed(1) : '';
    wModalLeanBody.value = item.leanBodyMass !== null ? item.leanBodyMass.toFixed(1) : '';
    wModalBone.value = item.boneMass !== null ? item.boneMass.toFixed(1) : '';
    wModalVisceralFat.value = item.visceralFat !== null ? item.visceralFat.toFixed(1) : '';
    wModalProteinRate.value = item.proteinRate !== null ? item.proteinRate.toFixed(1) : '';
    wModalSkeletalMuscle.value = item.skeletalMuscleMass !== null ? item.skeletalMuscleMass.toFixed(1) : '';
    wModalSubcutaneous.value = item.subcutaneousFat !== null ? item.subcutaneousFat.toFixed(1) : '';
    wModalBodyAge.value = item.bodyAge !== null ? item.bodyAge.toFixed(1) : '';
    wModalBodyType.value = item.bodyType || '';

    // 画像があれば表示
    if (item.imageId) {
      const src = item.imageSource === 'drive' 
        ? `/api/drive-image/${item.imageId}` 
        : `/uploads/${item.imageId}`;
      weightModalImage.src = src;
      weightModalImageContainer.style.display = 'block';
    } else {
      weightModalImage.src = '';
      weightModalImageContainer.style.display = 'none';
    }

    // 前回との比較比の計算
    let prevRecord = null;
    try {
      const response = await fetch('/api/body-composition');
      if (response.ok) {
        const weightHistory = await response.json();
        // 日付順 (新しい順) にソート
        const sortedHistory = [...weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        // 今回のレコードの位置を探す
        const currentIdx = sortedHistory.findIndex(r => r.id === item.id);
        if (currentIdx !== -1 && currentIdx < sortedHistory.length - 1) {
          prevRecord = sortedHistory[currentIdx + 1]; // 過去の直近データ
        }
      }
    } catch (e) {
      console.error('Failed to fetch weight history for modal diff', e);
    }

    // 前回比をセットするヘルパー関数
    function setDiffVal(elId, currentVal, prevVal, decimals = 1) {
      const el = document.getElementById(elId);
      if (!el) return;
      if (currentVal === null || currentVal === undefined || prevVal === null || prevVal === undefined) {
        el.textContent = '--';
        el.className = 'col-diff-val val-neutral';
        return;
      }
      const diff = currentVal - prevVal;
      if (diff > 0) {
        el.textContent = `+${diff.toFixed(decimals)}`;
        el.className = 'col-diff-val val-up';
      } else if (diff < 0) {
        el.textContent = `${diff.toFixed(decimals)}`;
        el.className = 'col-diff-val val-down';
      } else {
        el.textContent = `±0`;
        el.className = 'col-diff-val val-equal';
      }
    }

    setDiffVal('w-modal-diff-weight', item.weight, prevRecord ? prevRecord.weight : null, 1);
    setDiffVal('w-modal-diff-bmi', item.bmi, prevRecord ? prevRecord.bmi : null, 1);
    setDiffVal('w-modal-diff-fat', item.fatRate, prevRecord ? prevRecord.fatRate : null, 1);
    setDiffVal('w-modal-diff-heart', item.heartRate, prevRecord ? prevRecord.heartRate : null, 1);
    setDiffVal('w-modal-diff-muscle', item.muscleMass, prevRecord ? prevRecord.muscleMass : null, 1);
    setDiffVal('w-modal-diff-bmr', item.bmr, prevRecord ? prevRecord.bmr : null, 1);
    setDiffVal('w-modal-diff-water', item.waterRate, prevRecord ? prevRecord.waterRate : null, 1);
    setDiffVal('w-modal-diff-fatmass', item.fatMass, prevRecord ? prevRecord.fatMass : null, 1);
    setDiffVal('w-modal-diff-leanbody', item.leanBodyMass, prevRecord ? prevRecord.leanBodyMass : null, 1);
    setDiffVal('w-modal-diff-bone', item.boneMass, prevRecord ? prevRecord.boneMass : null, 1);
    setDiffVal('w-modal-diff-visceralfat', item.visceralFat, prevRecord ? prevRecord.visceralFat : null, 1);
    setDiffVal('w-modal-diff-proteinrate', item.proteinRate, prevRecord ? prevRecord.proteinRate : null, 1);
    setDiffVal('w-modal-diff-skeletalmuscle', item.skeletalMuscleMass, prevRecord ? prevRecord.skeletalMuscleMass : null, 1);
    setDiffVal('w-modal-diff-subcutaneous', item.subcutaneousFat, prevRecord ? prevRecord.subcutaneousFat : null, 1);
    setDiffVal('w-modal-diff-bodyage', item.bodyAge, prevRecord ? prevRecord.bodyAge : null, 1);

    const diffBodyTypeEl = document.getElementById('w-modal-diff-bodytype');
    if (diffBodyTypeEl) {
      diffBodyTypeEl.textContent = '--';
      diffBodyTypeEl.className = 'col-diff-val val-neutral';
    }

    weightDetailModal.style.display = 'flex';
  };

  // モーダル内の「変更を保存する」ボタンの処理
  btnSaveWeightModal.addEventListener('click', async () => {
    if (!currentEditingWeightId) return;

    loadingOverlay.style.display = 'flex';
    btnSaveWeightModal.disabled = true;

    // 入力された数値を収集
    const updatedData = {
      date: weightModalDateInput.value,
      measurementType: weightModalTypeSelect.value,
      weight: wModalWeight.value ? parseFloat(wModalWeight.value) : null,
      bmi: wModalBmi.value ? parseFloat(wModalBmi.value) : null,
      fatRate: wModalFat.value ? parseFloat(wModalFat.value) : null,
      heartRate: wModalHeart.value ? parseInt(wModalHeart.value, 10) : null,
      muscleMass: wModalMuscle.value ? parseFloat(wModalMuscle.value) : null,
      bmr: wModalBmr.value ? parseInt(wModalBmr.value, 10) : null,
      waterRate: wModalWater.value ? parseFloat(wModalWater.value) : null,
      fatMass: wModalFatMass.value ? parseFloat(wModalFatMass.value) : null,
      leanBodyMass: wModalLeanBody.value ? parseFloat(wModalLeanBody.value) : null,
      boneMass: wModalBone.value ? parseFloat(wModalBone.value) : null,
      visceralFat: wModalVisceralFat.value ? parseFloat(wModalVisceralFat.value) : null,
      proteinRate: wModalProteinRate.value ? parseFloat(wModalProteinRate.value) : null,
      skeletalMuscleMass: wModalSkeletalMuscle.value ? parseFloat(wModalSkeletalMuscle.value) : null,
      subcutaneousFat: wModalSubcutaneous.value ? parseFloat(wModalSubcutaneous.value) : null,
      bodyAge: wModalBodyAge.value ? parseInt(wModalBodyAge.value, 10) : null,
      bodyType: wModalBodyType.value || null
    };

    try {
      const response = await fetch(`/api/body-composition/${currentEditingWeightId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) throw new Error('体組成データの更新に失敗しました。');

      weightDetailModal.style.display = 'none';
      await loadWeightHistory();
      await updateDailyWeightSummary();
      alert('変更を保存しました。');

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      loadingOverlay.style.display = 'none';
      btnSaveWeightModal.disabled = false;
    }
  });

  btnCloseWeightModal.addEventListener('click', () => {
    weightDetailModal.style.display = 'none';
  });

  // モーダル外側クリックで閉じる
  weightDetailModal.addEventListener('click', (e) => {
    if (e.target === weightDetailModal) {
      weightDetailModal.style.display = 'none';
    }
  });

  // 初期ロードに体組成履歴のロードとサマリーのロードを追加
  loadWeightHistory();
  updateDailyWeightSummary();
});
