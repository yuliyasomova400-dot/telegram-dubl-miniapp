const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function game(){
  const nodes=new Map(), timers=new Map();let nextTimer=0;
  const node=()=>({textContent:'',children:[],dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(x){this.children.push(x)},replaceChildren(...xs){this.children=xs}});
  const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
  const context=vm.createContext({
    document:{querySelector:get,querySelectorAll:()=>[],createElement:node},
    window:{},location:{search:''},URLSearchParams,Math,
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id},
    clearTimeout(id){timers.delete(id)},setInterval:()=>0,clearInterval(){}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
  const run=s=>vm.runInContext(s,context);
  return {run,nodes,timers,click(index,correct=true){
    const match=run('state.match');
    const card=get(index===0?'#topCard':'#bottomCard').children[0];
    card.children.find(b=>(b.textContent===match)===correct).onclick();
  },score(){return run('state.score+":"+state.other')}};
}

for(const theme of ['classic','mermaid']){
  test(theme+': points follow the tapped card, not alternating turns',()=>{
    const g=game();g.run("setFieldTheme('"+theme+"');startGame('duel')");
    g.click(0);assert.equal(g.score(),'1:0');
    g.click(0);g.click(1);assert.equal(g.score(),'1:0','only one winner per round');
    g.run('makeRound()');g.click(0);assert.equal(g.score(),'2:0');
    g.run('makeRound()');g.click(1);assert.equal(g.score(),'2:1');
    assert.equal(g.nodes.get('#headerLeftScore').textContent,2);
    assert.equal(g.nodes.get('#headerRightScore').textContent,1);
    g.run('makeRound()');g.click(1,false);assert.equal(g.score(),'2:0');
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
