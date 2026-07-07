// 命運轉盤主程式
// 資料結構：themes = { "主題名稱": ["選項1", "選項2", ...] }

var DEFAULT_THEMES = {
  "晚餐": ["滷肉飯", "牛肉麵", "火鍋", "壽司", "鹹酥雞", "義大利麵", "便當", "麥當勞"],
  "飲料": ["珍珠奶茶", "紅茶拿鐵", "綠茶", "果汁", "咖啡", "冬瓜檸檬"],
  "假日活動": ["看電影", "逛街", "爬山", "打電動", "桌遊", "騎腳踏車"],
};

// 轉盤扇形的顏色，會依序循環使用
var COLORS = [
  "#ff7b54", "#ffd166", "#06d6a0", "#4cc9f0",
  "#b388eb", "#f72585", "#90be6d", "#f9844a",
];

var canvas = document.getElementById("wheel");
var ctx = canvas.getContext("2d");
var CENTER = canvas.width / 2;
var RADIUS = CENTER - 10;

var themes = loadThemes();
var currentTheme = Object.keys(themes)[0];
var rotation = 0;      // 轉盤目前的角度（弧度）
var spinning = false;  // 是否正在旋轉中

// --- 資料存取（存在瀏覽器的 localStorage，重新整理不會消失） ---

function loadThemes() {
  try {
    var saved = JSON.parse(localStorage.getItem("wheel-themes"));
    if (saved && Object.keys(saved).length > 0) return saved;
  } catch (e) { /* 資料壞掉就用預設值 */ }
  return JSON.parse(JSON.stringify(DEFAULT_THEMES));
}

function saveThemes() {
  localStorage.setItem("wheel-themes", JSON.stringify(themes));
}

// --- 畫轉盤 ---

function drawWheel() {
  var options = themes[currentTheme];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (options.length === 0) {
    ctx.fillStyle = "#3c2a63";
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9a8d8";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("先在下方加入選項吧！", CENTER, CENTER);
    return;
  }

  var seg = (Math.PI * 2) / options.length;

  options.forEach(function (label, i) {
    var start = rotation + i * seg;

    // 扇形（最後一格如果會跟第一格同色，就換一個顏色避免相鄰撞色）
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

    // 文字：沿著扇形中線放
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(start + seg / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#2b1233";
    var fontSize = options.length > 10 ? 15 : 18;
    ctx.font = "bold " + fontSize + "px 'Microsoft JhengHei', sans-serif";
    ctx.fillText(label, RADIUS - 16, 6);
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
  ctx.fillText("🎡", CENTER, CENTER + 2);
  ctx.textBaseline = "alphabetic";
}

// --- 旋轉 ---

function spin() {
  var options = themes[currentTheme];
  if (spinning || options.length < 2) return;

  spinning = true;
  document.getElementById("spinBtn").disabled = true;

  // 隨機轉 5~8 圈再加上隨機角度，讓結果無法預測
  var turns = 5 + Math.random() * 3;
  var target = rotation + turns * Math.PI * 2 + Math.random() * Math.PI * 2;
  var startRot = rotation;
  var duration = 4000;
  var t0 = performance.now();

  function frame(now) {
    var t = Math.min(1, (now - t0) / duration);
    var eased = 1 - Math.pow(1 - t, 3); // 先快後慢的減速效果
    rotation = startRot + (target - startRot) * eased;
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      document.getElementById("spinBtn").disabled = false;
      showResult(pickWinner());
    }
  }
  requestAnimationFrame(frame);
}

function pickWinner() {
  var options = themes[currentTheme];
  var seg = (Math.PI * 2) / options.length;
  // 指針固定在正上方（-90 度），算出它落在哪個扇形
  var pointerAngle = -Math.PI / 2 - rotation;
  var normalized = ((pointerAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return options[Math.floor(normalized / seg)];
}

function showResult(text) {
  document.getElementById("resultText").textContent = text;
  document.getElementById("resultOverlay").classList.remove("hidden");
}

function hideResult() {
  document.getElementById("resultOverlay").classList.add("hidden");
}

// --- 主題列 ---

function renderThemeTabs() {
  var nav = document.getElementById("themeTabs");
  nav.innerHTML = "";
  Object.keys(themes).forEach(function (name) {
    var btn = document.createElement("button");
    btn.textContent = name;
    if (name === currentTheme) btn.classList.add("active");
    btn.addEventListener("click", function () {
      currentTheme = name;
      renderAll();
    });
    nav.appendChild(btn);
  });
  document.getElementById("currentThemeName").textContent = currentTheme;
}

function addTheme() {
  var input = document.getElementById("newThemeInput");
  var name = input.value.trim();
  if (!name) return;
  if (themes[name]) {
    alert("已經有「" + name + "」這個主題了！");
    return;
  }
  themes[name] = [];
  currentTheme = name;
  input.value = "";
  saveThemes();
  renderAll();
}

function deleteTheme() {
  var names = Object.keys(themes);
  if (names.length <= 1) {
    alert("至少要留一個主題喔！");
    return;
  }
  if (!confirm("確定要刪除「" + currentTheme + "」這個主題嗎？")) return;
  delete themes[currentTheme];
  currentTheme = Object.keys(themes)[0];
  saveThemes();
  renderAll();
}

// --- 選項編輯 ---

function renderOptionList() {
  var list = document.getElementById("optionList");
  list.innerHTML = "";
  themes[currentTheme].forEach(function (opt, i) {
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.textContent = opt;
    var del = document.createElement("button");
    del.textContent = "✕";
    del.title = "刪除這個選項";
    del.addEventListener("click", function () {
      themes[currentTheme].splice(i, 1);
      saveThemes();
      renderAll();
    });
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function addOption() {
  var input = document.getElementById("newOptionInput");
  var text = input.value.trim();
  if (!text) return;
  if (themes[currentTheme].indexOf(text) !== -1) {
    alert("「" + text + "」已經在清單裡了！");
    return;
  }
  themes[currentTheme].push(text);
  input.value = "";
  saveThemes();
  renderAll();
}

// --- 畫面總更新 ---

function renderAll() {
  renderThemeTabs();
  renderOptionList();
  drawWheel();
  var spinBtn = document.getElementById("spinBtn");
  spinBtn.disabled = themes[currentTheme].length < 2;
}

// --- 事件綁定 ---

document.getElementById("spinBtn").addEventListener("click", spin);
document.getElementById("againBtn").addEventListener("click", function () {
  hideResult();
  spin();
});
document.getElementById("closeBtn").addEventListener("click", hideResult);
document.getElementById("addThemeBtn").addEventListener("click", addTheme);
document.getElementById("deleteThemeBtn").addEventListener("click", deleteTheme);
document.getElementById("addOptionBtn").addEventListener("click", addOption);

// 在輸入框按 Enter 也能送出
document.getElementById("newOptionInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") addOption();
});
document.getElementById("newThemeInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") addTheme();
});

renderAll();
