// 命運轉盤主程式
// 核心想法：選項是「內建」的，使用者不用自己想，
// 只要點選項決定這一輪「保留」或「排除」，還能把這個設定存成組合重複使用。
//
// 資料結構：
// state = {
//   themes:  { "主題名稱": { options: [全部選項], disabled: [被排除的選項] } },
//   presets: [ { name: "組合名稱", theme: "主題", enabled: [保留的選項] } ]
// }

var DEFAULT_LIBRARY = {
  "晚餐": [
    "滷肉飯", "牛肉麵", "火鍋", "壽司", "鹹酥雞", "義大利麵",
    "便當", "麥當勞", "拉麵", "咖哩飯", "水餃", "炒飯",
    "牛排", "披薩", "燒肉丼", "潛艇堡",
  ],
  "午餐": [
    "便當", "麵店", "自助餐", "水餃", "咖哩飯", "丼飯",
    "涼麵", "三明治", "越南河粉", "鍋燒意麵", "壽司", "速食",
  ],
  "飲料": [
    "珍珠奶茶", "紅茶拿鐵", "綠茶", "冬瓜檸檬", "果汁", "咖啡",
    "可可", "奶蓋綠茶", "檸檬紅茶", "烏龍茶", "氣泡飲", "養樂多綠",
  ],
  "假日活動": [
    "看電影", "逛街", "爬山", "打電動", "桌遊", "騎腳踏車",
    "野餐", "唱KTV", "看展覽", "咖啡廳耍廢", "游泳", "在家追劇",
  ],
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

var state = loadState();
var currentTheme = Object.keys(state.themes)[0];
var rotation = 0;      // 轉盤目前的角度（弧度）
var spinning = false;  // 是否正在旋轉中

// --- 資料存取（存在瀏覽器的 localStorage，重新整理不會消失） ---

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem("wheel-state"));
    if (saved && saved.themes && Object.keys(saved.themes).length > 0) {
      if (!saved.presets) saved.presets = [];
      return saved;
    }
  } catch (e) { /* 資料壞掉就用預設值 */ }

  var themes = {};
  Object.keys(DEFAULT_LIBRARY).forEach(function (name) {
    themes[name] = { options: DEFAULT_LIBRARY[name].slice(), disabled: [] };
  });
  return { themes: themes, presets: [] };
}

function saveState() {
  localStorage.setItem("wheel-state", JSON.stringify(state));
}

// 目前主題中「保留」（會出現在轉盤上）的選項
function enabledOptions() {
  var t = state.themes[currentTheme];
  return t.options.filter(function (o) {
    return t.disabled.indexOf(o) === -1;
  });
}

// --- 畫轉盤 ---

function drawWheel() {
  var options = enabledOptions();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (options.length < 2) {
    ctx.fillStyle = "#3c2a63";
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9a8d8";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("至少保留兩個選項才能轉！", CENTER, CENTER);
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
    var fontSize = options.length > 12 ? 13 : (options.length > 10 ? 15 : 18);
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
  var options = enabledOptions();
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
  var options = enabledOptions();
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
  Object.keys(state.themes).forEach(function (name) {
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
  if (state.themes[name]) {
    alert("已經有「" + name + "」這個主題了！");
    return;
  }
  state.themes[name] = { options: [], disabled: [] };
  currentTheme = name;
  input.value = "";
  saveState();
  renderAll();
}

function deleteTheme() {
  var names = Object.keys(state.themes);
  if (names.length <= 1) {
    alert("至少要留一個主題喔！");
    return;
  }
  if (!confirm("確定要刪除「" + currentTheme + "」這個主題嗎？")) return;
  delete state.themes[currentTheme];
  currentTheme = Object.keys(state.themes)[0];
  saveState();
  renderAll();
}

// --- 選項的保留 / 排除 ---

function toggleOption(opt) {
  var disabled = state.themes[currentTheme].disabled;
  var idx = disabled.indexOf(opt);
  if (idx === -1) {
    disabled.push(opt);      // 排除
  } else {
    disabled.splice(idx, 1); // 恢復保留
  }
  saveState();
  renderAll();
}

function keepAll() {
  state.themes[currentTheme].disabled = [];
  saveState();
  renderAll();
}

function renderOptionList() {
  var t = state.themes[currentTheme];
  var list = document.getElementById("optionList");
  list.innerHTML = "";

  t.options.forEach(function (opt) {
    var isOff = t.disabled.indexOf(opt) !== -1;
    var li = document.createElement("li");
    li.textContent = (isOff ? "✕ " : "✓ ") + opt;
    if (isOff) li.classList.add("off");
    li.title = isOff ? "點一下恢復保留" : "點一下排除";
    li.addEventListener("click", function () {
      toggleOption(opt);
    });
    list.appendChild(li);
  });

  var enabled = enabledOptions().length;
  document.getElementById("enabledCount").textContent =
    "保留 " + enabled + " / " + t.options.length + " 個";
}

function addOption() {
  var input = document.getElementById("newOptionInput");
  var text = input.value.trim();
  if (!text) return;
  var t = state.themes[currentTheme];
  if (t.options.indexOf(text) !== -1) {
    alert("「" + text + "」已經在清單裡了！");
    return;
  }
  t.options.push(text);
  input.value = "";
  saveState();
  renderAll();
}

// --- 我的組合（儲存保留/排除的設定，一鍵套用） ---

function savePreset() {
  var input = document.getElementById("presetNameInput");
  var name = input.value.trim();
  if (!name) {
    alert("先幫這個組合取個名字吧！");
    return;
  }
  var enabled = enabledOptions();
  if (enabled.length < 2) {
    alert("至少要保留兩個選項才能存成組合喔！");
    return;
  }
  // 同名的組合直接覆蓋
  state.presets = state.presets.filter(function (p) { return p.name !== name; });
  state.presets.push({ name: name, theme: currentTheme, enabled: enabled });
  input.value = "";
  saveState();
  renderPresets();
}

function applyPreset(preset) {
  // 主題被刪掉的話，用組合裡的內容重建
  if (!state.themes[preset.theme]) {
    state.themes[preset.theme] = { options: preset.enabled.slice(), disabled: [] };
  }
  var t = state.themes[preset.theme];

  // 組合裡有、但目前清單沒有的選項，直接補進轉盤
  preset.enabled.forEach(function (opt) {
    if (t.options.indexOf(opt) === -1) t.options.push(opt);
  });

  // 組合以外的選項全部排除
  t.disabled = t.options.filter(function (opt) {
    return preset.enabled.indexOf(opt) === -1;
  });

  currentTheme = preset.theme;
  saveState();
  renderAll();
}

function deletePreset(name) {
  if (!confirm("確定要刪除「" + name + "」這個組合嗎？")) return;
  state.presets = state.presets.filter(function (p) { return p.name !== name; });
  saveState();
  renderPresets();
}

function renderPresets() {
  var list = document.getElementById("presetList");
  list.innerHTML = "";

  if (state.presets.length === 0) {
    var empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "還沒有儲存任何組合";
    list.appendChild(empty);
    return;
  }

  state.presets.forEach(function (preset) {
    var li = document.createElement("li");

    var info = document.createElement("div");
    info.className = "preset-info";
    var title = document.createElement("b");
    title.textContent = preset.name;
    var meta = document.createElement("small");
    meta.textContent = preset.theme + "・" + preset.enabled.length + " 個選項";
    info.appendChild(title);
    info.appendChild(meta);

    var applyBtn = document.createElement("button");
    applyBtn.className = "apply";
    applyBtn.textContent = "套用";
    applyBtn.addEventListener("click", function () {
      applyPreset(preset);
    });

    var delBtn = document.createElement("button");
    delBtn.className = "del";
    delBtn.textContent = "✕";
    delBtn.title = "刪除這個組合";
    delBtn.addEventListener("click", function () {
      deletePreset(preset.name);
    });

    li.appendChild(info);
    li.appendChild(applyBtn);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

// --- 畫面總更新 ---

function renderAll() {
  renderThemeTabs();
  renderOptionList();
  renderPresets();
  drawWheel();
  document.getElementById("spinBtn").disabled = enabledOptions().length < 2;
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
document.getElementById("keepAllBtn").addEventListener("click", keepAll);
document.getElementById("savePresetBtn").addEventListener("click", savePreset);

// 在輸入框按 Enter 也能送出
document.getElementById("newOptionInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") addOption();
});
document.getElementById("newThemeInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") addTheme();
});
document.getElementById("presetNameInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") savePreset();
});

renderAll();
