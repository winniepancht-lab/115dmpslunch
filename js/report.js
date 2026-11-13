
// 替換為您部署的 GAS URL
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';

document.getElementById('date').valueAsDate = new Date();

// 自動抓取菜單
document.getElementById('fetchMenuBtn').addEventListener('click', function() {
    const dateVal = document.getElementById('date').value;
    if(!dateVal) return alert("請先選擇上方日期！");
    
    this.innerText = '抓取中...';
    this.disabled = true;

    fetch(`${GAS_URL}?action=getMenu&date=${dateVal}`)
    .then(r => r.json())
    .then(data => {
        if(data.status === 'success') {
            document.getElementById('menu').value = data.menu;
        } else {
            alert("抓取失敗或無資料，請改為手動輸入。");
        }
    })
    .catch(() => alert("連線異常，請手動輸入菜色。"))
    .finally(() => {
        this.innerText = '🪄 自動抓取';
        this.disabled = false;
    });
});

// 送出表單
document.getElementById('reportForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');
    
    btn.disabled = true; btn.innerText = '資料驗證寫入中...';
    msg.innerText = ''; msg.style.color = 'var(--tx)';

    const fd = new URLSearchParams();
    fd.append('action', 'report');
    fd.append('date', document.getElementById('date').value);
    fd.append('classId', document.getElementById('classId').value);
    fd.append('menu', document.getElementById('menu').value);
    fd.append('feedback', document.getElementById('feedback').value);
    fd.append('photoUrl', document.getElementById('photoUrl').value);
    fd.append('password', document.getElementById('password').value);

    fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd.toString() })
    .then(r => r.json())
    .then(data => {
        if(data.status === 'success') {
            msg.innerText = `✅ ${data.message}`;
            msg.style.color = '#1d6b43';
            this.reset(); document.getElementById('date').valueAsDate = new Date(); 
        } else {
            throw new Error(data.message || '寫入失敗');
        }
    })
    .catch(err => {
        msg.innerText = `❌ ${err.message}`;
        msg.style.color = 'var(--rd)';
    })
    .finally(() => {
        btn.disabled = false; btn.innerText = '🚀 送出紀錄';
    });
});
