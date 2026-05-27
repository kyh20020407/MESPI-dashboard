// 스크롤 리빌 (Scroll Reveal) 애니메이션 옵저버
document.addEventListener("DOMContentLoaded", function() {
    const reveals = document.querySelectorAll('.reveal-element');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.15 });

    reveals.forEach(reveal => {
        observer.observe(reveal);
    });
});

// 차트.js 데이터 연동 로직
fetch('data/result.json')
    .then(response => response.json())
    .then(data => {
        if (!data || data.length === 0) return;

        window.mespiData = data;

        // 메인 시세 및 등락률(주식 스타일) 계산
        const allTimestamps = [...new Set(data.map(item => item.timestamp))].sort();
        const latestTimestamp = allTimestamps[allTimestamps.length - 1];
        const latestDataGroup = data.filter(item => item.timestamp === latestTimestamp);
        
        let currentSum = 0;
        latestDataGroup.forEach(item => { currentSum += item.exchange_rate_per_1m; });
        const currentAvg = currentSum / latestDataGroup.length;

        window.latestAvgRatePer1m = currentAvg; 

        // --- 계산기 양방향 연동 로직 시작 ---
        const topInput = document.getElementById('calcTopInput');
        const bottomInput = document.getElementById('calcBottomInput');
        const topLabel = document.getElementById('calcTopLabel');
        const bottomLabel = document.getElementById('calcBottomLabel');
        const btnSwap = document.getElementById('btnSwapUnit');

        if (topInput && bottomInput && btnSwap) {
            let topIsMeso = true; // 현재 위쪽 창이 메소인지 여부

            const formatNum = (num) => Math.round(num).toLocaleString();
            const parseNum = (str) => parseFloat(str.replace(/,/g, '')) || 0;

            const updateCalc = (source) => {
                let topVal = parseNum(topInput.value);
                let bottomVal = parseNum(bottomInput.value);
                const rate = window.latestAvgRatePer1m || 0;

                if (rate === 0) return;

                if (source === 'top') {
                    if (topIsMeso) bottomInput.value = formatNum((topVal / 1000000) * rate);
                    else bottomInput.value = formatNum((topVal / rate) * 1000000);
                    topInput.value = topVal ? formatNum(topVal) : '';
                } else {
                    if (topIsMeso) topInput.value = formatNum((bottomVal / rate) * 1000000);
                    else topInput.value = formatNum((bottomVal / 1000000) * rate);
                    bottomInput.value = bottomVal ? formatNum(bottomVal) : '';
                }
            };

            // 숫자 입력 시 실시간 변환
            topInput.addEventListener('input', () => updateCalc('top'));
            bottomInput.addEventListener('input', () => updateCalc('bottom'));

            // 화살표 버튼 클릭 시 단위 전환
            btnSwap.addEventListener('click', () => {
                topIsMeso = !topIsMeso;
                topLabel.innerText = topIsMeso ? "메소" : "원 (KRW)";
                bottomLabel.innerText = topIsMeso ? "원 (KRW)" : "메소";
                
                const temp = topInput.value;
                topInput.value = bottomInput.value;
                bottomInput.value = temp;
                updateCalc('top'); // 값 위치를 바꾼 후 재계산
            });
        }
        // --- 계산기 양방향 연동 로직 끝 ---

        let priceHtml = `${Math.round(currentAvg).toLocaleString()}/1m`;

        if (allTimestamps.length >= 2) {
            const prevTimestamp = allTimestamps[allTimestamps.length - 2];
            const prevDataGroup = data.filter(item => item.timestamp === prevTimestamp);
            let prevSum = 0;
            prevDataGroup.forEach(item => { prevSum += item.exchange_rate_per_1m; });
            const prevAvg = prevSum / prevDataGroup.length;
            
            const change = currentAvg - prevAvg;
            const percentChange = (change / prevAvg) * 100;
            
            if (change > 0) { priceHtml = `<span style="color: #ff4c4c;">▲ ${Math.round(currentAvg).toLocaleString()}/1m (+${percentChange.toFixed(2)}%)</span>`; } 
            else if (change < 0) { priceHtml = `<span style="color: #4c80ff;">▼ ${Math.round(currentAvg).toLocaleString()}/1m (${percentChange.toFixed(2)}%)</span>`; } 
            else { priceHtml = `<span style="color: var(--text-light);">- ${Math.round(currentAvg).toLocaleString()}/1m (0.00%)</span>`; }
        }
        document.getElementById('dynamic-price').innerHTML = priceHtml;

        document.getElementById('chart-title').style.display = 'none';
        const selectEl = document.getElementById('timeRangeSelect');
        selectEl.style.display = 'block'; 

        const ctx = document.getElementById('priceChart').getContext('2d');
        
        window.priceChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] }, 
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false }, 
                plugins: { 
                    legend: { display: false }, 
                    tooltip: {
                        callbacks: {
                            title: function(context) { return context[0].label; }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { display: false }, 
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    },
                    y: { ticks: { color: '#aaa', font: { family: 'Pretendard' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

        // 기간별 데이터 필터링 차트 업데이트 함수
        function updateChartRange(range) {
            let filteredData = window.mespiData;
            
            if (range !== 'all') {
                const latestTsStr = window.mespiData[window.mespiData.length - 1].timestamp;
                const latestDate = new Date(latestTsStr.replace(' ', 'T'));
                
                const msPerDay = 24 * 60 * 60 * 1000;
                let days = 0;
                if(range === '1d') days = 1;
                else if(range === '3d') days = 3;
                else if(range === '5d') days = 5;
                else if(range === '2w') days = 14;
                else if(range === '1m') days = 30;
                
                const cutoffDate = new Date(latestDate.getTime() - (days * msPerDay));
                
                filteredData = window.mespiData.filter(d => {
                    const dDate = new Date(d.timestamp.replace(' ', 'T'));
                    return dDate >= cutoffDate;
                });
            }

            const timestamps = [...new Set(filteredData.map(item => item.timestamp))].sort();
            const baseItemNames = [...new Set(window.mespiData.map(item => item.item_name))]; 
            
            const mespiPrices = timestamps.map(ts => {
                const group = filteredData.filter(d => d.timestamp === ts);
                if (group.length === 0) return null;
                let sum = 0;
                group.forEach(i => sum += i.exchange_rate_per_1m);
                return sum / group.length;
            });

            const isMespiHidden = window.priceChart.data.datasets[0] ? window.priceChart.data.datasets[0].hidden : false;
            const mespiDataset = {
                label: "MESPI (종합 지수)", data: mespiPrices, hidden: isMespiHidden,
                borderColor: '#ffffff', backgroundColor: '#ffffff', 
                borderWidth: 4, pointRadius: 5, tension: 0.3, spanGaps: true
            };

            const lineColors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff'];
            
            const itemDatasets = baseItemNames.map((itemName, index) => {
                const itemPrices = timestamps.map(ts => {
                    const record = filteredData.find(d => d.item_name === itemName && d.timestamp === ts);
                    return record ? record.exchange_rate_per_1m : null;
                });
                
                const isHidden = window.priceChart.data.datasets[index + 1] ? window.priceChart.data.datasets[index + 1].hidden : false;

                return {
                    label: itemName, data: itemPrices, hidden: isHidden,
                    borderColor: lineColors[index % lineColors.length],
                    backgroundColor: lineColors[index % lineColors.length],
                    borderWidth: 2, pointRadius: 3, tension: 0.3, spanGaps: true 
                };
            });

            window.priceChart.data.labels = timestamps;
            window.priceChart.data.datasets = [mespiDataset, ...itemDatasets];
            window.priceChart.update();
        }

        selectEl.addEventListener('change', (e) => {
            updateChartRange(e.target.value);
        });

        updateChartRange('all');

        // 커스텀 범례 버튼 생성
        const legendContainer = document.getElementById('custom-legend');
        legendContainer.innerHTML = ''; 
        
        const baseItemNames = [...new Set(window.mespiData.map(item => item.item_name))];
        const allLabels = ["MESPI (종합 지수)", ...baseItemNames];
        const lineColors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff'];

        allLabels.forEach((labelName, index) => {
            const btn = document.createElement('button');
            btn.className = 'legend-btn';
            
            const color = index === 0 ? '#ffffff' : lineColors[(index - 1) % lineColors.length];
            btn.innerHTML = `<span class="legend-color-box" style="background-color: ${color}"></span> ${labelName}`;
            
            btn.addEventListener('click', () => {
                const isVisible = window.priceChart.isDatasetVisible(index);
                if (isVisible) {
                    window.priceChart.hide(index); 
                    btn.classList.add('hidden-dataset'); 
                } else {
                    window.priceChart.show(index); 
                    btn.classList.remove('hidden-dataset');
                }
            });
            
            legendContainer.appendChild(btn);
        });
    })
    .catch(error => {
        document.getElementById('dynamic-price').innerText = "Error";
        console.error("데이터를 불러오는 데 실패했습니다.", error);
    });
document.addEventListener('DOMContentLoaded', () => {
    // 상단 메뉴의 모든 링크 요소를 가져옵니다.
    const menuLinks = document.querySelectorAll('.menu li a');

    menuLinks.forEach(link => {
        // 큐브 시뮬레이터(id="openCubeBtn")를 제외한 나머지 링크에만 이벤트 적용
        if (link.id !== 'openCubeBtn') {
            link.addEventListener('click', (e) => {
                e.preventDefault(); // href="#" 클릭 시 스크롤이 맨 위로 튀는 현상 방지
                
                // 알림창 띄우기 (style.css에 있는 #mespiCommonAlertModal 띄우는 함수가 있다면 그걸로 교체하셔도 됩니다)
                alert('현재 준비중입니다.');
            });
        }
    });
});