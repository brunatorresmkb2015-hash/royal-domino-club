const socket=io();
const $=id=>document.getElementById(id);
let roomState=null, myHand=[], mySeat=-1, selected=null;
function err(t){$("error").textContent=t||""}
function enter(data){$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("roomCode").textContent=data.code;}
$("create").onclick=()=>{err("");socket.emit("createRoom",{name:$("name").value,mode:$("mode").value,target:$("target").value,fill:$("fill").value==="yes"},r=>r.error?err(r.error):enter(r));};
$("join").onclick=()=>{err("");socket.emit("joinRoom",{name:$("name").value,code:$("codeInput").value},r=>r.error?err(r.error):enter(r));};
$("copy").onclick=()=>navigator.clipboard?.writeText($("roomCode").textContent);
socket.on("state",s=>{roomState=s;render();});
socket.on("hand",h=>{myHand=h.hand;mySeat=h.seat;selected=null;renderHand();});
function render(){
 if(!roomState)return;
 $("roomCode").textContent=roomState.code;$("round").textContent=roomState.round;$("targetView").textContent=roomState.target;
 const seats=["seatBottom","seatLeft","seatTop","seatRight"];
 seats.forEach((id,i)=>{const p=roomState.players.find(x=>x.seat===i);$(id).innerHTML=p?`${p.name}${p.connected?"":" · desconectado"}<small>${p.seat===roomState.current&&roomState.status==="playing"?"SUA VEZ":roomState.mode==="duplas"?(p.team===0?"DUPLA A":"DUPLA B"):"JOGADOR"}</small>`:"Aguardando jogador";$(id).classList.toggle("active",!!p&&p.seat===roomState.current);});
 $("chain").innerHTML=roomState.chain.length?roomState.chain.map(t=>tileHTML(t,false)).join(""):'<div class="empty">Aguardando a primeira pedra...</div>';
 $("turn").textContent=roomState.status==="playing"?(roomState.players[roomState.current]?.name+" está jogando"):(roomState.lastMessage||"Aguardando jogadores");
 $("score").innerHTML=roomState.score.map((v,i)=>`<span>${roomState.mode==="duplas"?"DUPLA "+(i+1):"JOGADOR "+(i+1)} <b>${v}</b></span>`).slice(0,roomState.mode==="duplas"?2:4).join("");
 $("rematch").classList.toggle("hidden",!["roundOver","seriesOver"].includes(roomState.status));
 $("rematch").textContent=roomState.status==="seriesOver"?"NOVA SÉRIE":"PRÓXIMA PARTIDA";
 $("draw").disabled=roomState.status!=="playing"||roomState.current!==mySeat||roomState.boneyard===0;
 $("pass").disabled=roomState.status!=="playing"||roomState.current!==mySeat;
 if(roomState.status==="lobby"&&roomState.players.length>=2&&roomState.players[0]?.id===socket.id&&!$("start")){const b=document.createElement("button");b.id="start";b.className="gold";b.textContent="INICIAR PARTIDA";b.onclick=()=>socket.emit("startGame");$("game").querySelector(".gamebar").append(b);}
}
function tileHTML(t,vertical=true){return `<div class="tile ${vertical?"vertical":""}">${halfHTML(t.a)}${halfHTML(t.b)}</div>`}
function halfHTML(n){const patterns={0:[],1:[4],2:[1,6],3:[1,4,6],4:[1,3,5,7],5:[1,3,4,5,7],6:[1,2,3,5,6,7]};return `<div class="half">${Array.from({length:6},(_,i)=>`<i class="pip" style="visibility:${patterns[n].includes(i+1)?"visible":"hidden"};--pip:${["#b73535","#2d8b57","#315c9c","#c08c27"][n%4]}"></i>`).join("")}</div>`}
function renderHand(){$("hand").innerHTML=myHand.map(t=>`<div data-id="${t.id}" class="tile ${selected===t.id?"selected":""}">${halfHTML(t.a)}${halfHTML(t.b)}</div>`).join("");$("handCount").textContent=`(${myHand.length})`;document.querySelectorAll("#hand .tile").forEach(el=>el.onclick=()=>{selected=el.dataset.id;renderHand();if(roomState?.chain.length===0)socket.emit("playTile",{tileId:selected,side:"right"});else showPlacement();});}
function showPlacement(){if(!$("placement")){const d=document.createElement("span");d.id="placement";d.innerHTML=' <button class="outline" id="leftPlay">PONTA ESQUERDA</button> <button class="outline" id="rightPlay">PONTA DIREITA</button>';$("handarea").append(d);$("leftPlay").onclick=()=>play("left");$("rightPlay").onclick=()=>play("right");}}
function play(side){if(selected)socket.emit("playTile",{tileId:selected,side});selected=null;$("placement")?.remove();}
$("draw").onclick=()=>socket.emit("draw");$("pass").onclick=()=>socket.emit("pass");
$("rematch").onclick=()=>roomState.status==="seriesOver"?socket.emit("newSeries"):socket.emit("rematch");
$("chatForm").onsubmit=e=>{e.preventDefault();const v=$("chatInput").value.trim();if(v){socket.emit("chat",v);$("chatInput").value="";}};
socket.on("chat",m=>{const p=document.createElement("p");p.innerHTML=`<b>${escapeHTML(m.name)}</b> <time>${m.time}</time><br>${escapeHTML(m.text)}`;$("messages").append(p);$("messages").scrollTop=$("messages").scrollHeight;});
function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
