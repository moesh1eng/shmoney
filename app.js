(function(){
  "use strict";

  var STORAGE_KEY = "shmoney_state_v1";

  var defaultState = {
    totalEarned: 0,
    totalHours: 0,
    shiftLog: [],
    tfsaPct: 15,
    cibcOwed: 1200,
    amexSpent: 0,
    amexCap: 300,
    cibcSpent: 0,
    gasCap: 0,
    gasSpent: 0
  };

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return Object.assign({}, defaultState);
      var parsed = JSON.parse(raw);
      return Object.assign({}, defaultState, parsed);
    }catch(e){
      return Object.assign({}, defaultState);
    }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){
      console.error("Could not save", e);
    }
  }

  var state = loadState();

  function fmt(n){
    n = Math.round(n || 0);
    return "$" + n.toLocaleString();
  }

  function setDate(){
    var el = document.getElementById("todayDate");
    var d = new Date();
    var opts = { month: "short", day: "numeric" };
    el.textContent = d.toLocaleDateString(undefined, opts);
  }

  function render(){
    document.getElementById("totalEarned").textContent = fmt(state.totalEarned);
    var hoursDisplay = (Math.round(state.totalHours * 10) / 10);
    document.getElementById("totalHours").textContent = (hoursDisplay % 1 === 0 ? hoursDisplay.toFixed(0) : hoursDisplay.toFixed(1));

    document.getElementById("tfsaPctLabel").textContent = state.tfsaPct + "%";
    document.getElementById("tfsaSlider").value = state.tfsaPct;

    var tfsaAmt = state.totalEarned * (state.tfsaPct / 100);
    document.getElementById("tfsaAmt").textContent = fmt(tfsaAmt);

    document.getElementById("cibcOwedDisplay").textContent = fmt(state.cibcOwed);

    var remainder = state.totalEarned - tfsaAmt;
    var monthsEl = document.getElementById("cibcMonths");
    if(state.cibcOwed <= 0){
      monthsEl.textContent = "paid off";
    } else if(remainder > 0 && state.totalHours > 0){
      var months = Math.ceil(state.cibcOwed / remainder);
      monthsEl.textContent = months > 36 ? "36+" : String(months);
    } else {
      monthsEl.textContent = "\u2013\u2013";
    }

    // Amex
    var amexPct = state.amexCap > 0 ? Math.min(100, (state.amexSpent / state.amexCap) * 100) : 0;
    document.getElementById("amexBarFill").style.width = amexPct + "%";
    document.getElementById("amexBarFill").style.background = amexPct >= 90 ? "var(--rust)" : "var(--moss)";
    document.getElementById("amexStatus").textContent = fmt(state.amexSpent) + " of " + fmt(state.amexCap);

    // CIBC spend tracker (should stay 0)
    document.getElementById("cibcBarFill").style.width = state.cibcSpent > 0 ? "100%" : "0%";
    document.getElementById("cibcStatus").textContent = fmt(state.cibcSpent) + " new spend \u2014 should stay $0";

    // Gas
    var gasPct = state.gasCap > 0 ? Math.min(100, (state.gasSpent / state.gasCap) * 100) : 0;
    document.getElementById("gasBarFill").style.width = gasPct + "%";
    document.getElementById("gasStatus").textContent = state.gasCap > 0
      ? fmt(state.gasSpent) + " of " + fmt(state.gasCap)
      : "no cap set";

    renderShiftLog();
    checkAlerts(amexPct, gasPct);
    saveState();
  }

  function renderShiftLog(){
    var logEl = document.getElementById("shiftLog");
    logEl.innerHTML = "";
    state.shiftLog.slice(0, 8).forEach(function(entry){
      var row = document.createElement("div");
      row.className = "shift-log-item";
      var left = document.createElement("span");
      left.textContent = entry.hours + "h \u00b7 " + entry.job;
      var right = document.createElement("span");
      right.textContent = fmt(entry.pay);
      row.appendChild(left);
      row.appendChild(right);
      logEl.appendChild(row);
    });
  }

  function checkAlerts(amexPct, gasPct){
    var box = document.getElementById("alertBox");
    var text = document.getElementById("alertText");
    var msg = "";

    if(state.cibcSpent > 0){
      msg = "New spend logged on CIBC. This card should stay untouched until the June 24 balance clears \u2014 consider moving this purchase to Amex or cash.";
    } else if(amexPct >= 90){
      msg = "Amex groceries/dining is at " + Math.round(amexPct) + "% of cap. Ease up to keep this card clean while you build history.";
    } else if(state.gasCap > 0 && gasPct >= 90){
      msg = "Gas/transport is at " + Math.round(gasPct) + "% of this month's cap.";
    }

    if(msg){
      box.hidden = false;
      text.textContent = msg;
    } else {
      box.hidden = true;
    }
  }

  // Hours logging
  document.getElementById("logHoursBtn").addEventListener("click", function(){
    var hoursInput = document.getElementById("hoursInput");
    var jobSelect = document.getElementById("jobSelect");
    var hours = parseFloat(hoursInput.value);
    if(!hours || hours <= 0) return;
    var rate = parseFloat(jobSelect.value);
    var jobName = jobSelect.options[jobSelect.selectedIndex].getAttribute("data-job");
    var pay = hours * rate;

    state.totalHours += hours;
    state.totalEarned += pay;
    state.shiftLog.unshift({ hours: hours, job: jobName, rate: rate, pay: pay, ts: Date.now() });

    hoursInput.value = "";
    render();
  });

  // TFSA slider
  document.getElementById("tfsaSlider").addEventListener("input", function(e){
    state.tfsaPct = parseInt(e.target.value, 10);
    render();
  });

  // Car sale toggle
  var carSaleToggle = document.getElementById("carSaleToggle");
  var carSaleAmountRow = document.getElementById("carSaleAmountRow");
  carSaleToggle.addEventListener("change", function(){
    carSaleAmountRow.hidden = !carSaleToggle.checked;
  });

  document.getElementById("applyCarSaleBtn").addEventListener("click", function(){
    var amountInput = document.getElementById("carSaleAmount");
    var amount = parseFloat(amountInput.value);
    if(!amount || amount <= 0) return;
    state.cibcOwed = Math.max(0, state.cibcOwed - amount);
    amountInput.value = "";
    render();
  });

  // Amex
  document.getElementById("amexAddBtn").addEventListener("click", function(){
    var input = document.getElementById("amexSpend");
    var v = parseFloat(input.value);
    if(!v || v <= 0) return;
    state.amexSpent += v;
    input.value = "";
    render();
  });

  // CIBC
  document.getElementById("cibcAddBtn").addEventListener("click", function(){
    var input = document.getElementById("cibcSpend");
    var v = parseFloat(input.value);
    if(!v || v <= 0) return;
    state.cibcSpent += v;
    input.value = "";
    render();
  });

  // Gas
  document.getElementById("gasAddBtn").addEventListener("click", function(){
    var input = document.getElementById("gasSpend");
    var v = parseFloat(input.value);
    if(v && v > 0){
      state.gasSpent += v;
      input.value = "";
    }
    render();
  });

  // Edit caps
  document.querySelectorAll("[data-edit]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var key = btn.getAttribute("data-edit");
      var current = state[key] || 0;
      var label = key === "amexCap" ? "Amex groceries/dining cap" : "Gas/transport cap";
      var val = prompt(label + " ($):", current);
      if(val === null) return;
      var num = parseFloat(val);
      if(isNaN(num) || num < 0) return;
      state[key] = num;
      render();
    });
  });

  // Reset
  document.getElementById("resetBtn").addEventListener("click", function(){
    if(!confirm("Reset all data? This clears everything stored on this device.")) return;
    state = Object.assign({}, defaultState);
    saveState();
    render();
  });

  // Service worker for offline support
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(){});
    });
  }

  setDate();
  render();
})();
