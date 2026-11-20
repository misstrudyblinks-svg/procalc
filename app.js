import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence,
  browserSessionPersistence, updateProfile, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  doc, setDoc, collection, addDoc, getDocs, query, orderBy, limit,
  deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pages = {home: $('homePage'), login: $('loginPage'), calculator: $('calculatorPage')};
  let expression = '', justEvaluated = false, history = [], toastTimer, authMode = 'login', currentUser = null, scientificMode = false, angleMode = 'RAD';


  function syncHeader(name) {
    const nav = $('navLinks');
    const cta = $('navLogin');
    const menu = $('menuToggle');
    nav.classList.remove('open');
    nav.hidden = name !== 'home';
    menu.hidden = name !== 'home';
    if (name === 'calculator' && currentUser) {
      cta.innerHTML = 'Log out <span>↗</span>';
      cta.setAttribute('aria-label', 'Log out of ProCalc');
    } else if (name === 'login') {
      cta.innerHTML = 'Home <span>↗</span>';
      cta.setAttribute('aria-label', 'Return to homepage');
    } else {
      cta.innerHTML = 'Sign in <span>↗</span>';
      cta.setAttribute('aria-label', 'Sign in to ProCalc');
    }
    document.body.dataset.view = name;
  }
  function showPage(name) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[name].classList.add('active');
    syncHeader(name);
    window.scrollTo({top: 0, behavior: 'smooth'});
    if (name === 'calculator') updateClock();
  }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }
  function loginPage(mode='login') { setAuthMode(mode); $('loginError').textContent = ''; showPage('login'); setTimeout(() => $('username').focus(), 350); }
  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === 'register';
    $('authTitle').textContent = registering ? 'Create account' : 'Sign in';
    $('authSubtitle').textContent = registering ? 'Create your ProCalc account to save your calculations.' : 'Sign in to your ProCalc account to continue.';
    $('nameField').hidden = !registering;
    $('fullName').required = registering;
    $('loginSubmit').innerHTML = registering ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    $('authSwitchPrompt').textContent = registering ? 'Already have an account?' : 'New to ProCalc?';
    $('authSwitch').textContent = registering ? 'Sign in instead' : 'Create an account';
    $('password').autocomplete = registering ? 'new-password' : 'current-password';
    $('forgotPassword').hidden = registering;
    $('loginError').textContent = '';
  }
  async function submitAuth(email, password) {
    const errorEl = $('loginError');
    const submitBtn = $('loginSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = authMode === 'register' ? 'Creating account…' : 'Signing in…';
    errorEl.textContent = '';
    try {
      await setPersistence(auth, $('remember').checked ? browserLocalPersistence : browserSessionPersistence);
      let credential;
      if (authMode === 'register') {
        const fullName = $('fullName').value.trim();
        credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', credential.user.uid), {
          uid: credential.user.uid, displayName: fullName, email: credential.user.email,
          createdAt: serverTimestamp(), lastLoginAt: serverTimestamp()
        }, {merge: true});
      } else {
        credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', credential.user.uid), {
          email: credential.user.email, lastLoginAt: serverTimestamp()
        }, {merge: true});
      }
      await enterWorkspace(credential.user);
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
    } finally {
      submitBtn.disabled = false;
      $('loginSubmit').innerHTML = authMode === 'register' ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    }
  }
  function friendlyAuthError(code) {
    const messages = {
      'auth/email-already-in-use':'An account already exists with this email. Try signing in.',
      'auth/invalid-email':'Please enter a valid email address.',
      'auth/invalid-credential':'Email or password is incorrect. Please check and try again.',
      'auth/user-not-found':'No account was found for this email.',
      'auth/wrong-password':'Incorrect password. Try again or reset it in Firebase.',
      'auth/weak-password':'Use a password with at least 6 characters.',
      'auth/too-many-requests':'Too many attempts. Please wait and try again.',
      'auth/network-request-failed':'Network error. Check your connection and retry.',
      'auth/operation-not-allowed':'Email/password sign-in is not enabled in Firebase yet.',
      'auth/invalid-password':'Password is invalid.',
      'auth/user-disabled':'This account has been disabled.'
    };
    return messages[code] || 'Could not authenticate. Please try again.';
  }
  async function enterWorkspace(user) {
    currentUser = user;
    $('profileName').textContent = user.displayName || user.email?.split('@')[0] || 'Member';
    $('profileEmail').textContent = user.email || 'Signed in';
    $('avatarInitial').textContent = (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase();
    await loadHistory();
    populateProfile(user);
    showPage('calculator'); resetCalc(); toast('Welcome to your ProCalc workspace!');
  }
  async function logout() {
    closeProfile();
    try { await signOut(auth); history=[]; renderHistory(); resetCalc(); showPage('home'); toast('You have signed out.'); }
    catch { toast('Sign out failed. Please try again.'); }
  }
  async function loadHistory() {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'users', currentUser.uid, 'calculations'), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      history = snap.docs.map(d => {const x=d.data(); return {expr:x.expression,result:x.result,time:x.createdAt?.toDate?.().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) || 'Saved'};});
      renderHistory(); updateStats();
    } catch (e) { console.warn('History load failed', e); toast('Signed in, but history could not load. Check Firestore rules.'); }
  }
  async function saveCalculation(expr, result) {
    if (!currentUser) return;
    try { await addDoc(collection(db, 'users', currentUser.uid, 'calculations'), {expression:expr, result:String(result), createdAt:serverTimestamp()}); }
    catch(e) { console.warn('Calculation save failed',e); toast('Calculation worked, but saving failed.'); }
  }
  async function clearSavedHistory() {
    if (!currentUser) {history=[];renderHistory();return;}
    try {
      const snap = await getDocs(collection(db, 'users', currentUser.uid, 'calculations'));
      await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
      history=[];renderHistory();updateStats();toast('Calculation history cleared from your account.');
    } catch { toast('Could not clear saved history. Check Firestore rules.'); }
  }
  function updateStats(){
    const total=history.length;
    let addSub=0,mulDiv=0;
    history.forEach(item=>{const expr=String(item.expr||'');if(/[+\-]/.test(expr))addSub++;if(/[*/]/.test(expr))mulDiv++;});
    $('statTotal').textContent=total.toLocaleString();$('statAddSub').textContent=addSub.toLocaleString();$('statMulDiv').textContent=mulDiv.toLocaleString();
  }
  function populateProfile(user){
    const name=user.displayName||user.email?.split('@')[0]||'Member';
    $('profileDisplayName').value=user.displayName||'';$('profileEmailField').value=user.email||'';
    $('profileModalAvatar').textContent=name.charAt(0).toUpperCase();
  }
  function openProfile(){if(!currentUser){toast('Please sign in first.');return;}populateProfile(currentUser);$('profileModal').classList.add('open');$('profileModal').setAttribute('aria-hidden','false');}
  function closeProfile(){ $('profileModal').classList.remove('open');$('profileModal').setAttribute('aria-hidden','true'); }
  async function saveProfile(){
    if(!currentUser)return;
    const name=$('profileDisplayName').value.trim();if(!name){toast('Please enter a display name.');return;}
    const button=$('saveProfile');button.disabled=true;
    try{await updateProfile(currentUser,{displayName:name});await setDoc(doc(db,'users',currentUser.uid),{displayName:name,email:currentUser.email,updatedAt:serverTimestamp()},{merge:true});
      $('profileName').textContent=name;$('avatarInitial').textContent=name.charAt(0).toUpperCase();populateProfile(currentUser);closeProfile();toast('Profile updated successfully.');
    }catch(e){console.warn('Profile update failed',e);toast('Profile update failed. Please try again.');}finally{button.disabled=false;}
  }
  async function resetPassword(){const email=$('username').value.trim();if(!email){toast('Enter your email address first.');$('username').focus();return;}
    try{await sendPasswordResetEmail(auth,email);toast('Password reset email sent. Check your inbox.');}catch(e){toast(friendlyAuthError(e.code)||'Could not send reset email.');}
  }
  function setScientificMode(enabled){scientificMode=enabled;$('scientificKeys').hidden=!enabled;$('scientificToggle').classList.toggle('active',enabled);$('scientificToggle').textContent=enabled?'Standard mode':'Scientific mode';const label=document.querySelector('.tiny-label');if(label)label.textContent=enabled?'SCIENTIFIC CALCULATOR':'STANDARD CALCULATOR';}
  function toggleAngle(){angleMode=angleMode==='RAD'?'DEG':'RAD';const btn=document.querySelector('[data-action="angle"]');if(btn)btn.textContent=angleMode;toast('Angle mode: '+angleMode);preview();}
  function updateDisplay() { $('expressionDisplay').textContent = expression; }
  function resetCalc() { expression='';justEvaluated=false;updateDisplay();$('resultDisplay').textContent='0'; }
  function append(val) {
    if (justEvaluated && (/^[0-9.]$/.test(val) || val==='pi' || val==='e' || /^(sin|cos|tan|sqrt|log|ln)\($/.test(val))) expression=''; justEvaluated=false;
    const last=expression.slice(-1);
    if('+-*/'.includes(val)){if(!expression&&val!=='-')return;if('+-*/'.includes(last))expression=expression.slice(0,-1)+val;else expression+=val;}
    else if(val==='^2'||val==='^'){if(!expression)return;expression+=val;}
    else if(val==='pi'||val==='e'||val==='('||val===')'||/^(sin|cos|tan|sqrt|log|ln)\($/.test(val)){expression+=val;}
    else if(val==='.'){const segment=expression.split(/[+\-*/()]/).pop()||'';if(!segment.includes('.'))expression+=segment===''?'0.':'.';}
    else expression+=val;
    updateDisplay();preview();
  }
  function removeLast(){expression=expression.slice(0,-1);justEvaluated=false;updateDisplay();preview();}
  function toggleSign(){if(!expression){expression='-';updateDisplay();return;}const match=expression.match(/(\d*\.?\d+)(?!.*\d)/);if(match){const start=match.index,before=expression.slice(0,start),num=match[0];if(before.endsWith('-')&&(before.length===1||'+*/('.includes(before.slice(-2,-1))))expression=before.slice(0,-1)+num;else expression=before+(before.endsWith('-')?'':'-')+num+expression.slice(start+num.length);}justEvaluated=false;updateDisplay();preview();}
  function percent(){const match=expression.match(/(\d*\.?\d+)(?!.*\d)/);if(match){const start=match.index,value=Number(match[0])/100;expression=expression.slice(0,start)+String(value)+expression.slice(start+match[0].length);updateDisplay();preview();}}
  function tokenize(input){
    const tokens=[];let i=0;
    while(i<input.length){const c=input[i];if(/\s/.test(c)){i++;continue;}
      if(/[0-9.]/.test(c)){let num='',dots=0;while(i<input.length&&/[0-9.]/.test(input[i])){if(input[i]==='.')dots++;num+=input[i++];}if(dots>1||num==='.'){throw Error('Bad number');}tokens.push({type:'number',value:Number(num)});continue;}
      if(/[a-z]/i.test(c)){let name='';while(i<input.length&&/[a-z]/i.test(input[i]))name+=input[i++];if(name==='pi'||name==='e'){tokens.push({type:'constant',value:name});continue;}if(['sin','cos','tan','sqrt','log','ln'].includes(name)){tokens.push({type:'function',value:name});continue;}throw Error('Unknown function');}
      if('+-*/^()'.includes(c)){tokens.push({type:c,value:c});i++;continue;}throw Error('Invalid character');
    }return tokens;
  }
  function evaluate(input){
    const tokens=tokenize(input);let pos=0;function peek(){return tokens[pos];}function consume(type){if(peek()?.type===type)return tokens[pos++];throw Error('Unexpected token');}
    function expression(){return addSub();}
    function addSub(){let v=mulDiv();while(peek()&&(peek().type==='+'||peek().type==='-')){const op=tokens[pos++].type,r=mulDiv();v=op==='+'?v+r:v-r;}return v;}
    function mulDiv(){let v=power();while(peek()&&(peek().type==='*'||peek().type==='/'||peek().type==='number'||peek().type==='constant'||peek().type==='function'||peek().type==='(')){let op='*';if(peek().type==='*'||peek().type==='/')op=tokens[pos++].type;const r=power();if(op==='/'&&r===0)throw Error('Division by zero');v=op==='*'?v*r:v/r;}return v;}
    function power(){let v=unary();if(peek()?.type==='^'){pos++;v=Math.pow(v,power());}return v;}
    function unary(){if(peek()?.type==='+'){pos++;return unary();}if(peek()?.type==='-'){pos++;return -unary();}return primary();}
    function primary(){const t=peek();if(!t)throw Error('Incomplete');if(t.type==='number'){pos++;return t.value;}if(t.type==='constant'){pos++;return t.value==='pi'?Math.PI:Math.E;}
      if(t.type==='('){pos++;const v=expression();consume(')');return v;}
      if(t.type==='function'){pos++;consume('(');const arg=expression();consume(')');let x=arg;if(['sin','cos','tan'].includes(t.value)&&angleMode==='DEG')x=arg*Math.PI/180;
        if(t.value==='sin')return Math.sin(x);if(t.value==='cos')return Math.cos(x);if(t.value==='tan')return Math.tan(x);if(t.value==='sqrt'){if(arg<0)throw Error('Invalid square root');return Math.sqrt(arg);}if(t.value==='log'){if(arg<=0)throw Error('Invalid logarithm');return Math.log10(arg);}if(t.value==='ln'){if(arg<=0)throw Error('Invalid logarithm');return Math.log(arg);}}
      throw Error('Expected value');}
    if(!tokens.length)throw Error('Empty');const result=expression();if(pos!==tokens.length)throw Error('Incomplete expression');if(!Number.isFinite(result))throw Error('Invalid result');return result;
  }
  function formatted(n){return Number(n.toPrecision(12)).toLocaleString(undefined,{maximumFractionDigits:10});}
  function preview(){if(!expression){$('resultDisplay').textContent='0';return;}try{$('resultDisplay').textContent=formatted(evaluate(expression));}catch{$('resultDisplay').textContent='—';}}
  function calculate(){if(!expression)return;try{const result=evaluate(expression),clean=formatted(result);addHistory(expression,clean);saveCalculation(expression,clean);$('resultDisplay').textContent=clean;expression=String(Number(result.toPrecision(12)));updateDisplay();justEvaluated=true;}catch(err){$('resultDisplay').textContent=err.message==='Division by zero'?'Cannot divide by zero':'Invalid expression';toast(err.message==='Division by zero'?'Division by zero is not allowed.':'Check your expression and try again.');}}
  function addHistory(expr,result){history.unshift({expr,result,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})});history=history.slice(0,500);renderHistory();updateStats();}
  function renderHistory(){const list=$('historyList');if(!history.length){list.innerHTML='<div class="history-empty"><span>◷</span><p>Your calculations will appear here.</p></div>';return;}list.innerHTML=history.slice(0,30).map((item,i)=>`<div class="history-entry"><div class="history-expression">${escapeHTML(item.expr)}</div><div class="history-result">${escapeHTML(item.result)}</div><div class="history-time">${item.time}</div><button data-history-index="${i}" class="history-use">Use result ↗</button></div>`).join('');}
  function escapeHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function updateClock(){const now=new Date();$('clock').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  function copyResult(){const val=$('resultDisplay').textContent;if(['0','—','Invalid expression','Cannot divide by zero'].includes(val)){toast('No result to copy yet.');return;}navigator.clipboard?.writeText(val).then(()=>toast('Result copied to clipboard.')).catch(()=>toast('Copy failed—select the result manually.'));}
  function handleKey(e){if(!pages.calculator.classList.contains('active'))return;if(/[0-9]/.test(e.key)){append(e.key);e.preventDefault();}else if(['+','-','*','/'].includes(e.key)){append(e.key);e.preventDefault();}else if(e.key==='.'){append('.');e.preventDefault();}else if(scientificMode&&['(',')','^'].includes(e.key)){append(e.key);e.preventDefault();}else if(e.key==='Enter'||e.key==='='){calculate();e.preventDefault();}else if(e.key==='Backspace'){removeLast();e.preventDefault();}else if(e.key==='Escape'){if($('profileModal').classList.contains('open'))closeProfile();else resetCalc();e.preventDefault();}}

  $('navLogin').addEventListener('click',()=>{if(currentUser && pages.calculator.classList.contains('active')){logout();return;}if(pages.login.classList.contains('active')){showPage('home');return;}loginPage('login');});$('getStarted').addEventListener('click',()=>loginPage('register'));$('aboutStart').addEventListener('click',()=>loginPage('login'));$('backHome').addEventListener('click',()=>showPage('home'));
  $('loginForm').addEventListener('submit',e=>{e.preventDefault();submitAuth($('username').value,$('password').value);});
  $('authSwitch').addEventListener('click',()=>setAuthMode(authMode==='login'?'register':'login'));
  $('togglePassword').addEventListener('click',()=>{$('password').type=$('password').type==='password'?'text':'password';});
  $('logoutBtn').addEventListener('click',logout);$('copyResult').addEventListener('click',copyResult);$('clearHistory').addEventListener('click',clearSavedHistory);
  $('keypad').addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const action=btn.dataset.action,value=btn.dataset.value;if(action==='clear')resetCalc();else if(action==='equals')calculate();else if(action==='sign')toggleSign();else if(action==='percent')percent();else if(action==='angle')toggleAngle();else if(value)append(value);});
  $('historyList').addEventListener('click',e=>{const b=e.target.closest('[data-history-index]');if(!b)return;const item=history[Number(b.dataset.historyIndex)];if(!item)return;expression=item.result.replace(/,/g,'');justEvaluated=true;updateDisplay();$('resultDisplay').textContent=item.result;toast('Result loaded into calculator.');});
  $('sideCalc').addEventListener('click',()=>toast('Calculator is already open.'));$('sideHistory').addEventListener('click',()=>{$('historyList').scrollIntoView({behavior:'smooth'});});window.addEventListener('keydown',handleKey);$('menuToggle').addEventListener('click',()=> $('navLinks').classList.toggle('open'));document.querySelectorAll('[data-scroll]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();$('navLinks').classList.remove('open');if(!pages.home.classList.contains('active')){showPage('home');setTimeout(()=>$(a.dataset.scroll).scrollIntoView({behavior:'smooth'}),350);}else{$(a.dataset.scroll).scrollIntoView({behavior:'smooth'});}}));
  $('forgotPassword').addEventListener('click',resetPassword);
  $('profileButton').addEventListener('click',openProfile);$('sideProfile').addEventListener('click',openProfile);
  $('profileClose').addEventListener('click',closeProfile);document.querySelectorAll('[data-close-profile]').forEach(el=>el.addEventListener('click',closeProfile));
  $('saveProfile').addEventListener('click',saveProfile);$('scientificToggle').addEventListener('click',()=>setScientificMode(!scientificMode));
  $('year').textContent=new Date().getFullYear();setInterval(updateClock,1000);updateClock();renderHistory();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  onAuthStateChanged(auth, async user=>{currentUser=user;if(user){try{await enterWorkspace(user);}catch(e){console.error('Workspace load error',e);showPage('home');toast('Signed in, but the profile could not be loaded.');}}else{history=[];renderHistory();showPage('home');}});

  // Progressive Web App: enable installable phone home-screen shortcut and app shell cache.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('ProCalc service worker unavailable:', err)));
  }
})();
