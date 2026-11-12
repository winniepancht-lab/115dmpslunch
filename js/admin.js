// 替換為您的 Google Apps Script Web App URL (步驟 2)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbx8KcPuR-loKV9itJsg20WO-Sdy1Yj-BfbS78hV08lCBwT_0qpi_oiBfnKx1d-t1WVb/exec';

// 設定今日日期為預設值
document.getElementById('date').valueAsDate = new Date();

document.getElementById('lunchForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMsg');
    
    submitBtn.disabled = true;
    submitBtn.innerText = '資料寫入中...';
    statusMsg.innerText = '';
    statusMsg.className = 'mt-3 text-center fw-bold';

    // 收集表單資料
    const formData = new URLSearchParams();
    formData.append('date', document.getElementById('date').value);
    formData.append('classId', document.getElementById('classId').value);
    formData.append('menu', document.getElementById('menu').value);
    formData.append('feedback', document.getElementById('feedback').value);
    formData.append('photoUrl', document.getElementById('photoUrl').value);
    formData.append('reply', document.getElementById('reply').value);

    // 透過 fetch 發送 POST 請求到 GAS
    fetch(GAS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === 'success') {
            statusMsg.innerText = '✅ 紀錄已成功寫入！前台將同步更新。';
            statusMsg.classList.add('text-success');
            document.getElementById('lunchForm').reset();
            document.getElementById('date').valueAsDate = new Date(); // 復原日期
        } else {
            throw new Error(data.message || '寫入失敗');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // 若遇到 CORS 錯誤但資料有寫入的備案顯示
        statusMsg.innerText = '⚠️ 請求已送出，請至前台檢查是否更新成功。';
        statusMsg.classList.add('text-warning');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerText = '送出紀錄';
    });
});
