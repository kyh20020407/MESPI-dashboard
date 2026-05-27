document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. 상태 관리 및 기본 변수 설정
    // ==========================================
    let currentCubeType = null;
    let susCubePrice = 0;       
    let miracleCubePrice = 0;   
    let totalMeso = 0;          
    let isAutoRolling = false;  

    // 옵션 등급별 스타일 (레전드리는 배제됨)
    const gradeStyles = {
        1: { name: "[레어 등급]", className: "cube-opt-rare", color: "#66ffff" },
        2: { name: "[에픽 등급]", className: "cube-opt-epic", color: "#df73ff" },
        3: { name: "[유니크 등급]", className: "cube-opt-unique", color: "#ffb94c" }
    };

    const btnRollOnce = document.getElementById('btnRollOnce');
    const btnAutoRoll = document.getElementById('btnAutoRoll');
    const btnReset = document.getElementById('btnReset');
    const resultBox = document.querySelector('.cube-result-box');

    // ==========================================
    // 2. 핵심 유틸리티 함수
    // ==========================================

    function simplifyOptionText(rawText) {
        if (!rawText) return "";
        return rawText
            .replace(/:\s*\+#inc[a-zA-Z]+r%/g, " +%") 
            .replace(/:\s*\+#inc[a-zA-Z]+/g, " +")    
            .replace(/#prop/g, "일정")
            .replace(/#time/g, "일정")
            .trim();
    }

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
                    miracleCubePrice = latest.price || Math.round((450 / latest.exchange_rate_per_1m) * 1000000);
                    alert(`미라클 큐브가 선택되었습니다. (최근 실시간 가격: ${miracleCubePrice.toLocaleString()} 메소)`);
                }
            } else {
                alert("시세 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            }
        });
    }

// ==========================================
    // 4. 인게임 고증 랜덤 굴리기 로직 (플래닛 전용)
    // ==========================================
    function rollCubeLogic() {
        let currentGrade = parseInt(document.getElementById('startGrade').value) || 2;
        const selectedPart = parseInt(document.getElementById('equipPart').value) || 0;
        const currentReqLevel = parseInt(document.getElementById('equipLevel').value) || 120;

        // 레전드리(4) 선택 시 유니크(3)로 강제 조정
        if (currentGrade >= 4) {
            alert("이 시뮬레이터에서는 레전드리 등급을 지원하지 않습니다. 유니크 등급으로 강제 조정됩니다.");
            currentGrade = 3;
            document.getElementById('startGrade').value = 3;
        }

        // 4-1. 등급업 확률 (수큐, 미라클 동일 적용: 레어->에픽 6%, 에픽->유니크 1.8%)
        const upgradeChance = Math.random() * 100;
        if (currentGrade === 1 && upgradeChance < 6.0) {
            currentGrade = 2; document.getElementById('startGrade').value = 2; 
        } else if (currentGrade === 2 && upgradeChance < 1.8) {
            currentGrade = 3; document.getElementById('startGrade').value = 3; 
        }

        // 4-2. 큐브별 데이터 소스 철저히 분리
        const dataSource = (currentCubeType === 'miracle') ? window.MIRACLE_DATA : window.SUSPICIOUS_DATA;
        
        if (!dataSource || dataSource.length === 0) {
            alert("큐브 데이터를 불러오지 못했습니다. formatted-cube-data.js 파일 로드를 확인해주세요.");
            return null;
        }

        let resultOptions = [];
        
        // 4-3. 조합 불가 중복 옵션 카운터
        let ruleCounts = {
            bossDmg: 0, ignoreDef: 0, itemDrop: 0, mesoDrop: 0, 
            invincible: 0, decentSkill: 0, ignoreDmg: 0
        };

        // 4-4. 3줄 독립 추출 시작
        for (let i = 0; i < 3; i++) {
            let lineGrade = currentGrade;
            
            // 이탈 옵션 확률 정확한 분리 적용
            if (currentGrade > 1) {
                if (i === 1) {
                    // 2번째 줄: 10% 확률로 현재 등급 유지(이탈), 90% 하락
                    if (Math.random() * 100 > 10.0) {
                        lineGrade = currentGrade - 1;
                    }
                } else if (i === 2) {
                    // 3번째 줄: 1% 확률로 현재 등급 유지(이탈), 99% 하락
                    if (Math.random() * 100 > 1.0) {
                        lineGrade = currentGrade - 1;
                    }
                }
            }

            // 부위 및 조건 완벽 필터링
            let currentPool = dataSource.filter(opt => {
                if (opt.grade !== lineGrade) return false;
                
                // 부위 필터링 (0: 공통, 10: 무기/보조무기 공통 그룹)
                let isPartMatch = false;
                let optPart = opt.optionType;

                if (Array.isArray(optPart)) {
                    isPartMatch = optPart.includes(selectedPart) || optPart.includes(0);
                    if (selectedPart === 11 || selectedPart === 12 || selectedPart === 13) {
                        if (optPart.includes(10)) isPartMatch = true;
                    }
                } else {
                    isPartMatch = (optPart === selectedPart || optPart === 0);
                    if (selectedPart === 11 || selectedPart === 12 || selectedPart === 13) {
                        if (optPart === 10) isPartMatch = true;
                    }
                }
                if (!isPartMatch) return false;

                // 인게임 최대 옵션 등장 횟수 제한 체크
                let text = opt.text || "";
                if (text.includes("보스 몬스터 공격") && ruleCounts.bossDmg >= 2) return false;
                if (text.includes("방어율 무시") && ruleCounts.ignoreDef >= 2) return false;
                if (text.includes("아이템 드롭률") && ruleCounts.itemDrop >= 2) return false;
                if (text.includes("메소 획득량") && ruleCounts.mesoDrop >= 2) return false;
                if (text.includes("무적시간") && ruleCounts.invincible >= 1) return false;
                if (text.includes("스킬 사용 가능") && ruleCounts.decentSkill >= 1) return false;
                if (text.includes("확률로 데미지") && text.includes("무시") && ruleCounts.ignoreDmg >= 2) return false;

                return true;
            });
            
            if (currentPool.length === 0) {
                currentPool = dataSource.filter(opt => opt.grade === lineGrade && opt.optionType === 0);
            }

            // 가중치 비례 랜덤 추첨
            let totalWeight = currentPool.reduce((sum, opt) => sum + (opt.weight || 1), 0);
            let rand = Math.random() * totalWeight;
            
            let selectedOpt = null;
            let cumulative = 0;
            for (let opt of currentPool) {
                cumulative += (opt.weight || 1);
                if (rand <= cumulative) { selectedOpt = opt; break; }
            }
            
            if (selectedOpt) {
                resultOptions.push(selectedOpt);
                let text = selectedOpt.text;
                if (text.includes("보스 몬스터 공격")) ruleCounts.bossDmg++;
                if (text.includes("방어율 무시")) ruleCounts.ignoreDef++;
                if (text.includes("아이템 드롭률")) ruleCounts.itemDrop++;
                if (text.includes("메소 획득량")) ruleCounts.mesoDrop++;
                if (text.includes("무적시간")) ruleCounts.invincible++;
                if (text.includes("스킬 사용 가능")) ruleCounts.decentSkill++;
                if (text.includes("확률로 데미지") && text.includes("무시")) ruleCounts.ignoreDmg++;
            }
        }
        
        // 레벨별 스탯 수치 치환 작업
        return resultOptions.map(opt => {
            let text = opt.text;
            let vals = null;
            if (opt.level) {
                let levelKey = Math.ceil(currentReqLevel / 10).toString();
                if (!opt.level[levelKey]) {
                    let keys = Object.keys(opt.level).map(Number).sort((a,b)=>a-b);
                    levelKey = keys[keys.length-1].toString();
                }
                vals = opt.level[levelKey];
                for (let key in vals) { text = text.replace(`#${key}`, vals[key]); }
            }
            return { text: simplifyOptionText(text), original: opt.text, vals, grade: opt.grade };
        });
    }

    function updateResultUI(rolledOptions) {
        if (!rolledOptions) return; 
        calculateCost(); 

        if (!resultBox) return; 
        resultBox.innerHTML = '';

        const currentGrade = parseInt(document.getElementById('startGrade').value) || 2;
        const currentGradeStyle = gradeStyles[currentGrade] || gradeStyles[2];

        const gradeTitle = document.createElement('div');
        gradeTitle.style.cssText = `font-size: 18px; font-weight: 800; margin-bottom: 15px; text-align: center; letter-spacing: 2px; color: ${currentGradeStyle.color};`;
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
        if (!results) return false;
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
                    let isMatch = false;

                    if(resCleanText === targetCleanText || resCleanText.includes(targetCleanText.replace(' +', ''))) {
                        isMatch = true;
                    }
                    else if (/STR|DEX|INT|LUK/i.test(targetCleanText) && resCleanText.includes("올스탯")) {
                        if (targetCleanText.includes('%')) {
                            if (resCleanText.includes('%')) isMatch = true;
                        } else {
                            isMatch = true; 
                        }
                    }

                    if(isMatch) {
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
            if (options) updateResultUI(options);
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
                if (!options) { 
                    isAutoRolling = false;
                    btnAutoRoll.innerText = "목표 달성까지 자동";
                    return;
                }

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
                const currentGrade = parseInt(document.getElementById('startGrade').value) || 2;
                const currentGradeStyle = gradeStyles[currentGrade] || gradeStyles[2];
                resultBox.innerHTML = `
                    <div style="font-size: 18px; font-weight: 800; margin-bottom: 15px; text-align: center; letter-spacing: 2px; color: ${currentGradeStyle.color};">${currentGradeStyle.name}</div>
                    <div style="font-size: 15px; margin-bottom: 10px; text-align: center; color: #fff;">큐브를 돌려주세요</div>
                `;
            }
        });
    }

    // ==========================================
    // 6. 목표 옵션 검색어 자동완성 
    // ==========================================
    let optionMap = []; 
    let fullDataPool = [];
    if(window.SUSPICIOUS_DATA) fullDataPool = fullDataPool.concat(window.SUSPICIOUS_DATA);
    if(window.MIRACLE_DATA) fullDataPool = fullDataPool.concat(window.MIRACLE_DATA);

    // 레전드리(4등급) 옵션은 검색 풀에서도 완벽히 제외
    if(fullDataPool.length > 0) {
        const filteredPool = fullDataPool.filter(d => d.grade < 4);
        filteredPool.forEach(d => {
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
