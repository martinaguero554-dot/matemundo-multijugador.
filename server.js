const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.json({ ok: true, service: "MateMundo multiplayer" }));

const rooms = new Map();
const cleanName = s => String(s || "Invitado").replace(/[<>]/g, "").trim().slice(0, 18) || "Invitado";
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
function makeQuestion(topic, level) {
  const chosen = topic === "Mixto" ? ["Operaciones","Fracciones","Decimales","Geometría"][rand(0,3)] : topic;
  const max = level === "Fácil" ? 12 : level === "Medio" ? 35 : 100;
  let a,b,ans,q;
  if (chosen === "Fracciones") {
    const den=rand(2,8), num=rand(1,den-1), whole=rand(2,12);
    if(level==="Difícil"){ans=`${num*2}/${den*2}`;q=`¿Qué fracción equivale a ${num}/${den}?`;}
    else {ans=num*whole;q=`¿Cuánto es ${num}/${den} de ${den*whole}?`;}
  } else if (chosen === "Decimales") {
    a=rand(10,99)/10;b=rand(10,99)/10;const op=rand(0,1)?"+":"−";
    if(op==="−"&&b>a)[a,b]=[b,a];ans=Number((op==="+"?a+b:a-b).toFixed(1));q=`${a.toFixed(1)} ${op} ${b.toFixed(1)} = ?`;
  } else if (chosen === "Geometría") {
    a=rand(2,18);b=rand(2,18);
    if(rand(0,1)){ans=a*b;q=`Área de un rectángulo de ${a} cm × ${b} cm (cm²):`;}
    else {ans=4*a;q=`Perímetro de un cuadrado de lado ${a} cm:`;}
  } else {
    const op=["+","−","×","÷"][rand(0,3)];a=rand(2,max);b=rand(2,Math.min(max,15));
    if(op==="÷"){ans=rand(2,max);a=ans*b;}else if(op==="+")ans=a+b;else if(op==="−"){if(b>a)[a,b]=[b,a];ans=a-b;}else ans=a*b;
    q=`${a} ${op} ${b} = ?`;
  }
  const options=[ans];
  while(options.length<4){
    let v;
    if(typeof ans==="number"){const delta=rand(1,Math.max(4,Math.ceil(Math.abs(ans)*.25)));v=Number.isInteger(ans)?ans+(rand(0,1)?delta:-delta):Number((ans+(rand(0,1)?delta:-delta)/10).toFixed(1));}
    else v=`${rand(1,8)}/${rand(2,12)}`;
    if(!options.some(x=>String(x)===String(v)))options.push(v);
  }
  return { question:q, answer:String(ans), options:options.sort(()=>Math.random()-.5).map(String), topic:chosen };
}
function publicRoom(r){return r.players.map(p=>({name:p.name,connected:!!p.socketId}));}
function broadcastPlayers(r){io.to(r.code).emit("players-update",{players:publicRoom(r)});}
function snapshot(r){return {round:r.round,limit:r.limit,time:r.time,question:r.current.question,options:r.current.options,players:publicRoom(r),scores:r.scores};}
function endGame(r){
  clearInterval(r.timer);r.timer=null;
  const [a,b]=r.scores;let message=a===b?`🤝 ¡Empate! ${a} a ${b}`:a>b?`🏆 ¡Ganó ${r.players[0].name}! (${a} a ${b})`:`🏆 ¡Ganó ${r.players[1].name}! (${b} a ${a})`;
  io.to(r.code).emit("game-over",{message,scores:r.scores});
}
function startQuestion(r){
  clearInterval(r.timer);r.round++;r.time=10;r.answered=[false,false];r.questionDone=false;r.current=makeQuestion(r.topic,r.level);
  io.to(r.code).emit("new-question",snapshot(r));
  r.timer=setInterval(()=>{
    r.time--;io.to(r.code).emit("tick",r.time);
    if(r.time<=0){clearInterval(r.timer);r.timer=null;r.questionDone=true;io.to(r.code).emit("answer-result",{message:"⏱️ ¡Se acabó el tiempo! Nadie sumó puntos.",scores:r.scores,finishedQuestion:true});}
  },1000);
}
function roomError(socket,msg){socket.emit("room-error",msg);}
io.on("connection",socket=>{
  socket.on("create-room",data=>{
    const code=crypto.randomBytes(3).toString("hex").toUpperCase();
    const r={code,host:socket.id,players:[{socketId:socket.id,name:cleanName(data.name)}],topic:["Operaciones","Fracciones","Decimales","Geometría","Mixto"].includes(data.topic)?data.topic:"Operaciones",level:["Fácil","Medio","Difícil"].includes(data.level)?data.level:"Medio",limit:[5,10,15,20,30,50].includes(Number(data.limit))?Number(data.limit):10,round:0,time:10,scores:[0,0],answered:[false,false],questionDone:false,timer:null,current:null};
    rooms.set(code,r);socket.join(code);socket.data.room=code;socket.data.index=0;
    socket.emit("room-created",{code,players:publicRoom(r)});
  });
  socket.on("join-room",data=>{
    const code=String(data.code||"").toUpperCase();const r=rooms.get(code);
    if(!r)return roomError(socket,"No existe esa sala. Revisá el código.");
    if(r.players.length>=2)return roomError(socket,"La sala ya está completa.");
    if(r.round>0)return roomError(socket,"La partida ya comenzó.");
    r.players.push({socketId:socket.id,name:cleanName(data.name)});socket.join(code);socket.data.room=code;socket.data.index=1;
    socket.emit("room-joined",{code,index:1,players:publicRoom(r)});broadcastPlayers(r);
  });
  socket.on("start-game",data=>{
    const r=rooms.get(String(data.code||"").toUpperCase());
    if(!r||r.host!==socket.id)return roomError(socket,"Solo quien creó la sala puede empezar.");
    if(r.players.length!==2)return roomError(socket,"Esperá a que se una otro jugador.");
    r.scores=[0,0];r.round=0;startQuestion(r);
  });
  socket.on("answer",data=>{
    const r=rooms.get(String(data.code||"").toUpperCase());if(!r||r.questionDone||!r.current)return;
    const idx=r.players.findIndex(p=>p.socketId===socket.id);if(idx<0||r.answered[idx])return;
    r.answered[idx]=true;
    const correct=String(data.answer)===r.current.answer;
    if(correct){r.scores[idx]++;r.questionDone=true;clearInterval(r.timer);r.timer=null;io.to(r.code).emit("answer-result",{message:`⚡ ¡${r.players[idx].name} respondió primero y sumó un punto!`,scores:r.scores,finishedQuestion:true});}
    else {
      socket.emit("answer-result",{message:"❌ Esa no era. Esperá o probá otra opción si todavía tenés intentos.",scores:r.scores,finishedQuestion:false});
      if(r.answered.every(Boolean)){r.questionDone=true;clearInterval(r.timer);r.timer=null;io.to(r.code).emit("answer-result",{message:"Los dos respondieron mal. ¡A la siguiente!",scores:r.scores,finishedQuestion:true});}
    }
  });
  socket.on("next-question",data=>{
    const r=rooms.get(String(data.code||"").toUpperCase());if(!r||r.host!==socket.id||!r.questionDone)return;
    if(r.round>=r.limit)return endGame(r);
    startQuestion(r);
  });
  socket.on("leave-room",data=>{const code=String(data.code||"").toUpperCase();const r=rooms.get(code);if(r){clearInterval(r.timer);io.to(code).emit("room-closed","Un jugador salió. La sala se cerró.");rooms.delete(code);}socket.leave(code);socket.data.room=null;});
  socket.on("disconnect",()=>{
    const code=socket.data.room;const r=rooms.get(code);if(r){clearInterval(r.timer);io.to(code).emit("room-closed","Un jugador se desconectó. La sala se cerró.");rooms.delete(code);}
  });
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`MateMundo server listening on ${PORT}`));
