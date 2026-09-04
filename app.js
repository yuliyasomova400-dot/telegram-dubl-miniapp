const SYMBOLS = ['☀️','🌙','⭐','❤️','⚡','🔥','🍀','🌈','🚀','🐙','🦋','🍓','🎈','👑','💎','🎵','👻','🧿','🌵','🍕','🐳','🦄','⚓','🍉'];
const MERMAID_SYMBOLS = ['🧜‍♀️','🦀','🐠','🔱','🐚','👑','🐙','🍴','💎','⚓','🐦','🎵','🫧','🏰','⭐','🧪','🪞','🌊'];
const ANIMAL_NAMES = ['Пчела','Морская звезда','Щенок','Слон','Обезьянка','Пингвин','Тюлень','Коала','Корова','Тигр','Рыбка','Крокодил','Сова','Попугай','Черепаха','Кролик'];
const ANIMAL_SYMBOLS = ANIMAL_NAMES.map((_,index)=>'animal-'+index);
const ANIMAL_ATLAS = 'assets/animals-atlas-v1.png';
// Square regions include whole ears and tails and exclude neighboring sprites.
const ANIMAL_REGIONS = [[25,15,285],[340,25,270],[640,0,310],[945,15,285],[20,310,285],[340,320,285],[630,315,290],[950,325,285],[15,620,300],[340,620,290],[615,625,290],[915,615,320],[25,915,300],[330,910,280],[605,900,305],[943,900,310]];
const DUEL_ROUND_PAUSE = 420;
const DUEL_NEW_ROUND_GUARD = 300;
// Pack differently sized symbols inside the circle, including rotated corners.
function scatteredLayout(count,random=Math.random){
  const sizes=count===6?[28,25,23,21,19,17]:[26,24,22,20,19,17,16];
  for(let attempt=0;attempt<80;attempt++){
    const layout=[],shrink=Math.pow(.985,Math.floor(attempt/2));
    for(let i=0;i<count;i++){
      const size=sizes[i]*shrink,radius=size/Math.SQRT2*1.08;
      let placed=false;
      for(let trial=0;trial<120;trial++){
        const angle=random()*Math.PI*2,distance=Math.sqrt(random())*(47-radius);
        const x=50+Math.cos(angle)*distance,y=50+Math.sin(angle)*distance;
        if(layout.every(p=>Math.hypot(x-p.x,y-p.y)>=radius+p.radius+1)){
          layout.push({x,y,size,radius,rotation:random()*100-50});placed=true;break;
        }
      }
      if(!placed)break;
    }
    if(layout.length===count)return layout.sort(()=>random()-.5);
  }
  // Bounded fallback for a pathological random source; still varied in size.
  return Array.from({length:count},(_,i)=>({x:50+27*Math.cos(i*2*Math.PI/count),y:50+27*Math.sin(i*2*Math.PI/count),size:14+i*.3,radius:(14+i*.3)/Math.SQRT2*1.08,rotation:i*13-35}));
}
const state={mode:'solo',score:0,other:0,time:60,timer:null,match:null,sound:true,turn:1,lastMode:'solo',fieldTheme:'classic',inputLocked:false,localRoundId:0,localHasRound:false,localAcceptAfter:0,pendingMode:'duel',fieldLoading:false,localRoundTimer:null,room:null,user:null,channel:null,poller:null,onlineBusy:false,renderedTurn:-1,confirmingReady:false,readyFallback:null};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const tg=window.Telegram?.WebApp; if(tg){tg.ready();tg.expand();tg.setHeaderColor('#ede8ff');tg.setBackgroundColor('#ede8ff');}
const SUPABASE_URL='https://erafksbzscusdlclnded.supabase.co';
const SUPABASE_KEY='sb_publishable_AQvnIp5BDeWXgWpOvMbBAQ_3cXCxJz2';
const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
function haptic(type='light'){tg?.HapticFeedback?.impactOccurred(type)}
let audioContext;
function tone(frequency=440,duration=.06,type='sine',volume=.035){if(!state.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();oscillator.type=type;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}catch{}}
function clickFeedback(button){button?.classList.add('button-pulse');setTimeout(()=>button?.classList.remove('button-pulse'),260);tone(310,.045,'sine',.025);haptic('light')}
function setFieldTheme(theme='classic'){
  state.fieldTheme=['classic','mermaid','animals'].includes(theme)?theme:'classic';
  $('.app').classList.toggle('field-mermaid',state.fieldTheme==='mermaid');
  $('.app').classList.toggle('field-animals',state.fieldTheme==='animals');
}
function openFieldChoice(mode){
  state.pendingMode=mode;
  $('#fieldChoiceEyebrow').textContent=mode==='solo'?'ИГРА НА ВРЕМЯ':'ДУЭЛЬ НА ОДНОМ ТЕЛЕФОНЕ';
  $('#fieldChoiceMessage').textContent='На каком оформлении будете играть?';
  show('#fieldChoiceScreen');
}
let animalImage;
function loadAnimalArt(){
  if(animalImage?.complete&&animalImage.naturalWidth)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    animalImage=new Image();animalImage.onload=resolve;animalImage.onerror=reject;animalImage.src=ANIMAL_ATLAS;
  });
}
async function selectField(button){
  if(state.fieldLoading)return;
  state.fieldLoading=true;
  clickFeedback(button);
  const mode=state.pendingMode;
  try{
    if(button.dataset.field==='animals'){
      $('#fieldChoiceMessage').textContent='Загружаем зверят…';
      await loadAnimalArt();
    }
    if(!$('#fieldChoiceScreen').classList.contains('active'))return;
    setFieldTheme(button.dataset.field);
    startGame(mode);
  }catch{
    $('#fieldChoiceMessage').textContent='Не удалось загрузить зверят. Нажмите ещё раз или выберите другое поле.';
  }finally{state.fieldLoading=false}
}
function syncHeader(){['LeftScore','RightScore'].forEach(k=>$('#header'+k).textContent=$('#'+k[0].toLowerCase()+k.slice(1)).textContent);$('#headerTimer').textContent=$('#timer').textContent;$('#headerLeftLabel').textContent=$('#leftLabel').textContent;$('#headerRightLabel').textContent=$('#rightLabel').textContent}
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');$('.app').classList.toggle('playing',id==='#gameScreen')}
function sample(arr,n,exclude=[]){return [...arr].filter(x=>!exclude.includes(x)).sort(()=>Math.random()-.5).slice(0,n)}
function makeRound(){
  clearTimeout(state.localRoundTimer);state.localRoundTimer=null;
  state.localRoundId++;
  state.localAcceptAfter=state.mode==='duel'&&state.localHasRound?performance.now()+DUEL_NEW_ROUND_GUARD:0;
  state.localHasRound=true;state.inputLocked=false;
  const symbols=state.fieldTheme==='animals'?ANIMAL_SYMBOLS:state.fieldTheme==='mermaid'?MERMAID_SYMBOLS:SYMBOLS;
  const count=state.fieldTheme==='animals'?6:7;
  const match=sample(symbols,1)[0];state.match=match;
  const left=[match,...sample(symbols,count-1,[match])].sort(()=>Math.random()-.5);
  const right=[match,...sample(symbols,count-1,left)].sort(()=>Math.random()-.5);
  renderCards([left,right]);
}
function renderCards(cards){
  const mermaid=state.fieldTheme==='mermaid',animals=state.fieldTheme==='animals';
  const roundId=state.localRoundId;
  cards.forEach((items,index)=>{
    const positions=scatteredLayout(items.length);
    const card=document.createElement('div');card.className='card';
    items.forEach((symbol,i)=>{
      const b=document.createElement('button');b.className='symbol';b.dataset.symbol=symbol;
      const animalIndex=ANIMAL_SYMBOLS.indexOf(symbol);
      b.setAttribute('aria-label',animalIndex<0?symbol:ANIMAL_NAMES[animalIndex]);
      if(animalIndex>=0){
        const sprite=document.createElement('span');sprite.className='animal-sprite';
        sprite.setAttribute('aria-hidden','true');
        const [sx,sy,size]=ANIMAL_REGIONS[animalIndex];
        sprite.style.backgroundSize=1254/size*100+'%';
        sprite.style.backgroundPosition=sx/(1254-size)*100+'% '+sy/(1254-size)*100+'%';
        b.append(sprite);
      }else{b.textContent=symbol}
      const {x,y,size,rotation}=positions[i];
      b.style=`left:${x}%;top:${y}%;width:${size}%;height:${size}%;font-size:${animals?0:size*.76}cqw;transform:rotate(${rotation}deg)`;
      let gestureAllowed;
      b.onpointerdown=()=>{gestureAllowed=state.mode==='online'||(!state.inputLocked&&roundId===state.localRoundId&&(state.mode!=='duel'||performance.now()>=state.localAcceptAfter))};
      b.onpointercancel=()=>{gestureAllowed=false};
      b.onclick=()=>{
        if(gestureAllowed===false){gestureAllowed=undefined;return}
        gestureAllowed=undefined;
        pick(b,symbol,index,roundId);
      };
      card.append(b);
    });
    $(index===0?'#topCard':'#bottomCard').replaceChildren(card);
  });
}
function pick(button,symbol,cardIndex,roundId=state.localRoundId){
  if(state.mode==='online')return pickOnline(button,symbol);
  if(state.inputLocked||roundId!==state.localRoundId)return;
  if(state.mode==='duel'&&performance.now()<state.localAcceptAfter)return;
  if(state.mode==='duel'&&cardIndex!==0&&cardIndex!==1)return;
  if(symbol===state.match){
    state.inputLocked=true;
    button.classList.add('correct');tone(720,.12,'sine',.05);haptic('medium');
    if(state.mode==='solo'){state.score++;$('#leftScore').textContent=state.score}
    else{if(cardIndex===0)state.score++;else state.other++;updateDuel()}
    syncHeader();
    if(state.mode==='duel'&&(state.score>=10||state.other>=10)){
      state.localRoundTimer=setTimeout(endGame,350);
    }else{state.localRoundTimer=setTimeout(makeRound,state.mode==='duel'?DUEL_ROUND_PAUSE:260)}
  }else{
    button.classList.add('wrong');tone(145,.15,'sawtooth',.035);haptic('heavy');
    setTimeout(()=>button.classList.remove('wrong'),320);
    if(state.mode==='solo'){state.score=Math.max(0,state.score-1);$('#leftScore').textContent=state.score}
    else{if(cardIndex===0)state.score=Math.max(0,state.score-1);else state.other=Math.max(0,state.other-1);updateDuel()}
    syncHeader();
  }
}
function updateDuel(){$('#leftScore').textContent=state.score;$('#rightScore').textContent=state.other;$('#turnBanner').textContent='Каждый нажимает на своей карточке';syncHeader()}
function startGame(mode){clearTimeout(state.localRoundTimer);state.inputLocked=false;state.localHasRound=false;state.localAcceptAfter=0;state.mode=state.lastMode=mode;state.score=state.other=0;state.turn=1;clearInterval(state.timer);show('#gameScreen');if(mode==='solo'){$('#leftLabel').textContent='ОЧКИ';$('#rightLabel').textContent='РЕКОРД';$('#rightScore').textContent=localStorage.getItem('dobble-best')||0;state.time=60;$('#turnBanner').textContent='Найди общий символ';state.timer=setInterval(()=>{state.time--;drawTime();if(state.time<=0)endGame()},1000)}else{$('#leftLabel').textContent='↑ ИГРОК 1';$('#rightLabel').textContent='↓ ИГРОК 2';$('#rightScore').textContent='0';$('#turnBanner').textContent='Каждый нажимает на своей карточке';state.time=0}$('#leftScore').textContent='0';drawTime();syncHeader();makeRound()}
function drawTime(){if(state.mode!=='solo')$('#timer').textContent='до 10';else{const minutes=Math.floor(state.time/60);const seconds=state.time%60;$('#timer').textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}syncHeader()}
function endGame(){clearTimeout(state.localRoundTimer);state.inputLocked=true;clearInterval(state.timer);if(state.mode==='solo'){const best=Math.max(state.score,+(localStorage.getItem('dobble-best')||0));localStorage.setItem('dobble-best',best);$('#resultTitle').textContent=state.score===best&&state.score>0?'Новый рекорд!':'Отличная игра!';$('#resultText').textContent='Совпадений найдено';$('#resultScore').textContent=state.score;$('#resultIcon').textContent='★'}else if(state.mode==='online'){const won=state.room?.winner_id===state.user?.id;$('#resultTitle').textContent=won?'Вы победили!':'Друг победил';$('#resultText').textContent=`Финальный счёт ${state.room?.host_score||0} : ${state.room?.guest_score||0}`;$('#resultScore').textContent='🏆';$('#resultIcon').textContent=won?'★':'⚔'}else{const winner=state.score>state.other?1:2;$('#resultTitle').textContent=`Игрок ${winner} победил!`;$('#resultText').textContent=`Финальный счёт ${state.score} : ${state.other}`;$('#resultScore').textContent='🏆';$('#resultIcon').textContent=winner===1?'1':'2'}show('#resultScreen')}

function playerName(){return tg?.initDataUnsafe?.user?.first_name||'Игрок'}
async function ensureOnlineAuth(){if(!db)throw new Error('Сервис игры не загрузился');const {data:{session}}=await db.auth.getSession();if(session){state.user=session.user;return}const {data,error}=await db.auth.signInAnonymously({options:{data:{display_name:playerName()}}});if(error)throw error;state.user=data.user}
function seededRandom(seed){let value=Number(seed)||1;return()=>{value=(value*1664525+1013904223)%4294967296;return value/4294967296}}
function onlineRound(seed){const rnd=seededRandom(seed);const shuffled=[...SYMBOLS].sort(()=>rnd()-.5);const match=shuffled[0];const left=[match,...shuffled.slice(1,7)].sort(()=>rnd()-.5);const right=[match,...shuffled.slice(7,13)].sort(()=>rnd()-.5);state.match=match;renderCards([left,right])}
async function subscribeRoom(room){if(state.channel)await db.removeChannel(state.channel);clearInterval(state.poller);state.channel=db.channel(`room:${room.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:`id=eq.${room.id}`},payload=>applyRoom(payload.new)).subscribe();state.poller=setInterval(async()=>{const {data}=await db.from('game_rooms').select('*').eq('id',room.id).single();if(data&&data.updated_at!==state.room?.updated_at)applyRoom(data)},1000)}
function showReadyWait(room,isHost){show('#onlineScreen');$('#onlineTitle').textContent=isHost?'Начинаем игру…':'Соперник уведомлён';$('#onlineText').textContent=isHost?'Подтверждаем ваше возвращение.':'Не закрывайте игру — ожидайте его.';$('#roomCode').textContent=room.code;$('#onlineLoader').hidden=false;$('#createRoomButton').hidden=true;$('#shareRoomButton').hidden=true;$('#copyRoomButton').hidden=true}
async function confirmGameReady(room){if(state.confirmingReady)return;state.confirmingReady=true;const {data,error}=await db.rpc('confirm_game_ready',{room_id:room.id}).single();state.confirmingReady=false;if(!error&&data)applyRoom(data)}
function applyRoom(room){const previousTurn=state.room?.turn_no;state.room=room;if(room.status==='waiting'){show('#onlineScreen');$('#onlineTitle').textContent='Ждём второго игрока';$('#onlineText').textContent='Можно закрыть игру — бот сообщит, когда друг подключится.';$('#roomCode').textContent=room.code;$('#onlineLoader').hidden=false;$('#createRoomButton').hidden=true;$('#shareRoomButton').hidden=false;$('#copyRoomButton').hidden=false;return}if(room.status==='active'&&!room.host_ready_at){const isHost=state.user?.id===room.host_id;showReadyWait(room,isHost);if(isHost)confirmGameReady(room);else if(!state.readyFallback)state.readyFallback=setTimeout(()=>{state.readyFallback=null;confirmGameReady(room)},2500);return}clearTimeout(state.readyFallback);state.readyFallback=null;state.mode='online';state.lastMode='online';state.score=room.host_score;state.other=room.guest_score;$('#leftLabel').textContent=room.host_name||'Игрок 1';$('#rightLabel').textContent=room.guest_name||'Игрок 2';$('#leftScore').textContent=room.host_score;$('#rightScore').textContent=room.guest_score;$('#timer').textContent='до 10';$('#turnBanner').textContent='Кто быстрее найдёт символ?';syncHeader();if(room.status==='finished')return endGame();show('#gameScreen');if(previousTurn!==room.turn_no||state.renderedTurn!==room.turn_no){state.renderedTurn=room.turn_no;onlineRound(room.round_seed)}state.onlineBusy=false}
async function registerTelegramNotifications(){if(!tg?.initData)return;await db.functions.invoke('telegram-room-notifications',{body:{action:'register',init_data:tg.initData}})}
async function notifyRoomJoined(roomId){await db.functions.invoke('telegram-room-notifications',{body:{action:'notify_joined',room_id:roomId}})}
async function createRoom(){try{setOnlineLoading('Создаём комнату…');await ensureOnlineAuth();try{await registerTelegramNotifications()}catch{}const {data,error}=await db.rpc('create_game_room',{player_name:playerName()}).single();if(error)throw error;localStorage.setItem('dubl-room',data.code);await subscribeRoom(data);applyRoom(data)}catch(error){showOnlineError(error)}}
async function joinRoom(code){try{show('#onlineScreen');setOnlineLoading('Подключаемся к другу…');await ensureOnlineAuth();const {data:existing}=await db.from('game_rooms').select('*').eq('code',code).maybeSingle();if(existing){await subscribeRoom(existing);return applyRoom(existing)}const {data,error}=await db.rpc('join_game_room',{room_code:code,player_name:playerName()}).single();if(error)throw error;try{await notifyRoomJoined(data.id)}catch{}localStorage.setItem('dubl-room',data.code);await subscribeRoom(data);applyRoom(data)}catch(error){localStorage.removeItem('dubl-room');showOnlineError(error)}}
async function pickOnline(button,symbol){if(state.onlineBusy)return;if(symbol!==state.match){state.onlineBusy=true;button.classList.add('wrong');tone(145,.15,'sawtooth',.035);haptic('heavy');setTimeout(()=>button.classList.remove('wrong'),320);const {data,error}=await db.rpc('penalize_game_point',{room_id:state.room.id,expected_turn:state.room.turn_no}).single();if(error){state.onlineBusy=false;return}return applyRoom(data)}state.onlineBusy=true;button.classList.add('correct');tone(720,.12,'sine',.05);haptic('medium');const {data,error}=await db.rpc('score_game_point',{room_id:state.room.id,expected_turn:state.room.turn_no}).single();if(error){state.onlineBusy=false;return}applyRoom(data)}
function inviteLink(){return `https://t.me/DublFamily_Bot?startapp=${state.room?.code||''}`}
function leaveOnlineSession(){clearInterval(state.poller);clearTimeout(state.readyFallback);state.poller=null;state.readyFallback=null;if(state.channel){db.removeChannel(state.channel);state.channel=null}state.room=null;state.onlineBusy=false;state.renderedTurn=-1;state.confirmingReady=false;localStorage.removeItem('dubl-room')}
function resetOnlineLobby(){$('#onlineTitle').textContent='Пригласите друга';$('#onlineText').textContent='Создайте комнату и отправьте ссылку второму игроку.';$('#roomCode').textContent='------';$('#onlineLoader').hidden=true;$('#createRoomButton').hidden=false;$('#createRoomButton').textContent='Создать комнату';$('#shareRoomButton').hidden=true;$('#copyRoomButton').hidden=true;$('#copyRoomButton').textContent='Скопировать ссылку'}
function setOnlineLoading(text){show('#onlineScreen');$('#onlineTitle').textContent=text;$('#onlineText').textContent='Подождите несколько секунд.';$('#roomCode').textContent='······';$('#onlineLoader').hidden=false;$('#createRoomButton').hidden=true}
function showOnlineError(error){$('#onlineLoader').hidden=true;$('#onlineTitle').textContent='Не удалось подключиться';$('#onlineText').textContent=error?.message?.includes('Anonymous')?'Нужно включить анонимный вход в настройках Supabase.':'Проверьте интернет и попробуйте ещё раз.';$('#createRoomButton').hidden=false;$('#createRoomButton').textContent='Попробовать снова'}
function renderLeaderboard(rows){const list=$('#rankingList');list.replaceChildren();const me=rows.find(row=>row.is_me);$('#myRank').textContent=me?`№${me.rank_position}`:'—';$('#myStats').textContent=me?`${me.games_played} игр · ${me.wins} побед · ${me.win_rate}%`:'После первой завершённой сетевой партии';if(!rows.length){const message=document.createElement('p');message.className='ranking-message';message.textContent='Пока нет завершённых сетевых партий. Станьте первым!';return list.append(message)}rows.forEach(row=>{const item=document.createElement('div');item.className=`ranking-row${row.is_me?' me':''}`;const player=document.createElement('div');player.className='ranking-player';const place=document.createElement('span');place.className='ranking-place';place.textContent=row.rank_position<=3?['🥇','🥈','🥉'][row.rank_position-1]:`№${row.rank_position}`;const name=document.createElement('span');name.className='ranking-name';name.textContent=row.player_name;const rate=document.createElement('small');rate.textContent=`Победы ${row.win_rate}%${row.is_me?' · это вы':''}`;name.append(rate);player.append(place,name);item.append(player);[row.games_played,row.wins,row.losses].forEach(value=>{const number=document.createElement('span');number.className='ranking-number';number.textContent=value;item.append(number)});list.append(item)})}
async function openLeaderboard(button){clickFeedback(button);show('#rankingScreen');$('#rankingList').innerHTML='<p class="ranking-message">Загружаем рейтинг…</p>';try{await ensureOnlineAuth();const {data,error}=await db.rpc('get_leaderboard',{limit_count:50});if(error)throw error;renderLeaderboard(data||[])}catch{$('#rankingList').innerHTML='<p class="ranking-message">Не удалось загрузить рейтинг. Попробуйте ещё раз.</p>'}}
$$('[data-mode]').forEach(b=>b.onclick=()=>{clickFeedback(b);openFieldChoice(b.dataset.mode)});
$$('[data-field]').forEach(b=>b.onclick=()=>selectField(b));
$('#fieldChoiceBackButton').onclick=()=>show('#homeScreen');$('#onlineButton').onclick=e=>{clickFeedback(e.currentTarget);setFieldTheme('classic');leaveOnlineSession();resetOnlineLobby();show('#onlineScreen')};$('#createRoomButton').onclick=createRoom;$('#shareRoomButton').onclick=()=>{const url=`https://t.me/share/url?url=${encodeURIComponent(inviteLink())}&text=${encodeURIComponent('Сыграем в Дубль?')}`;if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url)};$('#copyRoomButton').onclick=async()=>{await navigator.clipboard.writeText(inviteLink());$('#copyRoomButton').textContent='Ссылка скопирована'};$('#onlineBackButton').onclick=()=>{leaveOnlineSession();show('#homeScreen')};$('#exitButton').onclick=e=>{clickFeedback(e.currentTarget);if(state.mode==='online'){leaveOnlineSession();show('#homeScreen')}else endGame()};$('#againButton').onclick=e=>{clickFeedback(e.currentTarget);if(state.lastMode==='online')db.rpc('rematch_game',{room_id:state.room.id}).then(({data})=>data&&applyRoom(data));else setTimeout(()=>startGame(state.lastMode),100)};$('#homeButton').onclick=e=>{clickFeedback(e.currentTarget);if(state.lastMode==='online')leaveOnlineSession();setTimeout(()=>show('#homeScreen'),100)};$('#rulesButton').onclick=e=>{clickFeedback(e.currentTarget);$('#rulesDialog').showModal()};$('#closeRules').onclick=e=>{clickFeedback(e.currentTarget);$('#rulesDialog').close()};$('#soundButton').onclick=e=>{state.sound=!state.sound;e.currentTarget.textContent=state.sound?'♪':'×';e.currentTarget.setAttribute('aria-label',state.sound?'Звук включён':'Звук выключен');if(state.sound)tone(520,.08)};
$('#rankingButton').onclick=e=>openLeaderboard(e.currentTarget);$('#rankingBackButton').onclick=()=>show('#homeScreen');
const startRoom=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam');
const savedRoom=localStorage.getItem('dubl-room');
if(startRoom)joinRoom(startRoom);else if(savedRoom)joinRoom(savedRoom);
