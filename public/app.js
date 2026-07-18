document.addEventListener('DOMContentLoaded', () => {
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

  const formatDisplayDate = (dateLike) => {
    const dateKey = jstDateKey(dateLike);
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const [, year, month, day] = match;
    const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdayLabels[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
    return `${year}/${month}/${day}(${weekday})`;
  };

  const formatDateTimeDisplay = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date).replace(/\s+/g, ' ');
  };

  const formatJstDateKeyFromDate = (date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const shiftJstDateKey = (dateKey, deltaDays) => {
    const match = typeof dateKey === 'string'
      ? dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;
    if (!match) return '';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    date.setUTCDate(date.getUTCDate() + deltaDays);
    return formatJstDateKeyFromDate(date);
  };

  const formatOverviewWeightLabel = (dateLike, measurementType) => {
    const dateKey = jstDateKey(dateLike);
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const month = String(Number(match[2]));
    const day = String(Number(match[3]));
    return `${month}/${day}`;
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Loading Elements
  const loadingOverlay = document.getElementById('loading-overlay');

  // History & Stats Elements
  const historyList = document.getElementById('history-list');
  const historyDayDetail = document.getElementById('history-day-detail');
  const historyDayDetailHeader = document.getElementById('history-day-detail-header');
  const historyDayDetailMeals = document.getElementById('history-day-detail-meals');
  const btnHistoryBack = document.getElementById('btn-history-back');
  const btnDeleteHistoryModal = document.getElementById('btn-delete-history-modal');
  btnHistoryBack.addEventListener('click', () => {
    historyDayDetail.hidden = true;
    historyDayDetailMeals.replaceChildren();
    historyList.style.display = '';
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'instant' });
  });
  const statsTotalMeals = document.getElementById('stats-total-meals');
  const statsAvgCalories = document.getElementById('stats-avg-calories');

  // History Detail Modal Elements
  const historyDetailModal = document.getElementById('history-detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveModal = document.getElementById('btn-save-modal');
  const btnReanalyzeModal = document.getElementById('btn-reanalyze-modal');
  const btnPresetModal = document.getElementById('btn-preset-modal');
  const mealAnalysisModal = document.getElementById('meal-analysis-modal');
  const btnCloseMealAnalysisModal = document.getElementById('btn-close-meal-analysis-modal');
  
  // Presets Elements
  const presetSearchInput = document.getElementById('preset-search-input');
  const presetSortSelect = document.getElementById('preset-sort-select');
  const presetViewChips = document.querySelectorAll('.preset-view-chip');
  const presetsList = document.getElementById('presets-list');
  const formPresetsManual = document.getElementById('form-presets-manual');
  const presetsManualToggle = document.getElementById('presets-manual-toggle');
  const presetsManualContent = document.getElementById('presets-manual-content');
  
  // Modal Edit Inputs
  const modalDateInput = document.getElementById('modal-date-input');
  const modalTimeInput = document.getElementById('modal-time-input');
  const modalTypeSelect = document.getElementById('modal-type-select');
  const modalTextInput = document.getElementById('modal-text-input');
  const modalCaloriesInput = document.getElementById('modal-calories-input');
  const modalProteinInput = document.getElementById('modal-protein-input');
  const modalFatInput = document.getElementById('modal-fat-input');
  const modalCarbsInput = document.getElementById('modal-carbs-input');

  // Chart instances
  let caloriesChart = null;
  let pfcChart = null;
  let weightTrendChart = null;
  let bmiTrendChart = null;
  const OVERVIEW_WEIGHT_RANGE_KEY = 'physilog_overview_weight_range';
  const OVERVIEW_WEIGHT_RANGE_CONFIG = {
    week: { days: 7, maxTicksLimit: 7, pointRadius: 4, pointHoverRadius: 6 },
    month: { days: 30, maxTicksLimit: 8, pointRadius: 3.5, pointHoverRadius: 5.5 },
    year: { days: 365, maxTicksLimit: 12, pointRadius: 2.5, pointHoverRadius: 4.5 }
  };
  let overviewWeightRange = localStorage.getItem(OVERVIEW_WEIGHT_RANGE_KEY) || 'month';
  if (!OVERVIEW_WEIGHT_RANGE_CONFIG[overviewWeightRange]) {
    overviewWeightRange = 'month';
  }


  let loadedPresets = [];
  let aiConsultationRecords = [];
  let currentPresetEditTarget = null;
  let presetViewMode = localStorage.getItem('preset_view_mode') || 'recent';
  const PRESET_FAVORITE_KEY = 'physilog_preset_favorites';
  const PRESET_USAGE_KEY = 'physilog_preset_usage';
  const PRESET_LAST_USED_KEY = 'physilog_preset_last_used';
  const PRESET_EXPANDED_KEY = 'physilog_preset_expanded_cards';
  
  // Current editing history ID (for Modal save & reanalyze)
  let currentEditingHistoryId = null;
  let activeDetailMeal = null; // 現在詳細モーダルに表示されている食事レコードを保持
  let currentAiConsultation = null;

  const formatDetailNutritionValue = (value, decimals) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '';
    return decimals === 0 ? String(Math.round(numericValue)) : numericValue.toFixed(decimals);
  };

  const toNutritionNumber = (value, fallback = 0) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const parseDetailNutritionValue = (value, decimals) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return null;
    return decimals === 0 ? Math.round(numericValue) : Math.round(numericValue * 10) / 10;
  };

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
  const mealDropZone = document.getElementById('meal-drop-zone');
  const mealCameraInput = document.getElementById('meal-camera-input');
  const mealGalleryInput = document.getElementById('meal-gallery-input');
  const btnMealCameraTrigger = document.getElementById('btn-meal-camera-trigger');
  const btnMealGalleryTrigger = document.getElementById('btn-meal-gallery-trigger');
  const mealPreviewContainer = document.getElementById('meal-preview-container');
  const mealImagePreview = document.getElementById('meal-image-preview');
  const btnRemoveMealImage = document.getElementById('btn-remove-meal-image');
  const mealTextInput = document.getElementById('meal-text-input');
  const mealDateInput = document.getElementById('meal-date-input');
  const mealTypeChips = document.querySelectorAll('#meal-type-chips .chip');
  const btnAnalyzeMeal = document.getElementById('btn-analyze');
  const btnOpenMealEntry = document.getElementById('btn-open-meal-entry');

  const btnSaveWeight = document.getElementById('btn-save-weight');
  const weightHistoryTbody = document.getElementById('weight-history-tbody');
  const profileHeightInput = document.getElementById('profile-height-input');
  const profileGenderSelect = document.getElementById('profile-gender-select');
  const profileActivitySelect = document.getElementById('profile-activity-select');
  const profileActivityNotesInput = document.getElementById('profile-activity-notes-input');
  const profileBirthDateInput = document.getElementById('profile-birth-date-input');
  const profileAgeOutput = document.getElementById('profile-age-output');
  const profileTargetWeightInput = document.getElementById('profile-target-weight-input');
  const profileTargetDateInput = document.getElementById('profile-target-date-input');

  // 体組成詳細モーダルの要素
  const weightDetailModal = document.getElementById('weight-detail-modal');
  const btnCloseWeightModal = document.getElementById('btn-close-weight-modal');
  const weightModalDateInput = document.getElementById('weight-modal-date-input');
  const weightModalTypeSelect = document.getElementById('weight-modal-type-select');
  const btnDeleteWeightModal = document.getElementById('btn-delete-weight-modal');
  const weightEntryModal = document.getElementById('weight-entry-modal');
  const btnOpenWeightEntry = document.getElementById('btn-open-weight-entry');
  const btnCloseWeightEntryModal = document.getElementById('btn-close-weight-entry-modal');
  // 解析タブのサマリー要素
  const dailyWeightSummaryBar = document.getElementById('daily-weight-box');
  const summaryWeightVal = document.getElementById('summary-weight-val');
  const dailyBmrCalories = document.getElementById('daily-bmr-calories');
  const overviewTdeeCalories = document.getElementById('overview-tdee-calories');
  const overviewWeightRangeButtons = document.querySelectorAll('.overview-chart-range-btn');
  const overviewAiQuestion = document.getElementById('overview-ai-question');
  const btnOverviewAiConsultation = document.getElementById('btn-overview-ai-consultation');
  const dailyTargetProtein = document.getElementById('daily-target-protein');
  const dailyTargetFat = document.getElementById('daily-target-fat');
  const dailyTargetCarbs = document.getElementById('daily-target-carbs');
  const summaryWeightGoalDiff = document.getElementById('summary-weight-goal-diff');
  const summaryWeightGoalDays = document.getElementById('summary-weight-goal-days');
  const aiConsultationHistoryBody = document.getElementById('ai-consultation-history-body');
  const aiConsultationHistoryEmpty = document.getElementById('ai-consultation-history-empty');
  const aiConsultationModal = document.getElementById('ai-consultation-modal');
  const btnCloseAiConsultationModal = document.getElementById('btn-close-ai-consultation-modal');
  const aiConsultationModalTitle = document.getElementById('ai-consultation-modal-title');
  const aiConsultationModalMeta = document.getElementById('ai-consultation-modal-meta');
  const aiConsultationModalQuestion = document.getElementById('ai-consultation-modal-question');
  const aiConsultationModalAnswer = document.getElementById('ai-consultation-modal-answer');
  const btnDeleteAiConsultationModal = document.getElementById('btn-delete-ai-consultation-modal');

  // Preset Edit Modal Elements
  const presetEditModal = document.getElementById('preset-edit-modal');
  const btnClosePresetEditModal = document.getElementById('btn-close-preset-edit-modal');
  const btnCancelPresetEdit = document.getElementById('btn-cancel-preset-edit');
  const btnSavePresetEdit = document.getElementById('btn-save-preset-edit');
  const btnDeletePresetEdit = document.getElementById('btn-delete-preset-edit');
  const presetEditForm = document.getElementById('preset-edit-form');
  const presetEditModalTitle = document.getElementById('preset-edit-modal-title');
  const presetEditModalSubtitle = document.getElementById('preset-edit-modal-subtitle');
  const presetEditNameInput = document.getElementById('preset-edit-name');
  const presetEditDropZone = document.getElementById('preset-edit-drop-zone');
  const presetEditCameraInput = document.getElementById('preset-edit-camera-input');
  const presetEditGalleryInput = document.getElementById('preset-edit-gallery-input');
  const btnPresetEditCameraTrigger = document.getElementById('btn-preset-edit-camera-trigger');
  const btnPresetEditGalleryTrigger = document.getElementById('btn-preset-edit-gallery-trigger');
  const presetEditPreviewContainer = document.getElementById('preset-edit-preview-container');
  const presetEditPhotoPreviewImage = document.getElementById('preset-edit-photo-preview-image');
  const btnRemovePresetEditImage = document.getElementById('btn-remove-preset-edit-image');
  const presetEditUploadBadge = document.getElementById('preset-edit-upload-badge');
  const btnClearPresetEditBadge = document.getElementById('btn-clear-preset-edit-badge');
  const presetEditBaseAmountInput = document.getElementById('preset-edit-base-amount');
  const presetEditServingUnitSelect = document.getElementById('preset-edit-serving-unit');
  const presetEditCaloriesInput = document.getElementById('preset-edit-calories');
  const presetEditProteinInput = document.getElementById('preset-edit-protein');
  const presetEditFatInput = document.getElementById('preset-edit-fat');
  const presetEditCarbsInput = document.getElementById('preset-edit-carbs');
  
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
  let selectedMealFile = null;
  let selectedPresetEditFile = null;
  let presetEditBaseImageUrl = '';
  let presetEditImageMarkedForRemoval = false;
  let activeMealType = 'snack';

  const updateModalBodyLock = () => {
    const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some((modal) => {
      return getComputedStyle(modal).display !== 'none';
    });
    document.body.classList.toggle('modal-open', anyModalOpen);
  };

  const showModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    updateModalBodyLock();
  };

  const hideModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    updateModalBodyLock();
  };

  const isCompactPresetLayout = () => window.matchMedia('(max-width: 600px)').matches;

  const getPresetEditDisplayValue = (value, decimals) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '';
    return decimals === 0 ? String(Math.round(numericValue)) : roundTo1(numericValue).toFixed(decimals);
  };

  const getPresetRegistrationKey = (preset, fallbackIndex = 0) => {
    const createdAt = Date.parse(preset?.createdAt || '');
    if (Number.isFinite(createdAt)) return createdAt;
    return Number.isFinite(fallbackIndex) ? fallbackIndex : 0;
  };

  const getPresetImageUrl = (imageSource, imageId) => {
    if (!imageSource || !imageId) return '';
    return `/api/image?source=${encodeURIComponent(imageSource)}&id=${encodeURIComponent(imageId)}`;
  };

  const updatePresetEditPhotoPreview = (imageUrl = '') => {
    if (!presetEditPreviewContainer || !presetEditPhotoPreviewImage) return;
    if (imageUrl) {
      presetEditPhotoPreviewImage.src = imageUrl;
      presetEditPreviewContainer.style.display = 'flex';
    } else {
      presetEditPhotoPreviewImage.removeAttribute('src');
      presetEditPreviewContainer.style.display = 'none';
    }
  };

  const syncPresetEditPhotoPreview = () => {
    if (presetEditImageMarkedForRemoval) {
      updatePresetEditPhotoPreview('');
      return;
    }
    if (selectedPresetEditFile) {
      return;
    }
    updatePresetEditPhotoPreview(presetEditBaseImageUrl);
  };

  if (presetEditPhotoPreviewImage) {
    presetEditPhotoPreviewImage.addEventListener('error', () => {
      presetEditPhotoPreviewImage.removeAttribute('src');
      if (presetEditPreviewContainer) presetEditPreviewContainer.style.display = 'none';
    });
  }

  const handlePresetEditFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    selectedPresetEditFile = file;
    presetEditImageMarkedForRemoval = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        updatePresetEditPhotoPreview(String(e.target.result));
      }
      if (presetEditUploadBadge) presetEditUploadBadge.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
  };

  const clearPresetEditSelectedPhoto = ({ removeExisting = false } = {}) => {
    selectedPresetEditFile = null;
    presetEditImageMarkedForRemoval = removeExisting;
    if (presetEditCameraInput) presetEditCameraInput.value = '';
    if (presetEditGalleryInput) presetEditGalleryInput.value = '';
    if (presetEditUploadBadge) presetEditUploadBadge.style.display = 'none';
    if (presetEditImageMarkedForRemoval) {
      updatePresetEditPhotoPreview('');
    } else {
      syncPresetEditPhotoPreview();
    }
  };

  const openPresetEditModal = (preset) => {
    if (!presetEditModal || !preset) return;
    currentPresetEditTarget = preset;
    selectedPresetEditFile = null;
    presetEditImageMarkedForRemoval = false;
    presetEditBaseImageUrl = getPresetImageUrl(preset.imageSource, preset.imageId);
    if (presetEditUploadBadge) presetEditUploadBadge.style.display = 'none';
    if (presetEditCameraInput) presetEditCameraInput.value = '';
    if (presetEditGalleryInput) presetEditGalleryInput.value = '';
    if (presetEditModalTitle) presetEditModalTitle.textContent = `${preset.name || '定番'} を編集`;
    if (presetEditModalSubtitle) {
      const category = preset.category || 'その他';
      const usageText = preset.lastUsedAt ? `最近使用 ${formatDateTimeDisplay(preset.lastUsedAt) || '記録済み'}` : '最近使用 なし';
      presetEditModalSubtitle.textContent = `${category} / ${usageText}`;
    }
    if (presetEditNameInput) presetEditNameInput.value = preset.name || '';
    if (presetEditBaseAmountInput) presetEditBaseAmountInput.value = getPresetEditDisplayValue(preset.baseAmount ?? 1, 1);
    if (presetEditServingUnitSelect) presetEditServingUnitSelect.value = preset.servingUnit === 'g' ? 'g' : '個';
    if (presetEditCaloriesInput) presetEditCaloriesInput.value = getPresetEditDisplayValue(preset.calories, 0);
    if (presetEditProteinInput) presetEditProteinInput.value = getPresetEditDisplayValue(preset.protein, 1);
    if (presetEditFatInput) presetEditFatInput.value = getPresetEditDisplayValue(preset.fat, 1);
    if (presetEditCarbsInput) presetEditCarbsInput.value = getPresetEditDisplayValue(preset.carbohydrates, 1);
    syncPresetEditPhotoPreview();
    showModal(presetEditModal);
    presetEditNameInput?.focus();
    presetEditNameInput?.select();
  };

  const closePresetEditModal = () => {
    currentPresetEditTarget = null;
    selectedPresetEditFile = null;
    presetEditBaseImageUrl = '';
    presetEditImageMarkedForRemoval = false;
    if (presetEditForm) presetEditForm.reset();
    if (presetEditUploadBadge) presetEditUploadBadge.style.display = 'none';
    syncPresetEditPhotoPreview();
    hideModal(presetEditModal);
  };

  const savePresetEdit = async () => {
    if (!currentPresetEditTarget?.id || !presetEditModal) return;
    const id = currentPresetEditTarget.id;
    const name = presetEditNameInput?.value.trim() || '';
    const baseAmount = Number(presetEditBaseAmountInput?.value);
    const servingUnit = presetEditServingUnitSelect?.value === 'g' ? 'g' : '個';
    const calories = Number(presetEditCaloriesInput?.value);
    const protein = Number(presetEditProteinInput?.value);
    const fat = Number(presetEditFatInput?.value);
    const carbohydrates = Number(presetEditCarbsInput?.value);

    if (!name) {
      alert('メニュー名を入力してください。');
      return;
    }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      alert('基準量を正しく入力してください。');
      return;
    }
    if ([calories, protein, fat, carbohydrates].some(value => !Number.isFinite(value) || value < 0)) {
      alert('栄養値を正しく入力してください。');
      return;
    }

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '定番を更新しています...';
    loadingSubTextEl.textContent = '編集内容を保存中';
    loadingOverlay.style.display = 'flex';

    try {
      const shouldUploadImage = !!selectedPresetEditFile || presetEditImageMarkedForRemoval;
      const requestBody = shouldUploadImage ? new FormData() : JSON.stringify({
        name,
        baseAmount: roundTo1(baseAmount),
        servingUnit,
        calories: Math.round(calories),
        protein: roundTo1(protein),
        fat: roundTo1(fat),
        carbohydrates: roundTo1(carbohydrates),
      });
      let requestInit;
      if (shouldUploadImage) {
        requestBody.append('name', name);
        requestBody.append('baseAmount', String(roundTo1(baseAmount)));
        requestBody.append('servingUnit', servingUnit);
        requestBody.append('calories', String(Math.round(calories)));
        requestBody.append('protein', String(roundTo1(protein)));
        requestBody.append('fat', String(roundTo1(fat)));
        requestBody.append('carbohydrates', String(roundTo1(carbohydrates)));
        if (selectedPresetEditFile) {
          requestBody.append('image', selectedPresetEditFile);
        } else if (presetEditImageMarkedForRemoval) {
          requestBody.append('clearImage', '1');
        }
        requestInit = {
          method: 'PATCH',
          body: requestBody,
        };
      } else {
        requestInit = {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        };
      }

      const response = await fetch(`/api/presets/${id}`, requestInit);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : {};
      if (!response.ok) {
        throw new Error(payload.error || '定番メニューの更新に失敗しました。');
      }
      closePresetEditModal();
      await loadPresets();
    } catch (err) {
      console.error(err);
      alert('定番メニューの更新に失敗しました。\n詳細: ' + (err.message || ''));
    } finally {
      loadingOverlay.style.display = 'none';
    }
  };

  const sortAiConsultations = (records) => {
    return [...records].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  };

  const openAiConsultationModal = (record) => {
    if (!record || !aiConsultationModal) return;
    currentAiConsultation = record;
    if (aiConsultationModalTitle) aiConsultationModalTitle.textContent = 'AI相談詳細';
    if (aiConsultationModalMeta) aiConsultationModalMeta.textContent = formatDateTimeDisplay(record.createdAt);
    if (aiConsultationModalQuestion) aiConsultationModalQuestion.textContent = record.question || '---';
    if (aiConsultationModalAnswer) aiConsultationModalAnswer.textContent = record.answer || '---';
    if (btnDeleteAiConsultationModal) btnDeleteAiConsultationModal.disabled = false;
    showModal(aiConsultationModal);
  };

  const renderAiConsultationHistory = (records) => {
    aiConsultationRecords = sortAiConsultations(Array.isArray(records) ? records : []);
    if (!aiConsultationHistoryBody || !aiConsultationHistoryEmpty) return;

    aiConsultationHistoryBody.replaceChildren();
    if (aiConsultationRecords.length === 0) {
      aiConsultationHistoryEmpty.textContent = 'まだ質問履歴がありません。';
      aiConsultationHistoryEmpty.hidden = false;
      return;
    }

    aiConsultationHistoryEmpty.hidden = true;
    const fragment = document.createDocumentFragment();
    aiConsultationRecords.forEach((record) => {
      const row = document.createElement('tr');
      row.className = 'ai-consultation-history-row';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.dataset.id = record.id || '';

      const dateCell = document.createElement('td');
      dateCell.className = 'ai-consultation-history-date';
      dateCell.textContent = formatDateTimeDisplay(record.createdAt);

      const questionCell = document.createElement('td');
      questionCell.className = 'ai-consultation-history-question';
      questionCell.textContent = record.question || '';

      const openRecord = () => openAiConsultationModal(record);
      row.addEventListener('click', openRecord);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openRecord();
        }
      });

      row.append(dateCell, questionCell);
      fragment.appendChild(row);
    });
    aiConsultationHistoryBody.appendChild(fragment);
  };

  async function loadAiConsultations() {
    if (!aiConsultationHistoryBody || !aiConsultationHistoryEmpty) return;
    try {
      const response = await fetch('/api/ai-consultations');
      if (!response.ok) throw new Error('相談履歴を取得できませんでした。');
      const records = await response.json();
      renderAiConsultationHistory(records);
    } catch (err) {
      console.error('Failed to load AI consultations:', err);
      aiConsultationRecords = [];
      aiConsultationHistoryBody.replaceChildren();
      aiConsultationHistoryEmpty.hidden = false;
      aiConsultationHistoryEmpty.textContent = '質問履歴の読み込みに失敗しました。';
    }
  }

  // ==========================================================================
  // Selector Initializer
  // ==========================================================================
  const initializeSelectors = () => {
    // 日付 (YYYY-MM-DD 形式)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    weightDateInput.value = `${yyyy}-${mm}-${dd}`;

    // 体組成測定区分の初期値自動設定 (朝5時〜夕方5時までは朝、それ以外は夜)
    const hour = today.getHours();
    if (hour >= 5 && hour < 17) {
      setWeightTypeActive('morning');
    } else {
      setWeightTypeActive('night');
    }
  };

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

  mealTypeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      setMealTypeActive(chip.getAttribute('data-type'));
    });
  });

  if (btnCloseMealAnalysisModal) {
    btnCloseMealAnalysisModal.addEventListener('click', () => {
      resetMealEntryForm();
      hideModal(mealAnalysisModal);
    });
  }

  if (mealAnalysisModal) {
    mealAnalysisModal.addEventListener('click', (event) => {
      if (event.target === mealAnalysisModal) {
        resetMealEntryForm();
        hideModal(mealAnalysisModal);
      }
    });
  }

  if (btnOpenMealEntry) {
    btnOpenMealEntry.addEventListener('click', () => {
      resetMealEntryForm();
      showModal(mealAnalysisModal);
    });
  }

  if (btnOpenWeightEntry) {
    btnOpenWeightEntry.addEventListener('click', () => {
      showModal(weightEntryModal);
    });
  }

  if (btnCloseWeightEntryModal) {
    btnCloseWeightEntryModal.addEventListener('click', () => {
      hideModal(weightEntryModal);
    });
  }

  if (weightEntryModal) {
    weightEntryModal.addEventListener('click', (event) => {
      if (event.target === weightEntryModal) {
        hideModal(weightEntryModal);
      }
    });
  }

  if (btnCloseAiConsultationModal) {
    btnCloseAiConsultationModal.addEventListener('click', () => {
      hideModal(aiConsultationModal);
    });
  }

  if (aiConsultationModal) {
    aiConsultationModal.addEventListener('click', (event) => {
      if (event.target === aiConsultationModal) {
        hideModal(aiConsultationModal);
      }
    });
  }

  if (btnClosePresetEditModal) {
    btnClosePresetEditModal.addEventListener('click', closePresetEditModal);
  }

  if (btnCancelPresetEdit) {
    btnCancelPresetEdit.addEventListener('click', closePresetEditModal);
  }

  if (presetEditModal) {
    presetEditModal.addEventListener('click', (event) => {
      if (event.target === presetEditModal) {
        closePresetEditModal();
      }
    });
  }

  if (presetEditForm) {
    presetEditForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await savePresetEdit();
    });
  }

  if (btnSavePresetEdit) {
    btnSavePresetEdit.addEventListener('click', async () => {
      await savePresetEdit();
    });
  }

  if (btnDeletePresetEdit) {
    btnDeletePresetEdit.addEventListener('click', async () => {
      if (!currentPresetEditTarget) return;
      await deletePreset(currentPresetEditTarget);
      closePresetEditModal();
    });
  }

  if (btnPresetEditCameraTrigger && presetEditCameraInput) {
    btnPresetEditCameraTrigger.addEventListener('click', () => presetEditCameraInput.click());
  }

  if (btnPresetEditGalleryTrigger && presetEditGalleryInput) {
    btnPresetEditGalleryTrigger.addEventListener('click', () => presetEditGalleryInput.click());
  }

  if (presetEditCameraInput) {
    presetEditCameraInput.addEventListener('change', (event) => handlePresetEditFileSelect(event.target.files[0]));
  }

  if (presetEditGalleryInput) {
    presetEditGalleryInput.addEventListener('change', (event) => handlePresetEditFileSelect(event.target.files[0]));
  }

  if (btnRemovePresetEditImage) {
    btnRemovePresetEditImage.addEventListener('click', (event) => {
      event.stopPropagation();
      clearPresetEditSelectedPhoto({ removeExisting: true });
    });
  }

  if (btnClearPresetEditBadge) {
    btnClearPresetEditBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      clearPresetEditSelectedPhoto({ removeExisting: false });
    });
  }

  if (presetEditDropZone) {
    presetEditDropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      presetEditDropZone.classList.add('dragover');
    });

    presetEditDropZone.addEventListener('dragleave', () => {
      presetEditDropZone.classList.remove('dragover');
    });

    presetEditDropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      presetEditDropZone.classList.remove('dragover');
      handlePresetEditFileSelect(event.dataTransfer.files[0]);
    });
  }

  if (btnDeleteAiConsultationModal) {
    btnDeleteAiConsultationModal.addEventListener('click', async () => {
      if (!currentAiConsultation?.id) return;
      if (!confirm('この質問履歴を削除しますか？')) return;
      btnDeleteAiConsultationModal.disabled = true;
      try {
        const response = await fetch(`/api/ai-consultations/${currentAiConsultation.id}`, {
          method: 'DELETE',
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : {};
        if (!response.ok) throw new Error(payload.error || '質問履歴の削除に失敗しました。');
        currentAiConsultation = null;
        hideModal(aiConsultationModal);
        await loadAiConsultations();
      } catch (err) {
        alert(err.message || '質問履歴の削除に失敗しました。');
      } finally {
        btnDeleteAiConsultationModal.disabled = false;
      }
    });
  }

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
    if (inferenceBody) inferenceBody.style.display = 'block';
    
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
    const nutrition = item.nutrition || {};
    const hasNutritionValues = Number.isFinite(Number(nutrition.calories))
      || Number.isFinite(Number(nutrition.protein))
      || Number.isFinite(Number(nutrition.fat))
      || Number.isFinite(Number(nutrition.carbohydrates));

    if (hasNutritionValues) {
      caloriesEl.textContent = formatDetailNutritionValue(nutrition.calories, 0);
      proteinEl.textContent = formatDetailNutritionValue(nutrition.protein, 1);
      fatEl.textContent = formatDetailNutritionValue(nutrition.fat, 1);
      carbsEl.textContent = formatDetailNutritionValue(nutrition.carbohydrates, 1);
      if (modalCaloriesInput) modalCaloriesInput.value = formatDetailNutritionValue(nutrition.calories, 0);
      if (modalProteinInput) modalProteinInput.value = formatDetailNutritionValue(nutrition.protein, 1);
      if (modalFatInput) modalFatInput.value = formatDetailNutritionValue(nutrition.fat, 1);
      if (modalCarbsInput) modalCarbsInput.value = formatDetailNutritionValue(nutrition.carbohydrates, 1);
    } else {
      caloriesEl.textContent = '--';
      proteinEl.textContent = '--';
      fatEl.textContent = '--';
      carbsEl.textContent = '--';
      if (modalCaloriesInput) modalCaloriesInput.value = '';
      if (modalProteinInput) modalProteinInput.value = '';
      if (modalFatInput) modalFatInput.value = '';
      if (modalCarbsInput) modalCarbsInput.value = '';
    }

    if (item.status === 'failed') {
      btnReanalyzeModal.classList.add('pulse-highlight');
      btnReanalyzeModal.innerHTML = '✨ AI解析を再実行（再計算）';
    } else {
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
    showModal(historyDetailModal);
  }

  // 初期実行
  initializeSelectors();
  initializeMealSelectors();
  validateWeightInputs();
  validateMealInputs();

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
      } else if (targetTabId === 'tab-analyze') {
        loadAiConsultations();
      } else if (targetTabId === 'tab-stats') {
        loadProfile();
      } else if (targetTabId === 'tab-overview') {
        loadStats();
      } else if (targetTabId === 'tab-presets') {
        loadPresets();
      }
    });
  });

  const roundTo1 = (value) => Math.round(Number(value) * 10) / 10;
  const roundCalories = (value) => Math.round(Number(value));

  function validateWeightInputs() {
    const hasImage = !!selectedWeightFile;
    const hasText = weightTextInput && weightTextInput.value.trim().length > 0;
    if (btnAnalyzeWeight) {
      btnAnalyzeWeight.disabled = !(hasImage || hasText);
    }
  }

  function getDefaultMealType(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 15) return 'noon';
    if (hour >= 17 && hour < 22) return 'night';
    return 'snack';
  }

  function validateMealInputs() {
    const hasImage = !!selectedMealFile;
    const hasText = mealTextInput && mealTextInput.value.trim().length > 0;
    if (btnAnalyzeMeal) {
      btnAnalyzeMeal.disabled = !(hasImage || hasText);
    }
  }

  function setMealTypeActive(type) {
    activeMealType = type;
    mealTypeChips.forEach((chip) => {
      if (chip.getAttribute('data-type') === type) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  const syncOverviewWeightRangeButtons = () => {
    overviewWeightRangeButtons.forEach((button) => {
      const isActive = button.dataset.overviewRange === overviewWeightRange;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const setOverviewWeightRange = (rangeKey) => {
    if (!OVERVIEW_WEIGHT_RANGE_CONFIG[rangeKey]) return;
    if (overviewWeightRange !== rangeKey) {
      overviewWeightRange = rangeKey;
      localStorage.setItem(OVERVIEW_WEIGHT_RANGE_KEY, rangeKey);
    }
    syncOverviewWeightRangeButtons();
    loadStats();
  };

  function initializeMealSelectors() {
    if (!mealDateInput) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    mealDateInput.value = `${yyyy}-${mm}-${dd}`;
    setMealTypeActive(getDefaultMealType(today));
  }

  overviewWeightRangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextRange = button.dataset.overviewRange;
      if (nextRange) setOverviewWeightRange(nextRange);
    });
  });

  function resetMealImage() {
    selectedMealFile = null;
    if (mealCameraInput) mealCameraInput.value = '';
    if (mealGalleryInput) mealGalleryInput.value = '';
    if (mealPreviewContainer) mealPreviewContainer.style.display = 'none';
    if (mealImagePreview) mealImagePreview.src = '';
    if (mealUploadBadge) mealUploadBadge.style.display = 'none';
    validateMealInputs();
  }

  function resetMealEntryForm() {
    resetMealImage();
    if (mealTextInput) mealTextInput.value = '';
    initializeMealSelectors();
    validateMealInputs();
  }

  const storageJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeStorageJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Failed to write local preset state:', err);
    }
  };

  const getFavoriteSet = () => new Set(storageJson(PRESET_FAVORITE_KEY, []));
  const getUsageMap = () => storageJson(PRESET_USAGE_KEY, {});
  const getLastUsedMap = () => storageJson(PRESET_LAST_USED_KEY, {});
  const getExpandedSet = () => new Set(storageJson(PRESET_EXPANDED_KEY, []));

  const togglePresetFavorite = (id) => {
    const favoriteSet = getFavoriteSet();
    if (favoriteSet.has(id)) {
      favoriteSet.delete(id);
    } else {
      favoriteSet.add(id);
    }
    writeStorageJson(PRESET_FAVORITE_KEY, Array.from(favoriteSet));
  };

  const markPresetUsed = (id) => {
    if (!id) return;
    const usageMap = getUsageMap();
    const lastUsedMap = getLastUsedMap();
    usageMap[id] = Number(usageMap[id] || 0) + 1;
    lastUsedMap[id] = Date.now();
    writeStorageJson(PRESET_USAGE_KEY, usageMap);
    writeStorageJson(PRESET_LAST_USED_KEY, lastUsedMap);
  };

  const getMealTypeLabel = (type) => {
    return {
      morning: '朝食',
      noon: '昼食',
      night: '夕食',
      snack: '間食',
    }[type] || '食事';
  };

  const getDefaultMealDateTime = () => {
    const now = new Date();
    return {
      mealDate: now.toISOString(),
      mealType: getDefaultMealType(now),
    };
  };

  const registerPresetMenu = async (preset, { requireConfirm = false, servingAmount = null } = {}) => {
    if (!preset) return;

    const baseAmount = Number.isFinite(Number(preset.baseAmount)) && Number(preset.baseAmount) > 0
      ? roundTo1(preset.baseAmount)
      : 1;
    const requestedAmount = Number(servingAmount);
    const actualServingAmount = Number.isFinite(requestedAmount) && requestedAmount > 0
      ? roundTo1(requestedAmount)
      : baseAmount;
    const servingUnit = preset.servingUnit || '個';
    const { mealDate, mealType } = getDefaultMealDateTime();
    const mealTypeLabel = getMealTypeLabel(mealType);

    if (requireConfirm) {
      const confirmed = confirm(`「${preset.name}」を${mealTypeLabel}として登録しますか？`);
      if (!confirmed) return;
    }

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '定番メニューを登録しています...';
    loadingSubTextEl.textContent = '履歴にそのまま保存中';
    loadingOverlay.style.display = 'flex';

    try {
      const formData = new FormData();
      formData.append('name', preset.name || '');
      formData.append('calories', preset.calories ?? '');
      formData.append('protein', preset.protein ?? '');
      formData.append('fat', preset.fat ?? '');
      formData.append('carbohydrates', preset.carbohydrates ?? '');
      formData.append('mealDate', mealDate);
      formData.append('mealType', mealType);
      formData.append('presetId', preset.id);
      formData.append('servingAmount', String(actualServingAmount));
      formData.append('baseServingAmount', String(baseAmount));
      formData.append('servingUnit', servingUnit);

      const response = await fetch('/api/history/preset', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : {};
      if (!response.ok) {
        throw new Error(payload.error || '定番メニューの登録に失敗しました。');
      }

      markPresetUsed(preset.id);
      await loadHistory();
      await updateDailySummary();
      await loadPresets();
      alert(`「${preset.name}」を${mealTypeLabel}として登録しました。`);
    } catch (err) {
      console.error(err);
      alert('定番メニューの登録に失敗しました。\n詳細: ' + (err.message || ''));
    } finally {
      loadingOverlay.style.display = 'none';
    }
  };

  const promptPresetServingAmount = (preset) => {
    if (!preset) return null;
    const baseAmount = Number.isFinite(Number(preset.baseAmount)) && Number(preset.baseAmount) > 0
      ? roundTo1(preset.baseAmount)
      : 1;
    const servingUnit = preset.servingUnit || '個';
    const input = window.prompt(
      `${preset.name || '定番メニュー'} の数量を入力してください。\n基準量: ${baseAmount.toFixed(1)} ${servingUnit}`,
      baseAmount.toFixed(1)
    );
    if (input === null) return null;
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('数量は0より大きい数値で入力してください。');
      return null;
    }
    return roundTo1(parsed);
  };

  const deletePreset = async (preset) => {
    if (!preset?.id) return;
    const confirmed = confirm(`「${preset.name}」を定番メニューから削除しますか？`);
    if (!confirmed) return;

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '定番メニューを削除しています...';
    loadingSubTextEl.textContent = '保存済みデータを消去中';
    loadingOverlay.style.display = 'flex';

    try {
      const response = await fetch(`/api/presets/${preset.id}`, {
        method: 'DELETE',
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : {};
      if (!response.ok) {
        throw new Error(payload.error || '定番メニューの削除に失敗しました。');
      }
      await loadPresets();
    } catch (err) {
      console.error(err);
      alert('定番メニューの削除に失敗しました。\n詳細: ' + (err.message || ''));
    } finally {
      loadingOverlay.style.display = 'none';
    }
  };

  const togglePresetExpanded = (id) => {
    if (!id) return;
    const expandedSet = getExpandedSet();
    if (expandedSet.has(id)) {
      expandedSet.delete(id);
    } else {
      expandedSet.add(id);
    }
    writeStorageJson(PRESET_EXPANDED_KEY, Array.from(expandedSet));
  };

  const inferPresetCategory = (preset) => {
    const name = `${preset?.name || ''}`.toLowerCase();
    const rules = [
      ['飲料', ['コーヒー', 'お茶', '茶', '水', 'ジュース', '牛乳', 'ヨーグルトドリンク', 'プロテインドリンク', '豆乳', 'スムージー']],
      ['間食', ['プロテイン', 'ヨーグルト', 'ナッツ', 'バナナ', 'チーズ', 'おやつ', 'ゼリー', 'バー', '間食', 'あんぱん']],
      ['汁物', ['味噌汁', 'みそ汁', 'スープ', '豚汁', 'お吸い物']],
      ['副菜', ['サラダ', '野菜', 'おひたし', 'きんぴら', '和え', '漬物', 'ブロッコリー', 'ほうれん草', 'キャベツ', '小鉢']],
      ['主菜', ['鶏', '豚', '牛', '魚', '鮭', 'サバ', '卵', '豆腐', '納豆', 'ハンバーグ', 'サラダチキン', 'ツナ', 'ささみ', '刺身']],
      ['主食', ['ご飯', 'ライス', 'パン', '麺', 'うどん', 'そば', 'パスタ', 'カレー', 'オートミール', 'シリアル', 'おにぎり']],
    ];

    for (const [category, keywords] of rules) {
      if (keywords.some(keyword => name.includes(keyword.toLowerCase()))) {
        return category;
      }
    }
    return 'その他';
  };

  const categoryOrder = ['主食', '主菜', '副菜', '汁物', '間食', '飲料', 'その他'];
  const categoryLabelMap = Object.fromEntries(categoryOrder.map(label => [label, label]));

  const formatPresetMeta = (preset) => {
    const baseAmount = Number.isFinite(Number(preset.baseAmount)) && Number(preset.baseAmount) > 0 ? roundTo1(preset.baseAmount) : 1;
    const servingUnit = preset.servingUnit || '個';
    return `${baseAmount.toFixed(1)}${servingUnit} / ${Math.round(Number(preset.calories) || 0)} kcal / P ${roundTo1(preset.protein || 0)} F ${roundTo1(preset.fat || 0)} C ${roundTo1(preset.carbohydrates || 0)}`;
  };

  const getPresetUsageCount = (id) => Number(getUsageMap()[id] || 0);
  const getPresetLastUsedAt = (id) => Number(getLastUsedMap()[id] || 0);
  const isPresetFavorite = (id) => getFavoriteSet().has(id);

  if (presetSearchInput) {
    presetSearchInput.addEventListener('input', () => {
      loadPresets();
    });
  }

  if (presetSortSelect) {
    presetSortSelect.addEventListener('change', () => {
      loadPresets();
    });
  }

  if (presetViewChips.length) {
    presetViewChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const nextView = chip.getAttribute('data-view') || 'recent';
        if (presetViewMode === nextView) return;
        presetViewMode = nextView;
        try {
          localStorage.setItem('preset_view_mode', presetViewMode);
        } catch (err) {
          console.error('Failed to persist preset view mode:', err);
        }
        loadPresets();
      });
    });
  }

  if (weightTextInput) {
    weightTextInput.addEventListener('input', validateWeightInputs);
  }

  // ==========================================================================
  // Update Daily Summary (Always Visible Card on Analyze Tab)
  // ==========================================================================
  function updateDailyCalorieProgress() {
    const progress = document.getElementById('daily-calorie-progress');
    const fill = document.getElementById('daily-calorie-progress-fill');
    const status = document.getElementById('daily-calorie-progress-status');
    const consumed = Number(document.getElementById('daily-total-calories')?.textContent) || 0;
    const target = Number(dailyBmrCalories?.textContent);

    if (!progress || !fill || !status) return;

    if (!Number.isFinite(target) || target <= 0) {
      fill.style.width = '0%';
      progress.setAttribute('aria-valuenow', '0');
      progress.setAttribute('aria-valuetext', '目標摂取カロリー未設定');
      progress.classList.remove('is-over');
      status.textContent = '目標を設定すると進捗を表示します';
      return;
    }

    const percentage = Math.round((consumed / target) * 100);
    const remaining = Math.max(0, target - consumed);
    fill.style.width = `${Math.min(percentage, 100)}%`;
    progress.setAttribute('aria-valuenow', String(Math.min(percentage, 100)));
    progress.setAttribute('aria-valuetext', `目標の${percentage}%`);
    progress.classList.toggle('is-over', consumed > target);
    status.innerHTML = consumed > target
      ? `目標の${percentage}%<br>（${consumed - target} kcal超過）`
      : `目標の${percentage}%<br>（あと${remaining} kcal）`;
  }

  function updateDailyPfcProgress() {
    const nutrients = [
      { key: 'protein', totalId: 'daily-total-protein', targetEl: dailyTargetProtein },
      { key: 'fat', totalId: 'daily-total-fat', targetEl: dailyTargetFat },
      { key: 'carbs', totalId: 'daily-total-carbs', targetEl: dailyTargetCarbs }
    ];

    nutrients.forEach(({ key, totalId, targetEl }) => {
      const progress = document.getElementById(`daily-${key}-progress`);
      const fill = progress?.querySelector('.pfc-progress-fill');
      const status = document.getElementById(`daily-${key}-progress-status`);
      const consumed = Number(document.getElementById(totalId)?.textContent) || 0;
      const target = Number(targetEl?.dataset.target);
      if (!progress || !fill || !status) return;

      if (!Number.isFinite(target) || target <= 0) {
        fill.style.width = '0%';
        progress.setAttribute('aria-valuenow', '0');
        progress.setAttribute('aria-valuetext', '目標未設定');
        progress.classList.remove('is-over');
        status.textContent = 'あと --.-g';
        return;
      }

      const percentage = Math.round((consumed / target) * 100);
      const difference = Math.abs(target - consumed).toFixed(1);
      fill.style.width = `${Math.min(percentage, 100)}%`;
      progress.setAttribute('aria-valuenow', String(Math.min(percentage, 100)));
      progress.setAttribute('aria-valuetext', `目標の${percentage}%`);
      progress.classList.toggle('is-over', consumed > target);
      status.textContent = consumed > target ? `${difference}g超過` : `あと ${difference}g`;
    });
  }

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
          totalCal += toNutritionNumber(item.nutrition?.calories);
          totalP += toNutritionNumber(item.nutrition?.protein);
          totalF += toNutritionNumber(item.nutrition?.fat);
          totalC += toNutritionNumber(item.nutrition?.carbohydrates);
        }
      });

      // DOM要素の更新
      document.getElementById('daily-total-calories').textContent = Math.round(totalCal);
      document.getElementById('daily-total-protein').textContent = Number(totalP).toFixed(1);
      document.getElementById('daily-total-fat').textContent = Number(totalF).toFixed(1);
      document.getElementById('daily-total-carbs').textContent = Number(totalC).toFixed(1);
      updateDailyCalorieProgress();
      updateDailyPfcProgress();

    } catch (err) {
      console.error('Failed to update daily summary:', err);
    }
  }

  // 起動時に今日の合計をロード
  updateDailySummary();

  btnOverviewAiConsultation.addEventListener('click', async () => {
    const question = overviewAiQuestion.value.trim();
    if (!question) {
      overviewAiQuestion.focus();
      return;
    }

    btnOverviewAiConsultation.disabled = true;
    btnOverviewAiConsultation.textContent = '回答を作成中...';

    try {
      const response = await fetch('/api/ai-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`サーバーから不正な応答を受信しました（HTTP ${response.status}）。サーバーを再起動してください。`);
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '回答を取得できませんでした。');
      await loadAiConsultations();
      openAiConsultationModal(result);
    } catch (err) {
      window.alert(err.message);
    } finally {
      btnOverviewAiConsultation.disabled = false;
      btnOverviewAiConsultation.textContent = '質問する';
    }
  });

  // ==========================================================================
  // 定番メニュー (Presets) 管理ロジック
  // ==========================================================================
  // 1. 定番データの読み込み ＆ レンダリング
  async function loadPresets() {
    try {
      const response = await fetch('/api/presets');
      const presets = await response.json();
      loadedPresets = Array.isArray(presets) ? presets : [];

      // B. 定番タブの一覧リストを更新
      if (presetsList) {
        const searchTerm = (presetSearchInput?.value || '').trim().toLowerCase();
        const sortMode = presetSortSelect?.value || 'newest';
        const favoriteSet = getFavoriteSet();
        const usageMap = getUsageMap();
        const lastUsedMap = getLastUsedMap();

        const enrichedPresets = loadedPresets.map((p, index) => ({
          ...p,
          category: inferPresetCategory(p),
          isFavorite: favoriteSet.has(p.id),
          usageCount: Number(usageMap[p.id] || 0),
          lastUsedAt: Number(lastUsedMap[p.id] || 0),
          registrationKey: getPresetRegistrationKey(p, index),
        })).filter(p => {
          if (!searchTerm) return true;
          const haystack = [
            p.name,
            p.category,
            p.calories,
            p.protein,
            p.fat,
            p.carbohydrates,
            p.baseAmount,
            p.servingUnit,
          ].join(' ').toLowerCase();
          return haystack.includes(searchTerm);
        });

        const compareBySortMode = (a, b) => {
          if (sortMode === 'name') {
            return `${a.name || ''}`.localeCompare(`${b.name || ''}`, 'ja');
          }
          if (sortMode === 'favorite') {
            if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
            if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
            return `${a.name || ''}`.localeCompare(`${b.name || ''}`, 'ja');
          }
          if (sortMode === 'recent') {
            if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
            if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
            return `${a.name || ''}`.localeCompare(`${b.name || ''}`, 'ja');
          }
          if (b.registrationKey !== a.registrationKey) return b.registrationKey - a.registrationKey;
          if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
          return `${a.name || ''}`.localeCompare(`${b.name || ''}`, 'ja');
        };

        const sortItems = (items) => items.slice().sort(compareBySortMode);
        const expandedSet = getExpandedSet();

        const renderPresetCard = (preset) => {
          const baseAmount = Number.isFinite(Number(preset.baseAmount)) && Number(preset.baseAmount) > 0 ? roundTo1(preset.baseAmount) : 1;
          const servingUnit = preset.servingUnit || '個';
          const usageText = preset.lastUsedAt
            ? formatDateTimeDisplay(preset.lastUsedAt) || '記録済み'
            : '未使用';
          const favoritePressed = preset.isFavorite ? 'true' : 'false';
          const caloriesText = `${formatDetailNutritionValue(preset.calories, 1) || '0.0'}`;
          const proteinText = `${formatDetailNutritionValue(preset.protein, 1) || '0.0'}`;
          const fatText = `${formatDetailNutritionValue(preset.fat, 1) || '0.0'}`;
          const carbohydratesText = `${formatDetailNutritionValue(preset.carbohydrates, 1) || '0.0'}`;
          const isExpanded = !isCompactPresetLayout() && expandedSet.has(preset.id);
          return `
            <div class="preset-card-matrix" data-id="${preset.id}">
              <div class="preset-card-matrix-shell ${isExpanded ? 'is-expanded' : ''}" data-id="${preset.id}" aria-expanded="${isExpanded ? 'true' : 'false'}">
                <div class="preset-card-matrix-top">
                  <div class="preset-card-matrix-title-block">
                    <div class="preset-card-matrix-title-row">
                      <span class="preset-category-pill">${preset.category}</span>
                      <div class="preset-card-name-wrapper" data-id="${preset.id}">
                        <span class="preset-card-name">${preset.name}</span>
                      </div>
                    </div>
                    <div class="preset-card-matrix-topline">
                      <span class="preset-card-meta-chip">${preset.lastUsedAt ? `最近使用 ${usageText}` : '最近使用 なし'}</span>
                      <span class="preset-card-meta-chip">${preset.usageCount}回</span>
                    </div>
                  </div>
                  <div class="preset-card-actions">
                    <button type="button" class="preset-favorite-btn" data-id="${preset.id}" aria-pressed="${favoritePressed}" aria-label="お気に入り切り替え">★</button>
                  </div>
                </div>
                <div class="preset-card-matrix-body" ${isExpanded ? '' : 'hidden'}>
                  <div class="preset-card-matrix-column preset-card-matrix-column-left">
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">基準量</span>
                      <button type="button" class="macro-badge macro-editable serving preset-card-number" data-id="${preset.id}" data-field="baseAmount" data-value="${baseAmount}" title="基準量を編集">${baseAmount.toFixed(1)}</button>
                    </div>
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">単位</span>
                      <select class="preset-unit-select preset-card-unit-select" data-id="${preset.id}" title="単位を編集">
                        <option value="個"${servingUnit === '個' ? ' selected' : ''}>個</option>
                        <option value="g"${servingUnit === 'g' ? ' selected' : ''}>g</option>
                      </select>
                    </div>
                    <div class="preset-delete-row">
                      <button type="button" class="preset-delete-btn" data-id="${preset.id}" aria-label="定番メニューを削除" title="削除">
                        <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M3 6h18"/>
                          <path d="M8 6V4h8v2"/>
                          <path d="M6 6l1 14h10l1-14"/>
                          <path d="M10 11v5"/>
                          <path d="M14 11v5"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="preset-card-matrix-column preset-card-matrix-column-right">
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">kcal</span>
                      <button type="button" class="macro-badge macro-editable calories preset-card-number" data-id="${preset.id}" data-field="calories" data-value="${preset.calories}" title="カロリーを編集">${caloriesText}</button>
                    </div>
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">P</span>
                      <button type="button" class="macro-badge macro-editable p preset-card-number" data-id="${preset.id}" data-field="protein" data-value="${preset.protein}" title="タンパク質を編集">${proteinText}</button>
                    </div>
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">F</span>
                      <button type="button" class="macro-badge macro-editable f preset-card-number" data-id="${preset.id}" data-field="fat" data-value="${preset.fat}" title="脂質を編集">${fatText}</button>
                    </div>
                    <div class="preset-card-matrix-row">
                      <span class="preset-card-matrix-label">C</span>
                      <button type="button" class="macro-badge macro-editable c preset-card-number" data-id="${preset.id}" data-field="carbohydrates" data-value="${preset.carbohydrates}" title="炭水化物を編集">${carbohydratesText}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        };
        const categoryRank = new Map(categoryOrder.map((category, index) => [category, index]));
        const favoritePresets = enrichedPresets.filter(p => p.isFavorite);
        const recentPresets = enrichedPresets.filter(p => p.lastUsedAt > 0);
        const getViewItems = () => {
          if (presetViewMode === 'favorites') {
            return sortItems(favoritePresets);
          }
          if (presetViewMode === 'categories') {
            return enrichedPresets.slice().sort((a, b) => {
              const aRank = categoryRank.has(a.category) ? categoryRank.get(a.category) : categoryOrder.length;
              const bRank = categoryRank.has(b.category) ? categoryRank.get(b.category) : categoryOrder.length;
              if (aRank !== bRank) return aRank - bRank;
              return compareBySortMode(a, b);
            });
          }
          const source = recentPresets.length ? recentPresets : enrichedPresets;
          return sortItems(source);
        };

        if (presetViewChips.length) {
          presetViewChips.forEach(chip => {
            chip.classList.toggle('is-active', chip.getAttribute('data-view') === presetViewMode);
          });
        }

        if (enrichedPresets.length === 0) {
          presetsList.innerHTML = searchTerm
            ? `<div class="presets-empty-state">検索条件に一致する定番メニューがありません。</div>`
            : `<div class="presets-empty-state">登録されている定番メニューはありません。<br>上の手動入力から登録してください。</div>`;
          return;
        }

        const viewItems = getViewItems();

        if (!viewItems.length) {
          presetsList.innerHTML = presetViewMode === 'favorites'
            ? `<div class="presets-empty-state">お気に入りの定番はまだありません。星を付けるとここに集まります。</div>`
            : `<div class="presets-empty-state">条件に合う定番メニューがありません。</div>`;
        } else {
          presetsList.innerHTML = viewItems.map(renderPresetCard).join('');
        }

        document.querySelectorAll('.preset-card-matrix').forEach(card => {
          let pressTimer = null;
          let startX = 0;
          let startY = 0;
          let longPressTriggered = false;
          const shell = card.querySelector('.preset-card-matrix-shell');
          const body = card.querySelector('.preset-card-matrix-body');
          const preset = loadedPresets.find(item => item.id === card.dataset.id) || null;
          const toggleExpansion = () => {
            const id = card.dataset.id;
            const isExpanded = body ? !body.hidden : false;
            if (body) body.hidden = isExpanded;
            if (shell) shell.classList.toggle('is-expanded', !isExpanded);
            shell?.setAttribute('aria-expanded', String(!isExpanded));
            togglePresetExpanded(id);
          };
          const cancelLongPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = null;
          };

          shell?.addEventListener('pointerdown', (event) => {
            if (event.target.closest('button, input, select')) return;
            startX = event.clientX;
            startY = event.clientY;
            longPressTriggered = false;
            shell?.classList.add('is-pressing');
            pressTimer = setTimeout(() => {
              longPressTriggered = true;
              shell?.classList.remove('is-pressing');
              navigator.vibrate?.(30);
              const preset = loadedPresets.find(item => item.id === card.dataset.id);
              const servingAmount = promptPresetServingAmount(preset);
              if (servingAmount !== null && servingAmount !== undefined) {
                registerPresetMenu(preset, { servingAmount });
              }
            }, 650);
          });

          shell?.addEventListener('pointermove', (event) => {
            if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
              cancelLongPress();
              shell?.classList.remove('is-pressing');
            }
          });

          ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
            shell?.addEventListener(type, () => {
              cancelLongPress();
              shell?.classList.remove('is-pressing');
            });
          });

          shell?.addEventListener('click', (event) => {
            if (event.target.closest('button, input, select, textarea')) return;
            if (longPressTriggered) {
              event.preventDefault();
              event.stopImmediatePropagation();
              longPressTriggered = false;
              return;
            }
            if (isCompactPresetLayout()) {
              event.preventDefault();
              event.stopPropagation();
              if (preset) {
                openPresetEditModal(preset);
              }
              return;
            }
            toggleExpansion();
          });
        });

        document.querySelectorAll('.preset-favorite-btn').forEach(button => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePresetFavorite(button.getAttribute('data-id'));
            loadPresets();
          });
        });

        document.querySelectorAll('.preset-delete-btn').forEach(button => {
          button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const preset = loadedPresets.find(item => item.id === button.getAttribute('data-id'));
            await deletePreset(preset);
          });
        });

        document.querySelectorAll('.macro-editable').forEach(badge => {
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (badge.querySelector('.preset-macro-edit-input')) return;

            const id = badge.getAttribute('data-id');
            const field = badge.getAttribute('data-field');
            const currentValue = badge.getAttribute('data-value');
            const originalHtml = badge.innerHTML;

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'preset-macro-edit-input';
            input.value = currentValue;
            input.min = '0';
            if (field === 'calories') input.max = '9999';
            if (field === 'baseAmount') input.min = '0.1';
            input.step = field === 'calories' ? '1' : '0.1';

            badge.textContent = '';
            badge.appendChild(input);
            input.focus();
            input.select();

            const restoreBadge = () => {
              badge.classList.remove('is-saving');
              badge.disabled = false;
              badge.innerHTML = originalHtml;
            };

            const saveMacroEdit = async () => {
              if (badge.classList.contains('is-saving')) return;
              const rawValue = input.value;
              const numericValue = Number(rawValue);
              if (rawValue === '' || !Number.isFinite(numericValue) || numericValue < 0 || (field === 'baseAmount' && numericValue <= 0) || (field === 'calories' && numericValue > 9999)) {
                restoreBadge();
                return;
              }

              const nextValue = field === 'calories'
                ? Math.round(numericValue)
                : Math.round(numericValue * 10) / 10;

              if (Number(currentValue) === nextValue) {
                restoreBadge();
                return;
              }

              try {
                badge.classList.add('is-saving');
                badge.disabled = true;
                badge.innerHTML = '<span class="preset-macro-spinner" aria-hidden="true"></span><span>更新中</span>';

                const res = await fetch(`/api/presets/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ [field]: nextValue })
                });

                if (res.ok) {
                  loadPresets();
                } else {
                  alert('栄養素の更新に失敗しました。');
                  restoreBadge();
                }
              } catch (err) {
                console.error(err);
                alert('更新中に通信エラーが発生しました。');
                restoreBadge();
              }
            };

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                restoreBadge();
              }
            });

            input.addEventListener('blur', saveMacroEdit);
          });
        });

        document.querySelectorAll('.preset-unit-select').forEach(select => {
          select.addEventListener('click', event => event.stopPropagation());
          select.addEventListener('change', async () => {
            const id = select.getAttribute('data-id');
            const servingUnit = select.value === 'g' ? 'g' : '個';
            select.disabled = true;
            try {
              const res = await fetch(`/api/presets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ servingUnit })
              });
              if (res.ok) {
                loadPresets();
              } else {
                alert('単位の更新に失敗しました。');
                loadPresets();
              }
            } catch (err) {
              console.error(err);
              alert('更新中に通信エラーが発生しました。');
              loadPresets();
            }
          });
        });

      }
    } catch (err) {
      console.error('Failed to load predefined menu presets:', err);
    }
  }

  // 2. 手動登録ポップアップ制御
  if (presetsManualToggle) {
    presetsManualToggle.addEventListener('click', () => {
      const isOpen = !presetsManualContent.hidden;
      presetsManualContent.hidden = isOpen;
      presetsManualToggle.textContent = isOpen ? '＋' : '×';
      presetsManualToggle.setAttribute('aria-expanded', String(!isOpen));
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
      const baseAmount = document.getElementById('preset-manual-serving-amount').value;
      const servingUnit = document.getElementById('preset-manual-serving-unit').value;

      if (!name) return;

      try {
        const response = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, calories, protein, fat, carbohydrates: carbs, baseAmount, servingUnit })
        });

        if (response.ok) {
          formPresetsManual.reset();
          presetsManualContent.hidden = true;
          presetsManualToggle.textContent = '＋';
          presetsManualToggle.setAttribute('aria-expanded', 'false');
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

  // 4. 食事詳細モーダル内の「定番に登録」ボタン押下処理
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
            baseAmount: 1,
            servingUnit: '個',
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
      historyList.style.display = '';
      historyDayDetail.hidden = true;
      historyDayDetailMeals.replaceChildren();
      const [historyResponse, weightResponse] = await Promise.all([
        fetch('/api/history'),
        fetch('/api/body-composition'),
      ]);
      const [history, weightHistory] = await Promise.all([
        historyResponse.json(),
        weightResponse.json(),
      ]);

      if (history.length === 0 && weightHistory.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <p>まだ解析履歴がありません。</p>
            <span>メニュー登録するとここに保存されます。</span>
          </div>
        `;
        return;
      }

      // 日付ごとにグループ化する (キー: YYYY-MM-DD)
      const groups = {};
      history.forEach(item => {
        const dateSource = item.mealDate || item.date;
        const dateKey = jstDateKey(dateSource);
        
        if (!groups[dateKey]) {
          groups[dateKey] = {
            dateLabel: formatDisplayDate(dateSource),
            meals: [],
            totalCalories: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCarbs: 0,
            morningWeight: null,
            nightWeight: null
          };
        }
        
        groups[dateKey].meals.push(item);
        groups[dateKey].totalCalories += toNutritionNumber(item.nutrition?.calories);
        groups[dateKey].totalProtein += toNutritionNumber(item.nutrition?.protein);
        groups[dateKey].totalFat += toNutritionNumber(item.nutrition?.fat);
        groups[dateKey].totalCarbs += toNutritionNumber(item.nutrition?.carbohydrates);
      });

      const previousWeightByPeriod = { morning: null, night: null };
      weightHistory
        .filter(item => Number.isFinite(Number(item.weight)))
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(item => {
          const period = item.measurementType === 'night' ? 'night' : 'morning';
          const currentWeight = Number(item.weight);
          item.historyListDiff = previousWeightByPeriod[period] == null
            ? null
            : currentWeight - previousWeightByPeriod[period];
          previousWeightByPeriod[period] = currentWeight;
        });

      weightHistory.forEach(item => {
        const dateKey = jstDateKey(item.date);
        if (!dateKey) return;
        if (!groups[dateKey]) {
          groups[dateKey] = {
            dateLabel: formatDisplayDate(item.date),
            meals: [],
            totalCalories: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCarbs: 0,
            morningWeight: null,
            nightWeight: null,
          };
        }
        if (item.measurementType === 'night') {
          if (!groups[dateKey].nightWeight) groups[dateKey].nightWeight = item;
        } else if (item.measurementType === 'morning') {
          if (!groups[dateKey].morningWeight) groups[dateKey].morningWeight = item;
        } else if (!groups[dateKey].morningWeight) {
          groups[dateKey].morningWeight = item;
        } else if (!groups[dateKey].nightWeight) {
          groups[dateKey].nightWeight = item;
        }
      });

      historyList.innerHTML = '';
      const historyTableWrapper = document.createElement('div');
      historyTableWrapper.className = 'history-table-wrapper';
      historyTableWrapper.innerHTML = `
        <table class="history-summary-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>P (g)</th>
              <th>F (g)</th>
              <th>C (g)</th>
              <th>カロリー</th>
              <th>朝体重 (kg)</th>
              <th>夜体重 (kg)</th>
            </tr>
          </thead>
        </table>
        <div class="history-summary-scroll">
          <table class="history-summary-table">
            <tbody></tbody>
          </table>
        </div>
      `;
      const historyTableBody = historyTableWrapper.querySelector('.history-summary-scroll tbody');
      historyList.appendChild(historyTableWrapper);

      // 日付の降順でソートして描画
      const sortedKeys = Object.keys(groups).sort().reverse();
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
          <div class="history-date-meta">
            <span class="history-date-title">${group.dateLabel}</span>
            <span class="history-row-chevron" aria-hidden="true">›</span>
          </div>
        `;
        // Create container for this date's cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'history-cards-container';
        cardsContainer.innerHTML = `
          <div class="history-detail-table-wrapper">
            <table class="history-detail-table">
              <thead><tr><th>#</th><th>区分</th><th>内容</th><th>P (g)</th><th>F (g)</th><th>C (g)</th><th>カロリー</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        `;
        const detailTableBody = cardsContainer.querySelector('tbody');
        const openDayDetail = () => {
          if (group.meals.length === 0) return;
          historyDayDetailHeader.innerHTML = headerEl.innerHTML;
          historyDayDetailMeals.replaceChildren(cardsContainer);
          historyList.style.display = 'none';
          historyDayDetail.hidden = false;
          document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'instant' });
        };

        const listRow = document.createElement('tr');
        listRow.className = 'history-summary-row';
        listRow.tabIndex = 0;
        const formatHistoryWeight = (record) => {
          if (!record || record.weight == null) return '--.-';
          const diff = Number(record.historyListDiff);
          const hasDiff = Number.isFinite(diff);
          const sign = hasDiff && diff > 0 ? '+' : '';
          const diffClass = !hasDiff ? 'none' : diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
          const diffText = hasDiff ? `${sign}${diff.toFixed(1)}` : '--';
          return `<button type="button" class="history-weight-link" data-period="${record.measurementType === 'night' ? 'night' : 'morning'}"><span>${Number(record.weight).toFixed(1)}</span><span class="history-weight-diff ${diffClass}">(${diffText})</span></button>`;
        };

        listRow.innerHTML = `
          <td class="history-summary-date"><span class="history-summary-date-inner"><span>${group.dateLabel.replace(/^\d{4}\//, '')}</span></span></td>
          <td>${pTotal}</td>
          <td>${fTotal}</td>
          <td>${cTotal}</td>
          <td class="history-summary-calories">${group.totalCalories}</td>
          <td class="history-summary-weight-cell">${formatHistoryWeight(group.morningWeight)}</td>
          <td class="history-summary-weight-cell">${formatHistoryWeight(group.nightWeight)}</td>
        `;
        listRow.addEventListener('click', openDayDetail);
        listRow.querySelector('[data-period="morning"]')?.addEventListener('click', (event) => {
          event.stopPropagation();
          openWeightDetailModal(group.morningWeight);
        });
        listRow.querySelector('[data-period="night"]')?.addEventListener('click', (event) => {
          event.stopPropagation();
          openWeightDetailModal(group.nightWeight);
        });
        listRow.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDayDetail();
          }
        });
        historyTableBody.appendChild(listRow);

        // 2. その日の食事明細行の生成
        group.meals.forEach((item, index) => {
          const mealTypeJa = {
            morning: '朝食',
            noon: '昼食',
            night: '夕食',
            snack: '間食'
          }[item.mealType || 'snack'];

          const card = document.createElement('tr');
          card.className = `history-detail-row ${item.status === 'failed' ? 'failed-analysis' : ''}`;
          card.tabIndex = 0;
          
          // 履歴カードクリックで単独モーダルを開く
          card.addEventListener('click', () => {
            openDetailModal(item);
          });
          card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openDetailModal(item);
            }
          });

          // 表示用の料理名・テキスト（記録時に保存された mealName を優先表示）
          const displayText = item.textInput && item.textInput.trim() 
            ? item.textInput.trim() 
            : (item.imageId ? '📸 画像付き記録' : '🍽️ 食事データ');
          let displayMealName = item.mealName || (item.nutrition && item.nutrition.mealName) || displayText;

          if (item.status === 'failed') {
            displayMealName = `⚠️ ${displayMealName} (解析未完了)`;
          }

          const proteinValue = item.status === 'failed' ? '--' : formatDetailNutritionValue(item.nutrition.protein, 1);
          const fatValue = item.status === 'failed' ? '--' : formatDetailNutritionValue(item.nutrition.fat, 1);
          const carbValue = item.status === 'failed' ? '--' : formatDetailNutritionValue(item.nutrition.carbohydrates, 1);
          const calorieValue = item.status === 'failed' ? '--' : formatDetailNutritionValue(item.nutrition.calories, 0);

          card.innerHTML = `
            <td class="history-detail-row-number">${index + 1}</td>
            <td><span class="history-meal-type-chip ${item.mealType || 'snack'}">${mealTypeJa}</span></td>
            <td class="history-detail-name"><span class="history-meal-text">${displayMealName}</span></td>
            <td>${proteinValue}</td>
            <td>${fatValue}</td>
            <td>${carbValue}</td>
            <td>${calorieValue}</td>
          `;

          detailTableBody.appendChild(card);
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
    hideModal(historyDetailModal);
    currentEditingHistoryId = null;
  };

  btnCloseModal.addEventListener('click', closeModal);

  btnDeleteHistoryModal.addEventListener('click', async () => {
    if (!currentEditingHistoryId) return;
    if (!confirm('この食事履歴を削除しますか？\n登録されたデータ（および画像ファイル）が完全に削除されます。')) return;

    const loadingTextEl = loadingOverlay.querySelector('p');
    const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
    loadingTextEl.textContent = '履歴を削除しています...';
    loadingSubTextEl.textContent = 'Googleドライブからデータを消去中';
    loadingOverlay.style.display = 'flex';

    try {
      const deleteRes = await fetch(`/api/history/${currentEditingHistoryId}`, { method: 'DELETE' });
      if (!deleteRes.ok) throw new Error('履歴の削除に失敗しました。');
      closeModal();
      activeDetailMeal = null;
      await loadHistory();
      await updateDailySummary();
    } catch (err) {
      console.error(err);
      alert('削除処理中にエラーが発生しました。');
    } finally {
      loadingOverlay.style.display = 'none';
      loadingTextEl.textContent = 'AIが栄養素を解析しています...';
      loadingSubTextEl.textContent = 'カロリーやPFCバランスを計算中';
    }
  });
  
  const inferenceBody = document.getElementById('modal-inference-body');
  if (inferenceBody) inferenceBody.style.display = 'block';
  
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
    const rawNutritionValues = [
      modalCaloriesInput?.value.trim() || '',
      modalProteinInput?.value.trim() || '',
      modalFatInput?.value.trim() || '',
      modalCarbsInput?.value.trim() || ''
    ];
    const hasNutritionUpdate = rawNutritionValues.some(value => value !== '');
    const isNutritionUpdateComplete = rawNutritionValues.every(value => value !== '');

    if (hasNutritionUpdate && !isNutritionUpdateComplete) {
      alert('カロリー、P、F、C はまとめて入力してください。');
      return;
    }

    const newCalories = hasNutritionUpdate ? parseDetailNutritionValue(modalCaloriesInput?.value, 0) : undefined;
    const newProtein = hasNutritionUpdate ? parseDetailNutritionValue(modalProteinInput?.value, 1) : undefined;
    const newFat = hasNutritionUpdate ? parseDetailNutritionValue(modalFatInput?.value, 1) : undefined;
    const newCarbs = hasNutritionUpdate ? parseDetailNutritionValue(modalCarbsInput?.value, 1) : undefined;

    if (hasNutritionUpdate && [newCalories, newProtein, newFat, newCarbs].some(value => value === null)) {
      alert('カロリー、P、F、C の数値を正しく入力してください。');
      return;
    }

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
          textInput: newTextInput,
          ...(hasNutritionUpdate ? {
            calories: newCalories,
            protein: newProtein,
            fat: newFat,
            carbohydrates: newCarbs
          } : {})
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
      document.getElementById('modal-calories').textContent = formatDetailNutritionValue(updatedRecord.nutrition.calories, 0);
      document.getElementById('modal-protein').textContent = formatDetailNutritionValue(updatedRecord.nutrition.protein, 1);
      document.getElementById('modal-fat').textContent = formatDetailNutritionValue(updatedRecord.nutrition.fat, 1);
      document.getElementById('modal-carbs').textContent = formatDetailNutritionValue(updatedRecord.nutrition.carbohydrates, 1);
      if (modalCaloriesInput) modalCaloriesInput.value = formatDetailNutritionValue(updatedRecord.nutrition.calories, 0);
      if (modalProteinInput) modalProteinInput.value = formatDetailNutritionValue(updatedRecord.nutrition.protein, 1);
      if (modalFatInput) modalFatInput.value = formatDetailNutritionValue(updatedRecord.nutrition.fat, 1);
      if (modalCarbsInput) modalCarbsInput.value = formatDetailNutritionValue(updatedRecord.nutrition.carbohydrates, 1);
      
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
  // Load Overview Weight Trend Chart
  // ==========================================================================
  async function loadStats() {
    try {
      // 体組成データを取得して体重推移を描画
      const weightRes = await fetch('/api/body-composition');
      if (!weightRes.ok) throw new Error('データ取得失敗');
      const weightHistory = await weightRes.json();
      const weightChartCanvas = document.getElementById('weight-trend-chart');
      if (!weightChartCanvas) return;

      syncOverviewWeightRangeButtons();

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

      const rangeConfig = OVERVIEW_WEIGHT_RANGE_CONFIG[overviewWeightRange] || OVERVIEW_WEIGHT_RANGE_CONFIG.month;
      const todayKey = jstDateKey(new Date());
      const startKey = shiftJstDateKey(todayKey, -(rangeConfig.days - 1));
      const filteredHistory = validHistory.filter((item) => {
        const itemKey = jstDateKey(item.date);
        return itemKey && itemKey >= startKey && itemKey <= todayKey;
      });
      const weightLabels = filteredHistory.map(d => formatOverviewWeightLabel(d.date, d.measurementType));
      const weightValues = filteredHistory.map(d => d.weight);
      if (weightTrendChart) weightTrendChart.destroy();
      if (bmiTrendChart) {
        bmiTrendChart.destroy();
        bmiTrendChart = null;
      }

      const designStyles = getComputedStyle(document.documentElement);
      const designColor = (name) => designStyles.getPropertyValue(name).trim();
      const chartAccent = designColor('--design-accent');
      const chartCard = designColor('--design-card');
      const chartMuted = designColor('--design-muted');
      const chartBorder = designColor('--design-border');
      const chartMorningPoint = designColor('--secondary');
      const chartNightPoint = designColor('--accent-blue');
      const weightPointColors = filteredHistory.map((item) => {
        if (item.measurementType === 'night') return chartNightPoint;
        if (item.measurementType === 'morning') return chartMorningPoint;
        return chartAccent;
      });

      weightTrendChart = new Chart(weightChartCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: weightLabels,
          datasets: [{
            label: '体重 (kg)',
            data: weightValues,
            borderColor: chartAccent,
            backgroundColor: `${chartAccent}1a`,
            borderWidth: 3,
            fill: true,
            tension: 0.25,
            pointBackgroundColor: weightPointColors,
            pointBorderColor: chartCard,
            pointBorderWidth: 2,
            pointRadius: rangeConfig.pointRadius,
            pointHoverRadius: rangeConfig.pointHoverRadius
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const item = filteredHistory[items[0]?.dataIndex ?? -1];
                  if (!item) return '';
                  const typeLabel = item.measurementType === 'morning'
                    ? '朝'
                    : item.measurementType === 'night'
                      ? '夜'
                      : '';
                  return typeLabel ? `${formatDisplayDate(item.date)} ${typeLabel}` : formatDisplayDate(item.date);
                },
                label: (context) => `体重 ${Number(context.parsed.y).toFixed(1)} kg`
              }
            }
          },
          scales: {
            y: {
              grace: '5%',
              grid: { color: chartBorder },
              ticks: { color: chartMuted, font: { size: 10, weight: '700' } }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: chartMuted,
                font: { size: 10, weight: '700' },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: rangeConfig.maxTicksLimit
              }
            }
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

  const profileFields = [
    { input: profileHeightInput, field: 'height', type: 'number' },
    { input: profileGenderSelect, field: 'gender', type: 'string' },
    { input: profileActivitySelect, field: 'activityLevel', type: 'string' },
    { input: profileActivityNotesInput, field: 'activityNotes', type: 'string' },
    { input: profileBirthDateInput, field: 'birthDate', type: 'string' },
    { input: profileTargetWeightInput, field: 'targetWeight', type: 'number' },
    { input: profileTargetDateInput, field: 'targetDate', type: 'string' }
  ];
  let currentProfile = null;

  const calculateAge = (birthDateValue) => {
    if (!birthDateValue) return null;
    const birthDate = new Date(`${birthDateValue}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  };

  const renderProfileAge = (birthDateValue) => {
    if (!profileAgeOutput) return;
    const age = calculateAge(birthDateValue);
    profileAgeOutput.textContent = age === null ? '-- 歳' : `${age} 歳`;
  };

  const setProfileFieldSaving = (input, isSaving) => {
    if (!input) return;
    const field = input.closest('.profile-goal-field, td');
    input.classList.toggle('is-saving', isSaving);
    input.disabled = isSaving;
    let spinner = field ? field.querySelector('.profile-field-spinner') : null;
    if (isSaving && field && !spinner) {
      spinner = document.createElement('span');
      spinner.className = 'profile-field-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      field.appendChild(spinner);
    } else if (!isSaving && spinner) {
      spinner.remove();
    }
  };

  const formatProfileValue = (value) => value === null || value === undefined ? '' : String(value);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('プロフィールの読み込みに失敗しました。');
      const profile = await response.json();
      currentProfile = profile;
      if (profileHeightInput) {
        profileHeightInput.value = formatProfileValue(profile.height);
        profileHeightInput.dataset.originalValue = profileHeightInput.value;
      }
      if (profileGenderSelect) {
        profileGenderSelect.value = profile.gender || '';
        profileGenderSelect.dataset.originalValue = profileGenderSelect.value;
      }
      if (profileActivitySelect) {
        profileActivitySelect.value = profile.activityLevel || 'normal';
        profileActivitySelect.dataset.originalValue = profileActivitySelect.value;
      }
      if (profileActivityNotesInput) {
        profileActivityNotesInput.value = profile.activityNotes || '';
        profileActivityNotesInput.dataset.originalValue = profileActivityNotesInput.value;
      }
      if (profileBirthDateInput) {
        profileBirthDateInput.value = profile.birthDate || '';
        profileBirthDateInput.dataset.originalValue = profileBirthDateInput.value;
      }
      if (profileTargetWeightInput) {
        profileTargetWeightInput.value = formatProfileValue(profile.targetWeight);
        profileTargetWeightInput.dataset.originalValue = profileTargetWeightInput.value;
      }
      if (profileTargetDateInput) {
        profileTargetDateInput.value = profile.targetDate || '';
        profileTargetDateInput.dataset.originalValue = profileTargetDateInput.value;
      }
      renderProfileAge(profile.birthDate);
      await updateDailyWeightSummary();
    } catch (err) {
      console.error(err);
    }
  };

  const saveProfileField = async (config) => {
    if (!config.input || config.input.classList.contains('is-saving')) return;
    const rawValue = config.input.value.trim();
    const previousValue = config.input.dataset.originalValue ?? '';
    if (rawValue === previousValue) return;

    const nextValue = config.type === 'number'
      ? (rawValue === '' ? null : Math.round(Number(rawValue) * 10) / 10)
      : rawValue;

    if (config.type === 'number' && rawValue !== '' && !Number.isFinite(nextValue)) {
      config.input.value = previousValue;
      return;
    }

    try {
      setProfileFieldSaving(config.input, true);
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.field]: nextValue })
      });
      if (!response.ok) throw new Error('プロフィールの保存に失敗しました。');
      const profile = await response.json();
      currentProfile = profile;
      const savedValue = formatProfileValue(profile[config.field]);
      config.input.value = savedValue;
      config.input.dataset.originalValue = savedValue;
      if (config.field === 'birthDate') renderProfileAge(profile.birthDate);
      await updateDailyWeightSummary();
    } catch (err) {
      console.error(err);
      alert(err.message || 'プロフィール保存中に通信エラーが発生しました。');
      config.input.value = previousValue;
    } finally {
      setProfileFieldSaving(config.input, false);
    }
  };

  profileFields.forEach(config => {
    if (!config.input) return;
    if (config.input.tagName === 'SELECT' || config.input.type === 'date') {
      config.input.addEventListener('change', () => saveProfileField(config));
    } else if (config.input.tagName === 'TEXTAREA') {
      config.input.addEventListener('change', () => saveProfileField(config));
      config.input.addEventListener('blur', () => saveProfileField(config));
    } else {
      config.input.addEventListener('change', () => saveProfileField(config));
      config.input.addEventListener('blur', () => saveProfileField(config));
      config.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          config.input.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          config.input.value = config.input.dataset.originalValue ?? '';
          config.input.blur();
        }
      });
    }
  });

  loadProfile();

  const estimateBmrFromProfile = (profile, weightKg) => {
    const heightCm = Number(profile?.height);
    const weight = Number(weightKg);
    const gender = profile?.gender;
    if (!Number.isFinite(heightCm) || heightCm <= 0 || !Number.isFinite(weight) || weight <= 0) return null;
    const age = calculateAge(profile?.birthDate);

    if (age !== null) {
      const genderOffset = gender === 'female' ? -161 : 5;
      return (10 * weight) + (6.25 * heightCm) - (5 * age) + genderOffset;
    }

    if (gender === 'male') {
      return (13.397 * weight) + (4.799 * heightCm) + 88.362;
    }
    if (gender === 'female') {
      return (9.247 * weight) + (3.098 * heightCm) + 447.593;
    }
    return (11.322 * weight) + (3.949 * heightCm) + 267.978;
  };

  const calculateEnergyTargets = (profile, latestWeightKg) => {
    const estimatedBmr = estimateBmrFromProfile(profile, latestWeightKg);
    if (estimatedBmr === null) return null;
    const activityFactors = {
      low: 1.2,
      normal: 1.55,
      high: 1.725
    };
    const activityFactor = activityFactors[profile?.activityLevel] || activityFactors.normal;
    const tdee = estimatedBmr * activityFactor;
    return {
      tdee: Math.round(tdee),
      targetCalories: Math.round(tdee * 0.8)
    };
  };

  const calculateTargetPfcGrams = (targetCalories) => {
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null;
    return {
      protein: Math.round(((targetCalories * 0.2) / 4) * 10) / 10,
      fat: Math.round(((targetCalories * 0.25) / 9) * 10) / 10,
      carbs: Math.round(((targetCalories * 0.55) / 4) * 10) / 10
    };
  };

  const updateTargetPfcSummary = (targetCalories) => {
    const pfcTargets = calculateTargetPfcGrams(targetCalories);
    if (!pfcTargets) {
      [dailyTargetProtein, dailyTargetFat, dailyTargetCarbs].forEach(element => {
        if (!element) return;
        element.textContent = '目標 --.-g';
        delete element.dataset.target;
      });
      updateDailyPfcProgress();
      return;
    }
    [
      [dailyTargetProtein, pfcTargets.protein],
      [dailyTargetFat, pfcTargets.fat],
      [dailyTargetCarbs, pfcTargets.carbs]
    ].forEach(([element, target]) => {
      if (!element) return;
      element.textContent = `目標 ${target.toFixed(1)}g`;
      element.dataset.target = String(target);
    });
    updateDailyPfcProgress();
  };

  // 最新体重・基礎代謝サマリーの更新（日付フィルターなしで常に最新値を表示）
  function updateWeightGoalSummary(latestWeight) {
    if (!summaryWeightGoalDiff || !summaryWeightGoalDays) return;

    const targetWeight = Number(currentProfile?.targetWeight);
    if (Number.isFinite(latestWeight) && Number.isFinite(targetWeight) && targetWeight > 0) {
      const difference = Math.round((latestWeight - targetWeight) * 10) / 10;
      if (difference > 0) {
        summaryWeightGoalDiff.textContent = `目標まで ${difference.toFixed(1)} kg`;
      } else if (difference < 0) {
        summaryWeightGoalDiff.textContent = `目標比 −${Math.abs(difference).toFixed(1)} kg`;
      } else {
        summaryWeightGoalDiff.textContent = '目標体重を達成';
      }
    } else {
      summaryWeightGoalDiff.textContent = '目標体重を設定してください';
    }

    const targetDate = currentProfile?.targetDate;
    const dateMatch = typeof targetDate === 'string'
      ? targetDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;
    const todayMatch = jstDateKey(new Date()).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch && todayMatch) {
      const targetUtc = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      const todayUtc = Date.UTC(Number(todayMatch[1]), Number(todayMatch[2]) - 1, Number(todayMatch[3]));
      const days = Math.round((targetUtc - todayUtc) / 86400000);
      summaryWeightGoalDays.textContent = days > 0
        ? `期日まで ${days} 日`
        : days === 0
          ? '期日は今日'
          : `期日から ${Math.abs(days)} 日経過`;
    } else {
      summaryWeightGoalDays.textContent = '達成期日を設定してください';
    }
  }

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
        updateWeightGoalSummary(latest.weight);
        
        // 前日比（1つ前の測定値との差）の算出
        const diffEl = document.getElementById('daily-weight-diff');
        if (diffEl) {
          if (validHistory.length > 1) {
            const prevRecord = validHistory[validHistory.length - 2];
            const diff = latest.weight - prevRecord.weight;
            diffEl.hidden = false;
            if (diff > 0) {
              diffEl.textContent = `前回比 +${diff.toFixed(1)}`;
              diffEl.className = 'weight-diff-inline up';
            } else if (diff < 0) {
              diffEl.textContent = `前回比 ${diff.toFixed(1)}`;
              diffEl.className = 'weight-diff-inline down';
            } else {
              diffEl.textContent = `前回比 ±0`;
              diffEl.className = 'weight-diff-inline same';
            }
          } else {
            diffEl.textContent = '';
            diffEl.hidden = true;
          }
        }
        
        // プロフィールと最新体重から推定したTDEE/目標摂取カロリーを表示する
        const energyTargets = calculateEnergyTargets(currentProfile, latest.weight);
        if (energyTargets !== null) {
          if (dailyBmrCalories) dailyBmrCalories.textContent = energyTargets.targetCalories;
          if (overviewTdeeCalories) overviewTdeeCalories.textContent = energyTargets.tdee;
          updateTargetPfcSummary(energyTargets.targetCalories);
          updateDailyCalorieProgress();
        } else {
          if (dailyBmrCalories) dailyBmrCalories.textContent = '----';
          updateTargetPfcSummary(null);
          updateDailyCalorieProgress();
        }
        
        dailyWeightSummaryBar.style.display = 'grid';
      } else {
        // 測定データが一件もない場合はデフォルト表示
        summaryWeightVal.textContent = '--.-';
        updateWeightGoalSummary(null);
        if (dailyBmrCalories) dailyBmrCalories.textContent = '----';
        const diffEl = document.getElementById('daily-weight-diff');
        if (diffEl) {
          diffEl.textContent = '';
          diffEl.hidden = true;
        }
        updateTargetPfcSummary(null);
        updateDailyCalorieProgress();
        dailyWeightSummaryBar.style.display = 'grid';
      }
    } catch (err) {
      console.error('Failed to update daily weight summary:', err);
      updateTargetPfcSummary(null);
      dailyWeightSummaryBar.style.display = 'grid';
    }
  }

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

  if (btnMealCameraTrigger && mealCameraInput) {
    btnMealCameraTrigger.addEventListener('click', () => mealCameraInput.click());
  }

  if (btnMealGalleryTrigger && mealGalleryInput) {
    btnMealGalleryTrigger.addEventListener('click', () => mealGalleryInput.click());
  }

  const handleMealFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }
    selectedMealFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (mealImagePreview) mealImagePreview.src = e.target.result;
      if (mealPreviewContainer) mealPreviewContainer.style.display = 'none';
      if (mealUploadBadge) mealUploadBadge.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
    validateMealInputs();
  };

  if (mealCameraInput) {
    mealCameraInput.addEventListener('change', (e) => handleMealFileSelect(e.target.files[0]));
  }

  if (mealGalleryInput) {
    mealGalleryInput.addEventListener('change', (e) => handleMealFileSelect(e.target.files[0]));
  }

  if (mealTextInput) {
    mealTextInput.addEventListener('input', () => validateMealInputs());
  }

  if (btnRemoveMealImage) {
    btnRemoveMealImage.addEventListener('click', (e) => {
      e.stopPropagation();
      resetMealImage();
    });
  }

  if (btnClearMealBadge) {
    btnClearMealBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      resetMealImage();
    });
  }

  if (mealDropZone) {
    mealDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mealDropZone.classList.add('dragover');
    });

    mealDropZone.addEventListener('dragleave', () => {
      mealDropZone.classList.remove('dragover');
    });

    mealDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      mealDropZone.classList.remove('dragover');
      handleMealFileSelect(e.dataTransfer.files[0]);
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
      hideModal(weightEntryModal);
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

  if (btnAnalyzeMeal) {
    btnAnalyzeMeal.addEventListener('click', async () => {
      const hasMealText = mealTextInput && mealTextInput.value.trim().length > 0;
      if (!selectedMealFile && !hasMealText) {
        alert('写真か補足テキストを入力してください。');
        return;
      }

      const loadingTextEl = loadingOverlay.querySelector('p');
      const loadingSubTextEl = loadingOverlay.querySelector('.loading-subtext');
      loadingTextEl.textContent = 'AIがメニューを解析しています...';
      loadingSubTextEl.textContent = '料理名と栄養を読み取り中';
      loadingOverlay.style.display = 'flex';
      btnAnalyzeMeal.disabled = true;

      const analyzeFormData = new FormData();
      if (selectedMealFile) {
        analyzeFormData.append('image', selectedMealFile);
      }
      analyzeFormData.append('textInput', mealTextInput?.value || '');
      analyzeFormData.append('mealDate', mealDateInput?.value || '');
      analyzeFormData.append('mealType', activeMealType || 'snack');

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: analyzeFormData,
        });

        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : {};
        if (!response.ok) {
          const error = new Error(payload.error || 'メニューの解析に失敗しました。');
          error.status = response.status;
          throw error;
        }

        const analyzedRecord = payload;
        resetMealEntryForm();
        hideModal(mealAnalysisModal);
        await loadHistory();
        openDetailModal(analyzedRecord);
      } catch (err) {
        console.error(err);
        const msg = err.message || '';
        if (err.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          alert('【AIアクセス制限】\nメニュー解析のアクセスが一時的に集中しています。\n\nお手数ですが、10秒〜20秒ほど待ってから、もう一度お試しください。');
        } else if (err.status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('temporary') || msg.includes('high demand')) {
          alert('【AIサーバー一時混雑】\n現在、GoogleのAIサーバーが非常に混み合っています。\n\n一時的な制限ですので、10秒〜15秒ほど待ってから、もう一度お試しください。');
        } else {
          alert('メニュー登録に失敗しました。\n\n少し時間をおいてからもう一度お試しください。\n詳細: ' + msg);
        }
      } finally {
        loadingOverlay.style.display = 'none';
        btnAnalyzeMeal.disabled = false;
      }
    });
  }

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
    if (!weightHistoryTbody) {
      await loadHistory();
      return;
    }
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

        const dateWithWeekday = formatDisplayDate(dateKey);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-date-only clickable-cell">
            <span class="date-text">${dateWithWeekday}</span>
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
  let isBindingWeightModalPatchHandlers = false;

  const weightModalFieldConfigs = [
    { field: 'date', input: weightModalDateInput, type: 'string' },
    { field: 'measurementType', input: weightModalTypeSelect, type: 'string' },
    { field: 'weight', input: wModalWeight, type: 'number', decimals: 1 },
    { field: 'bmi', input: wModalBmi, type: 'number', decimals: 1 },
    { field: 'fatRate', input: wModalFat, type: 'number', decimals: 1 },
    { field: 'heartRate', input: wModalHeart, type: 'integer' },
    { field: 'muscleMass', input: wModalMuscle, type: 'number', decimals: 1 },
    { field: 'bmr', input: wModalBmr, type: 'integer' },
    { field: 'waterRate', input: wModalWater, type: 'number', decimals: 1 },
    { field: 'fatMass', input: wModalFatMass, type: 'number', decimals: 1 },
    { field: 'leanBodyMass', input: wModalLeanBody, type: 'number', decimals: 1 },
    { field: 'boneMass', input: wModalBone, type: 'number', decimals: 1 },
    { field: 'visceralFat', input: wModalVisceralFat, type: 'number', decimals: 1 },
    { field: 'proteinRate', input: wModalProteinRate, type: 'number', decimals: 1 },
    { field: 'skeletalMuscleMass', input: wModalSkeletalMuscle, type: 'number', decimals: 1 },
    { field: 'subcutaneousFat', input: wModalSubcutaneous, type: 'number', decimals: 1 },
    { field: 'bodyAge', input: wModalBodyAge, type: 'integer' },
    { field: 'bodyType', input: wModalBodyType, type: 'string' }
  ];

  const parseWeightModalValue = (config) => {
    const rawValue = config.input.value.trim();
    if (rawValue === '') return null;
    if (config.type === 'integer') {
      const value = Number(rawValue);
      return Number.isFinite(value) ? Math.round(value) : null;
    }
    if (config.type === 'number') {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return null;
      const factor = 10 ** (config.decimals ?? 1);
      return Math.round(value * factor) / factor;
    }
    return rawValue;
  };

  const formatWeightModalValue = (config, value) => {
    if (value === null || value === undefined || value === '') return '';
    if (config.type === 'integer') return String(Math.round(Number(value)));
    if (config.type === 'number') return Number(value).toFixed(config.decimals ?? 1);
    return String(value);
  };

  const setWeightModalSaving = (input, isSaving) => {
    const parent = input.parentElement;
    if (!parent) return;
    input.classList.toggle('is-saving', isSaving);
    input.disabled = isSaving;
    let spinner = parent.querySelector('.weight-field-spinner');
    if (isSaving && !spinner) {
      spinner = document.createElement('span');
      spinner.className = 'weight-field-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      parent.appendChild(spinner);
    } else if (!isSaving && spinner) {
      spinner.remove();
    }
  };

  const setWeightModalEditing = (input, isEditing) => {
    input.classList.toggle('is-editing', isEditing);
    input.readOnly = !isEditing;
    if (input.tagName === 'SELECT') input.disabled = false;
  };

  const patchWeightModalField = async (config) => {
    if (!currentEditingWeightId || config.input.classList.contains('is-saving')) return;
    const nextValue = parseWeightModalValue(config);
    const previousValue = config.input.dataset.originalValue ?? '';
    const formattedNextValue = formatWeightModalValue(config, nextValue);
    if (formattedNextValue === previousValue) {
      config.input.value = previousValue;
      return;
    }

    try {
      setWeightModalSaving(config.input, true);
      const response = await fetch(`/api/body-composition/${currentEditingWeightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.field]: nextValue })
      });

      if (!response.ok) throw new Error('体組成データの更新に失敗しました。');
      const updatedRecord = await response.json();
      const updatedValue = updatedRecord[config.field];
      const formattedUpdatedValue = formatWeightModalValue(config, updatedValue);
      config.input.value = formattedUpdatedValue;
      config.input.dataset.originalValue = formattedUpdatedValue;
      setWeightModalEditing(config.input, false);
      await loadWeightHistory();
      await updateDailyWeightSummary();
    } catch (err) {
      console.error(err);
      alert(err.message || '更新中に通信エラーが発生しました。');
      config.input.value = previousValue;
    } finally {
      setWeightModalSaving(config.input, false);
      setWeightModalEditing(config.input, false);
    }
  };

  const bindWeightModalPatchHandlers = () => {
    if (isBindingWeightModalPatchHandlers) return;
    isBindingWeightModalPatchHandlers = true;

    weightModalFieldConfigs.forEach(config => {
      if (!config.input) return;
      const save = () => patchWeightModalField(config);
      const restore = () => {
        config.input.value = config.input.dataset.originalValue ?? '';
        setWeightModalEditing(config.input, false);
      };
      if (config.input.tagName === 'SELECT' || config.input.type === 'date') {
        config.input.addEventListener('focus', () => setWeightModalEditing(config.input, true));
        config.input.addEventListener('change', save);
        config.input.addEventListener('blur', () => setWeightModalEditing(config.input, false));
      } else {
        config.input.addEventListener('focus', () => {
          setWeightModalEditing(config.input, true);
          config.input.select();
        });
        config.input.addEventListener('click', () => {
          if (!config.input.classList.contains('is-editing')) {
            setWeightModalEditing(config.input, true);
            config.input.focus();
            config.input.select();
          }
        });
        config.input.addEventListener('blur', save);
        config.input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            config.input.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            restore();
            config.input.blur();
          }
        });
      }
    });
  };

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
    weightModalFieldConfigs.forEach(config => {
      if (!config.input) return;
      config.input.dataset.originalValue = formatWeightModalValue(config, item[config.field]);
      config.input.value = config.input.dataset.originalValue;
      setWeightModalEditing(config.input, false);
    });
    bindWeightModalPatchHandlers();

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

    showModal(weightDetailModal);
  };

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
      
      hideModal(weightDetailModal);
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
    hideModal(weightDetailModal);
  });

  // モーダル外側クリックで閉じる
  weightDetailModal.addEventListener('click', (e) => {
    if (e.target === weightDetailModal) {
      hideModal(weightDetailModal);
    }
  });

  const navLabelMap = {
    'tab-overview': '総合',
    'tab-analyze': 'AI',
    'tab-history': '記録',
    'tab-stats': '情報',
    'tab-presets': '定番',
  };
  navItems.forEach(item => {
    const tabId = item.getAttribute('data-tab');
    const label = item.querySelector('.nav-label');
    if (label && navLabelMap[tabId]) label.textContent = navLabelMap[tabId];
  });

  loadWeightHistory();
  updateDailyWeightSummary();
  loadStats();
  loadPresets();
  loadAiConsultations();
});
