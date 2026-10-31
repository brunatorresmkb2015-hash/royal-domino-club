const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("."));

const rooms = new Map();
const makeId = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const makeDeck = () => {
  const deck = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push({a,b,id:`${a}-${b}`});
  return deck;
};
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const points = hand => hand.reduce((s,t)=>s+t.a+t.b,0);
const publicRoom = room => ({
  code:room.code, mode:room.mode, target:room.target, fill:room.fill,
  players:room.players.map((p,i)=>({id:p.id,name:p.name,seat:i,connected:p.connected,team:room.mode==="duplas"?i%2:null})),
  status:room.status, round:room.round, score:room.score, chain:room.chain,
  current:room.current, boneyard:room.boneyard.length, passCount:room.passCount,
  winner:room.winner, lastMessage:room.lastMessage
});
function emitRoom(room) { io.to(room.code).emit("state", publicRoom(room)); }
function startRound(room) {
  const deck=shuffle(makeDeck());
  room.hands=room.players.map(()=>[]);
  const count=room.players.length===2?7:7;
  for(let n=0;n<count;n++) room.hands.forEach(h=>h.push(deck.pop()));
  room.boneyard=deck; room.chain=[]; room.passCount=0; room.winner=null;
  room.status="playing"; room.current=room.players.findIndex((p,i)=>room.hands[i].some(t=>t.a===6&&t.b===6));
  if(room.current<0) room.current=room.hands.reduce((best,h,i)=>h.length>room.hands[best].length?i:best,0);
  room.round++;
  emitRoom(room); sendHands(room);
}
function sendHands(room) { room.players.forEach((p,i)=>io.to(p.id).emit("hand",{hand:room.hands[i],seat:i})); }
function endRound(room, winner, reason) {
  room.status="roundOver"; room.winner=winner;
  let award=0;
  if(winner>=0) {
    if(reason==="bicha") award=2;
    else if(room.mode==="duplas") {
      const losing=room.hands.reduce((s,h,i)=>s+(i%2===winner%2?0:points(h)),0);
      award=losing;
    } else award=room.hands.reduce((s,h,i)=>s+(i===winner?0:points(h)),0);
    room.score[winner%2]+=award;
  }
  room.lastMessage=reason==="closed"?"Jogo fechado — venceu quem tinha menos pontos.":reason==="bicha"?"Batida de bucha! Vale 2 pontos.":"Dominó!";
  emitRoom(room);
}
function nextTurn(room) {
  room.current=(room.current+1)%room.players.length;
  if(room.passCount>=room.players.length) {
    const totals=room.hands.map(points);
    const min=Math.min(...totals);
    const winners=totals.map((v,i)=>v===min?i:-1).filter(i=>i>=0);
    endRound(room,winners[0],"closed"); return;
  }
  emitRoom(room); sendHands(room);
}
io.on("connection", socket => {
  socket.on("createRoom", ({name,mode,target,fill}, cb) => {
    const code=makeId();
    const room={code,mode:mode==="duplas"?"duplas":"individual",target:Math.max(4,Math.min(8,Number(target)||4)),fill:!!fill,
      players:[],hands:[],boneyard:[],chain:[],status:"lobby",round:0,score:[0,0,0,0],current:0,passCount:0,winner:null};
    rooms.set(code,room); joinRoom(socket,room,name,cb);
  });
  socket.on("joinRoom", ({code,name}, cb) => {
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room) return cb?.({error:"Sala não encontrada. Confira o código."});
    if(room.status!=="lobby" || room.players.length>=4) return cb?.({error:"A sala já começou ou está cheia."});
    joinRoom(socket,room,name,cb);
  });
  function joinRoom(socket,room,name,cb) {
    if(room.players.some(p=>p.name.toLowerCase()===(name||"").trim().toLowerCase())) return cb?.({error:"Esse nome já está na sala."});
    room.players.push({id:socket.id,name:(name||"Jogador").trim().slice(0,18),connected:true});
    socket.join(room.code); socket.data.room=room.code;
    cb?.({code:room.code}); emitRoom(room);
  }
  socket.on("startGame",()=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="lobby"||room.players[0]?.id!==socket.id||room.players.length<2)return;
    startRound(room);
  });
  socket.on("playTile",({tileId,side})=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="playing")return;
    const seat=room.players.findIndex(p=>p.id===socket.id); if(seat!==room.current)return;
    const hand=room.hands[seat], idx=hand.findIndex(t=>t.id===tileId); if(idx<0)return;
    const tile=hand[idx];
    if(room.chain.length===0) room.chain.push({...tile});
    else {
      const left=room.chain[0].a, right=room.chain[room.chain.length-1].b;
      let placed=null;
      if(side==="left" && (tile.b===left||tile.a===left)) placed=tile.a===left?{a:tile.b,b:tile.a}:{a:tile.a,b:tile.b};
      if(side==="right" && (tile.a===right||tile.b===right)) placed=tile.a===right?{a:tile.a,b:tile.b}:{a:tile.b,b:tile.a};
      if(!placed)return;
      if(side==="left")room.chain.unshift(placed); else room.chain.push(placed);
    }
    hand.splice(idx,1); room.passCount=0;
    if(hand.length===0){endRound(room,seat,tile.a===tile.b?"bicha":"normal");return;}
    nextTurn(room);
  });
  socket.on("draw",()=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="playing")return;
    const seat=room.players.findIndex(p=>p.id===socket.id); if(seat!==room.current||!room.boneyard.length)return;
    room.hands[seat].push(room.boneyard.pop()); room.passCount=0;
    emitRoom(room); sendHands(room);
  });
  socket.on("pass",()=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="playing")return;
    const seat=room.players.findIndex(p=>p.id===socket.id); if(seat!==room.current)return;
    room.passCount++; nextTurn(room);
  });
  socket.on("chat",message=>{
    const room=rooms.get(socket.data.room); if(!room)return;
    const player=room.players.find(p=>p.id===socket.id); if(!player)return;
    io.to(room.code).emit("chat",{name:player.name,text:String(message||"").slice(0,240),time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})});
  });
  socket.on("rematch",()=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="roundOver")return;
    if(room.round>=room.target){room.status="seriesOver";emitRoom(room);return;}
    startRound(room);
  });
  socket.on("newSeries",()=>{
    const room=rooms.get(socket.data.room); if(!room||room.status!=="seriesOver")return;
    room.score=[0,0,0,0];room.round=0;startRound(room);
  });
  socket.on("disconnect",()=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const p=room.players.find(x=>x.id===socket.id);if(p)p.connected=false;
    emitRoom(room);
  });
});
const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`Dominó Cassino rodando na porta ${port}`));
