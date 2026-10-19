import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, onSnapshot, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const firebaseConfig={apiKey:'AIzaSyCg7xoYF4hL7-mzEq6oWfxcQDhaMUTHkRQ',authDomain:'meu-financeiro-efef9.firebaseapp.com',projectId:'meu-financeiro-efef9',storageBucket:'meu-financeiro-efef9.firebasestorage.app',messagingSenderId:'783977878337',appId:'1:783977878337:web:2567cd983519cbe893c7c0',measurementId:'G-JLCM0KDFC6'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),store=getFirestore(app);
const $=id=>document.getElementById(id),status=$('cloud-status'),login=$('cloud-login'),logout=$('cloud-logout'),upload=$('cloud-upload');
const ownerId=$('share-my-id'),members=$('share-members'),shared=$('share-workspaces'),sharePanel=$('share-panel'),addMember=$('share-add'),guestId=$('share-guest-id');
const sections=['transactions','cards','bills','investments','goals'];
const normalize=d=>Object.fromEntries(sections.map(k=>[k,Array.isArray(d?.[k])?d[k]:[]]));
const hasData=d=>sections.some(k=>d[k]?.length);
const say=t=>{status.textContent=t};
let user=null,workspace=null,unsubscribe=null,unsubInvites=null,unsubMembers=null,ready=false,blocked=false,writeQueue=Promise.resolve(),generation=0;
const ownRef=uid=>doc(store,'users',uid,'finance','data');
const memberRef=(owner,guest)=>doc(store,'users',owner,'members',guest);
const inviteRef=(guest,owner)=>doc(store,'access',guest,'owners',owner);
function ui(){login.hidden=!!user;logout.hidden=!user;sharePanel.hidden=!user;upload.hidden=!user||workspace!==user?.uid||!ready;ownerId.textContent=user?.uid||'';}
function stopWorkspace(){generation++;if(unsubscribe){unsubscribe();unsubscribe=null}ready=false;blocked=false;workspace=null;ui()}
async function push(data){if(!ready||!workspace||!user||blocked){say('Aguarde a conexão antes de alterar registros.');return}const gen=generation,ref=ownRef(workspace),payload=normalize(data);writeQueue=writeQueue.catch(()=>{}).then(async()=>{if(gen!==generation)return;try{say('Salvando alterações...');await setDoc(ref,{...payload,updatedAt:Date.now()});if(gen===generation)say('Sincronizado ✓')}catch(e){say('Erro ao salvar: '+(e.code||e.message)+' — faça backup');console.error(e)}});await writeQueue}
window.financeSync={changed(data){void push(data)}};
async function openWorkspace(uid,{initial=false}={}){
 stopWorkspace();workspace=uid;const gen=generation,ref=ownRef(uid);ui();say('Carregando '+(uid===user.uid?'meus dados':'dados compartilhados')+'...');
 try{
  const snap=await getDoc(ref);if(gen!==generation)return;
  if(uid===user.uid){
   const local=window.financeBridge.get();
   if(snap.exists()){
    if(hasData(local)&&!sessionStorage.getItem('finance-share-migration-seen')){
     sessionStorage.setItem('finance-share-migration-seen','1');
     if(!confirm('Existem dados neste navegador e na sua conta. Carregar dados da nuvem? Faça backup antes se houver lançamentos locais não sincronizados.')){blocked=true;say('Sincronização pausada. Exporte um backup e recarregue para decidir.');return}
    }
    window.financeBridge.apply(normalize(snap.data()));
   }else if(hasData(local)){
    if(confirm('Sua conta ainda não tem dados na nuvem. Enviar os lançamentos locais para sua conta?'))await setDoc(ref,{...normalize(local),updatedAt:Date.now()});
    else{blocked=true;say('Migração pausada. Faça backup antes de continuar.');return}
   }else window.financeBridge.apply(normalize({}));
  }else{
   // Never upload device-local data into someone else's account.
   window.financeBridge.apply(normalize(snap.exists()?snap.data():{}));
  }
  if(gen!==generation)return;ready=true;ui();
  unsubscribe=onSnapshot(ref,s=>{if(gen!==generation||s.metadata.hasPendingWrites)return;if(s.exists())window.financeBridge.apply(normalize(s.data()));else window.financeBridge.apply(normalize({}));say('Sincronizado ✓')},e=>{ready=false;ui();say('Acesso interrompido: '+(e.code||e.message))});
  say(uid===user.uid?'Minha conta sincronizada ✓':'Conta compartilhada sincronizada ✓');
 }catch(e){ready=false;ui();say('Não foi possível abrir: '+(e.code||e.message))}
}
async function showMembers(){if(!user)return;const snap=await getDocs(collection(store,'users',user.uid,'members'));members.innerHTML='';if(snap.empty){members.textContent='Nenhuma pessoa convidada.';return}snap.forEach(d=>{const row=document.createElement('div');row.className='row';row.style.cssText='padding:7px 0;gap:8px;flex-wrap:wrap';const label=document.createElement('span');label.className='small';label.textContent=d.data().email||d.id;const button=document.createElement('button');button.className='danger';button.textContent='Revogar';button.onclick=async()=>{if(!confirm('Revogar o acesso desta pessoa?'))return;try{await deleteDoc(memberRef(user.uid,d.id));await deleteDoc(inviteRef(d.id,user.uid));await showMembers();say('Acesso revogado.')}catch(e){say('Erro ao revogar: '+(e.code||e.message))}};row.append(label,button);members.append(row)})}
async function showWorkspaces(){if(!user)return;const s=await getDocs(collection(store,'access',user.uid,'owners'));shared.innerHTML='';const self=document.createElement('button');self.className='secondary';self.textContent='Minha conta';self.onclick=()=>openWorkspace(user.uid);shared.append(self);s.forEach(d=>{const btn=document.createElement('button');btn.className='secondary';btn.textContent='Compartilhado: '+(d.data().ownerEmail||d.id);btn.onclick=()=>openWorkspace(d.id);shared.append(btn)})}
login.onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){say('Erro no login: '+(e.code||e.message))}};
logout.onclick=async()=>{if(!confirm('Sair? Se o aparelho for compartilhado, os dados exibidos serão apagados deste navegador.'))return;stopWorkspace();await signOut(auth);window.financeBridge.apply(normalize({}));};
upload.onclick=async()=>{if(!user||workspace!==user.uid||!ready)return;if(!confirm('Substituir TODOS os dados da sua conta na nuvem pelos dados deste navegador? Faça backup antes.'))return;await push(window.financeBridge.get())};
$('share-copy').onclick=async()=>{try{await navigator.clipboard.writeText(user.uid);say('Seu código de usuário foi copiado.')}catch(e){say('Selecione e copie seu código de usuário.')}};
addMember.onclick=async()=>{if(!user)return;const guest=guestId.value.trim();if(!/^[A-Za-z0-9]{15,128}$/.test(guest)||guest===user.uid){say('Informe o código UID válido da outra pessoa.');return}if(!confirm('Dar a esta conta acesso TOTAL para visualizar, adicionar, editar e excluir todos os seus dados financeiros?'))return;addMember.disabled=true;try{await setDoc(memberRef(user.uid,guest),{email:($('share-guest-label').value||'').trim().slice(0,120),addedAt:Date.now()});await setDoc(inviteRef(guest,user.uid),{ownerUid:user.uid,ownerEmail:user.email||'',addedAt:Date.now()});guestId.value='';await showMembers();say('Convite ativado. A pessoa deve atualizar o app e escolher sua conta em Acessos.')}catch(e){say('Falha ao convidar: '+(e.code||e.message))}finally{addMember.disabled=false}};
onAuthStateChanged(auth,async next=>{stopWorkspace();if(unsubInvites){unsubInvites();unsubInvites=null}user=next;ui();if(!user){say('Entre com Google para sincronizar.');return}say('Conectando...');try{await openWorkspace(user.uid,{initial:true});await Promise.all([showMembers(),showWorkspaces()]);unsubInvites=onSnapshot(collection(store,'access',user.uid,'owners'),()=>{void showWorkspaces()},()=>{});}catch(e){say('Falha ao carregar compartilhamento: '+(e.code||e.message))}});
