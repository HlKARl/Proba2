/* PROBA — client-side study RPG. All progress and imported banks stay on this device. */
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const FRENZY_ACTIVATION_SECONDS = 150;
const FRENZY_DURATION_SECONDS = 45;

const CLASS_INFO = {
  ninja:{
    name:'Ninja',
    icon:'影',
    tag:'Velocidad y dominio',
    desc:'Su especialidad es avanzar rápidamente mediante respuestas correctas y saltarse preguntas.',
    ability:'Paso veloz: 2 saltos cada 3 aciertos seguidos',
    initial:{name:'Paso veloz',desc:'Cada 3 respuestas correctas consecutivas obtiene 2 saltos.',icon:'影'},
    color:'green'
  },
  thief:{
    name:'Ladrón',
    icon:'♜',
    tag:'Manipulación y oportunidad',
    desc:'Su especialidad es manipular las alternativas y reducir la incertidumbre.',
    ability:'Robo de respuestas: elimina 1 opción incorrecta',
    initial:{name:'Robo de respuestas',desc:'Elimina automáticamente una alternativa incorrecta por pregunta.',icon:'♜'},
    color:'gold'
  },
  mage:{
    name:'Mago',
    icon:'✧',
    tag:'Azar y caos',
    desc:'Su especialidad es alterar las reglas de la campaña mediante resultados impredecibles.',
    ability:'Dados del destino: lanza un dado en la pregunta 10',
    initial:{name:'Dados del destino',desc:'Al llegar a la pregunta 10, lanza un dado que produce uno de los seis efectos especiales.',icon:'✧'},
    color:'purple'
  },
  berserker:{
    name:'Berserker',
    icon:'⚔',
    tag:'Riesgo y recompensa',
    desc:'Su especialidad es conseguir cantidades enormes de oro, a cambio de arriesgarlo todo.',
    ability:'Furia: oro ×2 · derrota cuesta todo + 10 % general',
    initial:{name:'Furia',desc:'Obtiene el doble de oro por cada respuesta correcta que genere recompensa.',icon:'⚔'},
    color:'red'
  }
};

const SKILLS = {
  ninja:[
    {id:'ninja-skill1',rank:'II',kind:'sacrificio',name:'Desapego',desc:'Comienza la campaña con un comodín menos.',cost:100000,icon:'◈'},
    {id:'ninja-skill2',rank:'III',kind:'mejora',name:'Reflejos',desc:'Ahora obtiene los 2 saltos cada 2 respuestas correctas consecutivas.',cost:400000,icon:'➶'},
    {id:'ninja-skill3',rank:'IV',kind:'sacrificio',name:'Riesgo calculado',desc:'Si responde incorrectamente, pierde todos los saltos acumulados.',cost:650000,icon:'⚠'},
    {id:'ninja-skill4',rank:'V',kind:'maestria',name:'Maestro de las sombras',desc:'Puede acumular hasta 6 saltos en lugar de 2 o 4.',cost:1000000,icon:'✦'}
  ],
  thief:[
    {id:'thief-skill1',rank:'II',kind:'sacrificio',name:'Codicia',desc:'Comienza la campaña con un comodín menos.',cost:100000,icon:'◈'},
    {id:'thief-skill2',rank:'III',kind:'mejora',name:'Hurto mayor',desc:'Una vez por cada bloque de 5 preguntas, puede eliminar una segunda alternativa incorrecta.',cost:400000,icon:'⟡'},
    {id:'thief-skill3',rank:'IV',kind:'sacrificio',name:'Juego peligroso',desc:'No puede utilizar el comodín 50/50 durante la campaña.',cost:650000,icon:'⚠'},
    {id:'thief-skill4',rank:'V',kind:'maestria',name:'Maestro del engaño',desc:'Puede eliminar una segunda alternativa incorrecta en cada pregunta, sin consumir usos adicionales.',cost:1000000,icon:'♢'}
  ],
  mage:[
    {id:'mage-skill1',rank:'II',kind:'sacrificio',name:'Pacto arcano',desc:'Comienza la campaña con un comodín menos.',cost:100000,icon:'◈'},
    {id:'mage-skill2',rank:'III',kind:'mejora',name:'Manipulación del destino',desc:'Puede retrasar el lanzamiento de los dados hasta 5 preguntas, una vez por campaña.',cost:400000,icon:'⏳'},
    {id:'mage-skill3',rank:'IV',kind:'sacrificio',name:'Deuda mágica',desc:'La campaña recibe 5 preguntas adicionales.',cost:650000,icon:'⚠'},
    {id:'mage-skill4',rank:'V',kind:'maestria',name:'Doble destino',desc:'Al lanzar los dados, obtiene dos resultados y puede elegir cuál aplicar.',cost:1000000,icon:'⚅'}
  ],
  berserker:[
    {id:'berserker-skill1',rank:'II',kind:'sacrificio',name:'Descontrol',desc:'Comienza la campaña con un comodín menos.',cost:200000,icon:'◈'},
    {id:'berserker-skill2',rank:'III',kind:'mejora',name:'Sed de sangre',desc:'El multiplicador de oro aumenta a ×3.',cost:700000,icon:'🔥'},
    {id:'berserker-skill3',rank:'IV',kind:'sacrificio',name:'Sin retirada',desc:'Si abandona voluntariamente una campaña, pierde todo el oro acumulado en ella.',cost:1100000,icon:'⚠'},
    {id:'berserker-skill4',rank:'V',kind:'maestria',name:'Furia absoluta',desc:'El multiplicador aumenta a ×4 y la bonificación por completar la campaña es de 50.000 de oro.',cost:1800000,icon:'⚡'}
  ]
};

const MAGE_DICE_EFFECTS = [
  {id:'gold4',face:'⚀',name:'Fortuna arcana (×4)',desc:'Multiplica por ×4 el oro obtenido en adelante durante esta campaña.'},
  {id:'skip10',face:'⚁',name:'Salto dimensional',desc:'Saltarse 10 preguntas de la campaña.'},
  {id:'halfRemaining',face:'⚂',name:'Fractura temporal',desc:'Reduce a la mitad las preguntas restantes, saltándose una de cada dos.'},
  {id:'restartQ1',face:'⚃',name:'Bucle cronológico',desc:'Regresa a la pregunta 1 conservando el oro acumulado.'},
  {id:'add5',face:'⚄',name:'Paradoja extendida',desc:'Añade 5 preguntas adicionales a la campaña.'},
  {id:'jokers2',face:'⚅',name:'Saqueo astral',desc:'Roba 2 comodines adicionales para esta campaña.'}
];

const LEVELS=[{name:'Nivel I',size:5,bonus:5000},{name:'Nivel II',size:10,bonus:10000},{name:'Nivel III',size:15,bonus:15000}];
const DEFAULT_STATE={version:5,gold:1000,subjects:[],selectedDocuments:[],unlocks:{ninja:[],thief:[],mage:[],berserker:[]},masteredQuestions:{},history:[],totals:{correct:0,answered:0,completed:0,failed:0,frenzyBest:null},settings:{questionGold:1000,frenzySeconds:FRENZY_DURATION_SECONDS,activeClass:'ninja'}};
let state=structuredClone(DEFAULT_STATE),db=null,selectedMode='campaign',selectedClass='ninja',game=null,toastTimer=null,clockTimer=null,modalLocked=false;

function openDB(){return new Promise(resolve=>{try{if(!('indexedDB'in window)||!window.indexedDB){resolve(null);return;}const req=window.indexedDB.open('proba-local-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('app'))req.result.createObjectStore('app');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);}catch{resolve(null);}});}
async function loadState(){db=await openDB();if(db){const value=await new Promise(resolve=>{const tx=db.transaction('app','readonly'),r=tx.objectStore('app').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});if(value)state=mergeState(value);}else{try{const value=JSON.parse(localStorage.getItem('proba-state')||'null');if(value)state=mergeState(value);}catch{}}}

function migrateClassUnlocks(classId, list){
  if(!Array.isArray(list)) return [];
  const validIds = SKILLS[classId].map(s=>s.id);
  if(list.every(id=>validIds.includes(id))) return [...new Set(list)];
  // Migrate older positional node unlocks (v1-v4) sequentially to the 4 new nodes
  const count = Math.min(list.length, validIds.length);
  return validIds.slice(0, count);
}

function mergeState(v){
 const merged={...structuredClone(DEFAULT_STATE),...v,version:5,totals:{...DEFAULT_STATE.totals,...(v.totals||{})},settings:{...DEFAULT_STATE.settings,...(v.settings||{})},unlocks:{...DEFAULT_STATE.unlocks,...(v.unlocks||{})},masteredQuestions:{...(v.masteredQuestions||{})}};
 if((Number(v.version)||0)<2 && Number(v.gold||0)<=0) merged.gold=1000;
 if(!Number.isFinite(Number(merged.gold))) merged.gold=1000;
 merged.settings.frenzySeconds = FRENZY_DURATION_SECONDS;
 for(const cid of ['ninja','thief','mage','berserker']){
   merged.unlocks[cid] = migrateClassUnlocks(cid, merged.unlocks[cid]);
 }
 const allIds=(merged.subjects||[]).flatMap(sub=>(sub.documents||[]).map(doc=>doc.id));
 merged.selectedDocuments=Array.isArray(v.selectedDocuments)?[...new Set(v.selectedDocuments.filter(id=>allIds.includes(id)))]:allIds;
 if(!['ninja','thief','mage','berserker'].includes(merged.settings.activeClass))merged.settings.activeClass='ninja';
 return merged;
}

async function saveState(render=true){if(db){await new Promise(resolve=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put(state,'state');tx.oncomplete=resolve;tx.onerror=resolve;});}else{try{localStorage.setItem('proba-state',JSON.stringify(state));}catch{showToast('No se pudo guardar. Exporta una copia de seguridad.');}}if(render)renderAll();}
const fmt=n=>Math.round(Number(n)||0).toLocaleString('es-EC');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);}
function sumQuestions(ids){return state.subjects.flatMap(s=>s.documents.filter(d=>ids.includes(d.id)).map(d=>d.questions)).flat();}
function normalizeKnowledgeText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function questionFingerprint(q){const options=(q.options||[]).map(normalizeKnowledgeText).sort();return JSON.stringify([normalizeKnowledgeText(q.question),options,normalizeKnowledgeText(q.options?.[q.answer]??'')]);}
function uniqueQuestionList(questions){const seen=new Set();return questions.filter(q=>{const key=questionFingerprint(q);if(seen.has(key))return false;seen.add(key);return true;});}
function countQuestions(ids){return uniqueQuestionList(sumQuestions(ids)).length;}
function allDocs(){return state.subjects.flatMap(s=>s.documents.map(d=>({...d,subjectName:s.name,subjectId:s.id})));}
function classLevel(id){return 1+(state.unlocks[id]||[]).length;}
function classHas(id,skill){return (state.unlocks[id]||[]).includes(skill);}
function nextSkill(id){return SKILLS[id].find(n=>!classHas(id,n.id));}
function uuid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function nav(page){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${page}`));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));window.scrollTo({top:0,behavior:'smooth'});}

function openModal(title,body,eyebrow='PROBA',locked=false){
  modalLocked=locked;
  $('#modalTitle').textContent=title;
  $('#modalEyebrow').textContent=eyebrow;
  $('#modalBody').innerHTML=body;
  $('#closeModal').classList.toggle('hidden',locked);
  $('#modalBackdrop').classList.remove('hidden');
}
function closeModal(force=false){
  if(modalLocked && !force) return;
  modalLocked=false;
  $('#closeModal').classList.remove('hidden');
  $('#modalBackdrop').classList.add('hidden');
  $('#modalBody').innerHTML='';
}

function levelForQuestion(q){if(q<=5)return 0;if(q<=15)return 1;return 2;}
function getClassAbilitySummary(id){
  const bought=state.unlocks[id]||[];
  if(id==='ninja'){
    const every=bought.includes('ninja-skill2')?2:3;
    const cap=bought.includes('ninja-skill4')?6:4;
    return `Paso veloz: 2 saltos cada ${every} aciertos (máx. ${cap})`;
  }
  if(id==='thief'){
    if(bought.includes('thief-skill4')) return 'Maestro del engaño: elimina hasta 2 opciones por pregunta';
    if(bought.includes('thief-skill2')) return 'Hurto mayor: 2.ª opción eliminable cada 5 preguntas';
    return 'Robo de respuestas: elimina 1 opción incorrecta';
  }
  if(id==='mage'){
    if(bought.includes('mage-skill4')) return 'Doble destino: elige entre 2 dados en P. 10';
    if(bought.includes('mage-skill2')) return 'Manipulación del destino: dado en P. 10 (retrasable)';
    return 'Dados del destino: dado mágico en P. 10';
  }
  if(id==='berserker'){
    const mult=bought.includes('berserker-skill4')?'×4':bought.includes('berserker-skill2')?'×3':'×2';
    return `Furia: oro ${mult} · derrota cuesta todo + 10 % general`;
  }
  return CLASS_INFO[id]?.ability||'';
}

function renderAll(){renderHeader();renderSubjects();renderAdventure();renderClasses();renderHistory();}
function renderHeader(){$('#goldBalance').textContent=fmt(state.gold);}
function renderSubjects(){const grid=$('#subjectGrid');grid.innerHTML=state.subjects.map(s=>`<article class="subject-card"><span class="eyebrow">${s.documents.length} DOCUMENTO${s.documents.length===1?'':'S'}</span><h3>${esc(s.name)}</h3><p>${s.documents.reduce((n,d)=>n+d.questions.length,0)} preguntas disponibles</p><div class="subject-actions"><button class="small-button" data-subject-action="import" data-id="${s.id}">＋ Importar</button><button class="small-button" data-subject-action="view" data-id="${s.id}">Documentos</button><button class="small-button danger" data-subject-action="delete" data-id="${s.id}">Eliminar</button></div></article>`).join('');$('#emptyLibrary').classList.toggle('hidden',state.subjects.length>0);grid.classList.toggle('hidden',!state.subjects.length);$('#completedCampaigns').textContent=fmt(state.totals.completed);$('#totalCorrect').textContent=fmt(state.totals.correct);const fav=Object.entries(state.history.reduce((o,h)=>{if(h.mode==='campaign'&&h.classId&&CLASS_INFO[h.classId])o[h.classId]=(o[h.classId]||0)+1;return o;},{})).sort((a,b)=>b[1]-a[1])[0];$('#favoriteClass').textContent=fav?CLASS_INFO[fav[0]].name:'—';}
function renderAdventure(){const box=$('#adventureDocuments'),docs=allDocs();const validIds=new Set(docs.map(d=>d.id));state.selectedDocuments=(state.selectedDocuments||[]).filter(id=>validIds.has(id));box.innerHTML=docs.map(d=>`<label class="doc-row"><input type="checkbox" class="adventure-check" value="${d.id}" ${state.selectedDocuments.includes(d.id)?'checked':''}/><span><strong>${esc(d.name)}</strong><small>${d.questions.length} preguntas · ${esc(d.subjectName)}</small></span><span class="doc-subject">${esc(d.subjectName)}</span></label>`).join('');$('#noDocsHint').classList.toggle('hidden',docs.length>0);$$('.adventure-check').forEach(c=>c.addEventListener('change',()=>updateAdventure(true)));updateAdventure(false);}
function updateAdventure(persist=true){const ids=$$('.adventure-check:checked').map(c=>c.value);state.selectedDocuments=ids;const n=countQuestions(ids);$('#selectedCount').textContent=`${ids.length} documento${ids.length===1?'':'s'} seleccionado${ids.length===1?'':'s'}`;$('#availableQuestions').textContent=`${n} preguntas disponibles`;$('#chosenClassIcon').textContent=CLASS_INFO[selectedClass].icon;$('#chosenClassName').textContent=`${CLASS_INFO[selectedClass].name} · Nivel ${classLevel(selectedClass)}`;$('#chosenClassAbility').textContent=getClassAbilitySummary(selectedClass);const hasGold=state.gold>0&&state.gold>=1;const valid=selectedMode==='campaign'?n>=30:n>=1;const canPlay=valid&&!(selectedMode==='campaign'&&selectedClass==='berserker'&&!hasGold);$('#startGameButton').disabled=!canPlay;$('#startNote').textContent=selectedMode==='campaign'?(selectedClass==='berserker'&&!hasGold?'El Berserker requiere oro en tu cartera para entrar a una campaña.':`Campaña: 5 + 10 + 15 preguntas. ${n<30?`El banco activo tiene ${n}; faltan ${30-n} para iniciar.`:'¡Banco listo! Tu selección se conservará para la próxima partida.'}`):`Modo Estudio: ${n} preguntas disponibles en tus fuentes activas.`;if(persist)saveState(false);}

function renderClasses(){
  const cards=$('#classCards');
  cards.innerHTML=Object.entries(CLASS_INFO).map(([id,c])=>`<article class="class-card ${id===selectedClass?'selected':''}" data-class-card="${id}" role="button" tabindex="0"><div class="class-icon">${c.icon}</div><h3>${c.name}</h3><p>${c.desc}</p><div class="class-level">${id===selectedClass?'CLASE ACTIVA · ':''}NIVEL ${classLevel(id)} · ${(state.unlocks[id]||[]).length}/4 DESBLOQUEOS</div></article>`).join('');
  const cInfo=CLASS_INFO[selectedClass],nodes=SKILLS[selectedClass],bought=state.unlocks[selectedClass]||[],next=nextSkill(selectedClass);
  $('#treeHeader').innerHTML=`<div class="tree-head"><div><span class="eyebrow">PROGRESIÓN DE CLASE (5 NIVELES)</span><h2>${cInfo.name}</h2><p>Nivel ${classLevel(selectedClass)} · ${bought.length} de 4 nodos desbloqueados</p></div><span class="coin">◈ ${fmt(state.gold)} ORO</span></div><p class="tree-wallet-note">Desbloquea cada sacrificio para habilitar la siguiente mejora y alcanzar la maestría de clase.</p>`;
  const initialHTML=`<div class="skill-node inicial"><div class="node-icon">${cInfo.initial.icon}</div><div><h4>Nivel I · ${esc(cInfo.initial.name)} <span class="node-badge inicial">Inicial</span></h4><p>${esc(cInfo.initial.desc)}</p></div><div class="node-status">ACTIVO</div></div>`;
  const kindLabel={sacrificio:'Sacrificio',mejora:'Mejora',maestria:'Maestría'};
  const nodesHTML=nodes.map(n=>{
    const owned=bought.includes(n.id),available=next?.id===n.id;
    return `<div class="skill-node ${n.kind}"><div class="node-icon">${n.icon}</div><div><h4>Nivel ${n.rank} · ${esc(n.name)} <span class="node-badge ${n.kind}">${kindLabel[n.kind]}</span></h4><p>${esc(n.desc)}</p></div><div class="node-status">${owned?'DESBLOQUEADO':available?'DISPONIBLE':'BLOQUEADO'}${available?`<button class="small-button" data-buy-skill="${n.id}" data-class="${selectedClass}">${fmt(n.cost)} ◈</button>`:''}</div></div>`;
  }).join('');
  $('#skillTree').innerHTML=`<div class="tree-list">${initialHTML}${nodesHTML}</div>`;
  updateAdventure(false);
}

function renderHistory(){const hist=state.history.slice(0,30);$('#historyList').innerHTML=hist.length?hist.map(h=>`<div class="history-row"><div><b>${esc(h.subject||'Partida')} · ${esc(h.mode==='campaign'?'Campaña':'Estudio')} ${h.classId&&CLASS_INFO[h.classId]?`· ${CLASS_INFO[h.classId].name}`:''}</b><small>${new Date(h.date).toLocaleString('es-EC')} · ${h.correct}/${h.answered} aciertos ${h.outcome?`· ${esc(h.outcome)}`:''}</small>${h.mistakes?.length?`<button class="text-button" data-review-history="${state.history.indexOf(h)}">Repasar ${h.mistakes.length} errores</button>`:''}</div><div class="history-result">${h.gold>=0?'+':''}${fmt(h.gold)} ◈<small>${h.outcome==='victoria'?'Victoria':h.outcome==='derrota'?'Derrota':h.outcome==='retiro'?'Retirada':'Práctica'}</small></div></div>`).join(''):'<div class="inline-empty panel">Todavía no tienes partidas registradas.</div>';$('#statGold').textContent=fmt(state.gold);$('#statRuns').textContent=fmt(state.history.filter(h=>h.mode==='campaign').length);const t=state.totals;$('#statAccuracy').textContent=t.answered?`${Math.round(t.correct/t.answered*100)}%`:'—';$('#statFrenzy').textContent=t.frenzyBest!=null?`${Math.floor(t.frenzyBest/60)}:${String(t.frenzyBest%60).padStart(2,'0')}`:'—';}

function createSubject(){openModal('Nueva materia',`<form id="subjectForm" class="form-stack"><label>Nombre de la materia<input name="name" required maxlength="60" placeholder="Ej. Control industrial" autofocus></label><div class="form-actions"><button type="button" class="secondary-button" id="cancelForm">Cancelar</button><button class="primary-button">Crear materia</button></div></form>`,'BIBLIOTECA');$('#subjectForm').addEventListener('submit',async e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name').trim();if(!name)return;state.subjects.push({id:uuid(),name,documents:[]});await saveState();closeModal();showToast('Materia creada.');});$('#cancelForm').onclick=closeModal;}
function importToSubject(subjectId){const s=state.subjects.find(x=>x.id===subjectId);if(!s)return;openModal(`Importar a ${esc(s.name)}`,`<form id="importForm" class="form-stack"><label>Selecciona documentos<input type="file" id="questionFiles" multiple accept=".txt,.csv,.md,.docx,.xlsx,.pdf"></label><p class="modal-note">Formatos: TXT, CSV, DOCX, XLSX y PDF con texto seleccionable. Todo se guarda localmente. Los PDF requieren conexión la primera vez para cargar el lector; los PDF escaneados necesitan OCR externo.</p><div class="form-actions"><button type="button" class="secondary-button" id="cancelImport">Cancelar</button><button class="primary-button" type="submit">Importar y revisar</button></div><div id="importProgress" class="modal-note"></div></form>`,'BIBLIOTECA');$('#cancelImport').onclick=closeModal;$('#importForm').addEventListener('submit',async e=>{e.preventDefault();const files=[...$('#questionFiles').files];if(!files.length){showToast('Selecciona archivos.');return;}const btn=e.currentTarget.querySelector('button[type=submit]'),status=$('#importProgress');btn.disabled=true;let added=0,totalQuestions=0;for(const file of files){status.textContent=`Leyendo ${file.name}…`;try{const questions=await readQuestionFile(file);if(!questions.length){showToast(`${file.name}: no encontré preguntas válidas.`);continue;}totalQuestions+=questions.length;const newDoc={id:uuid(),name:file.name.replace(/\.[^.]+$/,''),fileName:file.name,questions,createdAt:new Date().toISOString()};s.documents.push(newDoc);state.selectedDocuments=[...new Set([...(state.selectedDocuments||[]),newDoc.id])];added++;}catch(err){console.error(err);showToast(`${file.name}: ${err.message||'no se pudo leer'}`);}}await saveState();closeModal();if(added){showToast(`${added} documento(s) importado(s): ${totalQuestions} preguntas detectadas.`);openDocumentManager(subjectId);}});}
function openDocumentManager(subjectId){const s=state.subjects.find(x=>x.id===subjectId);if(!s)return;openModal(s.name,`<div class="form-actions" style="justify-content:flex-start;margin-top:0;margin-bottom:12px"><button class="small-button" id="addManualQuestion">＋ Añadir pregunta</button><button class="small-button" id="addMoreFiles">＋ Importar archivos</button></div><div class="question-editor">${s.documents.map(d=>`<div class="editor-question"><button class="small-button danger" data-doc-delete="${d.id}">Eliminar</button><strong>${esc(d.name)}</strong><small>${d.questions.length} preguntas · ${esc(d.fileName||'Creado en Proba')}</small><div class="form-actions" style="justify-content:flex-start"><button class="small-button" data-doc-edit="${d.id}">Revisar preguntas</button><button class="small-button" data-doc-rename="${d.id}">Renombrar</button></div></div>`).join('')||'<p class="modal-note">Todavía no hay documentos en esta materia.</p>'}</div><div class="form-actions"><button class="secondary-button" id="doneDocs">Listo</button></div>`,'MATERIA');$('#doneDocs').onclick=closeModal;$('#addMoreFiles').onclick=()=>{closeModal();importToSubject(subjectId);};$('#addManualQuestion').onclick=()=>{closeModal();addManualQuestion(subjectId);};$$('[data-doc-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este documento y todas sus preguntas?'))return;s.documents=s.documents.filter(d=>d.id!==b.dataset.docDelete);state.selectedDocuments=(state.selectedDocuments||[]).filter(id=>id!==b.dataset.docDelete);await saveState();openDocumentManager(subjectId);});$$('[data-doc-edit]').forEach(b=>b.onclick=()=>{const doc=s.documents.find(d=>d.id===b.dataset.docEdit);if(doc)editDocumentQuestions(subjectId,doc.id);});$$('[data-doc-rename]').forEach(b=>b.onclick=()=>{const doc=s.documents.find(d=>d.id===b.dataset.docRename);if(!doc)return;closeModal();openModal('Renombrar documento',`<form id="renameDocForm" class="form-stack"><label>Nombre<input name="name" value="${esc(doc.name)}" required></label><div class="form-actions"><button type="button" class="secondary-button" id="cancelRename">Cancelar</button><button class="primary-button">Guardar</button></div></form>`);$('#cancelRename').onclick=closeModal;$('#renameDocForm').onsubmit=async e=>{e.preventDefault();doc.name=new FormData(e.currentTarget).get('name').trim();await saveState();closeModal();openDocumentManager(subjectId);};});}
function addManualQuestion(subjectId){openModal('Añadir pregunta',questionFormHTML(),'EDITOR');wireQuestionForm(async q=>{let s=state.subjects.find(x=>x.id===subjectId);if(!s)return;let d=s.documents.find(x=>x.manual===true);if(!d){d={id:uuid(),name:'Preguntas manuales',fileName:'Creado en Proba',manual:true,questions:[]};s.documents.push(d);}d.questions.push(q);state.selectedDocuments=[...new Set([...(state.selectedDocuments||[]),d.id])];await saveState();closeModal();openDocumentManager(subjectId);});}
function questionFormHTML(q={}){const answers=q.options||['','','',''];return `<form id="questionForm" class="form-stack"><label>Enunciado<textarea name="question" required>${esc(q.question||'')}</textarea></label>${answers.map((v,i)=>`<label>Opción ${'ABCD'[i]}<input name="opt${i}" required value="${esc(v)}"></label>`).join('')}<label>Respuesta correcta<select name="correct">${['A','B','C','D'].map((v,i)=>`<option value="${i}" ${(q.answer===i||q.answer===v)?'selected':''}>${v}</option>`).join('')}</select></label><label>Explicación (opcional)<textarea name="explanation">${esc(q.explanation||'')}</textarea></label><div class="form-actions"><button type="button" class="secondary-button" id="cancelQuestion">Cancelar</button><button class="primary-button">Guardar pregunta</button></div></form>`;}
function wireQuestionForm(onSave){$('#cancelQuestion').onclick=closeModal;$('#questionForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const q={id:uuid(),question:f.get('question').trim(),options:[0,1,2,3].map(i=>f.get(`opt${i}`).trim()),answer:Number(f.get('correct')),explanation:f.get('explanation').trim()};await onSave(q);};}
function editDocumentQuestions(subjectId,docId){const s=state.subjects.find(x=>x.id===subjectId),d=s?.documents.find(x=>x.id===docId);if(!d)return;openModal(`Revisar · ${esc(d.name)}`,`<p class="modal-note">Verifica el enunciado, las cuatro alternativas y la respuesta correcta antes de jugar. Puedes editar o eliminar preguntas.</p><div class="question-editor">${d.questions.map((q,i)=>`<div class="editor-question"><button class="small-button" data-q-edit="${q.id}">Editar</button><button class="small-button danger" data-q-delete="${q.id}">Eliminar</button><strong>${i+1}. ${esc(q.question)}</strong><small>Correcta: ${'ABCD'[q.answer]||'?'} · ${esc(q.options[q.answer]||'')}</small></div>`).join('')}</div><div class="form-actions"><button class="secondary-button" id="backDocManager">Volver</button><button class="primary-button" id="finishReview">Terminar revisión</button></div>`,'REVISIÓN');$('#backDocManager').onclick=()=>openDocumentManager(subjectId);$('#finishReview').onclick=()=>{closeModal();openDocumentManager(subjectId);};$$('[data-q-delete]').forEach(b=>b.onclick=async()=>{d.questions=d.questions.filter(q=>q.id!==b.dataset.qDelete);await saveState();editDocumentQuestions(subjectId,docId);});$$('[data-q-edit]').forEach(b=>b.onclick=()=>{const q=d.questions.find(q=>q.id===b.dataset.qEdit);if(!q)return;const old=q;closeModal();openModal('Editar pregunta',questionFormHTML(old),'EDITOR');wireQuestionForm(async updated=>{Object.assign(old,updated);await saveState();closeModal();editDocumentQuestions(subjectId,docId);});});}

// ---------- File readers ----------
async function readQuestionFile(file){const ext=file.name.split('.').pop().toLowerCase();if(['txt','md'].includes(ext))return parseQuestionText(await file.text());if(ext==='csv')return parseCSV(await file.text());if(ext==='docx')return parseDOCX(file);if(ext==='xlsx')return parseXLSX(file);if(ext==='pdf')return parsePDF(file);throw new Error('Formato no compatible. Usa TXT, CSV, DOCX, XLSX o PDF.');}
function cleanQuestion(s){return s.replace(/^(?:pregunta\s*\d*\s*[:.)-]?|\d+\s*[.)-])\s*/i,'').trim();}
function parseQuestionText(text){
 const normalized=String(text||'').replace(/\r/g,'').replace(/\f/g,'\n').replace(/\u00a0/g,' ');
 const markers=[...normalized.matchAll(/\bPregunta\s*\d+\s*[:.)-]\s*/gi)];
 if(markers.length){
  const chunks=markers.map((m,i)=>normalized.slice(m.index,markers[i+1]?.index??normalized.length));
  return chunks.map(parseNumberedQuestionChunk).filter(Boolean);
 }
 let blocks=normalized.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
 if(blocks.length===1){const lines=normalized.split('\n');blocks=[];let cur=[];for(const line of lines){if(/^(?:pregunta\s*\d*\s*[:.)-]|\d+\s*[.)-])\s*/i.test(line.trim())&&cur.length){blocks.push(cur.join('\n'));cur=[];}if(line.trim())cur.push(line);}if(cur.length)blocks.push(cur.join('\n'));}
 return blocks.map(parseLegacyQuestionBlock).filter(Boolean);
}
function parseNumberedQuestionChunk(chunk){
 const body=chunk.replace(/^\s*Pregunta\s*\d+\s*[:.)-]\s*/i,'').replace(/[\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim();
 const answerMatch=body.match(/\b(?:respuesta(?:\s+correcta)?|correcta|soluci[oó]n|clave(?:\s+correcta)?)\s*[:=\-]\s*([A-D1-4])\b/i);
 if(!answerMatch)return null;
 const explanationMatch=body.match(/\b(?:explicaci[oó]n|justificaci[oó]n|comentario)\s*[:=\-]\s*/i);
 const coreEnd=Math.min(answerMatch.index,explanationMatch?.index??body.length);
 const core=body.slice(0,coreEnd).trim();
 const optionMatches=[...core.matchAll(/(?:^|\s)([A-D])\s*[).:\-]\s*/gi)];
 if(optionMatches.length<3)return null;
 const question=core.slice(0,optionMatches[0].index).trim();
 const optionPairs=optionMatches.map((m,i)=>{
  const letter=m[1].toUpperCase();
  const valueStart=m.index+m[0].length;
  const valueEnd=optionMatches[i+1]?.index??core.length;
  return [letter,core.slice(valueStart,valueEnd).trim()];
 });
 const optionMap={};for(const [letter,value] of optionPairs)optionMap[letter]=value;
 const answerMark=answerMatch[1].toUpperCase();
 const answer=/^[1-4]$/.test(answerMark)?Number(answerMark)-1:'ABCD'.indexOf(answerMark);
 const letters=Object.keys(optionMap).sort();
 const contiguous=letters.every((l,i)=>l==='ABCD'[i]);
 const options=letters.map(l=>optionMap[l]);
 if(!question||!contiguous||!options[answer]||options.some(x=>!x))return null;
 const explanation=explanationMatch?body.slice(explanationMatch.index+explanationMatch[0].length).trim():'';
 return {id:uuid(),question,options,answer,explanation};
}
function parseLegacyQuestionBlock(block){
 const lines=block.split('\n').map(l=>l.trim()).filter(Boolean);let qline='',opts=[],ans=null,explanation='';
 for(const l of lines){let m;
  if((m=l.match(/^(?:respuesta(?:\s+correcta)?|correcta|soluci[oó]n|clave(?:\s+correcta)?)\s*[:=\-]\s*([A-D1-4])\b/i))){const mark=m[1].toUpperCase();ans=/^[1-4]$/.test(mark)?Number(mark)-1:'ABCD'.indexOf(mark);continue;}
  if((m=l.match(/^(?:explicaci[oó]n|justificaci[oó]n|comentario)\s*[:=\-]\s*(.*)$/i))){explanation=m[1];continue;}
  if((m=l.match(/^([A-D])\s*[).:\-]\s*(.+)$/i))){opts['ABCD'.indexOf(m[1].toUpperCase())]=m[2].trim();continue;}
  if(!qline)qline=cleanQuestion(l);else qline+=' '+l;
 }
 if(qline&&opts.filter(Boolean).length>=3&&ans!==null&&opts[ans])return {id:uuid(),question:qline,options:opts.filter(Boolean),answer:ans,explanation};
 return null;
}
function parseCSV(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=!quoted;else if((c===','||c===';'||c==='\t')&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}row.push(field);if(row.some(x=>x.trim()))rows.push(row);return tableToQuestions(rows);}
function tableToQuestions(rows){if(rows.length<2)return[];const headers=rows[0].map(h=>h.trim().toLowerCase());const find=(names)=>headers.findIndex(h=>names.some(n=>h===n)||names.some(n=>n.length>1&&h.includes(n)));const qi=find(['pregunta','enunciado','question']);const oi=['a','b','c','d'].map(x=>headers.findIndex(h=>[`opcion ${x}`,`opción ${x}`,`alternativa ${x}`,`option ${x}`,x].includes(h)));const ai=find(['respuesta correcta','correcta','respuesta','answer','clave']);const ei=find(['explicacion','explicación','justificacion','justificación','explanation']);if(qi<0||oi.some(i=>i<0)||ai<0)return[];return rows.slice(1).map(r=>{const a=String(r[ai]??'').trim().toUpperCase();const answer=/^[1-4]$/.test(a)?Number(a)-1:'ABCD'.indexOf(a[0]);const options=oi.map(i=>String(r[i]??'').trim());if(!String(r[qi]||'').trim()||answer<0||options.some(x=>!x))return null;return{id:uuid(),question:String(r[qi]).trim(),options,answer,explanation:ei>=0?String(r[ei]||'').trim():''};}).filter(Boolean);}
async function readZip(file){const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error('El archivo no parece ser un DOCX/XLSX válido.');const total=view.getUint16(eocd+10,true),start=view.getUint32(eocd+16,true),map=new Map();let p=start;for(let n=0;n<total;n++){if(view.getUint32(p,true)!==0x02014b50)break;const method=view.getUint16(p+10,true),size=view.getUint32(p+20,true),nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true),commentLen=view.getUint16(p+32,true),localOffset=view.getUint32(p+42,true);const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nameLen));const lp=localOffset,localName=view.getUint16(lp+26,true),localExtra=view.getUint16(lp+28,true),dataStart=lp+30+localName+localExtra,compressed=bytes.slice(dataStart,dataStart+size);let content;if(method===0)content=compressed;else if(method===8){if(!('DecompressionStream'in window))throw new Error('Este navegador no permite descomprimir DOCX/XLSX.');const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));content=new Uint8Array(await new Response(stream).arrayBuffer());}else{p+=46+nameLen+extraLen+commentLen;continue;}map.set(name,content);p+=46+nameLen+extraLen+commentLen;}return map;}
async function parseDOCX(file){const zip=await readZip(file),xml=zip.get('word/document.xml');if(!xml)throw new Error('No se encontró el contenido de Word.');const doc=new DOMParser().parseFromString(new TextDecoder().decode(xml),'application/xml');const paras=[...doc.getElementsByTagName('w:p')].map(p=>[...p.getElementsByTagName('w:t')].map(t=>t.textContent).join(''));return parseQuestionText(paras.join('\n'));}
async function parseXLSX(file){const zip=await readZip(file),shared=zip.get('xl/sharedStrings.xml'),sheet=zip.get('xl/worksheets/sheet1.xml');if(!sheet)throw new Error('No se encontró la primera hoja de cálculo.');const strings=[];if(shared){const d=new DOMParser().parseFromString(new TextDecoder().decode(shared),'application/xml');for(const si of [...d.getElementsByTagName('si')])strings.push([...si.getElementsByTagName('t')].map(x=>x.textContent).join(''));}const d=new DOMParser().parseFromString(new TextDecoder().decode(sheet),'application/xml');const rows=[];for(const row of [...d.getElementsByTagName('row')]){const cells=[];for(const c of [...row.getElementsByTagName('c')]){const ref=c.getAttribute('r')||'',letters=(ref.match(/[A-Z]+/)||['A'])[0];let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col--;const v=c.getElementsByTagName('v')[0]?.textContent??'';let val=c.getAttribute('t')==='s'?strings[Number(v)]??'':c.getAttribute('t')==='inlineStr'?[...c.getElementsByTagName('t')].map(x=>x.textContent).join(''):v;cells[col]=val;}rows.push(cells);}return tableToQuestions(rows);}
let pdfModule=null;async function parsePDF(file){try{if(!pdfModule){pdfModule=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfModule.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';}const pdf=await pdfModule.getDocument({data:await file.arrayBuffer()}).promise;let text='';for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent();text+=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n\n';}return parseQuestionText(text);}catch(e){throw new Error('No pude extraer el texto del PDF. Comprueba que tenga texto seleccionable y conexión a Internet la primera vez.');}}

// ---------- Skill shop ----------
async function buySkill(classId,skillId){const skill=SKILLS[classId]?.find(n=>n.id===skillId);if(!skill||classHas(classId,skillId)||nextSkill(classId)?.id!==skillId)return;if(state.gold<skill.cost){showToast('No tienes suficiente oro.');return;}state.gold-=skill.cost;state.unlocks[classId].push(skillId);await saveState();showToast(`Nivel ${skill.rank}: ${skill.name} desbloqueado.`);}

// ---------- Game engine ----------
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function getClassSettings(id){
  const bought=state.unlocks[id]||[];
  const s={
    minusOneJoker: bought.includes(`${id}-skill1`),
    multiplier: 1,
    skipEvery: 3,
    skipCap: 4,
    loseSkipsOnWrong: false,
    thiefRemove: 1,
    thiefBlockBonus: false,
    noFifty: false,
    thiefMastery: false,
    mageDelay: false,
    mageExtra5: false,
    mageDoubleDice: false,
    noRetireGold: false,
    berserkerBonus: 25000
  };
  if(id==='ninja'){
    if(bought.includes('ninja-skill2')) s.skipEvery=2;
    if(bought.includes('ninja-skill3')) s.loseSkipsOnWrong=true;
    if(bought.includes('ninja-skill4')) s.skipCap=6;
  }
  if(id==='thief'){
    if(bought.includes('thief-skill2')) s.thiefBlockBonus=true;
    if(bought.includes('thief-skill3')) s.noFifty=true;
    if(bought.includes('thief-skill4')) s.thiefMastery=true;
  }
  if(id==='mage'){
    if(bought.includes('mage-skill2')) s.mageDelay=true;
    if(bought.includes('mage-skill3')) s.mageExtra5=true;
    if(bought.includes('mage-skill4')) s.mageDoubleDice=true;
  }
  if(id==='berserker'){
    s.multiplier=2;
    if(bought.includes('berserker-skill2')) s.multiplier=3;
    if(bought.includes('berserker-skill3')) s.noRetireGold=true;
    if(bought.includes('berserker-skill4')){
      s.multiplier=4;
      s.berserkerBonus=50000;
    }
  }
  return s;
}

function buildCampaignQuestions(pool, count){
  if(pool.length >= count) return pool.slice(0, count);
  const extra = shuffle(pool).slice(0, count - pool.length);
  return [...pool, ...extra];
}

function selectedDocIds(){return (state.selectedDocuments||[]).slice();}

function startGame(){
  const ids=selectedDocIds(),pool=shuffle(uniqueQuestionList(sumQuestions(ids)));
  const mode=selectedMode;
  if(!ids.length){showToast('Activa al menos un documento en Fuentes activas.');return;}
  if(mode==='campaign'&&pool.length<30){showToast(`La campaña necesita 30 preguntas diferentes. Ahora tienes ${pool.length}.`);return;}
  if(mode==='campaign'&&selectedClass==='berserker'&&state.gold<=0){showToast('El Berserker exige tener oro en tu cartera.');return;}
  const docs=allDocs().filter(d=>ids.includes(d.id));
  const settings=mode==='campaign'?getClassSettings(selectedClass):null;
  const targetCount=mode==='campaign'?(30+(settings?.mageExtra5?5:0)):Math.min(pool.length,$('#studyCount').value==='all'?pool.length:Number($('#studyCount').value));
  const questions=mode==='campaign'?buildCampaignQuestions(pool,targetCount):pool.slice(0,targetCount);

  const jokers={fifty:1,hint:1,retry:1};
  if(mode==='campaign' && settings?.minusOneJoker){
    const candidates=settings.noFifty?['hint','retry']:['fifty','hint','retry'];
    const removed=candidates[Math.floor(Math.random()*candidates.length)];
    jokers[removed]=0;
  }

  game={
    mode,
    classId:mode==='campaign'?selectedClass:null,
    settings,
    questions,
    questionKeys:questions.map(questionFingerprint),
    newMastery:Array(questions.length).fill(false),
    index:0,
    correct:0,
    answered:0,
    answerLocked:false,
    runGold:0,
    secured:0,
    unsecured:0,
    initialGold:state.gold,
    started:Date.now(),
    elapsed:0,
    level1Time:null,
    level12Time:null,
    frenzy:false,
    frenzyEnds:0,
    skipProgress:0,
    pendingSkips:0,
    thiefBlockUsed:false,
    thiefQuestionBonusUsed:false,
    mageGoldMultiplier:1,
    mageDiceRolled:false,
    mageDiceDelayed:false,
    jokers,
    questionJokerUsed:false,
    retryUsed:false,
    retryArmed:false,
    eliminated:[],
    selected:null,
    docIds:ids,
    subject:docs.map(d=>d.subjectName).filter((v,i,a)=>a.indexOf(v)===i).join(', '),
    wrong:[],
    levelPaid:[false,false,false],
    lastResult:null,
    studyDone:[]
  };

  $('#gameOverlay').classList.remove('hidden');
  document.body.classList.add('game-active');
  $('#gameModeLabel').textContent=mode==='campaign'?'CAMPAÑA':'MODO ESTUDIO';
  $('#playerClassName').textContent=game.classId?CLASS_INFO[game.classId].name:'Práctica';
  $('#playerEmblem').textContent=game.classId?CLASS_INFO[game.classId].icon:'✎';
  $('#playerClassAbility').textContent=game.classId?getClassAbilitySummary(game.classId):'Sin riesgos: cada pregunta nueva dominada puede dar oro';
  $('#retireGameButton').classList.toggle('hidden',mode==='study');
  $('#gameFrenzy').classList.add('hidden');
  if(clockTimer)clearInterval(clockTimer);
  clockTimer=setInterval(gameTick,250);
  if(mode==='campaign' && settings?.minusOneJoker){
    showToast('Sacrificio de clase: comienzas con 1 comodín menos.');
  }
  loadGameQuestion();
}

function effectiveGoldMultiplier(){
  if(!game || game.mode!=='campaign') return 1;
  return (game.settings?.multiplier||1) * (game.mageGoldMultiplier||1);
}

function activeOptionCount(){
  if(!game) return 4;
  const q=game.questions[game.index];
  return (q?.options?.length||4) - game.eliminated.length;
}

function gameTick(){
  if(!game)return;
  game.elapsed=Math.floor((Date.now()-game.started)/1000);
  $('#gameTimer').textContent=`${String(Math.floor(game.elapsed/60)).padStart(2,'0')}:${String(game.elapsed%60).padStart(2,'0')}`;
  if(game.frenzy){
    const left=Math.max(0,Math.ceil((game.frenzyEnds-Date.now())/1000));
    $('#frenzyTimer').textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
    if(left<=0){
      game.frenzy=false;
      $('#gameFrenzy').classList.add('hidden');
      renderJokers();
      showToast('El frenesí ha terminado.');
    }
  }
}

function loadGameQuestion(){
  if(!game)return;
  if(game.index>=game.questions.length){finishGame('victoria');return;}
  const q=game.questions[game.index];
  game.selected=null;
  game.answerLocked=false;
  game.retryUsed=false;
  game.retryArmed=false;
  game.questionJokerUsed=false;
  game.thiefQuestionBonusUsed=false;
  game.eliminated=[];

  if(game.mode==='campaign' && game.classId==='thief' && (game.index % 5 === 0)){
    game.thiefBlockUsed=false;
  }

  const card=$('#questionCard');
  if(card) card.scrollTop=0;

  $('#nextQuestionButton').classList.add('hidden');
  $('#nextQuestionButton').textContent='Siguiente pregunta →';
  const lvl=game.mode==='campaign'?levelForQuestion(game.index+1):0;
  $('#gameLevelLabel').textContent=game.mode==='campaign'?LEVELS[lvl].name.toUpperCase():'MODO ESTUDIO';
  $('#gameQuestionLabel').textContent=`PREGUNTA ${game.index+1} / ${game.questions.length}`;
  $('#gameProgressFill').style.width=`${game.index/game.questions.length*100}%`;
  $('#questionSubject').textContent=game.subject||'BANCO DE PREGUNTAS';

  updateQuestionRewardBanner();

  $('#questionText').textContent=q.question;
  $('#answerHint').textContent='Toca dos veces una opción para confirmar.';
  $('#explanationBox').classList.add('hidden');
  $('#explanationBox').textContent='';
  $('#answerList').innerHTML=q.options.map((opt,i)=>`<button class="answer-option" data-answer="${i}"><span class="letter">${'ABCD'[i]}</span><span>${esc(opt)}</span></button>`).join('');
  $$('[data-answer]').forEach(b=>b.onclick=()=>chooseAnswer(Number(b.dataset.answer)));

  if(game.mode==='campaign'&&game.classId==='thief'){
    const wrong=shuffle(q.options.map((_,i)=>i).filter(i=>i!==q.answer)).slice(0,1);
    wrong.forEach(i=>game.eliminated.push(i));
    refreshAnswerOptions();
  }

  $('#checkpointLabel').textContent=game.mode==='campaign'?`Próximo punto de control: pregunta ${Math.min(game.questions.length,Math.ceil((game.index+1)/5)*5)}`:'Preguntas a tu ritmo · oro solo por nuevos aciertos';
  renderJokers();
  renderClassSkill();
  updateGameGold();

  // Check Mage Dice trigger on Question 10 (index 9) or forced trigger on Question 15 (index 14) if delayed
  if(game.mode==='campaign' && game.classId==='mage' && !game.mageDiceRolled){
    if(game.index===9 && !game.mageDiceDelayed){
      if(game.settings.mageDelay){
        promptMageDelayChoice();
      }else{
        openMageDiceModal();
      }
    }else if(game.mageDiceDelayed && game.index>=14){
      showToast('Límite alcanzado (P. 15): los Dados del destino se activan ahora.');
      openMageDiceModal();
    }
  }
}

function updateQuestionRewardBanner(){
  if(!game)return;
  const fresh=!state.masteredQuestions[game.questionKeys[game.index]];
  const mult=effectiveGoldMultiplier();
  $('#questionReward').textContent=fresh?`+${fmt(Math.round((state.settings.questionGold||1000)*mult))} ◈ NUEVA`:'YA DOMINADA · 0 ◈';
  $('#questionReward').title=fresh?'Recompensa única por dominar esta pregunta':'Esta pregunta ya fue dominada; no vuelve a generar oro';
}

function refreshAnswerOptions(){
  $$('[data-answer]').forEach(b=>{
    const i=Number(b.dataset.answer);
    b.classList.toggle('eliminated',game.eliminated.includes(i));
  });
}

function chooseAnswer(i){
  if(!game||game.answerLocked||modalLocked)return;
  if(game.eliminated.includes(i))return;
  if(game.selected===i){confirmAnswer(i);return;}
  game.selected=i;
  $$('[data-answer]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.answer)===i));
  $('#answerHint').textContent=`Respuesta ${'ABCD'[i]} seleccionada. Pulsa nuevamente para confirmar.`;
}

function confirmAnswer(i){
  if(!game||game.answerLocked||modalLocked)return;
  const q=game.questions[game.index];
  if(i===q.answer){handleCorrect();return;}
  if(game.mode==='study'){handleStudyWrong(i);return;}

  // Ninja consecutive streak resets on wrong attempt; Level IV loses all accumulated skips
  if(game.classId==='ninja'){
    game.skipProgress=0;
    if(game.settings.loseSkipsOnWrong && game.pendingSkips>0){
      game.pendingSkips=0;
      showToast('Riesgo calculado: perdiste todos tus saltos acumulados.');
    }
    renderClassSkill();
  }

  if(game.retryArmed&&!game.retryUsed){
    game.retryUsed=true;
    game.retryArmed=false;
    game.eliminated.push(i);
    refreshAnswerOptions();
    renderJokers();
    $('#answerHint').textContent='Segunda oportunidad activa: opción descartada. Elige otra respuesta y confirma.';
    game.selected=null;
    $$('[data-answer]').forEach(b=>b.classList.remove('selected'));
    return;
  }

  game.answerLocked=true;
  game.answered++;
  state.totals.answered++;
  game.wrong.push({question:q.question,options:q.options,chosen:i,correct:q.answer,explanation:q.explanation});
  showAnswerState(q.answer,'Respuesta incorrecta. La campaña ha terminado.');
  setTimeout(()=>finishGame('derrota'),1100);
}

function showAnswerState(correct,msg){
  $$('[data-answer]').forEach(b=>{
    const i=Number(b.dataset.answer);
    b.disabled=true;
    if(i===correct)b.classList.add('correct');
    else if(i===game.selected)b.classList.add('wrong');
  });
  $('#answerHint').textContent=msg;
  const q=game.questions[game.index];
  if(q.explanation){
    $('#explanationBox').textContent=q.explanation;
    $('#explanationBox').classList.remove('hidden');
  }
}

function applyCampaignMilestones(completed){
  if(game.mode!=='campaign')return;
  const mult=effectiveGoldMultiplier();
  if(completed===5 && !game.levelPaid[0]){
    const newInLevel=game.newMastery.slice(0,5).filter(Boolean).length;
    if(newInLevel>=Math.ceil(LEVELS[0].size*.6)){
      const bonus=Math.round(LEVELS[0].bonus*mult);
      game.runGold+=bonus;game.unsecured+=bonus;
    }
    game.levelPaid[0]=true;
    game.level1Time=game.elapsed;
  }
  if(completed===15 && !game.levelPaid[1]){
    const newInLevel=game.newMastery.slice(5,15).filter(Boolean).length;
    if(newInLevel>=Math.ceil(LEVELS[1].size*.6)){
      const bonus=Math.round(LEVELS[1].bonus*mult);
      game.runGold+=bonus;game.unsecured+=bonus;
    }
    game.levelPaid[1]=true;
    game.level12Time=game.elapsed;
    if(game.elapsed<FRENZY_ACTIVATION_SECONDS)activateFrenzy();
  }
  if(completed===game.questions.length && completed>15 && !game.levelPaid[2]){
    const segLen=completed-15;
    const newInLevel=game.newMastery.slice(15,completed).filter(Boolean).length;
    if(newInLevel>=Math.ceil(segLen*.6)){
      const bonus=Math.round(LEVELS[2].bonus*mult);
      game.runGold+=bonus;game.unsecured+=bonus;
    }
    game.levelPaid[2]=true;
  }
  if(completed%5===0 || completed===game.questions.length)secureCheckpoint();
}

function skipNinjaQuestion(){
  if(!game || game.answerLocked || game.pendingSkips<=0) return;
  const skippedIndex=game.index,completed=skippedIndex+1;
  game.pendingSkips--;
  game.newMastery[skippedIndex]=false;
  game.index++;
  applyCampaignMilestones(completed);
  showToast(`Salto utilizado (${game.pendingSkips} restantes).`);
  loadGameQuestion();
}

function handleCorrect(){
  if(!game||game.answerLocked)return;
  game.answerLocked=true;
  const q=game.questions[game.index],key=game.questionKeys[game.index],isNew=!state.masteredQuestions[key];
  game.newMastery[game.index]=isNew;
  if(isNew)state.masteredQuestions[key]=true;
  game.correct++;game.answered++;
  state.totals.correct++;state.totals.answered++;
  const mult=effectiveGoldMultiplier();
  const reward=isNew?Math.round((state.settings.questionGold||1000)*mult):0;
  game.runGold+=reward;
  if(game.mode==='study'){state.gold+=reward;}else{game.unsecured+=reward;}
  const rewardText=isNew?`¡Pregunta dominada! +${fmt(reward)} de oro.`:'¡Correcto! Esta pregunta ya estaba dominada: no genera oro otra vez.';
  showAnswerState(q.answer,rewardText);

  if(game.mode==='campaign'&&game.classId==='ninja'){
    game.skipProgress++;
    if(game.skipProgress>=game.settings.skipEvery){
      game.skipProgress=0;
      const before=game.pendingSkips;
      game.pendingSkips=Math.min(game.settings.skipCap, game.pendingSkips+2);
      const gained=game.pendingSkips-before;
      if(gained>0){
        showToast(`¡Paso veloz! +${gained} salto${gained===1?'':'s'} acumulado${gained===1?'':'s'} (${game.pendingSkips}/${game.settings.skipCap}).`);
      }else{
        showToast(`Saltos al máximo (${game.pendingSkips}/${game.settings.skipCap}).`);
      }
    }
  }

  const completed=game.index+1;
  if(game.mode==='campaign'){
    const before=game.runGold;
    applyCampaignMilestones(completed);
    if(game.runGold>before)$('#answerHint').textContent+=` · Bono por nivel nuevo: +${fmt(game.runGold-before)} ◈`;
  }
  if(game.mode==='study'){game.studyDone.push({q,correct:true});}
  saveState(false);
  updateGameGold();
  renderHeader();
  renderJokers();
  renderClassSkill();
  const nextBtn=$('#nextQuestionButton');
  nextBtn.classList.remove('hidden');
  nextBtn.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function handleStudyWrong(i){if(!game||game.answerLocked)return;const q=game.questions[game.index];game.newMastery[game.index]=false;game.answerLocked=true;game.answered++;state.totals.answered++;game.wrong.push({question:q.question,options:q.options,chosen:i,correct:q.answer,explanation:q.explanation});game.studyDone.push({q,correct:false});showAnswerState(q.answer,'No pasa nada: revisa la respuesta correcta y aprende de ella.');saveState(false);const nextBtn=$('#nextQuestionButton');nextBtn.classList.remove('hidden');nextBtn.scrollIntoView({behavior:'smooth',block:'nearest'});}
function advanceGameQuestion(){if(!game||!game.answerLocked)return;game.index++;loadGameQuestion();}
function secureCheckpoint(){if(game.classId==='berserker')return;if(game.unsecured>0){state.gold+=game.unsecured;game.secured+=game.unsecured;game.unsecured=0;saveState();}updateGameGold();}
function activateFrenzy(){game.frenzy=true;game.frenzyEnds=Date.now()+FRENZY_DURATION_SECONDS*1000;$('#gameFrenzy').classList.remove('hidden');renderJokers();showToast(`¡FRENESÍ! Comodines ilimitados durante ${FRENZY_DURATION_SECONDS} segundos.`);}
function updateGameGold(){if(!game)return;$('#gameGold').textContent=fmt(state.gold);$('#runGold').textContent=fmt(state.runGold);$('#securedGold').textContent=game.classId==='berserker'?`${fmt(state.runGold)} en riesgo`:`${fmt(game.secured)} asegurado`;}

function renderClassSkill(){
  const box=$('#classSkillBox'),btn=$('#classSkillButton');
  if(!game || game.mode!=='campaign'){box.classList.add('hidden');return;}
  if(game.classId==='ninja'){
    box.classList.remove('hidden');
    $('#classSkillIcon').textContent='影';
    $('#classSkillTitle').textContent='Saltar pregunta';
    $('#classSkillSub').textContent=`Racha ${game.skipProgress}/${game.settings.skipEvery} · Máx. ${game.settings.skipCap}`;
    $('#classSkillCount').textContent=`${game.pendingSkips}/${game.settings.skipCap}`;
    btn.disabled=game.pendingSkips<=0 || game.answerLocked;
    return;
  }
  if(game.classId==='thief' && (game.settings.thiefBlockBonus || game.settings.thiefMastery)){
    box.classList.remove('hidden');
    const isMaster=game.settings.thiefMastery;
    $('#classSkillIcon').textContent='🗡';
    $('#classSkillTitle').textContent=isMaster?'Maestro del engaño':'Hurto mayor';
    $('#classSkillSub').textContent=isMaster?'Elimina 2.ª opción (cada pregunta)':'Elimina 2.ª opción (1 por bloque de 5)';
    const available=isMaster ? !game.thiefQuestionBonusUsed : (!game.thiefBlockUsed && !game.thiefQuestionBonusUsed);
    $('#classSkillCount').textContent=isMaster?(available?'1':'0'):(available?'1/1':'0/1');
    btn.disabled=!available || game.answerLocked || game.questionJokerUsed || activeOptionCount()<=2;
    return;
  }
  if(game.classId==='mage' && game.mageDiceDelayed && !game.mageDiceRolled){
    box.classList.remove('hidden');
    $('#classSkillIcon').textContent='🎲';
    $('#classSkillTitle').textContent='Dados del destino';
    $('#classSkillSub').textContent='Lanzamiento retrasado (límite P. 15)';
    $('#classSkillCount').textContent=`P.${game.index+1}/15`;
    btn.disabled=game.answerLocked;
    return;
  }
  box.classList.add('hidden');
}

function useClassSkill(){
  if(!game || game.mode!=='campaign' || game.answerLocked || modalLocked) return;
  if(game.classId==='ninja'){
    skipNinjaQuestion();
    return;
  }
  if(game.classId==='thief' && (game.settings.thiefBlockBonus || game.settings.thiefMastery)){
    const isMaster=game.settings.thiefMastery;
    const available=isMaster ? !game.thiefQuestionBonusUsed : (!game.thiefBlockUsed && !game.thiefQuestionBonusUsed);
    if(!available || game.questionJokerUsed || activeOptionCount()<=2) return;
    const q=game.questions[game.index];
    const extra=shuffle(q.options.map((_,i)=>i).filter(i=>i!==q.answer && !game.eliminated.includes(i))).slice(0,1);
    if(!extra.length) return;
    game.eliminated.push(...extra);
    if(game.selected!=null && game.eliminated.includes(game.selected)){
      game.selected=null;
      $$('[data-answer]').forEach(b=>b.classList.remove('selected'));
    }
    game.thiefQuestionBonusUsed=true;
    if(!isMaster) game.thiefBlockUsed=true;
    refreshAnswerOptions();
    renderJokers();
    renderClassSkill();
    showToast(`${isMaster?'Maestro del engaño':'Hurto mayor'}: segunda opción incorrecta eliminada.`);
    return;
  }
  if(game.classId==='mage' && game.mageDiceDelayed && !game.mageDiceRolled){
    openMageDiceModal();
  }
}

function renderJokers(){
  if(!game)return;
  const unlimited=game.frenzy;
  const fiftyForbidden=game.mode==='campaign' && game.classId==='thief' && game.settings?.noFifty;
  $('#jokerFifty').textContent=fiftyForbidden?'✕':(unlimited?'∞':game.jokers.fifty);
  $('#jokerHint').textContent=unlimited?'∞':game.jokers.hint;
  $('#jokerRetry').textContent=unlimited?'∞':game.jokers.retry;

  $$('[data-joker]').forEach(b=>{
    const key=b.dataset.joker;
    let blocked=game.answerLocked || game.questionJokerUsed;
    if(!unlimited && game.jokers[key]<=0) blocked=true;
    if(key==='fifty' && (fiftyForbidden || activeOptionCount()<=2)) blocked=true;
    if(key==='retry' && activeOptionCount()<=2) blocked=true;
    b.disabled=blocked;
    if(key==='fifty' && fiftyForbidden){
      b.title='Juego peligroso: 50/50 bloqueado en esta campaña';
    }else if(game.questionJokerUsed){
      b.title='Máximo 1 comodín por pregunta';
    }else if((key==='fifty'||key==='retry') && activeOptionCount()<=2){
      b.title='No aplicable cuando solo quedan 2 alternativas';
    }else{
      b.title='';
    }
  });
}

function useJoker(key){
  if(!game || game.answerLocked || modalLocked)return;
  if(game.questionJokerUsed){
    showToast('Solo puedes usar 1 comodín por pregunta.');
    return;
  }
  const fiftyForbidden=game.mode==='campaign' && game.classId==='thief' && game.settings?.noFifty;
  if(key==='fifty' && fiftyForbidden){
    showToast('Juego peligroso: no puedes usar 50/50 en esta campaña.');
    return;
  }
  const infinite=game.frenzy;
  if(!infinite&&game.jokers[key]<=0)return;
  const q=game.questions[game.index];

  if(key==='fifty'){
    const maxRemove=Math.min(2, activeOptionCount()-2);
    if(maxRemove<=0){
      showToast('Ya quedan solo 2 alternativas en esta pregunta.');
      return;
    }
    if(!infinite)game.jokers[key]--;
    game.questionJokerUsed=true;
    const remove=shuffle(q.options.map((_,i)=>i).filter(i=>i!==q.answer&&!game.eliminated.includes(i))).slice(0,maxRemove);
    game.eliminated.push(...remove);
    if(game.selected!=null&&game.eliminated.includes(game.selected)){
      game.selected=null;
      $$('[data-answer]').forEach(b=>b.classList.remove('selected'));
    }
    refreshAnswerOptions();
    showToast(maxRemove===2?'Dos alternativas incorrectas eliminadas.':'Una alternativa incorrecta eliminada (mínimo 2 opciones activas).');
  }else if(key==='hint'){
    if(!infinite)game.jokers[key]--;
    game.questionJokerUsed=true;
    if(q.explanation){
      $('#explanationBox').textContent=q.explanation;
      $('#explanationBox').classList.remove('hidden');
      $('#explanationBox').scrollIntoView({behavior:'smooth',block:'nearest'});
    }else{
      $('#answerHint').textContent='Hint: lee con atención cada alternativa y descarta las que contradigan el concepto.';
    }
  }else if(key==='retry'){
    if(activeOptionCount()<=2){
      showToast('No puedes combinar Reintentar cuando solo quedan 2 opciones.');
      return;
    }
    if(!infinite)game.jokers[key]--;
    game.questionJokerUsed=true;
    game.retryUsed=false;
    game.retryArmed=true;
    showToast('Segunda oportunidad preparada para esta pregunta.');
  }
  renderJokers();
  renderClassSkill();
}

// ---------- Mage Dice System ----------
function promptMageDelayChoice(){
  openModal('Dados del destino · Pregunta 10',`
    <p class="result-summary">Has llegado a la pregunta 10. Gracias a <b>Manipulación del destino</b>, puedes lanzar el dado ahora o retrasarlo hasta la pregunta 15.</p>
    <div class="dice-actions" style="justify-content:center">
      <button type="button" class="secondary-button" id="delayMageDiceBtn">Retrasar (hasta P. 15)</button>
      <button type="button" class="primary-button" id="rollMageDiceNowBtn">🎲 Lanzar dado ahora</button>
    </div>
  `,'MAGO · NIVEL III',true);
  $('#delayMageDiceBtn').onclick=()=>{
    game.mageDiceDelayed=true;
    closeModal(true);
    renderClassSkill();
    showToast('Lanzamiento retrasado. Puedes activarlo desde el panel lateral hasta la P. 15.');
  };
  $('#rollMageDiceNowBtn').onclick=()=>{
    openMageDiceModal();
  };
}

function openMageDiceModal(){
  if(!game || game.mageDiceRolled) return;
  const indices=shuffle([0,1,2,3,4,5]);
  const isDouble=Boolean(game.settings?.mageDoubleDice);
  const rolled=isDouble ? [MAGE_DICE_EFFECTS[indices[0]], MAGE_DICE_EFFECTS[indices[1]]] : [MAGE_DICE_EFFECTS[indices[0]]];

  const cardsHTML=rolled.map((eff,idx)=>`
    <div class="dice-card ${isDouble?'selectable':''}" data-pick-dice="${idx}">
      <div class="dice-top">
        <div class="dice-face">${eff.face}</div>
        <h4>${esc(eff.name)}</h4>
      </div>
      <p>${esc(eff.desc)}</p>
      ${isDouble?`<button type="button" class="small-button" style="margin-top:auto">Elegir este destino</button>`:''}
    </div>
  `).join('');

  openModal(isDouble?'Doble destino · Elige un resultado':'Dados del destino',`
    <p class="modal-note">${isDouble?'Tu maestría arcana arrojó dos dados. Selecciona cuál efecto aplicar a la campaña:':'El dado del destino ha dictado su efecto sobre tu campaña:'}</p>
    <div class="dice-grid ${isDouble?'two-dice':''}">${cardsHTML}</div>
    ${isDouble?'':`<div class="dice-actions"><button type="button" class="primary-button" id="applySingleDiceBtn">Aplicar efecto</button></div>`}
  `,'MAGO · AZAR Y CAOS',true);

  if(isDouble){
    $$('[data-pick-dice]').forEach(el=>{
      el.onclick=()=>applyMageDiceEffect(rolled[Number(el.dataset.pickDice)]);
    });
  }else{
    $('#applySingleDiceBtn').onclick=()=>applyMageDiceEffect(rolled[0]);
  }
}

function applyMageDiceEffect(effect){
  if(!game || game.mageDiceRolled) return;
  game.mageDiceRolled=true;
  game.mageDiceDelayed=false;
  closeModal(true);
  renderClassSkill();

  if(effect.id==='gold4'){
    game.mageGoldMultiplier=4;
    updateQuestionRewardBanner();
    showToast('¡Fortuna arcana! Todo el oro obtenido en adelante se multiplica por ×4.');
    return;
  }

  if(effect.id==='skip10'){
    let skipped=0;
    while(skipped<10 && game.index<game.questions.length){
      game.newMastery[game.index]=false;
      game.index++;
      skipped++;
      applyCampaignMilestones(game.index);
    }
    showToast(`¡Salto dimensional! Avanzaste ${skipped} pregunta${skipped===1?'':'s'}.`);
    loadGameQuestion();
    return;
  }

  if(effect.id==='halfRemaining'){
    const cur=game.index;
    const headQ=game.questions.slice(0,cur), tailQ=game.questions.slice(cur);
    const headK=game.questionKeys.slice(0,cur), tailK=game.questionKeys.slice(cur);
    const headM=game.newMastery.slice(0,cur), tailM=game.newMastery.slice(cur);
    const keptQ=[], keptK=[], keptM=[];
    for(let idx=0; idx<tailQ.length; idx++){
      if(idx % 2 === 0){
        keptQ.push(tailQ[idx]);
        keptK.push(tailK[idx]);
        keptM.push(tailM[idx]);
      }
    }
    const removed=tailQ.length - keptQ.length;
    game.questions=[...headQ, ...keptQ];
    game.questionKeys=[...headK, ...keptK];
    game.newMastery=[...headM, ...keptM];
    $('#gameQuestionLabel').textContent=`PREGUNTA ${game.index+1} / ${game.questions.length}`;
    $('#gameProgressFill').style.width=`${game.index/game.questions.length*100}%`;
    $('#checkpointLabel').textContent=`Próximo punto de control: pregunta ${Math.min(game.questions.length,Math.ceil((game.index+1)/5)*5)}`;
    showToast(`¡Fractura temporal! Se eliminaron ${removed} preguntas restantes.`);
    return;
  }

  if(effect.id==='restartQ1'){
    const fullPool=shuffle(uniqueQuestionList(sumQuestions(game.docIds)));
    const unmastered=fullPool.filter(q=>!state.masteredQuestions[questionFingerprint(q)]);
    const mastered=fullPool.filter(q=>state.masteredQuestions[questionFingerprint(q)]);
    const freshList=buildCampaignQuestions([...unmastered, ...mastered], game.questions.length);
    game.questions=freshList;
    game.questionKeys=freshList.map(questionFingerprint);
    game.newMastery=Array(freshList.length).fill(false);
    game.index=0;
    game.levelPaid=[false,false,false];
    game.frenzy=false;
    $('#gameFrenzy').classList.add('hidden');
    showToast('¡Bucle cronológico! Regresas a la pregunta 1 conservando todo tu oro.');
    loadGameQuestion();
    return;
  }

  if(effect.id==='add5'){
    const fullPool=shuffle(uniqueQuestionList(sumQuestions(game.docIds)));
    const usedKeys=new Set(game.questionKeys);
    const unused=fullPool.filter(q=>!usedKeys.has(questionFingerprint(q)));
    const extra=buildCampaignQuestions([...unused, ...fullPool], 5);
    game.questions.push(...extra);
    game.questionKeys.push(...extra.map(questionFingerprint));
    game.newMastery.push(...Array(extra.length).fill(false));
    $('#gameQuestionLabel').textContent=`PREGUNTA ${game.index+1} / ${game.questions.length}`;
    $('#gameProgressFill').style.width=`${game.index/game.questions.length*100}%`;
    showToast('¡Paradoja extendida! Se añadieron 5 preguntas a la campaña.');
    return;
  }

  if(effect.id==='jokers2'){
    const names={fifty:'50/50',hint:'Hint',retry:'Reintentar'};
    const keys=['fifty','hint','retry'];
    const gained=[];
    for(let n=0;n<2;n++){
      const pick=keys[Math.floor(Math.random()*keys.length)];
      game.jokers[pick]++;
      gained.push(names[pick]);
    }
    renderJokers();
    showToast(`¡Saqueo astral! +1 ${gained[0]} y +1 ${gained[1]}.`);
  }
}

function retireGame(){
  if(!game)return;
  const forfeitsGold=game.mode==='campaign' && game.classId==='berserker' && game.settings?.noRetireGold;
  const msg=forfeitsGold
    ?'Sacrificio Sin retirada: si abandonas voluntariamente perderás todo el oro acumulado en esta campaña. ¿Retirarte de todos modos?'
    :'¿Retirarte y conservar todo el oro acumulado en esta campaña?';
  if(!confirm(msg))return;
  finishGame('retiro');
}

async function finishGame(outcome){
 if(!game)return;
 const g=game;clearInterval(clockTimer);clockTimer=null;
 let delta=0,penalty=0,bonus=0;
 const freshCount=g.newMastery.filter(Boolean).length;
 const freshCampaign=g.mode==='campaign'&&freshCount>=Math.ceil(g.newMastery.length*.6);
 const mult=g.mode==='campaign'?(g.settings?.multiplier||1)*(g.mageGoldMultiplier||1):1;
 const baseCompletion=g.classId==='berserker'?g.settings.berserkerBonus:10000;
 const completionBonus=freshCampaign?Math.round(baseCompletion*(g.classId==='mage'?(g.mageGoldMultiplier||1):1)):0;

 if(g.mode==='campaign'){
  if(outcome==='derrota'&&g.classId==='berserker'){
   penalty=Math.ceil(state.gold*.10);state.gold=Math.max(0,state.gold-penalty);delta=-penalty;
  }else if(outcome==='retiro'&&g.classId==='berserker'&&g.settings?.noRetireGold){
   delta=0;
  }else if(g.classId==='berserker'){
   state.gold+=g.runGold;delta=g.runGold;
   if(outcome==='victoria'&&completionBonus){bonus=completionBonus;state.gold+=bonus;delta+=bonus;}
  }else if(outcome==='retiro'){
   state.gold+=g.unsecured;delta=g.runGold;g.secured+=g.unsecured;g.unsecured=0;
  }else if(outcome==='victoria'){
   state.gold+=g.unsecured+completionBonus;delta=g.runGold+completionBonus;bonus=completionBonus;g.unsecured=0;
  }else{
   delta=-g.unsecured;
  }
 }
 if(outcome==='victoria'&&g.mode==='campaign'){
  state.totals.completed++;
  if(g.level12Time!=null&&g.level12Time<FRENZY_ACTIVATION_SECONDS){const t=g.level12Time;if(state.totals.frenzyBest==null||t<state.totals.frenzyBest)state.totals.frenzyBest=t;}
 }
 if(outcome==='derrota'&&g.mode==='campaign')state.totals.failed++;
 const record={date:new Date().toISOString(),mode:g.mode,classId:g.classId,subject:g.subject||'Partida',correct:g.correct,answered:g.answered,gold:g.mode==='study'?g.runGold:delta,outcome:g.mode==='study'?'practica':outcome,runGold:g.runGold,bonus,penalty,wrong:g.wrong.length,mistakes:g.wrong};
 state.history.unshift(record);if(state.history.length>100)state.history.length=100;
 await saveState();$('#gameOverlay').classList.add('hidden');document.body.classList.remove('game-active');game=null;
 let title=outcome==='victoria'?(g.mode==='study'?'Práctica terminada':'¡Campaña completada!'):outcome==='retiro'?'Retirada estratégica':'Campaña perdida';
 let summary='';
 if(g.mode==='study')summary=`Respondiste correctamente ${g.correct} de ${g.answered} preguntas. Ganaste ${fmt(g.runGold)} de oro por dominar preguntas nuevas. ${g.wrong.length?`Tienes ${g.wrong.length} respuestas para repasar.`:'¡Excelente trabajo!'}`;
 else if(outcome==='derrota'&&g.classId==='berserker')summary=`Has perdido ${fmt(g.runGold)} de oro de campaña y pagado una penalización del 10 % (${fmt(penalty)} de oro general). Las preguntas aprendidas siguen registradas y no volverán a generar oro.`;
 else if(outcome==='retiro'&&g.classId==='berserker'&&g.settings?.noRetireGold)summary=`Sin retirada: al abandonar la campaña perdiste los ${fmt(g.runGold)} de oro acumulados en ella.`;
 else if(outcome==='derrota')summary=`Conservas ${fmt(g.secured)} de oro asegurado. Se perdió el oro obtenido después del último punto de control.`;
 else if(outcome==='retiro')summary=`Retirada con ${fmt(g.runGold)} de oro de campaña conservado.`;
 else summary=`Aciertos: ${g.correct}/${g.answered}. Oro generado: ${fmt(g.runGold)}${bonus?` (incluye ${fmt(bonus)} de bonificación por completar una campaña con al menos 60 % de preguntas nuevas)`:'. No hubo bonificación final porque el banco ya contenía preguntas dominadas.'}`;
 openModal(title,`<div class="result-emblem">${outcome==='victoria'?'✧':outcome==='derrota'?'⚔':'◈'}</div><p class="result-summary">${esc(summary)}</p><div class="result-stats"><div><small>ACIERTOS</small><b>${g.correct}/${g.answered}</b></div><div><small>ORO DE CAMPAÑA</small><b>${fmt(g.runGold)}</b></div><div><small>ORO GENERAL</small><b>${fmt(state.gold)}</b></div></div>${g.wrong.length?`<div class="mistake-review"><h3>Preguntas para repasar</h3>${g.wrong.map((m,i)=>`<div><b>${i+1}. ${esc(m.question)}</b><p>Respuesta correcta: ${esc(m.options?.[m.correct]||'')}</p>${m.explanation?`<small>${esc(m.explanation)}</small>`:''}</div>`).join('')}</div>`:''}<div class="form-actions"><button class="primary-button" id="resultDone">Continuar</button></div>`,'RESULTADO');
 $('#resultDone').onclick=()=>{closeModal();nav('inicio');};renderAll();
}

function showHistoryReview(h){const items=h.mistakes||[];openModal('Repaso de errores',`<div class="mistake-review">${items.map((m,i)=>`<div><b>${i+1}. ${esc(m.question)}</b><p>Respuesta correcta: ${esc(m.options?.[m.correct]||'')}</p>${m.explanation?`<small>${esc(m.explanation)}</small>`:''}</div>`).join('')||'<p class="modal-note">No hay errores guardados.</p>'}</div><div class="form-actions"><button class="primary-button" id="closeReview">Cerrar</button></div>`,'REGISTRO');$('#closeReview').onclick=closeModal;}

// ---------- Settings and backup ----------
function settingsModal(){openModal('Configuración y respaldo',`<div class="form-stack"><p class="modal-note">Tu biblioteca, oro y progreso se guardan en este dispositivo. Exporta una copia para trasladarlos a otro navegador o equipo.</p><button class="secondary-button" id="exportBackup">Exportar copia de seguridad</button><label>Restaurar copia<input type="file" id="restoreBackup" accept=".json,application/json"></label><button class="secondary-button" id="downloadTemplate">Descargar plantilla TXT</button><div class="settings-danger"><b>Restablecer progreso</b><p>Vuelve a 1.000 de oro, bloquea las mejoras y limpia el historial. Conserva tus materias, documentos y el registro de preguntas ya dominadas para impedir que se vuelva a ganar oro con el mismo contenido.</p><button class="danger-button" id="resetProgressButton">Restablecer oro y personaje</button></div><p class="modal-note">No existe sincronización en la nube. Borrar los datos del navegador puede eliminar el progreso si no tienes una copia.</p></div>`,'AJUSTES');$('#exportBackup').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});downloadBlob(blob,'proba-backup.json');};$('#restoreBackup').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed.subjects||!parsed.unlocks)throw new Error();state=mergeState(parsed);selectedClass=state.settings.activeClass||'ninja';await saveState();closeModal();showToast('Copia restaurada correctamente.');}catch{showToast('El archivo de copia no es válido.');}};$('#downloadTemplate').onclick=()=>downloadBlob(new Blob([QUESTION_TEMPLATE],{type:'text/plain;charset=utf-8'}),'plantilla-preguntas-proba.txt');$('#resetProgressButton').onclick=async()=>{if(!confirm('¿Restablecer el oro a 1.000, bloquear todas las mejoras y borrar el historial? Tus materias, documentos y preguntas ya dominadas se conservarán.'))return;const mastery=state.masteredQuestions;state.gold=1000;state.unlocks={ninja:[],thief:[],mage:[],berserker:[]};state.history=[];state.totals={...DEFAULT_STATE.totals};state.masteredQuestions=mastery;state.settings={...state.settings,activeClass:'ninja'};selectedClass='ninja';await saveState();closeModal();showToast('Progreso restablecido. Tus preguntas dominadas siguen registradas.');};}
const QUESTION_TEMPLATE=`Pregunta 1: ¿Cuál es la capital de Ecuador?\nA) Guayaquil\nB) Quito\nC) Cuenca\nD) Loja\nRespuesta: B\nExplicación: Quito es la capital de Ecuador.\n\nPregunta 2: ¿Cuánto es 6 × 7?\nA) 36\nB) 40\nC) 42\nD) 48\nRespuesta: C\nExplicación: Seis multiplicado por siete es cuarenta y dos.\n\n`;
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// ---------- UI events ----------
function bindEvents(){document.addEventListener('click',e=>{const navBtn=e.target.closest('[data-nav]');if(navBtn){nav(navBtn.dataset.nav);return;}const sa=e.target.closest('[data-subject-action]');if(sa){const id=sa.dataset.id;if(sa.dataset.subjectAction==='import')importToSubject(id);if(sa.dataset.subjectAction==='view')openDocumentManager(id);if(sa.dataset.subjectAction==='delete'){if(confirm('¿Eliminar la materia y todos sus documentos?')){const sub=state.subjects.find(s=>s.id===id);const gone=new Set((sub?.documents||[]).map(d=>d.id));state.subjects=state.subjects.filter(s=>s.id!==id);state.selectedDocuments=(state.selectedDocuments||[]).filter(docId=>!gone.has(docId));saveState();}}return;}const cc=e.target.closest('[data-class-card]');if(cc){selectedClass=cc.dataset.classCard;state.settings.activeClass=selectedClass;saveState();showToast(`${CLASS_INFO[selectedClass].name} es tu clase activa.`);return;}const buy=e.target.closest('[data-buy-skill]');if(buy){buySkill(buy.dataset.class,buy.dataset.buySkill);return;}const joker=e.target.closest('[data-joker]');if(joker){useJoker(joker.dataset.joker);return;}const review=e.target.closest('[data-review-history]');if(review){const h=state.history[Number(review.dataset.reviewHistory)];if(h)showHistoryReview(h);return;}});
 $('#addSubjectButton').onclick=createSubject;$('#emptyAddSubject').onclick=createSubject;$('#settingsButton').onclick=settingsModal;$('#closeModal').onclick=()=>closeModal();$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal();});$('#selectAllDocs').onclick=()=>{$$('.adventure-check').forEach(c=>c.checked=true);updateAdventure();};$$('[data-mode]').forEach(b=>b.onclick=()=>{selectedMode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));$('#campaignOptions').classList.toggle('hidden',selectedMode!=='campaign');$('#studyOptions').classList.toggle('hidden',selectedMode!=='study');updateAdventure();});$('#startGameButton').onclick=startGame;$('#nextQuestionButton').onclick=advanceGameQuestion;$('#classSkillButton').onclick=useClassSkill;$('#exitGameButton').onclick=()=>{if(game&&confirm('¿Cerrar esta partida?'))finishGame(game.mode==='study'?'retiro':'derrota');};$('#retireGameButton').onclick=retireGame;$('#clearHistoryButton').onclick=async()=>{if(confirm('¿Limpiar el historial? Tu oro y habilidades no cambiarán.')){state.history=[];await saveState();}};}

// ---------- Startup ----------
(async function init(){await loadState();selectedClass=state.settings.activeClass||'ninja';bindEvents();if('serviceWorker'in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').catch(console.warn);}renderAll();})();
