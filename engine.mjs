export const VERSION=2;
export const PHASES=['writer-pass','write','answer','result','finish'];
export const shuffled=(items,rng=Math.random)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export const MIN_PLAYERS=3;
export const MAX_PLAYERS=6;
const MIN_CLUES_PER_ROUND=3;
export const cluesPerRound=playerCount=>Math.max(MIN_CLUES_PER_ROUND,playerCount-1);
export function anonymousClueOrder(clues, rng = Math.random) {
 const indices=clues.map((_,index)=>index);
 const order=shuffled(indices,rng);
 const writers=[...new Set(clues.map(clue=>clue.writer))];
 const writingOrder=writers.flatMap(writer=>indices.filter(index=>clues[index].writer===writer));
 if(order.every((index,position)=>clues[index].writer===clues[writingOrder[position]].writer)){
  const different=order.findIndex(index=>clues[index].writer!==clues[order[0]].writer);
  if(different>0)[order[0],order[different]]=[order[different],order[0]];
 }
 return order;
}
export function createGame(settings,faceIds,topics,rng=Math.random){
 const names=settings.names.map((x,i)=>String(x).trim().slice(0,18)||'プレイヤー'+(i+1));
 if(names.length<MIN_PLAYERS||names.length>MAX_PLAYERS)throw Error('3〜6人で遊べます。');
 const laps=1,total=names.length,pool=[...new Set(faceIds)];
 if(pool.length<total*5)throw Error('この人数で使う写真を準備できませんでした。');
 const clueCount=cluesPerRound(names.length);
 const selected=topics.filter(t=>settings.genres.includes(t.genre));if(selected.length<clueCount)throw Error('お題のジャンルを選んでください。');
 const faces=settings.faceOrder?settings.faceOrder.filter(id=>pool.includes(id)):shuffled(pool,rng);let deck=settings.topicOrder?settings.topicOrder.map(id=>selected.find(t=>t.id===id)).filter(Boolean):shuffled(selected,rng),used=0;
 const rounds=Array.from({length:total},(_,index)=>{const host=index%names.length,writers=Array.from({length:names.length-1},(_,j)=>(host+j+1)%names.length);
  if(used+clueCount>deck.length){deck=shuffled(selected,rng);used=0}const deal=shuffled(faces.splice(0,5),rng),targetId=deal[0];
  const clues=deck.slice(used,used+=clueCount).map((t,j)=>({topicId:t.id,title:t.title,genre:t.genre,writer:writers[j%writers.length],text:''}));
  return {host,writers,targetId,bonusCardId:deal[1],candidates:shuffled(deal,rng),clues,selected:null,guess:null,correct:null,resultRevealed:false,bestClue:null,displayOrder:anonymousClueOrder(clues,rng),bestOrder:anonymousClueOrder(clues,rng),bestConfirmed:false};
 });return {version:VERSION,allWriters:true,pickPrize:true,names,laps,rounds,roundIndex:0,writerCursor:0,phase:'writer-pass',createdAt:Date.now()};
}
export const currentRound=g=>g.rounds[g.roundIndex];
export const currentWriter=g=>currentRound(g).writers[g.writerCursor];
export const assignedClues=g=>currentRound(g).clues.map((c,i)=>({...c,index:i})).filter(c=>c.writer===currentWriter(g));
export function openWriter(g){if(g.phase!=='writer-pass')throw Error('手番が違います。');g.phase='write'}
export function submitWriter(g){if(g.phase!=='write')throw Error('今はプロフィールの入力中ではありません。');if(!assignedClues(g).every(c=>c.text.trim()))throw Error('担当のプロフィールを入力してください。');const round=currentRound(g);g.phase=++g.writerCursor<round.writers.length?'writer-pass':'answer';if(g.phase==='answer'){round.displayOrder=anonymousClueOrder(round.clues);round.bestOrder=anonymousClueOrder(round.clues)}}
export function selectPerson(g,id){if(g.phase==='answer'&&currentRound(g).candidates.includes(id))currentRound(g).selected=id}
export function lockGuess(g){const r=currentRound(g);if(g.phase!=='answer'||!r.candidates.includes(r.selected))throw Error('ひとりを選んでください。');r.guess=r.selected;r.correct=null;r.resultRevealed=false;r.bestClue=null;r.bestConfirmed=false;g.phase='result'}
export function revealResult(g){if(g.phase!=='result')return;const r=currentRound(g);r.resultRevealed=true;r.correct=r.guess===r.targetId;if(r.writers.length===1)r.bestClue=0}
export function chooseBest(g,index){if(g.phase!=='result'||!currentRound(g).resultRevealed||currentRound(g).bestConfirmed||!Number.isInteger(index)||index<0||index>=currentRound(g).clues.length)return;const round=currentRound(g);if(round.bestClue!==index)round.prizeId=null;round.bestClue=index}
const prizeOptions=round=>round.candidates.filter(id=>!round.correct||id!==round.targetId);
export function nextRound(g){const r=currentRound(g);if(g.phase!=='result'||!r.resultRevealed)throw Error('先に答えを見てください。');if(r.bestClue===null)throw Error('ベストプロフィールをひとつ選んでください。');r.prizeId=r.targetId;r.samePrize=true;r.bestConfirmed=true;if(g.roundIndex+1===g.rounds.length)g.phase='finish';else{g.roundIndex++;g.writerCursor=0;g.phase='writer-pass'}}
export function awards(g){return g.rounds.flatMap((r,round)=>!r.resultRevealed?[]:[...(r.correct?[{owner:r.host,id:r.targetId,round,reason:'正解'}]:[]),...(!r.bestConfirmed||r.bestClue===null?[]:[{owner:r.clues[r.bestClue].writer,id:r.samePrize?r.targetId:g.pickPrize?r.prizeId:r.bonusCardId,round,reason:'ベストプロフィール'}])])}
export const scores=g=>g.names.map((name,owner)=>({name,owner,points:awards(g).filter(a=>a.owner===owner).length}));
export const collected=g=>g.rounds.filter(r=>r.correct===true);
export function protectPrivate(g){if(g.phase==='write')g.phase='writer-pass';return g}
export function validateGame(g,faceIds){try{
 const ids=new Set(faceIds);if(!g||g.version!==VERSION||!Array.isArray(g.names)||g.names.length<2||g.names.length>10||!g.names.every(n=>typeof n==='string'&&n.length>0&&n.length<=18)||![1,2].includes(g.laps)||!PHASES.includes(g.phase)||!Array.isArray(g.rounds)||g.rounds.length!==g.names.length*g.laps||!Number.isInteger(g.roundIndex)||g.roundIndex<0||g.roundIndex>=g.rounds.length)return false;
 const n=g.names.length,used=new Set();for(const r of g.rounds){if(!Number.isInteger(r.host)||r.host<0||r.host>=n||!Array.isArray(r.writers)||r.writers.length!==(g.allWriters?n-1:Math.min(3,n-1))||new Set(r.writers).size!==r.writers.length||r.writers.some(x=>!Number.isInteger(x)||x<0||x>=n||x===r.host)||!Array.isArray(r.candidates)||r.candidates.length!==5||new Set(r.candidates).size!==5||r.candidates.some(id=>!ids.has(id)||used.has(id))||!r.candidates.includes(r.targetId)||!r.candidates.includes(r.bonusCardId)||r.bonusCardId===r.targetId||!Array.isArray(r.clues)||(g.allWriters?r.clues.length!==cluesPerRound(n):r.clues.length!==MIN_CLUES_PER_ROUND&&(g.pickPrize||n!==3||r.clues.length!==4))||r.clues.some(c=>typeof c.title!=='string'||typeof c.text!=='string'||c.text.length>80||!r.writers.includes(c.writer))||typeof r.resultRevealed!=='boolean'||(r.bestClue!==null&&(!Number.isInteger(r.bestClue)||r.bestClue<0||r.bestClue>=r.clues.length))||(r.selected!==null&&!r.candidates.includes(r.selected))||(r.guess!==null&&!r.candidates.includes(r.guess)))return false;
 if(r.samePrize&&(!r.bestConfirmed||!r.resultRevealed||r.bestClue===null||r.prizeId!==r.targetId))return false;
 if(!r.samePrize&&g.pickPrize&&((r.bestConfirmed&&!prizeOptions(r).includes(r.prizeId))||(r.prizeId!=null&&(!r.resultRevealed||r.bestClue===null||!prizeOptions(r).includes(r.prizeId)))))return false;
 r.candidates.forEach(id=>used.add(id));if(r.resultRevealed){if(r.correct!==(r.guess===r.targetId)||r.guess===null)return false}else if(r.correct!==null||r.bestClue!==null)return false;
 }return Number.isInteger(g.writerCursor)&&g.writerCursor>=0&&g.writerCursor<=currentRound(g).writers.length;
 }catch{return false}}
