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
  
  // Loading Elements
  const loadingOverlay = document.getElementById('loading-overlay');

  // History & Stats Elements
  const historyList = document.getElementById('history-list');
  const statsTotalMeals = document.getElementById('stats-total-meals');
  const statsAvgCalories = document.getElementById('stats-avg-calories');

  // History Detail Modal Elements
  const historyDetailModal = document.getElementById('history-detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveModal = document.getElementById('btn-save-modal');
  const btnReanalyzeModal = document.getElementById('btn-reanalyze-modal');
  const btnPresetModal = document.getElementById('btn-preset-modal');
  
  // Presets Elements
  const presetSelector = document.getElementById('preset-selector');
  const presetsList = document.getElementById('presets-list');
  const formPresetsManual = document.getElementById('form-presets-manual');
  const formPresetsAiAnalyze = document.getElementById('form-presets-ai-analyze');
  const btnPresetsAiSubmit = document.getElementById('btn-presets-ai-submit');
  const presetsManualToggle = document.getElementById('presets-manual-toggle');
  const presetsManualContent = document.getElementById('presets-manual-content');
  const presetsManualArrow = document.getElementById('presets-manual-arrow');
  const presetsTextInput = document.getElementById('presets-text-input');
  
  // Presets AI upload elements
  const btnPresetsCameraTrigger = document.getElementById('btn-presets-camera-trigger');
  const btnPresetsGalleryTrigger = document.getElementById('btn-presets-gallery-trigger');
  const presetsCameraInput = document.getElementById('presets-camera-input');
  const presetsGalleryInput = document.getElementById('presets-gallery-input');
  const presetsImagePreviewContainer = document.getElementById('presets-image-preview-container');
  const presetsImagePreview = document.getElementById('presets-image-preview');
  const btnPresetsRemoveImage = document.getElementById('btn-presets-remove-image');
  
  // Modal Edit Inputs
  const modalDateInput = document.getElementById('modal-date-input');
  const modalTimeInput = document.getElementById('modal-time-input');
  const modalTypeSelect = document.getElementById('modal-type-select');
  const modalTextInput = document.getElementById('modal-text-input');

  // Chart instances
  let caloriesChart = null;
  let pfcChart = null;
  let weightTrendChart = null;
  let bmiTrendChart = null;


  // Selected file reference
  let selectedFile = null;
  let activeMealType = 'snack';
  
  // Current editing history ID (for Modal save & reanalyze)
  let currentEditingHistoryId = null;
  let activeDetailMeal = null; // 現在詳細モーダルに表示されている食事レコードを保持

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
  const btnDeleteWeightModal = document.getElementById('btn-delete-weight-modal');
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
    activeDetailMeal = item;
    currentEditingHistoryId = item.id;
    
    // 画像が無い場合のプレースホルダー対応 (ない場合は親コンテナごと非表示にしてスリム化)
    const modalImage = document.getElementById('modal-meal-image');
    const modalImageContainer = modalImage.closest('.modal-image-container');
    if (item.imageId) {
      modalImage.src = `/api/image?source=${item.imageSource}&id=${item.imageId}`;
      if (modalImageContainer) modalImageContainer.style.display = 'block';
      modalImage.style.display = 'block';
    } else {
      if (modalImageContainer) modalImageContainer.style.display = 'none';
      modalImage.style.display = 'none';
    }
    
    // 根拠アコーディオンの表示状態を閉じた状態(初期状態)にリセット
    const inferenceBody = document.getElementById('modal-inference-body');
    const inferenceArrow = document.getElementById('modal-inference-arrow');
    if (inferenceBody) inferenceBody.style.display = 'none';
    if (inferenceArrow) {
      inferenceArrow.textContent = '▼';
      inferenceArrow.style.transform = 'rotate(0deg)';
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

    const caloriesEl = document.getElementById('modal-calories');
    const proteinEl = document.getElementById('modal-protein');
    const fatEl = document.getElementById('modal-fat');
    const carbsEl = document.getElementById('modal-carbs');

    if (item.status === 'failed') {
      caloriesEl.textContent = '--';
      proteinEl.textContent = '--';
      fatEl.textContent = '--';
      carbsEl.textContent = '--';
      
      btnReanalyzeModal.classList.add('pulse-highlight');
      btnReanalyzeModal.innerHTML = '✨ AI解析を再実行（再計算）';
    } else {
      caloriesEl.textContent = item.nutrition.calories;
      proteinEl.textContent = Number(item.nutrition.protein).toFixed(1);
      fatEl.textContent = Number(item.nutrition.fat).toFixed(1);
      carbsEl.textContent = Number(item.nutrition.carbohydrates).toFixed(1);
      
      btnReanalyzeModal.classList.remove('pulse-highlight');
      btnReanalyzeModal.innerHTML = '🔄 再計算する';
    }
    
    const modalInference = document.getElementById('modal-inference');
    const modalInferenceCard = document.getElementById('modal-inference-card');
    if (item.nutrition.inference) {
      modalInference.textContent = item.nutrition.inference;
      modalInferenceCard.style.display = 'block';
    } else {
      modalInferenceCard.style.display = 'none';
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
    
    // 定番メニューセレクタをリセット
    if (presetSelector) {
      presetSelector.value = '';
      btnAnalyze.textContent = "食事を解析する";
      btnAnalyze.style.backgroundColor = "";
    }

    // 日付・食事区分セレクタを現在時刻で初期化
    initializeSelectors();
  }

  // 初期実行
  initializeSelectors();
  validateWeightInputs();

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
      } else if (targetTabId === 'tab-presets') {
        loadPresets();
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
    const hasPreset = presetSelector && presetSelector.value !== "";
    const hasImage = !!selectedFile;
    const hasText = mealTextInput.value.trim().length > 0;
    btnAnalyze.disabled = !(hasPreset || hasImage || hasText);
  }

  function validateWeightInputs() {
    const hasImage = !!selectedWeightFile;
    const hasText = weightTextInput && weightTextInput.value.trim().length > 0;
    if (btnAnalyzeWeight) {
      btnAnalyzeWeight.disabled = !(hasImage || hasText);
    }
  }

  if (presetSelector) {
    presetSelector.addEventListener('change', () => {
      const selectedId = presetSelector.value;
      if (selectedId !== "") {
        // 定番メニューが選ばれたらボタン表記を切替 (写真はクリアせず併用可能にする)
        btnAnalyze.textContent = "定番メニューで記録する";
        btnAnalyze.style.backgroundColor = "var(--primary-dark)";
        mealTextInput.value = "";
      } else {
        btnAnalyze.textContent = "食事を解析する";
        btnAnalyze.style.backgroundColor = "";
      }
      validateInputs();
    });
  }

  mealTextInput.addEventListener('input', validateInputs);
  if (weightTextInput) {
    weightTextInput.addEventListener('input', validateWeightInputs);
  }

  // ==========================================================================
  // Analyze Meal Execution
  // ==========================================================================
  btnAnalyze.addEventListener('click', async () => {
    const selectedPresetId = presetSelector ? presetSelector.value : "";
    
    // A. 定番メニューが選ばれている場合の直接記録処理
    if (selectedPresetId !== "") {
      const opt = presetSelector.options[presetSelector.selectedIndex];
      const presetName = opt.dataset.name;
      const cVal = opt.dataset.calories;
      const pVal = opt.dataset.protein;
      const fVal = opt.dataset.fat;
      const carbVal = opt.dataset.carbohydrates;

      btnAnalyze.disabled = true;

      const loadingTextEl = loadingOverlay.querySelector('p');
      const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
      loadingTextEl.textContent = '定番メニューを記録しています...';
      loadingSubTextEl.textContent = '計算済みのデータを食事履歴へ追加中';
      loadingOverlay.style.display = 'flex';

      const selectedDate = mealDateInput.value;
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const fullDateTimeStr = `${selectedDate}T${hours}:${minutes}:${seconds}`;
      const mealDateToSend = new Date(fullDateTimeStr).toISOString();

      const formData = new FormData();
      formData.append('name', presetName);
      formData.append('calories', cVal);
      formData.append('protein', pVal);
      formData.append('fat', fVal);
      formData.append('carbohydrates', carbVal);
      formData.append('mealDate', mealDateToSend);
      formData.append('mealType', activeMealType);
      formData.append('presetId', selectedPresetId);
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      try {
        const response = await fetch('/api/history/preset', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('定番メニューの記録に失敗しました。');

        const record = await response.json();

        // 成功後の各種同期 ＆ 自動遷移 ＆ モーダル起動
        updateDailySummary();
        await loadHistory();

        const historyNavItem = document.querySelector('[data-tab="tab-history"]');
        if (historyNavItem) {
          historyNavItem.click();
        }

        openDetailModal(record);
        resetAnalyzeForm();

      } catch (err) {
        console.error(err);
        alert(err.message);
      } finally {
        loadingOverlay.style.display = 'none';
        btnAnalyze.disabled = false;
      }
      return; // 定番記録処理はここで終了
    }

    // B. 通常の AI 解析処理
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
      
      // 今日の合計表示をリアルタイム更新
      updateDailySummary();

      // 履歴一覧も同期してリロード
      await loadHistory();

      // 自動で食事（履歴）タブ（tab-history）へ遷移
      const historyNavItem = document.querySelector('[data-tab="tab-history"]');
      if (historyNavItem) {
        historyNavItem.click();
      }

      // 作成された履歴の詳細モーダルを表示
      openDetailModal(record);

      // 解析画面の入力値を初期化
      resetAnalyzeForm();

      // AI解析に失敗して一時保存された場合のアラート
      if (record.status === 'failed') {
        alert('【AI解析失敗 - 履歴保存】\n一時的なエラーによりAI解析に失敗しましたが、入力データ（画像・テキスト）は履歴に保存されました。\n\n詳細画面から「再計算」ボタンを押すことで、再度解析を実行できます。');
      }

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
      document.getElementById('daily-total-protein').textContent = Number(totalP).toFixed(1);
      document.getElementById('daily-total-fat').textContent = Number(totalF).toFixed(1);
      document.getElementById('daily-total-carbs').textContent = Number(totalC).toFixed(1);

    } catch (err) {
      console.error('Failed to update daily summary:', err);
    }
  }

  // 起動時に今日の合計をロード
  updateDailySummary();

  // ==========================================================================
  // 定番メニュー (Presets) 管理ロジック
  // ==========================================================================
  let presetsSelectedFile = null;

  // 1. 定番データの読み込み ＆ レンダリング
  async function loadPresets() {
    try {
      const response = await fetch('/api/presets');
      const presets = await response.json();

      // A. 解析画面のドロップダウンを更新
      if (presetSelector) {
        presetSelector.innerHTML = '<option value="">定番メニューから選択</option>';
        presets.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.dataset.calories = p.calories;
          opt.dataset.protein = p.protein;
          opt.dataset.fat = p.fat;
          opt.dataset.carbohydrates = p.carbohydrates;
          opt.dataset.name = p.name;
          opt.textContent = `${p.name} (${p.calories} kcal - P:${p.protein} F:${p.fat} C:${p.carbohydrates})`;
          presetSelector.appendChild(opt);
        });
      }

      // B. 定番タブの一覧リストを更新
      if (presetsList) {
        if (presets.length === 0) {
          presetsList.innerHTML = `
            <div class="presets-empty-state" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px; background: rgba(255,255,255,0.7); border-radius: 12px; border: 1.5px dashed var(--border-color);">
              登録されている定番メニューはありません。<br>上のAI解析か手動入力で登録してください。
            </div>
          `;
          return;
        }

        presetsList.innerHTML = '';
        presets.forEach(p => {
          const card = document.createElement('div');
          card.className = 'preset-card';
          card.innerHTML = `
            <div class="preset-card-info">
              <div class="preset-card-name-wrapper" data-id="${p.id}">
                <span class="preset-card-name">${p.name}</span>
                <span class="preset-edit-icon" title="名前を編集">
                  <svg class="icon-svg" style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </span>
              </div>
              <div class="preset-card-macros">
                <span class="macro-badge calories">${p.calories} kcal</span>
                <span class="macro-badge p">P: ${p.protein}g</span>
                <span class="macro-badge f">F: ${p.fat}g</span>
                <span class="macro-badge c">C: ${p.carbohydrates}g</span>
              </div>
            </div>
            <button class="btn-delete-preset" data-id="${p.id}" title="定番メニューから削除">
              <svg class="icon-svg" style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          `;
          presetsList.appendChild(card);
        });

        // 削除ボタンのリスナー追加
        document.querySelectorAll('.btn-delete-preset').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (confirm('この定番メニューを削除してもよろしいですか？')) {
              try {
                const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
                if (res.ok) {
                  loadPresets();
                } else {
                  alert('削除に失敗しました。');
                }
              } catch (err) {
                console.error(err);
                alert('通信エラーが発生しました。');
              }
            }
          });
        });

        // 名前編集のリスナー追加
        document.querySelectorAll('.preset-card-name-wrapper').forEach(wrapper => {
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = wrapper.getAttribute('data-id');
            const nameSpan = wrapper.querySelector('.preset-card-name');
            const currentName = nameSpan.textContent;

            // すでに入力欄に切り替わっている場合は多重処理防止
            if (wrapper.querySelector('.preset-edit-input')) return;

            // 入力フィールドを生成して置き換える
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'preset-edit-input';
            input.value = currentName;

            // 表示を切り替え
            nameSpan.style.display = 'none';
            const editIcon = wrapper.querySelector('.preset-edit-icon');
            if (editIcon) editIcon.style.display = 'none';
            wrapper.appendChild(input);
            input.focus();
            input.select();

            // 保存処理
            const saveNameEdit = async () => {
              const newName = input.value.trim();
              if (newName === '' || newName === currentName) {
                // 空、または変更なしなら元に戻す
                nameSpan.style.display = '';
                if (editIcon) editIcon.style.display = '';
                input.remove();
                return;
              }

              try {
                const res = await fetch(`/api/presets/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: newName })
                });

                if (res.ok) {
                  // リロードしてドロップダウンも更新
                  loadPresets();
                } else {
                  alert('名前の更新に失敗しました。');
                  nameSpan.style.display = '';
                  if (editIcon) editIcon.style.display = '';
                  input.remove();
                }
              } catch (err) {
                console.error(err);
                alert('更新中に通信エラーが発生しました。');
                nameSpan.style.display = '';
                if (editIcon) editIcon.style.display = '';
                input.remove();
              }
            };

            // Enterキーで確定
            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
              }
            });

            // フォーカスアウトで確定・保存
            input.addEventListener('blur', saveNameEdit);
          });
        });
      }
    } catch (err) {
      console.error('Failed to load predefined menu presets:', err);
    }
  }

  // 2. 手動登録アコーディオン制御
  if (presetsManualToggle) {
    presetsManualToggle.addEventListener('click', () => {
      const isHidden = presetsManualContent.style.display === 'none' || !presetsManualContent.style.display;
      if (isHidden) {
        presetsManualContent.style.display = 'block';
        presetsManualArrow.classList.add('active');
      } else {
        presetsManualContent.style.display = 'none';
        presetsManualArrow.classList.remove('active');
      }
    });
  }

  // 3. 手動登録フォーム送信処理
  if (formPresetsManual) {
    formPresetsManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('preset-manual-name').value.trim();
      const calories = document.getElementById('preset-manual-calories').value;
      const protein = document.getElementById('preset-manual-protein').value;
      const fat = document.getElementById('preset-manual-fat').value;
      const carbs = document.getElementById('preset-manual-carbs').value;

      if (!name) return;

      try {
        const response = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, calories, protein, fat, carbohydrates: carbs })
        });

        if (response.ok) {
          formPresetsManual.reset();
          presetsManualContent.style.display = 'none';
          presetsManualArrow.classList.remove('active');
          loadPresets();
        } else {
          alert('定番マスタの登録に失敗しました。');
        }
      } catch (err) {
        console.error(err);
        alert('登録中にエラーが発生しました。');
      }
    });
  }

  // 4. AI定番登録フォームのファイルハンドラ
  if (btnPresetsCameraTrigger) {
    btnPresetsCameraTrigger.addEventListener('click', () => presetsCameraInput.click());
    btnPresetsGalleryTrigger.addEventListener('click', () => presetsGalleryInput.click());

    const handlePresetsFile = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
      }
      presetsSelectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        presetsImagePreview.src = e.target.result;
        presetsImagePreviewContainer.style.display = 'block';
        checkPresetsAiSubmitState();
      };
      reader.readAsDataURL(file);
    };

    presetsCameraInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handlePresetsFile(e.target.files[0]);
    });
    presetsGalleryInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handlePresetsFile(e.target.files[0]);
    });

    btnPresetsRemoveImage.addEventListener('click', () => {
      presetsSelectedFile = null;
      presetsCameraInput.value = '';
      presetsGalleryInput.value = '';
      presetsImagePreviewContainer.style.display = 'none';
      presetsImagePreview.src = '';
      checkPresetsAiSubmitState();
    });
  }

  // AI定番登録ボタン活性化の制御
  function checkPresetsAiSubmitState() {
    const hasText = presetsTextInput.value.trim().length > 0;
    const hasImage = !!presetsSelectedFile;
    btnPresetsAiSubmit.disabled = (!hasText && !hasImage);
  }

  if (presetsTextInput) {
    presetsTextInput.addEventListener('input', checkPresetsAiSubmitState);
  }

  // 5. AI定番登録フォーム送信処理
  if (formPresetsAiAnalyze) {
    formPresetsAiAnalyze.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hasText = presetsTextInput.value.trim().length > 0;
      const hasImage = !!presetsSelectedFile;
      if (!hasText && !hasImage) return;

      btnPresetsAiSubmit.disabled = true;
      
      const loadingTextEl = loadingOverlay.querySelector('p');
      const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
      loadingTextEl.textContent = 'AIが栄養素を分析しています...';
      loadingSubTextEl.textContent = '定番メニューに登録するデータを算出中';
      loadingOverlay.style.display = 'flex';

      const formData = new FormData();
      if (hasImage) {
        formData.append('image', presetsSelectedFile);
      }
      formData.append('textInput', presetsTextInput.value.trim());

      try {
        const response = await fetch('/api/presets/analyze', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || '定番登録中にサーバーエラーが発生しました。');
        }

        // フォームのリセット
        presetsSelectedFile = null;
        presetsCameraInput.value = '';
        presetsGalleryInput.value = '';
        presetsImagePreviewContainer.style.display = 'none';
        presetsImagePreview.src = '';
        presetsTextInput.value = '';
        btnPresetsAiSubmit.disabled = true;

        loadPresets();
      } catch (err) {
        console.error(err);
        alert('AI定番登録に失敗しました:\n' + err.message);
      } finally {
        loadingOverlay.style.display = 'none';
      }
    });
  }

  // 6. 食事詳細モーダル内の「定番に登録」ボタン押下処理
  if (btnPresetModal) {
    btnPresetModal.addEventListener('click', async () => {
      if (!activeDetailMeal) return;

      const displayTitle = document.getElementById('modal-meal-title').textContent || '定番メニュー';
      const cVal = activeDetailMeal.nutrition.calories;
      const pVal = activeDetailMeal.nutrition.protein;
      const fVal = activeDetailMeal.nutrition.fat;
      const carbVal = activeDetailMeal.nutrition.carbohydrates;

      btnPresetModal.disabled = true;
      
      try {
        const response = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: displayTitle,
            calories: cVal,
            protein: pVal,
            fat: fVal,
            carbohydrates: carbVal,
            imageSource: activeDetailMeal.imageSource || '',
            imageId: activeDetailMeal.imageId || ''
          })
        });

        if (response.ok) {
          alert(`「${displayTitle}」を定番メニューに保存しました！\n次回より簡単選択から一撃で記録できます。`);
          loadPresets();
        } else {
          alert('定番登録に失敗しました。');
        }
      } catch (err) {
        console.error(err);
        alert('定番登録中に通信エラーが発生しました。');
      } finally {
        btnPresetModal.disabled = false;
      }
    });
  }

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
              const yyyyStr = dateObj.getFullYear();
              const mmStr = String(dateObj.getMonth() + 1).padStart(2, '0');
              const ddStr = String(dateObj.getDate()).padStart(2, '0');
              return `${yyyyStr}/${mmStr}/${ddStr}`;
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
const _today = new Date();
const todayKey = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;

      
      sortedKeys.forEach(dateKey => {
        const group = groups[dateKey];
        
        // 食事日時（登録時刻）の降順でソート
        group.meals.sort((a, b) => {
          return new Date(b.mealDate || b.date) - new Date(a.mealDate || a.date);
        });
        
        // 1. 日別合計ヘッダーの生成 (日付の右側にインラインで並べる)
        const headerEl = document.createElement('div');
        headerEl.className = 'history-date-header';
        
        const pTotal = group.totalProtein.toFixed(1);
        const fTotal = group.totalFat.toFixed(1);
        const cTotal = group.totalCarbs.toFixed(1);
 
        headerEl.innerHTML = `
          <div class="history-left-group">
            <div class="history-pfc-chips">
              <div class="history-pfc-chip protein"><span class="label">P</span><span class="val">${pTotal}</span></div>
              <div class="history-pfc-chip fat"><span class="label">F</span><span class="val">${fTotal}</span></div>
              <div class="history-pfc-chip carbs"><span class="label">C</span><span class="val">${cTotal}</span></div>
            </div>
            <div class="history-calories">${group.totalCalories} <span class="unit">kcal</span></div>
          </div>
          <span class="history-date-title">${group.dateLabel}</span>
        `;
        // Create container for this date's cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'history-cards-container';
        // Show only today by default
        cardsContainer.style.display = (dateKey === todayKey) ? 'block' : 'none';
        // Toggle visibility on header click
        headerEl.style.cursor = 'pointer';
        headerEl.addEventListener('click', () => {
          const isHidden = cardsContainer.style.display === 'none';
          cardsContainer.style.display = isHidden ? 'block' : 'none';
        });
        // グループラッパーにまとめて追加
        const groupDiv = document.createElement('div');
        groupDiv.className = 'history-group';
        groupDiv.appendChild(headerEl);
        groupDiv.appendChild(cardsContainer);
        historyList.appendChild(groupDiv);

        // 2. その日の食事カードの生成
        group.meals.forEach(item => {
          const mealTypeJa = {
            morning: '朝食',
            noon: '昼食',
            night: '夕食',
            snack: '間食'
          }[item.mealType || 'snack'];

          const card = document.createElement('div');
          card.className = `card history-card ${item.status === 'failed' ? 'failed-analysis' : ''}`;
          
          // 履歴カードクリックで単独モーダルを開く
          card.addEventListener('click', () => {
            openDetailModal(item);
          });

          // 表示用の料理名・テキスト（Geminiが解析した具体的な料理名 mealName を優先表示）
          const displayText = item.textInput && item.textInput.trim() 
            ? item.textInput.trim() 
            : (item.imageId ? '📸 画像から解析' : '🍽️ 食事データ');
          let displayMealName = item.mealName || (item.nutrition && item.nutrition.mealName) || displayText;

          if (item.status === 'failed') {
            displayMealName = `⚠️ ${displayMealName} (解析未完了)`;
          }

          let leftGroupHtml = '';
          if (item.status === 'failed') {
            leftGroupHtml = `
              <div class="history-failed-badge">
                <span class="warning-icon">⚠️</span>
                <span class="badge-text">解析未完了 (クリックして再計算)</span>
              </div>
            `;
          } else {
            leftGroupHtml = `
              <div class="history-pfc-chips">
                <div class="history-pfc-chip protein"><span class="label">P</span><span class="val">${Number(item.nutrition.protein).toFixed(1)}</span></div>
                <div class="history-pfc-chip fat"><span class="label">F</span><span class="val">${Number(item.nutrition.fat).toFixed(1)}</span></div>
                <div class="history-pfc-chip carbs"><span class="label">C</span><span class="val">${Number(item.nutrition.carbohydrates).toFixed(1)}</span></div>
              </div>
              <div class="history-calories">${item.nutrition.calories} <span class="unit">kcal</span></div>
            `;
          }

          // 写真なし：カロリー+PFCと食事区分が1行目、料理名とゴミ箱ボタンが2行目
          card.innerHTML = `
            <div class="history-info">
              <!-- 1行目: カロリーとPFCチップス、食事区分チップ -->
              <div class="history-info-row-top">
                <div class="history-left-group">
                  ${leftGroupHtml}
                </div>
                <span class="history-meal-type-chip ${item.mealType || 'snack'}">${mealTypeJa}</span>
              </div>
              <!-- 2行目: 料理名とゴミ箱ボタン (動的挿入) -->
              <div class="history-info-row-bottom">
                <span class="history-meal-text">${displayMealName}</span>
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
          card.querySelector('.history-info-row-bottom').appendChild(deleteBtn);

          cardsContainer.appendChild(card);
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
  
  // 根拠アコーディオンの開閉イベントバインド
  const inferenceTrigger = document.getElementById('modal-inference-trigger');
  const inferenceBody = document.getElementById('modal-inference-body');
  const inferenceArrow = document.getElementById('modal-inference-arrow');

  if (inferenceTrigger && inferenceBody && inferenceArrow) {
    inferenceTrigger.addEventListener('click', () => {
      const isCollapsed = inferenceBody.style.display === 'none';
      if (isCollapsed) {
        inferenceBody.style.display = 'block';
        inferenceArrow.textContent = '▲';
        inferenceArrow.style.transform = 'rotate(180deg)';
      } else {
        inferenceBody.style.display = 'none';
        inferenceArrow.textContent = '▼';
        inferenceArrow.style.transform = 'rotate(0deg)';
      }
    });
  }
  
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
      activeDetailMeal = updatedRecord;
      btnReanalyzeModal.classList.remove('pulse-highlight');
      btnReanalyzeModal.innerHTML = '🔄 再計算する';

      document.getElementById('modal-meal-title').textContent = updatedRecord.mealName || updatedRecord.textInput || '食事詳細';
      document.getElementById('modal-calories').textContent = updatedRecord.nutrition.calories;
      document.getElementById('modal-protein').textContent = Number(updatedRecord.nutrition.protein).toFixed(1);
      document.getElementById('modal-fat').textContent = Number(updatedRecord.nutrition.fat).toFixed(1);
      document.getElementById('modal-carbs').textContent = Number(updatedRecord.nutrition.carbohydrates).toFixed(1);
      
      const modalInference = document.getElementById('modal-inference');
      const modalInferenceCard = document.getElementById('modal-inference-card');
      if (updatedRecord.nutrition.inference) {
        modalInference.textContent = updatedRecord.nutrition.inference;
        modalInferenceCard.style.display = 'block';
      } else {
        modalInferenceCard.style.display = 'none';
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
      // 体組成データを取得して体重・BMI推移を描画
      const weightRes = await fetch('/api/body-composition');
      if (!weightRes.ok) throw new Error('データ取得失敗');
      const weightHistory = await weightRes.json();

      // 古い順にソート（時系列）
      const validHistory = [...weightHistory]
        .filter(d => d.weight !== null && d.weight > 0)
        .sort((a, b) => {
          const dateA = jstDateKey(a.date);
          const dateB = jstDateKey(b.date);
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const priority = { night: 3, morning: 2, other: 1 };
          return (priority[a.measurementType] || 0) - (priority[b.measurementType] || 0);
        });

      // 直近30件のみ
      const slicedHistory = validHistory.slice(-30);

      const weightLabels = slicedHistory.map(d => {
        const dateObj = new Date(`${jstDateKey(d.date)}T00:00:00+09:00`);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd}`;
      });
      const weightValues = slicedHistory.map(d => d.weight);
      const bmiValues = slicedHistory.map(d => d.bmi ?? null);

      // 1. 体重推移グラフ
      const weightCtx = document.getElementById('weight-trend-chart').getContext('2d');
      if (weightTrendChart) weightTrendChart.destroy();

      weightTrendChart = new Chart(weightCtx, {
        type: 'line',
        data: {
          labels: weightLabels,
          datasets: [{
            label: '体重 (kg)',
            data: weightValues,
            borderColor: '#4a90e2',
            backgroundColor: 'rgba(74, 144, 226, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.2,
            pointBackgroundColor: '#4a90e2',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grace: '5%', grid: { color: 'rgba(200, 220, 210, 0.3)' } },
            x: { grid: { display: false } }
          }
        }
      });

      // 2. BMI推移グラフ
      const bmiCtx = document.getElementById('bmi-trend-chart').getContext('2d');
      if (typeof bmiTrendChart !== 'undefined' && bmiTrendChart) bmiTrendChart.destroy();

      bmiTrendChart = new Chart(bmiCtx, {
        type: 'line',
        data: {
          labels: weightLabels,
          datasets: [{
            label: 'BMI',
            data: bmiValues,
            borderColor: '#a06cc1',
            backgroundColor: 'rgba(160, 108, 193, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.2,
            pointBackgroundColor: '#a06cc1',
            pointRadius: 4,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grace: '5%', grid: { color: 'rgba(200, 220, 210, 0.3)' } },
            x: { grid: { display: false } }
          }
        }
      });

    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }


  // ==========================================================================
  // 体組成 (Weight / Body Composition) OCR & 記録ロジック
  // ==========================================================================

  // 最新体重・基礎代謝サマリーの更新（日付フィルターなしで常に最新値を表示）
  async function updateDailyWeightSummary() {
    try {
      const response = await fetch('/api/body-composition');
      if (!response.ok) throw new Error('データ取得失敗');
      
      const weightHistory = await response.json();
      
      // 体重データが存在する全測定記録を日付の昇順（古い順）、および区分の昇順（朝 -> 夜）にソート
      const validHistory = [...weightHistory]
        .filter(item => item.weight !== null)
        .sort((a, b) => {
          const dateA = jstDateKey(a.date);
          const dateB = jstDateKey(b.date);
          if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
          }
          const priority = { night: 3, morning: 2, other: 1 };
          const pA = priority[a.measurementType] || 0;
          const pB = priority[b.measurementType] || 0;
          return pA - pB;
        });

      if (validHistory.length > 0) {
        // 一番最後の要素が最も新しい測定データ
        const latest = validHistory[validHistory.length - 1];
        summaryWeightVal.textContent = latest.weight.toFixed(1);
        
        // 前日比（1つ前の測定値との差）の算出
        const diffEl = document.getElementById('daily-weight-diff');
        if (diffEl) {
          if (validHistory.length > 1) {
            const prevRecord = validHistory[validHistory.length - 2];
            const diff = latest.weight - prevRecord.weight;
            diffEl.style.display = 'inline-block';
            if (diff > 0) {
              diffEl.textContent = `+${diff.toFixed(1)}`;
              diffEl.className = 'weight-diff-badge up';
            } else if (diff < 0) {
              diffEl.textContent = `${diff.toFixed(1)}`;
              diffEl.className = 'weight-diff-badge down';
            } else {
              diffEl.textContent = `±0`;
              diffEl.className = 'weight-diff-badge same';
            }
          } else {
            diffEl.textContent = '';
            diffEl.style.display = 'none';
          }
        }
        
        // 基礎代謝を食事カロリー表示の横にマージする
        if (latest.bmr !== null) {
          if (dailyBmrCalories) dailyBmrCalories.textContent = latest.bmr;
          if (dailyBmrDivider) dailyBmrDivider.style.display = 'inline';
        } else {
          if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
        }
        
        dailyWeightSummaryBar.style.display = 'inline-flex';
      } else {
        // 測定データが一件もない場合はデフォルト表示
        summaryWeightVal.textContent = '--.-';
        const diffEl = document.getElementById('daily-weight-diff');
        if (diffEl) {
          diffEl.textContent = '';
          diffEl.style.display = 'none';
        }
        if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
        dailyWeightSummaryBar.style.display = 'inline-flex';
      }
    } catch (err) {
      console.error('Failed to update daily weight summary:', err);
      if (dailyBmrDivider) dailyBmrDivider.style.display = 'none';
      dailyWeightSummaryBar.style.display = 'inline-flex';
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
    validateWeightInputs();
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
    validateWeightInputs();
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
    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = 'AIが体組成データを解析しています...';
    loadingSubTextEl.textContent = '体重や体脂肪率などの数値を読み取り中';
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
      const measurementType = activeChip ? activeChip.getAttribute('data-type') : 'morning';

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
      validateWeightInputs();

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

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '体組成データを保存しています...';
    loadingSubTextEl.textContent = '測定記録をGoogleドライブへ追加中';
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

      // 1. 各レコードについて、同区分（朝・夜）での前回比差分をあらかじめ計算して付与する
      weightHistory.forEach((item, idx) => {
        const currentType = item.measurementType || 'other';
        let prevRecord = null;
        for (let j = idx + 1; j < weightHistory.length; j++) {
          const compareType = weightHistory[j].measurementType || 'other';
          if (compareType === currentType && weightHistory[j].weight !== null) {
            prevRecord = weightHistory[j];
            break;
          }
        }
        
        if (item.weight !== null && prevRecord !== null) {
          item.typeDiff = item.weight - prevRecord.weight;
        } else {
          item.typeDiff = null;
        }
      });

      // 2. 日付ごとにレコードを集約する
      const dailyGroups = {};
      weightHistory.forEach(item => {
        const dateKey = jstDateKey(item.date) || '-----';
        if (!dailyGroups[dateKey]) {
          dailyGroups[dateKey] = {
            date: dateKey,
            morning: null,
            night: null
          };
        }
        if (item.measurementType === 'morning') {
          dailyGroups[dateKey].morning = item;
        } else if (item.measurementType === 'night') {
          dailyGroups[dateKey].night = item;
        } else {
          if (!dailyGroups[dateKey].morning) {
            dailyGroups[dateKey].morning = item;
          } else if (!dailyGroups[dateKey].night) {
            dailyGroups[dateKey].night = item;
          }
        }
      });

      // 3. 日付の降順でソートして描画
      const sortedDates = Object.keys(dailyGroups).sort((a, b) => b.localeCompare(a));

      sortedDates.forEach(dateKey => {
        const dayGroup = dailyGroups[dateKey];
        const morningItem = dayGroup.morning;
        const nightItem = dayGroup.night;

        // 朝の体重・差分HTML
        let morningWeightHTML = '<div class="weight-cell-container"><span class="weight-empty-placeholder">--.-</span><span class="weight-empty-placeholder">--</span></div>';
        if (morningItem && morningItem.weight !== null) {
          let diffStr = '<span class="weight-diff weight-diff-stable">±0</span>';
          if (morningItem.typeDiff !== null) {
            const diff = morningItem.typeDiff;
            const sign = diff > 0 ? '+' : '';
            const diffClass = diff > 0 ? 'weight-diff-up' : diff < 0 ? 'weight-diff-down' : 'weight-diff-stable';
            diffStr = `<span class="weight-diff ${diffClass}">${sign}${diff.toFixed(1)}</span>`;
          } else {
            diffStr = '<span class="weight-diff weight-diff-stable">--</span>';
          }
          morningWeightHTML = `
            <div class="weight-cell-container">
              <span class="weight-num">${morningItem.weight.toFixed(1)}</span>
              ${diffStr}
            </div>
          `;
        }

        // 夜の体重・差分HTML
        let nightWeightHTML = '<div class="weight-cell-container"><span class="weight-empty-placeholder">--.-</span><span class="weight-empty-placeholder">--</span></div>';
        if (nightItem && nightItem.weight !== null) {
          let diffStr = '<span class="weight-diff weight-diff-stable">±0</span>';
          if (nightItem.typeDiff !== null) {
            const diff = nightItem.typeDiff;
            const sign = diff > 0 ? '+' : '';
            const diffClass = diff > 0 ? 'weight-diff-up' : diff < 0 ? 'weight-diff-down' : 'weight-diff-stable';
            diffStr = `<span class="weight-diff ${diffClass}">${sign}${diff.toFixed(1)}</span>`;
          } else {
            diffStr = '<span class="weight-diff weight-diff-stable">--</span>';
          }
          nightWeightHTML = `
            <div class="weight-cell-container">
              <span class="weight-num">${nightItem.weight.toFixed(1)}</span>
              ${diffStr}
            </div>
          `;
        }

        // 基礎代謝の決定 (夜データ優先、無ければ朝データ)
        let bmrVal = '----';
        if (nightItem && nightItem.bmr !== null) {
          bmrVal = nightItem.bmr;
        } else if (morningItem && morningItem.bmr !== null) {
          bmrVal = morningItem.bmr;
        }

        const dateDisp = dateKey.replace(/-/g, '/');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-date-only clickable-cell">
            <span class="date-text">${dateDisp}</span>
          </td>
          <td class="td-weight morning-cell clickable-cell" data-has-data="${!!morningItem}">${morningWeightHTML}</td>
          <td class="td-weight night-cell clickable-cell" data-has-data="${!!nightItem}">${nightWeightHTML}</td>
          <td class="td-bmr-only clickable-cell"><span class="bmr-num">${bmrVal}</span></td>
        `;

        // 各セルへの個別クリックイベントの適用 (朝・夜を個別に編集できるようにする)
        const morningCell = tr.querySelector('.morning-cell');
        morningCell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (morningItem) {
            openWeightDetailModal(morningItem);
          }
        });

        const nightCell = tr.querySelector('.night-cell');
        nightCell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (nightItem) {
            openWeightDetailModal(nightItem);
          }
        });

        // 日付・基礎代謝セルのクリック時のフォールバック
        const dateCell = tr.querySelector('.td-date-only');
        const bmrCell = tr.querySelector('.td-bmr-only');
        const openFallbackModal = () => {
          if (nightItem) {
            openWeightDetailModal(nightItem);
          } else if (morningItem) {
            openWeightDetailModal(morningItem);
          }
        };
        dateCell.addEventListener('click', openFallbackModal);
        bmrCell.addEventListener('click', openFallbackModal);

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
    weightModalTypeSelect.value = item.measurementType || 'morning';

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

    // 前回との比較比の計算
    let prevRecord = null;
    try {
      const response = await fetch('/api/body-composition');
      if (response.ok) {
        const weightHistory = await response.json();
        // 日付順 (新しい順) にソート
        const sortedHistory = [...weightHistory].sort((a, b) => {
          const dateA = jstDateKey(a.date);
          const dateB = jstDateKey(b.date);
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          const priority = { night: 3, morning: 2, other: 1 };
          return (priority[b.measurementType] || 0) - (priority[a.measurementType] || 0);
        });
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

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '体組成データを更新しています...';
    loadingSubTextEl.textContent = '修正された測定記録を保存中';
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

  // モーダル内の「削除」ボタンの処理
  btnDeleteWeightModal.addEventListener('click', async () => {
    if (!currentEditingWeightId) return;
    if (!confirm('この測定データを削除しますか？')) return;

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '体組成データを削除しています...';
    loadingSubTextEl.textContent = 'データをGoogleドライブから消去中';
    loadingOverlay.style.display = 'flex';

    try {
      const delRes = await fetch(`/api/body-composition/${currentEditingWeightId}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error('削除に失敗しました。');
      
      weightDetailModal.style.display = 'none';
      await loadWeightHistory();
      await updateDailyWeightSummary();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      loadingOverlay.style.display = 'none';
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

  // ==========================================================================
  // 総括タブ - AI分析ロジック
  // ==========================================================================
  const summaryDateInput = document.getElementById('summary-date-input');
  const summaryCommentInput = document.getElementById('summary-comment-input');
  const btnAnalyzeSummary = document.getElementById('btn-analyze-summary');
  const summaryResultContainer = document.getElementById('summary-result-container');
  const summaryResultText = document.getElementById('summary-result-text');
  const summaryResultDate = document.getElementById('summary-result-date');
  const summaryLoading = document.getElementById('summary-loading');
  const summaryHistoryList = document.getElementById('summary-history-list');

  const jstDateKey = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  // 総括タブ表示時に今日の日付をセット
  const initSummaryDate = () => {
    const t = new Date();
    summaryDateInput.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  };
  initSummaryDate();

  const tabAnalyze = document.querySelector('[data-tab="tab-analyze"]');
  const tabSummary = document.querySelector('[data-tab="tab-summary"]');
  if (tabAnalyze && tabSummary && tabAnalyze.nextElementSibling !== tabSummary) {
    tabAnalyze.insertAdjacentElement('afterend', tabSummary);
  }
  const navLabelMap = {
    'tab-analyze': '解析',
    'tab-summary': '総括',
    'tab-history': '履歴',
    'tab-weight': '体重',
    'tab-stats': '統計',
    'tab-presets': '定型',
  };
  navItems.forEach(item => {
    const tabId = item.getAttribute('data-tab');
    const label = item.querySelector('.nav-label');
    if (label && navLabelMap[tabId]) label.textContent = navLabelMap[tabId];
  });

  // タブ切り替え時にも日付を初期化
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.getAttribute('data-tab') === 'tab-summary') {
        if (!summaryDateInput.value) initSummaryDate();
      }
    });
  });

  // AI分析ボタン
  btnAnalyzeSummary.addEventListener('click', async () => {
    const date = summaryDateInput.value;
    if (!date) {
      alert('分析する日付を指定してください。');
      return;
    }
    const comment = summaryCommentInput.value.trim();

    // ローディング表示
    btnAnalyzeSummary.disabled = true;
    summaryResultContainer.style.display = 'none';
    summaryLoading.style.display = 'block';

    try {
      const res = await fetch('/api/analyze-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, comment })
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = res.status === 429
          ? 'APIの利用制限に達しました。\n少し時間をおいてから再度お試しください。'
          : (data.error || '分析に失敗しました。');
        throw new Error(msg);
      }

      // 結果表示
      const dateObj = new Date(date + 'T00:00:00');
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      summaryResultDate.textContent = `${yyyy}/${mm}/${dd} の分析結果`;
      summaryResultText.textContent = data.analysis;
      summaryResultContainer.style.display = 'block';

    } catch (err) {
      console.error('Summary analysis error:', err);
      alert('AI分析中にエラーが発生しました: ' + err.message);
    } finally {
      summaryLoading.style.display = 'none';
      btnAnalyzeSummary.disabled = false;
    }
  });

  const renderSummaryHistoryRecord = (record) => {
    const dateObj = new Date(`${record.date}T00:00:00`);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateLabel = `${yyyy}/${mm}/${dd}`;
    const analysisPreview = (record.analysis || '').trim().slice(0, 120) || '分析結果はありません。';
    const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString('ja-JP') : '';

    const item = document.createElement('div');
    item.className = 'summary-history-card';
    item.innerHTML = `
      <div class="summary-history-card-top">
        <div>
          <div class="summary-history-date">${dateLabel}</div>
          <div class="summary-history-meta">
            ${record.mealCount ?? 0} 食 / ${Number(record.totalCalories || 0)} kcal${record.hasBodyComp ? ' / 体組成あり' : ''}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-danger summary-history-delete">削除</button>
      </div>
      <div class="summary-history-preview">${analysisPreview}${(record.analysis || '').length > 120 ? '…' : ''}</div>
      <div class="summary-history-created">${createdAt}</div>
    `;

    item.addEventListener('click', () => {
      summaryResultDate.textContent = `${dateLabel} の分析結果`;
      summaryResultText.textContent = record.analysis || '';
      summaryResultContainer.style.display = 'block';
      summaryResultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const deleteBtn = item.querySelector('.summary-history-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('この分析履歴を削除しますか？')) return;
      try {
        const res = await fetch(`/api/summary-history/${record.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('削除に失敗しました');
        await loadSummaryHistory();
        if (summaryResultText.textContent === record.analysis) {
          summaryResultContainer.style.display = 'none';
        }
      } catch (err) {
        console.error('Failed to delete summary history:', err);
        alert(err.message);
      }
    });

    return item;
  };

  async function loadSummaryHistory() {
    if (!summaryHistoryList) return;
    try {
      const res = await fetch('/api/summary-history');
      if (!res.ok) throw new Error('履歴の取得に失敗しました');
      const history = await res.json();

      if (!history.length) {
        summaryHistoryList.innerHTML = `
          <div class="summary-history-empty">
            まだ分析履歴がありません。AI邱乗峡を実行すると、ここに保存されます。
          </div>
        `;
        return;
      }

      summaryHistoryList.innerHTML = '';
      history.forEach(record => {
        summaryHistoryList.appendChild(renderSummaryHistoryRecord(record));
      });
    } catch (err) {
      console.error('Failed to load summary history:', err);
      summaryHistoryList.innerHTML = `<p class="error-text">分析履歴の読み込みに失敗しました。</p>`;
    }
  }

  loadWeightHistory();
  updateDailyWeightSummary();
  loadPresets();
  loadSummaryHistory();
});
