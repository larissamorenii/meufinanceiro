import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCg7xoYF4hL7-mzEq6oWfxcQDhaMUTHkRQ',
  authDomain: 'meu-financeiro-efef9.firebaseapp.com',
  projectId: 'meu-financeiro-efef9',
  storageBucket: 'meu-financeiro-efef9.firebasestorage.app',
  messagingSenderId: '783977878337',
  appId: '1:783977878337:web:2567cd983519cbe893c7c0',
  measurementId: 'G-JLCM0KDFC6'
};
const app=initializeApp(firebaseConfig),auth=getAuth(app),store=getFirestore(app);
const status=document.getElementById('cloud-status'),login=document.getElementById('cloud-login'),logout=document.getElementById('cloud-logout'),upload=document.getElementById('cloud-upload');
let unsub=null,reference=null,ready=false,busy=false,queue=Promise.resolve(),latest=null,hasRemote=false;
const say=t=>status.textContent=t;
const hasData=d=>['transactions','cards','bills','investments','goals'].some(k=>d[k]?.length);
const normalize=d=>Object.fromEntries(['transactions','cards','bills','investments','goals'].map(k=>[k,Array.isArray(d?.[k])?d[k]:[]]));
function updateButtons(user){login.hidden=!!user;logout.hidden=!user;upload.hidden=!user;}
async function push(data){if(!reference||!ready)return;latest=normalize(data);queue=queue.catch(()=>{}).then(async()=>{busy=true;say('Salvando na nuvem...');try{await setDoc(reference,{...latest,updatedAt:Date.now()});say('Sincronizado com a nuvem ✓')}catch(e){say('Falha ao sincronizar: '+e.code+' — faça backup');console.error(e)}finally{busy=false}});await queue;}
window.financeSync={changed(data){if(ready&&reference)void push(data);else if(reference)say('Dados locais alterados. Aguarde a conexão ou use Enviar dados locais.')}};
login.addEventListener('click',async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){say('Falha no login: '+(e.code||e.message)+'. Verifique os domínios autorizados e bloqueio de pop-ups.')}});
logout.addEventListener('click',async()=>{if(!confirm('Sair da conta? Os dados locais permanecem neste aparelho.'))return;await signOut(auth)});
upload.addEventListener('click',async()=>{if(!reference)return;const local=window.financeBridge.get();if(!confirm('Enviar os dados deste dispositivo para a nuvem? Isso SUBSTITUIRÁ os dados existentes na nuvem, inclusive em outros aparelhos. Faça um backup antes.'))return;ready=true;await push(local)});
onAuthStateChanged(auth,async user=>{
 if(unsub){unsub();unsub=null}ready=false;reference=null;updateButtons(user);
 if(!user){say('Modo local — entre com Google para sincronizar.');return}
 say('Conectando como '+(user.email||'usuário')+'...');
 reference=doc(store,'users',user.uid,'finance','data');const own=reference;
 try{
  const snap=await getDoc(own);if(reference!==own)return;
  if(snap.exists()){
   hasRemote=true;
   const local=window.financeBridge.get();
   if(hasData(local)&&!sessionStorage.getItem('finance-cloud-migration-seen')){
    sessionStorage.setItem('finance-cloud-migration-seen','1');
    if(confirm('Encontramos dados na nuvem e neste dispositivo. Deseja carregar os dados da nuvem? Clique Cancelar para manter os dados locais e decidir depois usando "Enviar dados locais".'))window.financeBridge.apply(normalize(snap.data()));
    else {say('Dados locais mantidos. Use Enviar dados locais se quiser substituir a nuvem.');return}
   }else window.financeBridge.apply(normalize(snap.data()));
  }else{
   hasRemote=false;
   const local=window.financeBridge.get();
   if(hasData(local)){
    say('Conta sem dados na nuvem. Confirme a migração dos dados locais.');
    if(confirm('Sua conta ainda não possui dados na nuvem. Deseja enviar os lançamentos deste dispositivo agora?')){ready=true;await push(local)}
    else {say('Dados locais mantidos. Use Enviar dados locais quando desejar.');return}
   }else{ready=true;await push(local)}
  }
  if(reference!==own)return;
  ready=true;
  unsub=onSnapshot(own,{includeMetadataChanges:false},s=>{
    if(!s.exists()||s.metadata.hasPendingWrites)return;
    if(!busy)window.financeBridge.apply(normalize(s.data()));
    say('Sincronizado com a nuvem ✓');
  },e=>say('Erro ao acompanhar dados: '+e.code));
  say('Sincronizado com a nuvem ✓');
 }catch(e){say('Não foi possível conectar: '+(e.code||e.message));console.error(e)}
});
