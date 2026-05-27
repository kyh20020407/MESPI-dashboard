document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. 상태 관리 및 기본 변수 설정
    // ==========================================
    let currentCubeType = null;
    let susCubePrice = 0;       // 수상한 큐브 가격
    let miracleCubePrice = 0;   // 미라클 큐브 가격
    let totalMeso = 0;          // 누적 소모 메소
    let isAutoRolling = false;  // 자동 돌리기 상태

    // 옵션 등급별 스타일 지정 (1: 레어, 2: 에픽, 3: 유니크, 4: 레전드리)
    const gradeStyles = {
        1: { name: "[레어 등급]", className: "cube-opt-rare" },
        2: { name: "[에픽 등급]", className: "cube-opt-epic" },
        3: { name: "[유니크 등급]", className: "cube-opt-unique" },
        4: { name: "[레전드리 등급]", className: "cube-opt-legendary" }
    };

    // DOM 엘리먼트 가져오기
    const btnRollOnce = document.getElementById('btnRollOnce');
    const btnAutoRoll = document.getElementById('btnAutoRoll');
    const btnReset = document.getElementById('btnReset');
    const resultBox = document.querySelector('.cube-result-box');

    // ==========================================
    // 2. 핵심 유틸리티 함수
    // ==========================================

    // 텍스트 간소화
    function simplifyOptionText(rawText) {
        return rawText
            .replace(/:\s*\+#inc[a-zA-Z]+r%/g, " +%") 
            .replace(/:\s*\+#inc[a-zA-Z]+/g, " +")    
            .replace(/#prop/g, "일정")
            .replace(/#time/g, "일정")
            .trim();
    }

    // 큐브 소모 비용 및 레벨별 수수료 계산 (실시간 UI 반영)
    function calculateCost() {
        const currentReqLevel = parseInt(document.getElementById('equipLevel').value) || 120;
        
        let levelCost = 0;
        if (currentReqLevel >= 1 && currentReqLevel <= 34) levelCost = 8000;
        else if (currentReqLevel >= 35 && currentReqLevel <= 74) levelCost = 16000;
        else if (currentReqLevel >= 75) levelCost = 65000;

        let currentCubePrice = (currentCubeType === 'miracle') ? miracleCubePrice : susCubePrice;

        totalMeso += (currentCubePrice + levelCost);
        document.getElementById('totalMesoUsed').innerText = `${totalMeso.toLocaleString()} 메소`;

        if(window.latestAvgRatePer1m) {
            const krwCost = (totalMeso / 1000000) * window.latestAvgRatePer1m;
            document.getElementById('totalKrwUsed').innerText = `${Math.round(krwCost).toLocaleString()} 원`;
        }
    }

    // ==========================================
    // 3. UI 및 큐브 선택 이벤트 처리
    // ==========================================

    const openBtn = document.getElementById('openCubeBtn');
    const modal = document.getElementById('cubeModal');
    const closeBtn = document.getElementById('closeCubeModal');

    if (openBtn && modal) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'flex'; 
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => { 
            modal.style.display = 'none'; 
            isAutoRolling = false;
        });
    }

    const btnSusCube = document.getElementById('btnSusCube');
    if (btnSusCube) {
        btnSusCube.addEventListener('click', () => {
            currentCubeType = 'suspicious';
            document.getElementById('activeCubeImg').src = 'data/sus.png';
            document.getElementById('activeCubeImg').style.display = 'block';
            
            const priceInput = prompt("현재 서버의 '수상한 큐브' 1개당 가격(메소)을 입력해주세요.", "30000");
            if(priceInput && !isNaN(priceInput)) {
                susCubePrice = parseInt(priceInput);
                alert(`수상한 큐브 가격이 ${susCubePrice.toLocaleString()} 메소로 설정되었습니다.`);
            }
        });
    }

    const btnMiracleCube = document.getElementById('btnMiracleCube');
    if (btnMiracleCube) {
        btnMiracleCube.addEventListener('click', () => {
            currentCubeType = 'miracle';
            document.getElementById('activeCubeImg').src = 'data/miracle.png'; 
            document.getElementById('activeCubeImg').style.display = 'block';
            
            if (window.mespiData && window.mespiData.length > 0) {
                const miracleData = window.mespiData.filter(d => d.item_name === '미라클 큐브').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                if (miracleData.length > 0) {
                    const latest = miracleData[miracleData.length - 1];
                    miracleCubePrice = latest.price || Math.round((1200 / latest.exchange_rate_per_1m) * 1000000);
                    alert(`미라클 큐브가 선택되었습니다. (최근 실시간 가격: ${miracleCubePrice.toLocaleString()} 메소)`);
                }
            } else {
                alert("시세 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            }
        });
    }

    // ==========================================
    // 4. 인게임 고증 랜덤 굴리기 로직 (오류 수정본)
    // ==========================================
    function rollCubeLogic() {
        // UI에서 선택한 값을 숫자로 바로 받아옵니다.
        const currentGrade = parseInt(document.getElementById('startGrade').value) || 2;
        const selectedPart = parseInt(document.getElementById('equipPart').value) || 0;
        const currentReqLevel = parseInt(document.getElementById('equipLevel').value) || 120;

        // ★ 버그 수정: 영단어 매핑을 거치지 않고, HTML의 숫자 value를 다이렉트로 옵션풀과 매칭합니다.
        let pool = window.SUSPICIOUS_DATA.filter(d => 
            d.grade === currentGrade && (d.optionType === selectedPart || d.optionType === 0)
        );

        if(pool.length === 0) {
            pool = window.SUSPICIOUS_DATA.filter(d => d.grade === currentGrade);
        }
        
        let resultOptions = [];
        let max1Count = 0; 
        let max2Count = 0; 

        for (let i = 0; i < 3; i++) {
            let currentPool = pool.filter(opt => {
                let isMax1 = opt.text.includes("스킬 사용 가능") || (opt.text.includes("무적시간") && opt.text.includes("증가"));
                let isMax2 = (opt.text.includes("데미지") && opt.text.includes("무시")) || opt.text.includes("일정 시간 무적");
                if (isMax1 && max1Count >= 1) return false;
                if (isMax2 && max2Count >= 2) return false;
                return true;
            });
            
            if(currentPool.length === 0) currentPool = pool;

            let totalWeight = currentPool.reduce((sum, opt) => sum + opt.weight, 0);
            let rand = Math.random() * totalWeight;
            
            let selectedOpt = null;
            let cumulative = 0;
            for (let opt of currentPool) {
                cumulative += opt.weight;
                if (rand <= cumulative) { selectedOpt = opt; break; }
            }
            
            if (selectedOpt) {
                resultOptions.push(selectedOpt);
                let isMax1 = selectedOpt.text.includes("스킬 사용 가능") || (selectedOpt.text.includes("무적시간") && selectedOpt.text.includes("증가"));
                let isMax2 = (selectedOpt.text.includes("데미지") && selectedOpt.text.includes("무시")) || selectedOpt.text.includes("일정 시간 무적");
                if (isMax1) max1Count++;
                if (isMax2) max2Count++;
            }
        }
        
        return resultOptions.map(opt => {
            let levelKey = Math.ceil(currentReqLevel / 10).toString();
            if (!opt.level[levelKey]) {
                let keys = Object.keys(opt.level).map(Number).sort((a,b)=>a-b);
                levelKey = keys[keys.length-1].toString();
            }
            let vals = opt.level[levelKey];
            let text = opt.text;
            for (let key in vals) { text = text.replace(`#${key}`, vals[key]); }
            return { text: simplifyOptionText(text), original: opt.text, vals, grade: opt.grade };
        });
    }

    // 결과 UI 출력
    function updateResultUI(rolledOptions) {
        calculateCost(); 

        if (!resultBox) return; 
        resultBox.innerHTML = '';

        const currentGrade = parseInt(document.getElementById('startGrade').value) || 2;
        const currentGradeStyle = gradeStyles[currentGrade] || gradeStyles[2];

        const gradeTitle = document.createElement('div');
        gradeTitle.style.cssText = "font-size: 18px; font-weight: 800; margin-bottom: 15px; text-align: center; letter-spacing: 2px;";
        gradeTitle.innerText = currentGradeStyle.name;
        gradeTitle.className = currentGradeStyle.className;
        resultBox.appendChild(gradeTitle);

        rolledOptions.forEach(optData => {
            const line = document.createElement('div');
            line.style.cssText = "font-size: 15px; margin-bottom: 10px; text-align: center; color: #fff;";
            line.innerText = optData.text;
            resultBox.appendChild(line);
        });
    }

    // ==========================================
    // 5. 자동 큐브 및 목표 달성 체크 로직
    // ==========================================
    
    function checkTargetAchieved(results) {
        let achieved = true;
        let hasTarget = false;

        for (let i = 1; i <= 3; i++) {
            const targetCleanText = document.getElementById(`targetOp${i}`).value.trim();
            const targetVal = parseFloat(document.getElementById(`targetVal${i}`).value) || 0;
            
            if (targetCleanText) {
                hasTarget = true;
                let sumVal = 0;
                results.forEach(res => {
                    const resCleanText = simplifyOptionText(res.original); 
                    if(resCleanText === targetCleanText || resCleanText.includes(targetCleanText.replace(' +', ''))) {
                        let numMatch = res.text.match(/\d+/g);
                        if(numMatch) sumVal += parseFloat(numMatch[numMatch.length-1]);
                    }
                });
                if (sumVal < targetVal) achieved = false;
            }
        }
        return hasTarget ? achieved : false;
    }

    if(btnRollOnce) {
        btnRollOnce.addEventListener('click', () => {
            if(!currentCubeType) return alert("먼저 좌측 상단에서 큐브 종류를 선택해주세요!");
            const options = rollCubeLogic();
            updateResultUI(options);
        });
    }

    if(btnAutoRoll) {
        btnAutoRoll.addEventListener('click', () => {
            if(!currentCubeType) return alert("먼저 좌측 상단에서 큐브 종류를 선택해주세요!");
            
            if(isAutoRolling) {
                isAutoRolling = false;
                btnAutoRoll.innerText = "목표 달성까지 자동";
                return;
            }
            
            if (!document.getElementById('targetOp1').value && !document.getElementById('targetOp2').value && !document.getElementById('targetOp3').value) {
                return alert("자동 돌리기를 진행할 목표 옵션을 최소 1개 이상 입력해주세요!");
            }

            isAutoRolling = true;
            btnAutoRoll.innerText = "중지";
            let rollCount = 0;

            function autoRollStep() {
                if(!isAutoRolling) return;
                
                const options = rollCubeLogic();
                updateResultUI(options);
                rollCount++;
                
                if(checkTargetAchieved(options)) {
                    isAutoRolling = false;
                    btnAutoRoll.innerText = "목표 달성까지 자동";
                    alert(`축하합니다! 목표 옵션을 달성했습니다!\n(총 소모 횟수: ${rollCount}회)`);
                    return;
                }
                setTimeout(autoRollStep, 0);
            }
            autoRollStep();
        });
    }

    if(btnReset) {
        btnReset.addEventListener('click', () => {
            isAutoRolling = false;
            if (btnAutoRoll) btnAutoRoll.innerText = "목표 달성까지 자동";
            
            totalMeso = 0;
            document.getElementById('totalMesoUsed').innerText = "0 메소";
            document.getElementById('totalKrwUsed').innerText = "0 원";
            
            for(let i=1; i<=3; i++) {
                if (document.getElementById(`targetOp${i}`)) document.getElementById(`targetOp${i}`).value = "";
                if (document.getElementById(`targetVal${i}`)) document.getElementById(`targetVal${i}`).value = "";
            }
            
            if (resultBox) {
                resultBox.innerHTML = `
                    <div style="font-size: 18px; font-weight: 800; margin-bottom: 15px; text-align: center; color: #df73ff; letter-spacing: 2px;">[에픽 등급]</div>
                    <div style="font-size: 15px; margin-bottom: 10px; text-align: center; color: #fff;">큐브를 돌려주세요</div>
                `;
            }
        });
    }

    // ==========================================
    // 6. 목표 옵션 검색어 자동완성 
    // ==========================================
    let optionMap = []; 
    if(window.SUSPICIOUS_DATA) {
        const filteredData = window.SUSPICIOUS_DATA.filter(d => d.grade < 5);
        filteredData.forEach(d => {
            const cleanText = simplifyOptionText(d.text);
            if(!optionMap.some(opt => opt.clean === cleanText)) {
                optionMap.push({ raw: d.text, clean: cleanText });
            }
        });
    }

    function setupAutocomplete(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        if(!input || !list) return;

        function renderDropdown(filterVal) {
            list.innerHTML = '';
            const matched = filterVal 
                ? optionMap.filter(opt => opt.clean.includes(filterVal))
                : optionMap;

            if (matched.length > 0) {
                list.style.display = 'block';
                matched.forEach(matchObj => {
                    let li = document.createElement('li');
                    li.innerText = matchObj.clean; 
                    li.addEventListener('click', (e) => {
                        e.stopPropagation();
                        input.value = matchObj.clean; 
                        input.setAttribute('data-raw', matchObj.raw); 
                        list.style.display = 'none';
                    });
                    list.appendChild(li);
                });
            } else { list.style.display = 'none'; }
        }

        input.addEventListener('input', function() { renderDropdown(this.value); });
        input.addEventListener('focus', function() { renderDropdown(this.value); });

        document.addEventListener('click', (e) => {
            if(e.target !== input && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    }
    
    setupAutocomplete('targetOp1', 'autoList1');
    setupAutocomplete('targetOp2', 'autoList2');
    setupAutocomplete('targetOp3', 'autoList3');
});