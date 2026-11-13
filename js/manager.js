
// 替換為您部署的 GAS URL
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';

// 頁籤切換
document.getElementById('adminTabs').addEventListener('click', e => {
    if(e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#adminTabs button').forEach(b => b.classList.remove('on'));
    e.target.classList.add('on');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(e.target.dataset.target).classList.add('active');
});

function getPwd() { return document.getElementById('superPassword').value; }

// --- 待審核清單 ---
document.getElementById('loadPendingBtn').addEventListener('click', function() {
    const pwd = getPwd(); if(!pwd) return alert("請先輸入上方超級密碼");
    this.innerText = "載入中..."; this.disabled = true;
    
    const fd = new URLSearchParams(); fd.append('action', 'getPending'); fd.append('password', pwd);
    fetch(GAS_URL, { method: 'POST', body: fd.toString() })
    .then(r => r.json())
    .then(data => {
        if(data.status !== 'success') throw new Error(data.message);
        const container = document.getElementById('pendingContainer');
        if(data.list.length === 0) {
            container.innerHTML = '<div class="empty">🎉 太棒了，目前沒有待審核的資料！</div>';
        } else {
            container.innerHTML = data.list.map(item => `
                <div class="card" id="row-${item.rowIndex}">
                    <div style="margin-bottom:8px;">
                        <span class="badge">${item.date}</span> <b style="color:var(--ac);">${item.classId}班 ${item.name}</b>
                    </div>
                    <div style="font-size:0.9rem; margin-bottom:8px;">
                        <b>今日菜色：</b>${item.menu}<br>
                        <b>意見反饋：</b>${item.feedback}<br>
                        ${item.photo ? `<a href="${item.photo}" target="_blank">🖼️ 點此查看照片</a>` : ''}
                    </div>
                    <textarea id="reply-${item.rowIndex}" placeholder="此處可為家代補充營養師的回覆 (選填)" rows="2" style="width:100%; margin-bottom:8px;"></textarea>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-success" onclick="approve(${item.rowIndex})">✅ 核准發布</button>
                        <button class="btn btn-danger" onclick="trash(${item.rowIndex})">🗑️ 刪除退回</button>
                    </div>
                </div>
            `).join('');
        }
    })
    .catch(err => alert("載入失敗: " + err.message))
    .finally(() => { this.innerText = "🔄 載入最新清單"; this.disabled = false; });
});

window.approve = function(rowIndex) {
    const reply = document.getElementById(`reply-${rowIndex}`).value;
    const fd = new URLSearchParams(); fd.append('action', 'approve'); fd.append('password', getPwd());
    fd.append('rowIndex', rowIndex); fd.append('reply', reply);
    
    document.getElementById(`row-${rowIndex}`).style.opacity = '0.5';
    fetch(GAS_URL, { method: 'POST', body: fd.toString() }).then(r=>r.json()).then(data => {
        if(data.status==='success') document.getElementById(`row-${rowIndex}`).remove();
        else alert(data.message);
    });
};
window.trash = function(rowIndex) {
    if(!confirm("確定要作廢這筆紀錄嗎？不會發布到前台。")) return;
    const fd = new URLSearchParams(); fd.append('action', 'delete'); fd.append('password', getPwd());
    fd.append('rowIndex', rowIndex);
    fetch(GAS_URL, { method: 'POST', body: fd.toString() }).then(r=>r.json()).then(data => {
        if(data.status==='success') document.getElementById(`row-${rowIndex}`).remove();
    });
};

// --- 更新排班表 ---
document.getElementById('updateRosterBtn').addEventListener('click', function() {
    const pwd = getPwd(); if(!pwd) return alert("請輸入超級密碼");
    const csvData = document.getElementById('rosterData').value;
    
    this.innerText = "更新中..."; this.disabled = true;
    const fd = new URLSearchParams(); fd.append('action', 'updateRoster'); 
    fd.append('password', pwd); fd.append('csvData', csvData);
    
    fetch(GAS_URL, { method: 'POST', body: fd.toString() })
    .then(r => r.json())
    .then(data => {
        const msg = document.getElementById('rosterMsg');
        if(data.status === 'success') { msg.innerText = "✅ " + data.message; msg.style.color = '#1d6b43'; }
        else { msg.innerText = "❌ " + data.message; msg.style.color = 'var(--rd)'; }
    })
    .finally(() => { this.innerText = "上傳覆蓋排班表"; this.disabled = false; });
});

// --- 試菜統計 ---
document.getElementById('loadStatsBtn').addEventListener('click', function() {
    const pwd = getPwd(); if(!pwd) return alert("請輸入超級密碼");
    this.innerText = "撈取中..."; this.disabled = true;
    
    const fd = new URLSearchParams(); fd.append('action', 'getStats'); fd.append('password', pwd);
    
    fetch(GAS_URL, { method: 'POST', body: fd.toString() })
    .then(r => r.json())
    .then(data => {
        if(data.status !== 'success') throw new Error(data.message);
        const container = document.getElementById('statsContainer');
        const stats = data.stats;
        let html = '<table style="width:100%; border-collapse:collapse; background:#fff; text-align:left;">';
        html += '<tr style="border-bottom:2px solid var(--bd);"><th>班級</th><th>代表姓名</th><th>應值班次數</th><th>已完成次數</th><th>達成率</th></tr>';
        for(let c in stats) {
            let s = stats[c];
            let percent = s.assigned ? Math.round((s.completed / s.assigned) * 100) : 0;
            let color = percent >= 100 ? '#1d6b43' : (percent === 0 ? 'var(--rd)' : 'var(--tx)');
            html += `<tr style="border-bottom:1px solid #f6ead7;">
                <td style="padding:8px 4px;">${c}</td>
                <td>${s.name}</td>
                <td>${s.assigned}</td>
                <td style="color:${color}; font-weight:bold;">${s.completed}</td>
                <td>${percent}%</td>
            </tr>`;
        }
        html += '</table>';
        container.innerHTML = html;
    })
    .catch(err => alert("載入失敗: " + err.message))
    .finally(() => { this.innerText = "🔄 載入統計數據"; this.disabled = false; });
});
