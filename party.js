// 喝酒轉盤主程式（多人連線版）
// 用 WebRTC（PeerJS）讓多支手機連上同一個房間：
// 一個人「建立房間」當房主，其他人輸入房號加入。
// 房主是遊戲的裁判：管理玩家名單、輪到誰、轉盤結果，再廣播給所有人。

var WHEEL_OPTIONS = [
  "自己喝一口", "左邊的人喝", "右邊的人喝", "全場一起喝",
  "指定一人喝", "安全過關 😇", "喝兩口", "真心話",
  "大冒險", "學動物叫 10 秒", "跟左邊交換座位", "再轉一次",
];

var COLORS = [
  "#ff7b54", "#ffd166", "#06d6a0", "#4cc9f0",
  "#b388eb", "#f72585", "#90be6d", "#f9844a",
];

// 房號使用的字元（排除容易唸錯看錯的 0/O、1/I/L）
var CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

var canvas = document.getElementById("wheel");
var ctx = canvas.getContext("2d");
var CENTER = canvas.width / 2;
var RADIUS = CENTER - 10;

// --- 連線狀態 ---
var peer = null;       // 自己的連線節點
var isHost = false;
var conns = [];        // 房主專用：所有客人的連線
var hostConn = null;   // 客人專用：連到房主的連線
var myName = "";

// --- 遊戲狀態（以房主為準，廣播同步） ---
var players = [];      // [{ id, name, wind }]
var turnIndex = 0;
var rotation = 0;
var spinning = false;
var anim = null;       // { start, target, t0, t1 } 轉動動畫參數
var spinnerName = "";  // 這一轉是誰轉的

function myId() {
  return isHost ? "host" : (peer ? peer.id : "");
}

// ========== 大廳：建立 / 加入房間 ==========

function randomCode() {
  var code = "";
  for (var i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function setLobbyStatus(text) {
  document.getElementById("lobbyStatus").textContent = text;
}

function createRoom() {
  myName = document.getElementById("nameInput").value.trim();
  if (!myName) { alert("先輸入你的暱稱！"); return; }

  var code = randomCode();
  setLobbyStatus("建立房間中…");
  peer = new Peer("drinkwheel-" + code);

  peer.on("open", function () {
    isHost = true;
    players = [{ id: "host", name: myName, wind: 1 }];
    enterRoom(code);
  });

  peer.on("connection", function (conn) {
    conn.on("data", function (msg) { handleHostMessage(conn, msg); });
    conn.on("close", function () { removePlayer(conn); });
  });

  peer.on("error", function (err) {
    if (err.type === "unavailable-id") {
      // 房號撞號（機率很低），重新產生一個
      createRoom();
    } else {
      setLobbyStatus("連線失敗：" + err.type + "，請重新整理再試。");
    }
  });
}

function joinRoom() {
  myName = document.getElementById("nameInput").value.trim();
  var code = document.getElementById("codeInput").value.trim().toUpperCase();
  if (!myName) { alert("先輸入你的暱稱！"); return; }
  if (code.length !== 4) { alert("房號是 4 個字！"); return; }

  setLobbyStatus("連線中…");
  peer = new Peer();

  peer.on("open", function () {
    hostConn = peer.connect("drinkwheel-" + code);
    hostConn.on("open", function () {
      hostConn.send({ type: "join", name: myName });
      enterRoom(code);
    });
    hostConn.on("data", handleGuestMessage);
    hostConn.on("close", function () {
      alert("與房主斷線了，回到大廳。");
      location.reload();
    });
  });

  peer.on("error", function (err) {
    if (err.type === "peer-unavailable") {
      setLobbyStatus("找不到房號「" + code + "」，確認一下有沒有打錯。");
    } else {
      setLobbyStatus("連線失敗：" + err.type + "，請重新整理再試。");
    }
  });
}

function enterRoom(code) {
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("room").classList.remove("hidden");
  document.getElementById("roomCode").textContent = code;
  drawWheel();
  renderPlayers();
  updateButtons();
}

// ========== 房主：處理客人的訊息 ==========

function handleHostMessage(conn, msg) {
  if (msg.type === "join") {
    players.push({ id: conn.peer, name: msg.name, wind: 1 });
    conns.push(conn);
    broadcast({ type: "log", text: msg.name + " 加入了房間 🍻" });
    addLog(msg.name + " 加入了房間 🍻");
    broadcastState();
    renderPlayers();
    updateButtons();
  } else if (msg.type === "spinRequest") {
    if (!spinning && players[turnIndex] && players[turnIndex].id === conn.peer) {
      startSpin();
    }
  } else if (msg.type === "windRequest") {
    useWind(conn.peer);
  }
}

function removePlayer(conn) {
  var idx = players.findIndex(function (p) { return p.id === conn.peer; });
  if (idx === -1) return;
  var name = players[idx].name;
  players.splice(idx, 1);
  conns = conns.filter(function (c) { return c !== conn; });
  if (turnIndex >= players.length) turnIndex = 0;
  broadcast({ type: "log", text: name + " 離開了房間" });
  addLog(name + " 離開了房間");
  broadcastState();
  renderPlayers();
  updateButtons();
}

function broadcast(msg) {
  conns.forEach(function (c) { c.send(msg); });
}

function broadcastState() {
  broadcast({
    type: "state",
    players: players.map(function (p) { return { id: p.id, name: p.name, wind: p.wind }; }),
    turnIndex: turnIndex,
    rotation: rotation,
  });
}

// ========== 客人：處理房主的訊息 ==========

function handleGuestMessage(msg) {
  if (msg.type === "state") {
    players = msg.players;
    turnIndex = msg.turnIndex;
    if (!spinning) {
      rotation = msg.rotation;
      drawWheel();
    }
    renderPlayers();
    updateButtons();
  } else if (msg.type === "spin") {
    spinnerName = msg.spinnerName;
    addLog(spinnerName + " 轉動了轉盤！");
    startAnim(msg.startRot, msg.target, msg.duration);
  } else if (msg.type === "wind") {
    applyWindLocal(msg.newTarget, msg.extendMs);
    addLog(msg.by + " 使用了 🌪️ 妖風！");
  } else if (msg.type === "log") {
    addLog(msg.text);
  }
}

// ========== 轉盤 ==========

function drawWheel() {
  var options = WHEEL_OPTIONS;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var seg = (Math.PI * 2) / options.length;

  options.forEach(function (label, i) {
    var start = rotation + i * seg;
    var colorIndex = i % COLORS.length;
    if (i === options.length - 1 && colorIndex === 0) colorIndex = 2;
    ctx.fillStyle = COLORS[colorIndex];
    ctx.beginPath();
    ctx.moveTo(CENTER, CENTER);
    ctx.arc(CENTER, CENTER, RADIUS, start, start + seg);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#12081f";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字：順時針轉 90 度、下半部自動翻正（跟命運轉盤同一套邏輯）
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(start + seg / 2);
    ctx.translate(RADIUS - 38, 0);
    ctx.rotate(Math.PI / 2);
    var mid = ((start + seg / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (mid > 0 && mid < Math.PI) ctx.rotate(Math.PI);
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b1233";
    var fontSize = 13;
    ctx.font = "bold " + fontSize + "px 'Microsoft JhengHei', sans-serif";
    var maxWidth = (RADIUS - 38) * seg * 0.9;
    while (fontSize > 9 && ctx.measureText(label).width > maxWidth) {
      fontSize--;
      ctx.font = "bold " + fontSize + "px 'Microsoft JhengHei', sans-serif";
    }
    ctx.fillText(label, 0, fontSize / 3);
    ctx.restore();
  });

  // 中心圓
  ctx.fillStyle = "#12081f";
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🍻", CENTER, CENTER + 2);
  ctx.textBaseline = "alphabetic";
}

function pickWinner() {
  var seg = (Math.PI * 2) / WHEEL_OPTIONS.length;
  var pointerAngle = -Math.PI / 2 - rotation;
  var normalized = ((pointerAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return WHEEL_OPTIONS[Math.floor(normalized / seg)];
}

// 房主：發動一次旋轉並廣播
function startSpin() {
  spinnerName = players[turnIndex].name;
  var turns = 5 + Math.random() * 3;
  var target = rotation + turns * Math.PI * 2 + Math.random() * Math.PI * 2;
  var duration = 5000;
  broadcast({ type: "spin", startRot: rotation, target: target, duration: duration, spinnerName: spinnerName });
  addLog(spinnerName + " 轉動了轉盤！");
  startAnim(rotation, target, duration);
}

var finishTimer = null;

function startAnim(start, target, duration) {
  rotation = start;
  spinning = true;
  var now = performance.now();
  anim = { start: start, target: target, t0: now, t1: now + duration };
  updateButtons();
  requestAnimationFrame(frame);
  armFinishTimer();
}

// 保底計時器：就算分頁在背景、動畫被瀏覽器暫停，
// 時間到了一樣結算到正確的最終角度，遊戲不會卡住
function armFinishTimer() {
  clearTimeout(finishTimer);
  if (!anim) return;
  finishTimer = setTimeout(function () {
    if (!anim) return;
    rotation = anim.target;
    anim = null;
    spinning = false;
    drawWheel();
    onSpinEnd();
  }, anim.t1 - performance.now() + 150);
}

function frame(now) {
  if (!anim) return;
  var t = Math.min(1, (now - anim.t0) / (anim.t1 - anim.t0));
  var eased = 1 - Math.pow(1 - t, 3);
  rotation = anim.start + (anim.target - anim.start) * eased;
  drawWheel();
  if (t < 1) {
    requestAnimationFrame(frame);
  } else {
    clearTimeout(finishTimer);
    anim = null;
    spinning = false;
    onSpinEnd();
  }
}

function onSpinEnd() {
  var result = pickWinner();
  document.getElementById("resultLabel").textContent = "🎯 " + spinnerName + " 轉到了…";
  document.getElementById("resultText").textContent = result;
  document.getElementById("resultOverlay").classList.remove("hidden");

  if (isHost) {
    // 「再轉一次」就不換人，其他情況輪到下一位
    if (result !== "再轉一次" && players.length > 0) {
      turnIndex = (turnIndex + 1) % players.length;
    }
    broadcastState();
  }
  renderPlayers();
  updateButtons();
}

// ========== 🌪️ 妖風道具 ==========

// 房主：處理妖風（自己用或客人用都走這裡）
function useWind(playerId) {
  if (!isHost || !spinning) return;
  var player = players.find(function (p) { return p.id === playerId; });
  if (!player || player.wind <= 0) return;

  player.wind--;
  var extra = Math.PI / 2 + Math.random() * Math.PI * 2; // 再吹走 1/4 圈到 2 圈多
  var newTarget = anim.target + extra;
  var extendMs = 1200;

  broadcast({ type: "wind", by: player.name, newTarget: newTarget, extendMs: extendMs });
  addLog(player.name + " 使用了 🌪️ 妖風！");
  applyWindLocal(newTarget, extendMs);
  broadcastState();
}

// 所有人：把進行中的動畫吹向新的目標
function applyWindLocal(newTarget, extendMs) {
  if (!anim) return;
  var now = performance.now();
  anim = { start: rotation, target: newTarget, t0: now, t1: anim.t1 + extendMs };
  armFinishTimer();
  renderPlayers();
  updateButtons();
}

// ========== 畫面更新 ==========

function renderPlayers() {
  var list = document.getElementById("playerList");
  list.innerHTML = "";
  players.forEach(function (p, i) {
    var li = document.createElement("li");
    var label = p.name + " " + "🌪️".repeat(p.wind);
    if (p.id === myId()) label += "（你）";
    li.textContent = label;
    if (i === turnIndex) li.classList.add("current-turn");
    list.appendChild(li);
  });
}

function updateButtons() {
  var spinBtn = document.getElementById("spinBtn");
  var windBtn = document.getElementById("windBtn");
  var current = players[turnIndex];
  var isMyTurn = current && current.id === myId();

  spinBtn.disabled = spinning || !isMyTurn;
  spinBtn.textContent = spinning
    ? "轉動中…"
    : (isMyTurn ? "開始轉！" : "輪到 " + (current ? current.name : "…"));

  var me = players.find(function (p) { return p.id === myId(); });
  var myWind = me ? me.wind : 0;
  // 妖風只能在「別人轉的時候」用，陷害別人才好玩
  windBtn.disabled = !spinning || myWind <= 0 || spinnerName === myName;
  windBtn.textContent = "🌪️ 妖風（剩 " + myWind + " 次）";
}

function addLog(text) {
  var log = document.getElementById("log");
  var line = document.createElement("div");
  line.textContent = text;
  log.insertBefore(line, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

// ========== 事件綁定 ==========

document.getElementById("createBtn").addEventListener("click", createRoom);
document.getElementById("joinBtn").addEventListener("click", joinRoom);

document.getElementById("spinBtn").addEventListener("click", function () {
  if (spinning) return;
  if (isHost) {
    if (players[turnIndex] && players[turnIndex].id === "host") startSpin();
  } else {
    hostConn.send({ type: "spinRequest" });
  }
});

document.getElementById("windBtn").addEventListener("click", function () {
  if (isHost) {
    useWind("host");
  } else {
    hostConn.send({ type: "windRequest" });
  }
});

document.getElementById("closeBtn").addEventListener("click", function () {
  document.getElementById("resultOverlay").classList.add("hidden");
});

drawWheel();
