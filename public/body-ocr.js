const APP_VERSION = 'v1.0.33';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const OCR_TIMEOUT_MS = 12000;

let tesseractLoader = null;
let saveInProgress = false;

const FIELDS = [
  { id:'input-weight-val', key:'weight', row:0, col:0, decimals:2, min:30, max:250 },
  { id:'input-bmi-val', key:'bmi', row:0, col:1, decimals:1, min:10, max:60 },
  { id:'input-fat-val', key:'fatRate', row:1, col:0, decimals:1, min:3, max:70 },
  { id:'input-heart-val', key:'heartRate', row:1, col:1, decimals:0, min:30, max:220 },
  { id:'input-muscle-val', key:'muscleMass', row:2, col:0, decimals:2, min:10, max:150 },
  { id:'input-bmr-val', key:'bmr', row:2, col:1, decimals:0, min:500, max:4000 },
  { id:'input-water-val', key:'waterRate', row:3, col:0, decimals:1, min:20, max:80 },
  { id:'input-fatmass-val', key:'fatMass', row:3, col:1, decimals:2, min:1, max:100 },
  { id:'input-leanbody-val', key:'leanBodyMass', row:4, col:0, decimals:2, min:20, max:200 },
  { id:'input-bone-val', key:'boneMass', row:4, col:1, decimals:2, min:1, max:10 },
  { id:'input-visceralfat-val', key:'visceralFat', row:5, col:0, decimals:1, min:1, max:30 },
  { id:'input-proteinrate-val', key:'proteinRate', row:5, col:1, decimals:1, min:5, max:40 },
  { id:'input-skeletalmuscle-val', key:'skeletalMuscleMass', row:6, col:0, decimals:2, min:10, max:100 },
  { id:'input-subcutaneous-val', key:'subcutaneousFat', row:6, col:1, decimals:1, min:3, max:70 },
  { id:'input-bodyage-val', key:'bodyAge', row:7, col:0, decimals:0, min:10, max:100 },
];

const LAYOUT = {
  left:[0.070,0.455],
  right:[0.555,0.940],
  firstY:0.067,
  rowStep:0.1185,
  halfHeight:0.022,
};

function loadTesseract(){
  if(globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if(tesseractLoader) return tesseractLoader;
  tesseractLoader = new Promise((resolve,reject)=>{
    const old = document.querySelector('script[data-physilog-tesseract]');
    if(old){
      old.addEventListener('load',()=>resolve(globalThis.Tesseract),{once:true});
      old.addEventListener('error',()=>reject(new Error('OCRライブラリを読み込めませんでした。')),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=TESSERACT_URL;
    script.async=true;
    script.dataset.physilogTesseract='1';
    script.onload=()=>resolve(globalThis.Tesseract);
    script.onerror=()=>reject(new Error('OCRライブラリを読み込めませんでした。'));
    document.head.appendChild(script);
  });
  return tesseractLoader;
}

function getImageFile(){
  return document.getElementById('weight-camera-input')?.files?.[0]
    || document.getElementById('weight-gallery-input')?.files?.[0]
    || null;
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('画像を読み込めませんでした。'));};
    image.src=url;
  });
}

function setLoading(visible,detail=''){
  const overlay=document.getElementById('loading-overlay');
  if(!overlay) return;
  overlay.style.display=visible?'flex':'none';
  overlay.setAttribute('aria-hidden',visible?'false':'true');
  const title=overlay.querySelector('p');
  const sub=overlay.querySelector('.loading-subtext');
  if(title) title.textContent='体組成データを読み取っています...';
  if(sub) sub.textContent=detail || 'Smart Scale固定フォーマットを解析中';
}

function fieldValue(id){ return String(document.getElementById(id)?.value||'').trim(); }
function clearFields(){
  [...FIELDS.map(f=>f.id),'input-bodytype-val'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
function applyValues(values){
  Object.entries(values).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if(!el || value===null || value===undefined || value==='') return;
    el.value=String(value);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  });
}
function showEditor(){
  const editor=document.getElementById('weight-result-edit-container');
  if(!editor) return;
  editor.style.display='block';
  requestAnimationFrame(()=>editor.scrollIntoView({behavior:'smooth',block:'start'}));
}
function showNotice(text){
  const editor=document.getElementById('weight-result-edit-container');
  if(!editor) return;
  let notice=document.getElementById('body-ocr-notice');
  if(!notice){
    notice=document.createElement('div');
    notice.id='body-ocr-notice';
    notice.className='body-ocr-notice';
    editor.prepend(notice);
  }
  notice.textContent=text;
}

function cropRect(field,image){
  const xs=field.col===0?LAYOUT.left:LAYOUT.right;
  const cy=LAYOUT.firstY+LAYOUT.rowStep*field.row;
  return {
    sx:Math.round(xs[0]*image.naturalWidth),
    sy:Math.max(0,Math.round((cy-LAYOUT.halfHeight)*image.naturalHeight)),
    sw:Math.round((xs[1]-xs[0])*image.naturalWidth),
    sh:Math.round(LAYOUT.halfHeight*2*image.naturalHeight),
  };
}

function buildComposite(image,mode='contrast'){
  const rowH=110, width=980;
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=rowH*FIELDS.length;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font='bold 42px monospace';
  ctx.textBaseline='middle';
  ctx.fillStyle='#000';

  FIELDS.forEach((field,index)=>{
    const y=index*rowH;
    ctx.fillText(String(index+1).padStart(2,'0')+':',18,y+rowH/2);
    const r=cropRect(field,image);
    ctx.drawImage(image,r.sx,r.sy,r.sw,r.sh,150,y+8,width-170,rowH-16);
  });

  const pixels=ctx.getImageData(130,0,width-130,canvas.height);
  const data=pixels.data;
  for(let i=0;i<data.length;i+=4){
    const gray=data[i]*.299+data[i+1]*.587+data[i+2]*.114;
    let v=gray;
    if(mode==='contrast') v=Math.max(0,Math.min(255,(gray-140)*2.0+140));
    if(mode==='threshold') v=gray<205?0:255;
    data[i]=data[i+1]=data[i+2]=v;
    data[i+3]=255;
  }
  ctx.putImageData(pixels,130,0);
  return canvas;
}

function normalizeNumber(raw,field){
  let token=String(raw||'')
    .replace(/[OoＯｏ]/g,'0')
    .replace(/[Il１|]/g,'1')
    .replace(/[，,]/g,'.')
    .replace(/[^0-9.]/g,'');
  if(!token) return null;
  const firstDot=token.indexOf('.');
  if(firstDot>=0) token=token.slice(0,firstDot+1)+token.slice(firstDot+1).replace(/\./g,'');
  let value=Number(token);
  if(!Number.isFinite(value)) return null;
  if(!token.includes('.') && field.decimals>0 && value>field.max){
    for(let p=1;p<=3;p+=1){
      const c=value/(10**p);
      if(c>=field.min && c<=field.max){value=c;break;}
    }
  }
  if(value<field.min || value>field.max) return null;
  return field.decimals===0?String(Math.round(value)):value.toFixed(field.decimals);
}

function parseCompositeText(text){
  const values={};
  const lines=String(text||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  for(const line of lines){
    const compact=line.replace(/\s+/g,'');
    let match=compact.match(/^(\d{1,2})\D*([0-9][0-9.,]*)/);
    if(!match) match=compact.match(/^(\d{2})([0-9][0-9.,]*)/);
    if(!match) continue;
    const index=Number(match[1])-1;
    const field=FIELDS[index];
    if(!field) continue;
    const normalized=normalizeNumber(match[2],field);
    if(normalized!==null) values[field.id]=normalized;
  }
  return values;
}

function reconcile(values){
  const n=id=>{const x=Number(values[id]);return Number.isFinite(x)?x:null;};
  const put=(id,v,d)=>{if(Number.isFinite(v))values[id]=d===0?String(Math.round(v)):v.toFixed(d);};
  let muscle=n('input-muscle-val');
  let bone=n('input-bone-val');
  let lean=n('input-leanbody-val');
  let fatMass=n('input-fatmass-val');
  let weight=n('input-weight-val');
  let fatRate=n('input-fat-val');

  if(muscle!==null && bone!==null){
    const derived=muscle+bone;
    if(derived>=20&&derived<=200&&(lean===null||Math.abs(lean-derived)<=1.2)){lean=derived;put('input-leanbody-val',derived,2);}
  }
  if(lean!==null && fatMass!==null){
    const derived=lean+fatMass;
    if(derived>=30&&derived<=250&&(weight===null||Math.abs(weight-derived)<=1.5)){weight=derived;put('input-weight-val',derived,2);}
  }
  if(weight!==null && fatMass!==null){
    const derived=fatMass/weight*100;
    if(derived>=3&&derived<=70&&(fatRate===null||Math.abs(fatRate-derived)<=2.0)){fatRate=derived;put('input-fat-val',derived,1);}
  }
  return values;
}

function withTimeout(promise,ms){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('OCR timeout')),ms)),
  ]);
}

async function recognizeNumbers(Tesseract,image){
  const worker=await Tesseract.createWorker('eng',1);
  let values={};
  try{
    await worker.setParameters({
      tessedit_char_whitelist:'0123456789.:,',
      tessedit_pageseg_mode:'6',
      preserve_interword_spaces:'1',
      user_defined_dpi:'300',
    });
    setLoading(true,'15項目を一括認識中');
    const first=await withTimeout(worker.recognize(buildComposite(image,'contrast')),OCR_TIMEOUT_MS);
    values=parseCompositeText(first?.data?.text||'');

    if(Object.keys(values).length<12){
      setLoading(true,'未取得項目を再確認中');
      const second=await withTimeout(worker.recognize(buildComposite(image,'threshold')),OCR_TIMEOUT_MS);
      values={...parseCompositeText(second?.data?.text||''),...values};
    }
  }finally{
    try{void worker.terminate();}catch{}
  }
  return reconcile(values);
}

async function recognizeBodyTypeInBackground(Tesseract,image){
  const input=document.getElementById('input-bodytype-val');
  if(!input) return;
  const canvas=document.createElement('canvas');
  canvas.width=700;canvas.height=220;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,Math.round(image.naturalWidth*.54),Math.round(image.naturalHeight*.884),Math.round(image.naturalWidth*.40),Math.round(image.naturalHeight*.045),0,0,canvas.width,canvas.height);
  try{
    const result=await withTimeout(Tesseract.recognize(canvas,'jpn',{tessedit_pageseg_mode:'7'}),6000);
    const text=String(result?.data?.text||'').replace(/\s+/g,'');
    let type='';
    if(/標.{0,3}(準|准)/.test(text)) type='標準的';
    else if(/隠.{0,3}肥.{0,3}満/.test(text)) type='隠れ肥満型';
    else if(/筋.{0,3}肉/.test(text)) type='筋肉型';
    else if(/運.{0,3}動/.test(text)) type='運動型';
    else if(/やせ|痩/.test(text)) type='やせ型';
    else if(/肥.{0,3}満/.test(text)) type='肥満型';
    if(type&&!input.value) input.value=type;
  }catch{}
}

async function runBodyOcr(event){
  event.preventDefault();
  event.stopImmediatePropagation();
  const button=event.currentTarget;
  const file=getImageFile();
  const pasted=fieldValue('weight-text-input');
  if(!file&&!pasted){window.alert('体組成計の画像を選択してください。');return;}
  button.disabled=true;
  clearFields();
  document.getElementById('body-ocr-notice')?.remove();
  try{
    let values={};
    let image=null;
    let Tesseract=null;
    if(file){
      setLoading(true,'Smart Scale画像を準備中');
      [Tesseract,image]=await Promise.all([loadTesseract(),loadImage(file)]);
      values=await recognizeNumbers(Tesseract,image);
    }
    applyValues(values);
    setLoading(false);
    showEditor();
    const count=FIELDS.filter(f=>fieldValue(f.id)!=='').length;
    showNotice(count===FIELDS.length?'15項目を読み取りました。数値を確認して保存してください。':`${count}/15項目を読み取りました。空欄だけ確認・手入力してください。`);
    if(Tesseract&&image) void recognizeBodyTypeInBackground(Tesseract,image);
  }catch(error){
    console.error('Body OCR failed:',error);
    setLoading(false);
    showEditor();
    showNotice('読み取りを完了できませんでした。取得できた値を確認し、空欄は手入力してください。');
  }finally{
    setLoading(false);
    button.disabled=false;
  }
}

function reconcileForm(){
  const values={};
  FIELDS.forEach(f=>{const v=fieldValue(f.id);if(v!=='')values[f.id]=v;});
  applyValues(reconcile(values));
}

async function saveBodyComposition(event){
  event.preventDefault();
  event.stopImmediatePropagation();
  if(saveInProgress)return;
  reconcileForm();
  if(!fieldValue('input-weight-val')&&!fieldValue('input-fat-val')&&!fieldValue('input-muscle-val')){
    window.alert('体重、体脂肪率、筋肉量のいずれかを入力してください。');
    return;
  }
  saveInProgress=true;
  const button=event.currentTarget;
  button.disabled=true;
  setLoading(true,'体組成データを保存中');
  try{
    const form=new FormData();
    FIELDS.forEach(f=>form.append(f.key,fieldValue(f.id)));
    form.append('bodyType',fieldValue('input-bodytype-val'));
    form.append('date',fieldValue('weight-date-input'));
    form.append('measurementType',document.querySelector('#weight-type-chips .weight-chip.active')?.dataset?.type||'morning');
    form.append('textInput',fieldValue('weight-text-input'));
    const image=getImageFile();
    if(image)form.append('image',image);
    const response=await fetch('/api/body-composition',{method:'POST',body:form});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'保存に失敗しました。');
    window.location.reload();
  }catch(error){
    console.error('Body composition save failed:',error);
    window.alert(`保存に失敗しました。\n${error.message||''}`);
  }finally{
    setLoading(false);
    button.disabled=false;
    saveInProgress=false;
  }
}

function ensureStyles(){
  if(document.getElementById('body-ocr-v2-style'))return;
  const style=document.createElement('style');
  style.id='body-ocr-v2-style';
  style.textContent=`
    #weight-result-edit-container.body-comp-results-edit-card{background:#132b3a!important;border:1px solid #294759!important}
    #weight-result-edit-container .result-edit-field{background:#102431!important;border:1px solid #36576a!important}
    #weight-result-edit-container .input-number-v2{background:#071923!important;color:#fff!important;border:1px solid #3d6074!important;font-weight:800!important}
    #btn-save-weight{background:linear-gradient(135deg,#168f5c,#1fbf78)!important;border:1px solid #42d995!important;color:#fff!important;font-weight:800!important}
    .body-ocr-notice{margin:0 0 12px;padding:10px 12px;border:1px solid #36576a;border-radius:10px;background:rgba(31,191,120,.08);color:#e6f0f5;font-size:12px;line-height:1.5}
    .floating-entry-actions{position:absolute;left:14px;bottom:76px;z-index:7000;display:flex;flex-direction:column;gap:10px;pointer-events:none}
    .floating-entry-btn{pointer-events:auto;width:54px;height:54px;border-radius:50%;border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.32)}
    .floating-entry-btn.meal{background:linear-gradient(135deg,#148866,#20b981)}.floating-entry-btn.body{background:linear-gradient(135deg,#17677e,#20a4bf)}
    .floating-entry-btn svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .floating-entry-btn .fab-label{display:none}
  `;
  document.head.appendChild(style);
}

function ensureFloatingButtons(){
  if(document.getElementById('floating-entry-actions'))return;
  const host=document.querySelector('.app-container')||document.body;
  const wrap=document.createElement('div');
  wrap.id='floating-entry-actions';
  wrap.className='floating-entry-actions';
  wrap.innerHTML=`<button type="button" class="floating-entry-btn meal" id="floating-open-meal" aria-label="メニュー登録"><svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v8c0 1.1.9 2 2 2h3v3"/></svg><span class="fab-label">メニュー登録</span></button><button type="button" class="floating-entry-btn body" id="floating-open-weight" aria-label="体組成登録"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8a4 4 0 0 1 8 0"/><path d="M12 8l2-2"/></svg><span class="fab-label">体組成登録</span></button>`;
  host.appendChild(wrap);
  document.getElementById('floating-open-meal')?.addEventListener('click',()=>document.getElementById('btn-open-meal-entry')?.click());
  document.getElementById('floating-open-weight')?.addEventListener('click',()=>document.getElementById('btn-open-weight-entry')?.click());
}

function install(){
  ensureStyles();
  ensureFloatingButtons();
  const version=document.querySelector('.app-version');if(version)version.textContent=APP_VERSION;
  const analyze=document.getElementById('btn-analyze-weight');
  if(analyze){
    analyze.textContent='体組成を読み取る';
    analyze.addEventListener('click',runBodyOcr,{capture:true});
  }
  const save=document.getElementById('btn-save-weight');
  if(save)save.addEventListener('click',saveBodyComposition,{capture:true});
  const bodyType=document.getElementById('input-bodytype-val');
  if(bodyType)bodyType.placeholder='任意';
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
}
