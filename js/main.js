// 替換為發佈到網路的 CSV 連結 (步驟 3)
const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vREskMp4E7maOMthtokLEWGgeRBNBKxl3djFSIxeYCfccmBiaC0iWup2HUvfNz40DYQkATEd8_nOlmo/pub?output=csv'; 

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

function fetchData() {
    Papa.parse(DATA_URL, {
        download: true,
        header: true,
        complete: function(results) {
            const data = results.data.filter(row => row['日期']); 
            // 依日期遞減排序 (確保最新的在最上面)
            data.sort((a, b) => new Date(b['日期']) - new Date(a['日期']));
            renderData(data);
        },
        error: function(err) {
            console.error('讀取資料失敗:', err);
            document.getElementById('loadingMsg').innerHTML = '讀取資料失敗，請確認資料來源。';
        }
    });
}

function getAnonymousGrade(classStr) {
    if (!classStr) return '家長代表';
    classStr = classStr.toString().trim();
    const gradeMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
    const gradeNum = classStr.charAt(0);
    return gradeMap[gradeNum] ? gradeMap[gradeNum] + '年級家長代表' : '家長代表';
}

function renderData(data) {
    if (data.length === 0) {
        document.getElementById('loadingMsg').innerHTML = '目前尚無紀錄。';
        return;
    }

    const latestDate = data[0]['日期'];
    document.getElementById('currentDate').innerText = `(${latestDate})`;
    const todayMenu = data.find(row => row['日期'] === latestDate)['午餐菜色'];
    document.getElementById('todayMenu').innerText = todayMenu || '無菜單資料';

    const latestFeedbacks = data.filter(row => row['日期'] === latestDate);
    const container = document.getElementById('feedbackContainer');
    container.innerHTML = ''; 

    latestFeedbacks.forEach(row => {
        const anonymousName = getAnonymousGrade(row['班級']);
        const feedback = row['家代意見反饋'] || '無文字回饋';
        const photoUrl = row['照片連結'];
        const nutritionistReply = row['營養師回應'];

        let photoHtml = photoUrl ? `<div class="photo-container"><img src="${photoUrl}" alt="午餐照片" loading="lazy"></div>` : '';
        let replyHtml = nutritionistReply ? `
            <div class="nutritionist-reply">
                <strong>👩‍⚕️ 營養師/校方回應：</strong>
                <p class="mb-0 mt-1">${nutritionistReply}</p>
            </div>` : '';

        const cardHtml = `
            <div class="col-md-6">
                <div class="card feedback-card h-100">
                    <div class="card-body">
                        <h5 class="card-title"><span class="badge bg-success">${anonymousName}</span></h5>
                        <p class="card-text mt-3">${feedback}</p>
                        ${photoHtml}
                        ${replyHtml}
                    </div>
                </div>
            </div>`;
        container.innerHTML += cardHtml;
    });
}
