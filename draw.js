// 抽籤器主程式
// 三種玩法：抽一個人、隨機分組、排出順序
// 名單存在 localStorage，重新整理不會消失

var names = loadNames();
var drawing = false; // 抽籤動畫進行中

var nameInput = document.getElementById("nameInput");
var nameList = document.getElementById("nameList");
var nameCount = document.getElementById("nameCount");
var resultPanel = document.getElementById("resultPanel");
var resultTitle = document.getElementById("resultTitle");
var resultArea = document.getElementById("resultArea");

// --- 名單管理 ---

function loadNames() {
  try {
    var saved = JSON.parse(localStorage.getItem("draw-names"));
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* 資料壞掉就用空名單 */ }
  return [];
}

function saveNames() {
  localStorage.setItem("draw-names", JSON.stringify(names));
}

function addName() {
  var name = nameInput.value.trim();
  if (!name) return;
  if (names.indexOf(name) !== -1) {
    alert("「" + name + "」已經在名單裡了！");
    return;
  }
  names.push(name);
  nameInput.value = "";
  nameInput.focus();
  saveNames();
  renderNames();
}

function removeName(index) {
  names.splice(index, 1);
  saveNames();
  renderNames();
}

function renderNames() {
  nameList.innerHTML = "";
  names.forEach(function (name, i) {
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.textContent = name;
    var del = document.createElement("button");
    del.textContent = "✕";
    del.title = "移除";
    del.addEventListener("click", function () {
      removeName(i);
    });
    li.appendChild(span);
    li.appendChild(del);
    nameList.appendChild(li);
  });
  nameCount.textContent = names.length === 0
    ? "還沒有人，先把大家的名字加進來吧！"
    : "目前 " + names.length + " 人";
}

// 把陣列隨機洗牌（Fisher-Yates 洗牌法）
function shuffle(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll(".action-btn").forEach(function (btn) {
    btn.disabled = disabled;
  });
}

function showResult(title) {
  resultTitle.textContent = title;
  resultArea.innerHTML = "";
  resultPanel.classList.remove("hidden");
}

// --- 玩法一：抽一個人 ---

function pickOne() {
  if (drawing) return;
  if (names.length < 2) {
    alert("至少要兩個人才有得抽！");
    return;
  }
  drawing = true;
  setButtonsDisabled(true);
  showResult("🎯 被命運選中的是…");

  var nameEl = document.createElement("div");
  nameEl.className = "big-name";
  resultArea.appendChild(nameEl);

  // 名字快速跳動、越來越慢，最後停在一個人身上
  var delay = 60;
  var ticks = 18;

  function tick() {
    nameEl.textContent = names[Math.floor(Math.random() * names.length)];
    ticks--;
    if (ticks > 0) {
      delay = delay * 1.18;
      setTimeout(tick, delay);
    } else {
      nameEl.textContent = names[Math.floor(Math.random() * names.length)];
      nameEl.classList.add("final");
      nameEl.textContent += " 🎉";
      drawing = false;
      setButtonsDisabled(false);
    }
  }
  tick();
}

// --- 玩法二：隨機分組 ---

function makeGroups() {
  if (drawing) return;
  var groupCount = Number(document.getElementById("groupCount").value);
  if (names.length < groupCount) {
    alert("人數要至少 " + groupCount + " 人才能分 " + groupCount + " 組！");
    return;
  }
  showResult("👥 分組結果");

  var shuffled = shuffle(names);
  var groups = [];
  for (var g = 0; g < groupCount; g++) groups.push([]);
  shuffled.forEach(function (name, i) {
    groups[i % groupCount].push(name); // 輪流發牌的方式分組，人數最平均
  });

  groups.forEach(function (members, g) {
    var card = document.createElement("div");
    card.className = "group-card";
    var title = document.createElement("b");
    title.textContent = "第 " + (g + 1) + " 組：";
    card.appendChild(title);
    card.appendChild(document.createTextNode(members.join("、")));
    resultArea.appendChild(card);
  });
}

// --- 玩法三：排出順序 ---

function makeOrder() {
  if (drawing) return;
  if (names.length < 2) {
    alert("至少要兩個人才能排順序！");
    return;
  }
  showResult("🔢 順序出爐");

  var list = document.createElement("ol");
  list.className = "order-list";
  shuffle(names).forEach(function (name, i) {
    var li = document.createElement("li");
    var num = document.createElement("span");
    num.className = "order-num";
    num.textContent = (i + 1) + ".";
    li.appendChild(num);
    li.appendChild(document.createTextNode(name));
    list.appendChild(li);
  });
  resultArea.appendChild(list);
}

// --- 事件綁定 ---

document.getElementById("addNameBtn").addEventListener("click", addName);
nameInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addName();
});
document.getElementById("pickOneBtn").addEventListener("click", pickOne);
document.getElementById("makeGroupsBtn").addEventListener("click", makeGroups);
document.getElementById("makeOrderBtn").addEventListener("click", makeOrder);

renderNames();
