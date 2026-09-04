const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('scattered symbols vary in size and stay separated inside the circle',()=>{
  const g=game();
  for(const count of [6,7])for(let round=0;round<100;round++){
    const layout=g.run('scatteredLayout('+count+')');
    assert.equal(layout.length,count);
    assert.ok(Math.max(...layout.map(p=>p.size))/Math.min(...layout.map(p=>p.size))>1.5);
    for(const [i,p] of layout.entries()){
      assert.ok(Math.hypot(p.x-50,p.y-50)+p.radius<=47.001);
      for(const q of layout.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=p.radius+q.radius);
    }
  }
});

function game(){
  const nodes=new Map(), timers=new Map();let nextTimer=0,now=0;
  const node=()=>({textContent:'',children:[],dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return true}},setAttribute(){},append(x){this.children.push(x)},replaceChildren(...xs){this.children=xs}});
  const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
  const context=vm.createContext({
    Image:class{set src(value){this.complete=true;this.naturalWidth=1254;this.onload?.()}},
    document:{querySelector:get,querySelectorAll:()=>[],createElement:node},
    performance:{now:()=>now},window:{},location:{search:''},URLSearchParams,Math,
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout(fn,delay=0){const id=++nextTimer;timers.set(id,{fn,due:now+delay});return id},
    clearTimeout(id){timers.delete(id)},setInterval:()=>0,clearInterval(){}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
  const run=s=>vm.runInContext(s,context);
  const advance=ms=>{const target=now+ms;for(;;){const next=[...timers].filter(([,v])=>v.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;now=next[1].due;timers.delete(next[0]);next[1].fn()}now=target};
  return {run,nodes,timers,advance,nextRound(){run('makeRound()');advance(301)},button(index,correct=true){
    const match=run('state.match');
    return get(index===0?'#topCard':'#bottomCard').children[0].children.find(b=>(b.dataset.symbol===match)===correct);
  },click(index,correct=true){
    const match=run('state.match');
    const card=get(index===0?'#topCard':'#bottomCard').children[0];
    card.children.find(b=>(b.dataset.symbol===match)===correct).onclick();
  },score(){return run('state.score+":"+state.other')}};
}

for(const theme of ['classic','mermaid','animals']){
  test(theme+': points follow the tapped card, not alternating turns',()=>{
    const g=game();g.run("setFieldTheme('"+theme+"');startGame('duel')");
    g.click(0);assert.equal(g.score(),'1:0');
    g.click(0);g.click(1);assert.equal(g.score(),'1:0','only one winner per round');
    g.nextRound();g.click(0);assert.equal(g.score(),'2:0');
    g.nextRound();g.click(1);assert.equal(g.score(),'2:1');
    assert.equal(g.nodes.get('#headerLeftScore').textContent,2);
    assert.equal(g.nodes.get('#headerRightScore').textContent,1);
    g.nextRound();g.click(1,false);assert.equal(g.score(),'2:0');
    g.click(1,false);assert.equal(g.score(),'2:0','no negative score');
    g.click(0,false);assert.equal(g.score(),'1:0');
  });
}

for(const index of [0,1]){
  test('player '+(index+1)+' wins at ten and cannot score again',()=>{
    const g=game();g.run("startGame('duel');state.score=9;state.other=9");
    g.click(index);assert.equal(g.score(),index===0?'10:9':'9:10');
    g.click(1-index);assert.equal(g.score(),index===0?'10:9':'9:10');
    g.run('endGame()');
    assert.equal(g.nodes.get('#resultTitle').textContent,'Игрок '+(index+1)+' победил!');
    assert.equal(g.timers.size,0,'end clears the pending round');
  });
}

test('solo accepts either card and replay clears stale round timer',()=>{
  const g=game();g.run("startGame('solo')");g.click(1);
  assert.equal(g.score(),'1:0');
  assert.equal(g.timers.size,1);
  g.run("startGame('duel')");
  assert.equal(g.timers.size,0);
  assert.equal(g.score(),'0:0');
  g.click(1);assert.equal(g.score(),'0:1');
});

for(const theme of ['classic','mermaid','animals']){
  test(theme+': late opponent tap never penalizes the following round',()=>{
    const g=game();g.run("setFieldTheme('"+theme+"');startGame('duel');state.other=5");
    const oldCorrect=g.button(1),oldWrong=g.button(1,false);
    oldCorrect.onpointerdown();
    g.click(0);
    g.advance(100);oldCorrect.onclick();oldWrong.onclick();
    assert.equal(g.score(),'1:5','resolved cards ignore all late input');
    g.advance(320);
    const earlyGesture=g.button(1,false);
    earlyGesture.onpointerdown();earlyGesture.onclick();
    g.click(1);assert.equal(g.score(),'1:5','new cards briefly ignore all input');
    earlyGesture.onpointerdown();
    g.advance(301);
    earlyGesture.onclick();
    oldCorrect.onclick();oldWrong.onclick();
    assert.equal(g.score(),'1:5','old elements and gestures stay invalid after guard expires');
    const genuineWrong=g.button(1,false);
    genuineWrong.onpointerdown();genuineWrong.onclick();
    assert.equal(g.score(),'1:4','ordinary wrong answer still costs one point');
    g.click(1);assert.equal(g.score(),'1:5','new correct answer belongs to opponent');
  });
}

test('all themes generate unique cards with exactly one matching symbol',()=>{
  const g=game();
  for(const theme of ['classic','mermaid','animals']){
    g.run("setFieldTheme('"+theme+"');startGame('duel')");
    for(let i=0;i<100;i++){
      const a=g.nodes.get('#topCard').children[0].children.map(b=>b.dataset.symbol);
      const b=g.nodes.get('#bottomCard').children[0].children.map(b=>b.dataset.symbol);
      assert.equal(a.length,theme==='animals'?6:7);
      assert.equal(b.length,a.length);
      assert.equal(new Set(a).size,a.length);
      assert.equal(new Set(b).size,b.length);
      assert.equal(a.filter(x=>b.includes(x)).length,1);
      if(theme==='animals')assert.ok(g.nodes.get('#topCard').children[0].children.every(b=>b.children[0].className==='animal-sprite'));
      g.nextRound();
    }
  }
});

test('field choice keeps solo or duel mode and clears prior theme classes',()=>{
  const g=game();
  g.run("openFieldChoice('solo');setFieldTheme('animals')");
  assert.equal(g.run('state.pendingMode'),'solo');
  assert.equal(g.nodes.get('#fieldChoiceEyebrow').textContent,'ИГРА НА ВРЕМЯ');
  g.run("openFieldChoice('duel');setFieldTheme('classic')");
  assert.equal(g.run('state.pendingMode'),'duel');
  assert.equal(g.run('state.fieldTheme'),'classic');
});

test('selecting every theme starts the requested local game mode',async()=>{
  for(const mode of ['solo','duel'])for(const theme of ['classic','mermaid','animals']){
    const g=game();
    g.run("openFieldChoice('"+mode+"')");
    await g.run("selectField({dataset:{field:'"+theme+"'},classList:{add(){},remove(){}}})");
    assert.equal(g.run('state.mode'),mode);
    assert.equal(g.run('state.fieldTheme'),theme);
    assert.equal(g.run('state.fieldLoading'),false);
    assert.equal(g.nodes.get('#topCard').children[0].children.length,theme==='animals'?6:7);
  }
});

test('animal atlas and every display region are valid',()=>{
  const g=game();
  assert.ok(fs.existsSync(path.join(__dirname,'../assets/animals-atlas-v1.png')));
  assert.equal(g.run('ANIMAL_REGIONS.length'),16);
  assert.equal(g.run('ANIMAL_REGIONS.every(([x,y,s])=>x>=0&&y>=0&&s>0&&x+s<=1254&&y+s<=1254)'),true);
});

test('failed animal download leaves the field chooser usable',async()=>{
  const g=game();
  g.run("Image=class{set src(value){this.onerror()}};openFieldChoice('duel')");
  await g.run("selectField({dataset:{field:'animals'},classList:{add(){},remove(){}}})");
  assert.equal(g.run('state.fieldLoading'),false);
  assert.match(g.nodes.get('#fieldChoiceMessage').textContent,/Не удалось/);
  await g.run("selectField({dataset:{field:'classic'},classList:{add(){},remove(){}}})");
  assert.equal(g.run('state.mode'),'duel');
});
