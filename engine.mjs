export const VERSION=2;
export const PHASES=['writer-pass','write','answer','result','finish'];
export const shuffled=(items,rng=Math.random)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function createGame(settings,faceIds,topics,rng=Math.random){
 const names=settings.names.map((x,i)=>String(x).trim().slice(0,18)||'プレイヤー'+(i+1));
 if(names.length<2||names.length>10)throw Error('2〜10人で遊べます。');
 const laps=settings.laps===2?2:1,total=names.length*laps,pool=[...new Set(faceIds)];
 if(pool.length<total*5)throw Error('この人数で使う写真を準備できませんでした。');
 const selected=topics.filter(t=>settings.genres.includes(t.genre));if(selected.length<3)throw Error('お題のジャンルを選んでください。');
 const faces=settings.faceOrder?settings.faceOrder.filter(id=>pool.includes(id)):shuffled(pool,rng);let deck=settings.topicOrder?settings.topicOrder.map(id=>selected.find(t=>t.id===id)).filter(Boolean):shuffled(selected,rng),used=0;
 const rounds=Array.from({length:total},(_,index)=>{const host=index%names.length,writers=Array.from({length:Math.min(3,names.length-1)},(_,j)=>(host+j+1)%names.length);
  if(used+3>deck.length){deck=shuffled(selected,rng);used=0}const deal=shuffled(faces.splice(0,5),rng),targetId=deal[0];
  return {host,writers,targetId,bonusCardId:deal[1],candidates:shuffled(deal,rng),clues:deck.slice(used,used+=3).map((t,j)=>({topicId:t.id,title:t.title,genre:t.genre,writer:writers[j%writers.length],text:''})),selected:null,guess:null,correct:null,resultRevealed:false,bestClue:null,displayOrder:shuffled([0,1,2],rng),bestOrder:shuffled([0,1,2],rng),bestConfirmed:false};
 });return {version:VERSION,names,laps,rounds,roundIndex:0,writerCursor:0,phase:'writer-pass',createdAt:Date.now()};
}
export const currentRound=g=>g.rounds[g.roundIndex];
export const currentWriter=g=>currentRound(g).writers[g.writerCursor];
export const assignedClues=g=>currentRound(g).clues.map((c,i)=>({...c,index:i})).filter(c=>c.writer===currentWriter(g));
export function openWriter(g){if(g.phase!=='writer-pass')throw Error('手番が違います。');g.phase='write'}
export function submitWriter(g){if(g.phase!=='write')throw Error('今はプロフィールの入力中ではありません。');if(!assignedClues(g).every(c=>c.text.trim()))throw Error('担当のプロフィールを入力してください。');g.phase=++g.writerCursor<currentRound(g).writers.length?'writer-pass':'answer'}
export function selectPerson(g,id){if(g.phase==='answer'&&currentRound(g).candidates.includes(id))currentRound(g).selected=id}
export function lockGuess(g){const r=currentRound(g);if(g.phase!=='answer'||!r.candidates.includes(r.selected))throw Error('ひとりを選んでください。');r.guess=r.selected;r.correct=null;r.resultRevealed=false;r.bestClue=null;r.bestConfirmed=false;g.phase='result'}
export function revealResult(g){if(g.phase!=='result')return;const r=currentRound(g);r.resultRevealed=true;r.correct=r.guess===r.targetId;if(r.writers.length===1)r.bestClue=0}
export function chooseBest(g,index){if(g.phase!=='result'||!currentRound(g).resultRevealed||currentRound(g).bestConfirmed||!Number.isInteger(index)||index<0||index>2)return;currentRound(g).bestClue=index}
export function nextRound(g){const r=currentRound(g);if(g.phase!=='result'||!r.resultRevealed)throw Error('先に答えを見てください。');if(r.bestClue===null)throw Error('ベストプロフィールをひとつ選んでください。');r.bestConfirmed=true;if(g.roundIndex+1===g.rounds.length)g.phase='finish';else{g.roundIndex++;g.writerCursor=0;g.phase='writer-pass'}}
export function awards(g){return g.rounds.flatMap((r,round)=>!r.resultRevealed?[]:[...(r.correct?[{owner:r.host,id:r.targetId,round,reason:'正解'}]:[]),...(!r.bestConfirmed||r.bestClue===null?[]:[{owner:r.clues[r.bestClue].writer,id:r.bonusCardId,round,reason:'ベストプロフィール'}])])}
export const scores=g=>g.names.map((name,owner)=>({name,owner,points:awards(g).filter(a=>a.owner===owner).length}));
export const collected=g=>g.rounds.filter(r=>r.correct===true);
export function protectPrivate(g){if(g.phase==='write')g.phase='writer-pass';return g}
export function validateGame(g,faceIds){try{
 const ids=new Set(faceIds);if(!g||g.version!==VERSION||!Array.isArray(g.names)||g.names.length<2||g.names.length>10||!g.names.every(n=>typeof n==='string'&&n.length>0&&n.length<=18)||![1,2].includes(g.laps)||!PHASES.includes(g.phase)||!Array.isArray(g.rounds)||g.rounds.length!==g.names.length*g.laps||!Number.isInteger(g.roundIndex)||g.roundIndex<0||g.roundIndex>=g.rounds.length)return false;
 const n=g.names.length,used=new Set();for(const r of g.rounds){if(!Number.isInteger(r.host)||r.host<0||r.host>=n||!Array.isArray(r.writers)||r.writers.length!==Math.min(3,n-1)||new Set(r.writers).size!==r.writers.length||r.writers.some(x=>!Number.isInteger(x)||x<0||x>=n||x===r.host)||!Array.isArray(r.candidates)||r.candidates.length!==5||new Set(r.candidates).size!==5||r.candidates.some(id=>!ids.has(id)||used.has(id))||!r.candidates.includes(r.targetId)||!r.candidates.includes(r.bonusCardId)||r.bonusCardId===r.targetId||!Array.isArray(r.clues)||r.clues.length!==3||r.clues.some(c=>typeof c.title!=='string'||typeof c.text!=='string'||c.text.length>80||!r.writers.includes(c.writer))||typeof r.resultRevealed!=='boolean'||(r.bestClue!==null&&(!Number.isInteger(r.bestClue)||r.bestClue<0||r.bestClue>2))||(r.selected!==null&&!r.candidates.includes(r.selected))||(r.guess!==null&&!r.candidates.includes(r.guess)))return false;
 r.candidates.forEach(id=>used.add(id));if(r.resultRevealed){if(r.correct!==(r.guess===r.targetId)||r.guess===null)return false}else if(r.correct!==null||r.bestClue!==null)return false;
 }return Number.isInteger(g.writerCursor)&&g.writerCursor>=0&&g.writerCursor<=currentRound(g).writers.length;
 }catch{return false}}
