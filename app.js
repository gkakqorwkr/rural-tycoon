/**
 * [Rule B] 전역 가상 파일 로깅 시스템
 */
class VirtualFileLogger {
    constructor() { this.logKey = "farming_rt_logs"; }
    log(msg) {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        localStorage.setItem(this.logKey, (localStorage.getItem(this.logKey)||"") + line);
        console.log(line);
    }
}
const logger = new VirtualFileLogger();

// --- 1. 환경 변수 및 게임 메타 데이터 ---
const DAY_DURATION_MS = 60000; // 1분 = 1일 (총 30분 풀타임 플레이 구조)
const TICK_RATE_MS = 1000; 
const SAVE_DATA_KEY = "Farming_V3_SaveData";

// 모바일 및 웹 UI용 NPC 초상화 
function getKoreanSVG(emoji, bgColor) {
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='128' height='128' fill='${encodeURIComponent(bgColor)}'/><text x='64' y='90' font-size='70' text-anchor='middle'>${encodeURIComponent(emoji)}</text></svg>`;
}

const PORTRAITS = {
    ai: getKoreanSVG('📺', '#a3b18a'),          
    mayor: getKoreanSVG('👴🏽', '#e9c46a'),       
    corp: getKoreanSVG('😎', '#264653'),         
    mechanic: getKoreanSVG('👨‍🔧', '#808080'),   
    merchant: getKoreanSVG('👩‍🌾', '#e07a5f')    
};

// 씨앗/작물 메타 데이터 (1분 체제에 맞춘 폭발적 생장 속도)
const SEED_DATA = {
    carrot: { id: 'carrot', name: "토종 당근", cost: 10, sellPrice: 20, isGMO: false, color: "#fc8c03", growSecs: 20 }, 
    potato: { id: 'potato', name: "시골 감자", cost: 25, sellPrice: 55, isGMO: false, color: "#d1a738", growSecs: 35 }, 
    gmoCorn: { id: 'gmoCorn', name: "[GMO] 황금 옥수수", cost: 60, sellPrice: 250, isGMO: true, color: "#ff2200", growSecs: 10 },
    goldenGinseng: { id: 'goldenGinseng', name: "전설의 산삼", cost: 150, sellPrice: 1000, isGMO: false, color: "#d8f3dc", growSecs: 50 } 
};

const STORY_EVENTS = {
    1: [
        {speaker: "최첨단 AI 도우미", img: 'ai', text: "시스템 부팅 완료. 귀농 체험 기간은 앞으로 30일(30분) 간 진행됩니다.\n농산물 시가는 우측 상단 전광판에서 주식처럼 매일 변동됩니다.\n지금 즉시 당근을 심어 자산을 축적하십시오."}
    ],
    2: [
        {speaker: "옆집 김씨 이장님", img: 'mayor', text: "아이고~ 반가워 청년! 내 권한으로 장터에 [시골 감자]를 풀었어!\n날씨를 잘 보고 시세가 훌쩍 뛸 때 내다 팔면 부자가 될겨!"}
    ],
    3: [
        {speaker: "태산 코퍼레이션 에이전트", img: 'corp', text: "저희 10초 완성 [GMO 황금 옥수수]를 제안하러 왔습니다.\n돈은 엄청나게 벌리겠지만... 땅이 오염되어 썩는 건 감수하셔야 할 겁니다."}
    ],
    15: [
        {speaker: "최첨단 AI 도우미", img: 'ai', text: "경고: 계약 기간(30일)의 절반이 경과했습니다.\n엔딩 산출을 위해 당신의 잔고와 밭의 오염도를 누적 계산 중입니다."}
    ]
};

const VILLAGE_EVENTS = {
    hardware: [
        {speaker: "수리공 박씨 아재", img: 'mechanic', text: "땅이 까맣게 썩어 들어간다고? 쯧쯧.. GMO를 심었구만.\n내 150G짜리 캡슐 하나면 맹독도 싹 씻어준다고. 잔고 확인하고 하나 쟁여둬."},
        {speaker: "수리공 박씨 아재", img: 'mechanic', text: "태풍이 온다고 너무 쫄지 마. 날아가면 다시 심으면 그만이지!"}
    ],
    market: [
        {speaker: "시장 상인 아주머니", img: 'merchant', text: "우리 시장에 자주 와서 도장 찍어! 나랑 좀 친해지면 아주 요~물인 씨앗을 몰래 꺼내줄랑가 모르지~"},
        {speaker: "옆집 김씨 이장님", img: 'mayor', text: "오늘 감자 값이 완전 떡상했어! 빨랑 밭에서 빼서 다 팔어!"}
    ],
    park: [
        {speaker: "최첨단 AI 도우미", img: 'ai', text: "휴식을 취하며 오늘의 주식 시세를 분석하는 것을 권장합니다."},
        {speaker: "태산 코퍼레이션 에이전트", img: 'corp', text: "철물점 영감탱이가 파는 정화 캡슐... 아주 귀찮은 물건이군요.\n우리 옥수수를 마구잡이로 심어댈 수 있는 면죄부니까요."}
    ]
};

// --- 화면 전환 및 맵 로직 브릿지 ---
window.appSwitchScreen = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    document.getElementById('btn-tab-'+tab).classList.add('active');
    document.getElementById('view-'+tab).classList.add('active');
};

window.visitLocation = function(loc) {
    if (!gm) return;
    
    // 호감도 증가
    gm.affinity[loc]++;
    
    // 특수 이벤트: 시장 호감도 5 달성 시 산삼 해금
    if (loc === 'market' && gm.affinity[loc] >= 5 && !gm.unlockedSeeds.includes('goldenGinseng')) {
        gm.unlockedSeeds.push('goldenGinseng');
        logger.log("🌸 시장 주모와의 호감도 달성! [전설의 산삼]이 장터에 추가되었습니다!");
        const sp = {speaker: "시장 상인 아주머니", img: 'merchant', text: "아이고 총각~ 하도 뻔질나게 드나들어서 정 들었어 아주.\n내가 특별히 목함에 숨겨둔 [전설의 산삼] 씨앗을 꺼내줄게!"};
        dialogueManager.queue.push(sp);
    } else {
        const list = VILLAGE_EVENTS[loc];
        const rnd = list[Math.floor(Math.random() * list.length)];
        dialogueManager.queue.push(rnd);
    }

    if(dialogueManager.overlay.style.display === 'none') {
        dialogueManager.playNext();
    }
};

// --- 2. 다이얼로그 매니저 ---
class DialogueManager {
    constructor() {
        this.overlay = document.getElementById('dialogue-overlay');
        this.box = document.getElementById('dialogue-box');
        this.portrait = document.getElementById('dialogue-portrait');
        this.speakerName = document.getElementById('dialogue-speaker');
        this.textBox = document.getElementById('dialogue-text');
        
        this.queue = [];
        this.isTyping = false;
        this.typeTimer = null;
        this.currentFullText = "";

        this.box.addEventListener('click', () => {
            if (this.isTyping) {
                clearInterval(this.typeTimer);
                this.textBox.innerHTML = this.currentFullText.replace(/\n/g, "<br>");
                this.isTyping = false;
            } else {
                this.playNext();
            }
        });
    }

    triggerEvent(day) {
        if (!STORY_EVENTS[day]) return;
        this.queue.push(...STORY_EVENTS[day]);
        if (this.overlay.style.display === 'none') this.playNext();
    }

    playNext() {
        if (this.queue.length === 0) {
            this.overlay.style.display = 'none'; 
            return;
        }

        const data = this.queue.shift();
        this.overlay.style.display = 'flex';
        this.speakerName.innerText = data.speaker;
        
        if (PORTRAITS[data.img]) {
            this.portrait.style.display = 'block';
            this.portrait.src = PORTRAITS[data.img];
        } else {
            this.portrait.style.display = 'none';
        }

        this.textBox.innerHTML = "";
        this.currentFullText = data.text;
        this.isTyping = true;
        let charIndex = 0;

        this.typeTimer = setInterval(() => {
            let char = this.currentFullText.charAt(charIndex);
            if (char === '\n') char = '<br>';
            this.textBox.innerHTML += char;
            charIndex++;

            if (charIndex >= this.currentFullText.length) {
                clearInterval(this.typeTimer);
                this.isTyping = false;
            }
        }, 30); 
    }
}

// --- 3. 실시간 게임 핵심 구동부 (GameManager) ---
class GameManager {
    constructor() {
        this.day = 1;
        this.money = 100;
        this.elapsedTimeMs = 0; 
        
        this.weather = "Clear";
        this.inventory = { seeds: {carrot: 3, potato: 0, gmoCorn: 0, goldenGinseng: 0}, crops: {carrot: 0, potato: 0, gmoCorn: 0, goldenGinseng: 0}, tools: {purifier: 0} };
        this.unlockedSeeds = ['carrot'];
        
        this.affinity = { hardware: 0, market: 0, park: 0 };
        this.marketPrices = null; // 주식 시세 전광판 데이터
        this.isGameOver = false;
    }

    init() {
        this.loadSave();

        // 게임 오버 상태 복구 차단 (초기화해야 함)
        if(this.day > 30) this.day = 30;

        if (!this.marketPrices) this.calculateDailyMarket();

        this.updateUI();
        marketManager.renderShop();
        this.updateWeatherDOM();
        
        if (this.day === 1 && this.elapsedTimeMs < 1000) {
            setTimeout(() => dialogueManager.triggerEvent(1), 800);
        }

        // V3: 매 분(60초) = 1일
        setInterval(() => this.gameLoopTick(), TICK_RATE_MS);
    }

    saveDataLocally() {
        if(this.isGameOver) return;
        const payload = {
            day: this.day,
            money: this.money,
            elapsedTimeMs: this.elapsedTimeMs,
            weather: this.weather,
            inventory: this.inventory,
            unlockedSeeds: this.unlockedSeeds,
            affinity: this.affinity,
            marketPrices: this.marketPrices,
            crops: interactionManager.crops.map(c => ({
                isPlanted: c.isPlanted,
                type: c.type,
                growthLevel: c.growthLevel,
                pollution: c.pollution
            }))
        };
        localStorage.setItem(SAVE_DATA_KEY, JSON.stringify(payload));
    }

    loadSave() {
        const saved = localStorage.getItem(SAVE_DATA_KEY);
        if (!saved) return;
        try {
            const dt = JSON.parse(saved);
            this.day = dt.day || 1;
            this.money = dt.money || 100;
            this.elapsedTimeMs = dt.elapsedTimeMs || 0;
            this.weather = dt.weather || "Clear";
            
            // 병합 복구
            this.inventory.seeds = { ...this.inventory.seeds, ...(dt.inventory.seeds || {}) };
            this.inventory.crops = { ...this.inventory.crops, ...(dt.inventory.crops || {}) };
            this.inventory.tools = { purifier: dt.inventory?.tools?.purifier || 0 };
            
            this.unlockedSeeds = dt.unlockedSeeds || this.unlockedSeeds;
            this.affinity = dt.affinity || this.affinity;
            this.marketPrices = dt.marketPrices || null;

            if (dt.crops && dt.crops.length === interactionManager.crops.length) {
                interactionManager.crops.forEach((c, idx) => {
                    const cd = dt.crops[idx];
                    c.isPlanted = cd.isPlanted;
                    c.type = cd.type;
                    c.growthLevel = cd.growthLevel;
                    c.pollution = cd.pollution;
                    c.render();
                });
            }
        } catch (e) { console.error(e); }
    }

    static resetSave() {
        if(confirm("모든 데이터를 초기화하고 Day 1로 새 게임을 시작하시겠습니까?")) {
            localStorage.removeItem(SAVE_DATA_KEY);
            location.reload();
        }
    }

    gameLoopTick() {
        if(this.isGameOver) return;

        this.elapsedTimeMs += TICK_RATE_MS;
        
        if (this.elapsedTimeMs >= DAY_DURATION_MS) { // 하루 1분 
            this.elapsedTimeMs = 0;
            this.day++;

            // 30일 초과 시 결산
            if (this.day > 30) {
                this.triggerEnding();
                return;
            }
            this.onDayChanged();
        }

        interactionManager.crops.forEach(c => c.growTick(TICK_RATE_MS / 1000));
        this.updateAIChatTerminal();
        this.updateTimeUI();

        if (this.elapsedTimeMs % 5000 === 0) this.saveDataLocally();
    }

    updateAIChatTerminal() {
        const aiChat = document.getElementById('ai-chat');
        if (this.elapsedTimeMs % 10000 === 0) {
            const tips = [
                `> 모듈: 토양 오염도는 게임 종료(30일차) 시 강제로 정산됩니다.`,
                `> 예측: 오늘의 옥수수 시세 변동률을 상점에 물어보십시오.`,
                `> 센서: 비(장마)가 오면 광합성 속도가 폭증합니다.`,
                `> AI분석: 정화 캡슐(150G) 구입은 최고의 방어책입니다.`,
                `> 경고: 태풍은 확률적으로 약한 작물을 날려버립니다!`
            ];
            aiChat.innerHTML = tips[Math.floor(Math.random() * tips.length)];
        }
    }

    calculateDailyMarket() {
        this.marketPrices = {};
        Object.keys(SEED_DATA).forEach(key => {
            const base = SEED_DATA[key].sellPrice;
            let fluct = (Math.random() * 0.8) - 0.4; // 기본 -40% ~ +40%
            
            // 날씨 이벤트
            if (this.weather === "Heatwave" && key === "potato") fluct += 0.3; // 감자 떡상
            if (this.weather === "Typhoon" && key === "gmoCorn") fluct -= 0.5; // 옥수수 떡락 (안전우려)
            if (this.weather === "Rain" && key === "carrot") fluct -= 0.2;     // 흔함

            // 한계치(-60% ~ +100%)
            if(fluct > 1.0) fluct = 1.0;
            if(fluct < -0.6) fluct = -0.6;
            
            this.marketPrices[key] = {
                price: Math.max(1, Math.floor(base * (1 + fluct))),
                fluct: fluct
            };
        });
        document.getElementById('market-day').innerText = this.day;
    }

    onDayChanged() {
        logger.log(`새로운 장이 열렸습니다: Day ${this.day}`);
        
        // 날씨 무작위 변경 (맑음 40%, 폭염 30%, 장마 20%, 태풍 10%)
        const roll = Math.random();
        if(roll < 0.1) this.weather = "Typhoon";
        else if(roll < 0.3) this.weather = "Rain";
        else if(roll < 0.6) this.weather = "Heatwave";
        else this.weather = "Clear";

        this.updateWeatherDOM();
        
        // 시장 변동 산출 및 UI 갱신 (주식 시스템)
        this.calculateDailyMarket();

        // 스크립트 해금
        if (this.day === 2 && !this.unlockedSeeds.includes('potato')) this.unlockedSeeds.push('potato');
        if (this.day === 3 && !this.unlockedSeeds.includes('gmoCorn')) this.unlockedSeeds.push('gmoCorn');
        
        marketManager.renderShop();
        dialogueManager.triggerEvent(this.day);
        
        // 날씨 즉각 재난
        if (this.weather === "Typhoon") {
            const planted = interactionManager.crops.filter(c => c.isPlanted && c.pollution <= 80);
            if(planted.length > 0) {
                let targets = Math.min(Math.floor(Math.random() * 3) + 1, planted.length); // 1~3개 타격
                for(let i=0; i<targets; i++) {
                    let rnd = Math.floor(Math.random() * planted.length);
                    planted[rnd].reset(); // 파괴
                    planted.splice(rnd, 1);
                }
                logger.log("⚠️ 초강력 태풍이 불어와 일부 작물이 휩쓸려 나갔습니다!!");
                document.getElementById('farm').classList.add('shake');
                setTimeout(() => document.getElementById('farm').classList.remove('shake'), 800);
            }
        }

        this.saveDataLocally();
    }

    updateWeatherDOM() {
        const dom = document.getElementById('weather-status');
        if(this.weather === "Heatwave") dom.innerHTML = "<span style='color:red;'>⚠️ 폭염 극대 (성장 50% 지연)</span>";
        else if(this.weather === "Rain") dom.innerHTML = "<span style='color:blue;'>🌧️ 장마철 (성장 1.5배 가속!)</span>";
        else if(this.weather === "Typhoon") dom.innerHTML = "<span style='color:purple;'>🌀 초강력 태풍 접근 중!</span>";
        else dom.innerHTML = "<span style='color:green;'>🌞 맑음 (안정적인 광합성)</span>";
    }

    updateTimeUI() {
        const pct = (this.elapsedTimeMs / DAY_DURATION_MS) * 100;
        document.getElementById('time-bar-fill').style.width = `${pct}%`;
        
        const totalSecs = Math.floor(this.elapsedTimeMs / 1000);
        document.getElementById('time-text').innerText = `Day ${this.day} - ${totalSecs.toString().padStart(2,'0')}초/60초 | 총 30일`;
        
        document.getElementById('player-money').innerText = this.money;
    }

    updateUI() {
        let invenHTML = "";
        for (const [key, amt] of Object.entries(this.inventory.seeds)) {
            if (amt > 0) invenHTML += `${SEED_DATA[key].name} 모종: <b>${amt}</b><br>`;
        }
        for (const [key, amt] of Object.entries(this.inventory.crops)) {
            if (amt > 0) invenHTML += `${SEED_DATA[key].name} 수확물: <b>${amt}</b><br>`;
        }
        
        if (invenHTML === "") invenHTML = "텅 비었음";
        document.getElementById('player-inventory').innerHTML = invenHTML;
        interactionManager.updateSeedTools();
        this.updateTimeUI();
    }

    triggerEnding() {
        this.isGameOver = true;
        const endingDiv = document.getElementById('ending-screen');
        const endTitle = document.getElementById('ending-title');
        const endDesc = document.getElementById('ending-desc');
        
        let totalPollution = interactionManager.crops.reduce((sum, c) => sum + c.pollution, 0);
        totalPollution = Math.floor(totalPollution);

        document.getElementById('ending-money').innerText = this.money;
        document.getElementById('ending-pollution').innerText = totalPollution;
        
        endingDiv.style.display = 'flex';
        
        if (totalPollution > 500) {
            endTitle.innerText = "😭 파산: 빚더미 노예 (BAD END)";
            endTitle.style.color = "#d62828";
            endDesc.innerHTML = "당신은 돈에 눈이 멀어 자연이 주는 혜택을 외면하고, 맹독성 비료와 유전자 조작 작물만 찍어냈습니다.<br><br>마을 반경 3km 토양은 영영 썩어버렸으며,<br>당신은 배상금을 감당하지 못해 코퍼레이션의 하청 노동자로 남은 여생을 보내야 합니다.";
        } else if (this.money >= 10000 && totalPollution === 0) {
            endTitle.innerText = "🏆 신화: 유기농 대지주 (TRUE END)";
            endTitle.style.color = "#fff";
            endTitle.style.textShadow = "0 0 20px #f4a261";
            endDesc.innerHTML = "30일간 단 한 구역의 오염도 허락하지 않고 자연과 공존하는 위대한 생태 농법을 일궈냈습니다!<br><br>자산은 넘치고 주변 이웃들은 당신을 전설적인 영농 명장으로 존경합니다.<br>시골 마을의 진정한 평화가 도래했습니다!";
        } else {
            endTitle.innerText = "👨‍🌾 평범한 시골 촌장 (NORMAL END)";
            endTitle.style.color = "#a8dadc";
            endDesc.innerHTML = "도시에 지쳐 내려온 당신의 짧은 30일 체험이 종료되었습니다.<br><br>적당한 자산과 적당히 지저분해진 땅도 남았지만, 결국 그 평범함 속에서 잔잔한 여생을 이어가기로 결심합니다.";
        }
    }
}


// --- 4. 작물 객체의 실시간 생장 (Crop) ---
class Crop {
    constructor(uiElement) {
        this.ui = uiElement;
        this.pollution = 0; 
        this.reset();
    }

    reset() {
        this.isPlanted = false;
        this.type = null;
        this.growthLevel = 0;
        this.render();
    }

    seed(seedId) {
        this.isPlanted = true;
        this.type = seedId;
        this.growthLevel = 0;
        logger.log(`밭에 ${SEED_DATA[seedId].name} 파종 (오염누적 위험).`);
        this.render();
    }

    growTick(secTick) {
        if (!this.isPlanted || this.growthLevel >= 100) return;

        let scData = SEED_DATA[this.type];
        let growthPerSec = 100 / scData.growSecs;

        if (gm.weather === "Heatwave") growthPerSec *= 0.5; 
        if (gm.weather === "Rain") growthPerSec *= 1.5; 
        
        if (this.pollution > 40) growthPerSec *= 0.3; 
        if (this.pollution > 80) return; 

        if (scData.isGMO) {
            this.pollution += 2.0 * secTick; // 파종 기간 내내 오염도 방출
        }

        this.growthLevel += growthPerSec * secTick;
        if (this.growthLevel >= 100) {
            this.growthLevel = 100;
            this.render();
        } else {
             this.render();
        }
    }

    render() {
        if (this.pollution > 80) {
            this.ui.style.background = "#2a1e1b";
            this.ui.style.border = "4px inset #4a3f35";
            this.ui.innerHTML = "☠️<br><small style='color:red;'>썩은 모래</small>";
            return;
        }

        if (this.isPlanted) {
            const dt = SEED_DATA[this.type];
            this.ui.style.backgroundColor = dt.color;
            if (this.growthLevel >= 100) {
                this.ui.innerHTML = "🌟수확가능";
                this.ui.style.boxShadow = "0 0 10px white";
            } else {
                this.ui.innerHTML = `${this.growthLevel.toFixed(1)}%`;
                this.ui.style.boxShadow = "none";
            }
        } else {
            this.ui.style.backgroundColor = ""; 
            this.ui.style.boxShadow = "none";
            this.ui.innerHTML = "";
            if (this.pollution > 0) {
                this.ui.innerHTML = `⚠️<br><small>유독가스: ${this.pollution.toFixed(1)}</small>`;
            }
        }
    }
}


// --- 5. 다이나믹 경제 시장 관리자 (MarketManager) ---
class MarketManager {
    constructor() {
        this.stockElement = document.getElementById('market-stock');
        
        document.getElementById('btn-sell-all').addEventListener('click', () => {
            let totalEarned = 0;
            for (const [key, amt] of Object.entries(gm.inventory.crops)) {
                if (amt > 0 && gm.marketPrices[key]) {
                    totalEarned += amt * gm.marketPrices[key].price;
                    gm.inventory.crops[key] = 0;
                }
            }
            if (totalEarned > 0) {
                gm.money += totalEarned;
                logger.log(`💵 폭등/폭락장을 뚫고 수확물 일괄 매각 완료! +${totalEarned}G`);
                gm.updateUI();
                gm.saveDataLocally();
            } else {
                alert("팔 수 있는 수확물이 없습니다!");
            }
        });
    }

    renderShop() {
        this.stockElement.innerHTML = "";
        
        if(!gm.marketPrices) return;

        gm.unlockedSeeds.forEach(seedId => {
            const seed = SEED_DATA[seedId];
            const tp = gm.marketPrices[seedId];
            
            // 시세 변동률을 그대로 모종 구입가에도 똑바로 반영 (최소 1G 보장)
            const currentCost = Math.max(1, Math.round(seed.cost * (1 + tp.fluct)));

            let badgeHtml = `<span class="price-flat">보합동결</span>`;
            if (tp.fluct >= 0.01) badgeHtml = `<span class="price-up">🔺 시세 폭등 (+${(tp.fluct*100).toFixed(0)}%)</span>`;
            if (tp.fluct <= -0.01) badgeHtml = `<span class="price-down">🔻 시세 대출혈 (${(tp.fluct*100).toFixed(0)}%)</span>`;

            const div = document.createElement('div');
            div.className = 'shop-item';
            div.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:1.05rem; color:#1d3557; border-bottom:1px dashed #ddd; padding-bottom:3px;">
                        <b>${seed.name}</b> (매수가: <strong style="color:#d62828;">${currentCost}</strong> G)
                    </span>
                    <span style="margin-top:5px;">수확 매도가: <strong style="font-size:1.2rem;">${tp.price}</strong> G</span>
                    <span style="font-size:0.85rem;">${badgeHtml}</span>
                </div>
                <button class="buy-btn" onclick="marketManager.buySeed('${seedId}')">종묘<br>매수</button>
            `;
            this.stockElement.appendChild(div);
        });
    }

    buySeed(seedId) {
        const seed = SEED_DATA[seedId];
        // 변동 시세 기준가 적용
        const tp = gm.marketPrices[seedId];
        const currentCost = Math.max(1, Math.round(seed.cost * (1 + tp.fluct)));

        if (gm.money >= currentCost) {
            gm.money -= currentCost;
            gm.inventory.seeds[seedId]++;
            gm.updateUI();
            gm.saveDataLocally();
        } else {
            alert(`투자는 신중히! 자본금이 부족합니다. (현재가: ${currentCost}G)`);
        }
    }

    buyTool(toolId) {
        if(toolId === "purifier") {
            const cost = 150;
            if(gm.money >= cost) {
                gm.money -= cost;
                gm.inventory.tools.purifier++;
                gm.updateUI();
                gm.saveDataLocally();
                logger.log("완벽한 안전장치, 정화 캡슐을 구매했습니다.");
            } else {
                alert("150G가 필요합니다.");
            }
        }
    }
}


// --- 6. 강력한 도구 모듈 (InteractionManager) ---
class InteractionManager {
    constructor() {
        this.currentTool = "harvest";
        this.gridSize = 25;
        this.farmContainer = document.getElementById('farm');
        this.crops = [];
        this.isDragging = false;
        
        this.initGrid();
        this.bindEvents();
    }

    initGrid() {
        for(let i=0; i<this.gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'farm-cell';
            cell.dataset.index = i;
            this.farmContainer.appendChild(cell);
            this.crops.push(new Crop(cell));
        }
    }

    updateSeedTools() {
        const c = document.getElementById('seed-tools-container');
        c.innerHTML = "";
        
        // 1. 씨앗 파종기
        for (const [key, amt] of Object.entries(gm.inventory.seeds)) {
            if (amt > 0 || gm.unlockedSeeds.includes(key)) {
                const btn = document.createElement('button');
                btn.className = `tool-btn ${this.currentTool === 'seed_'+key ? 'active':''}`;
                btn.innerText = `🌱 ${SEED_DATA[key].name} (${amt}개 보유)`;
                btn.dataset.tool = 'seed_'+key;
                
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentTool = e.target.dataset.tool;
                });
                c.appendChild(btn);
            }
        }

        // 2. 도구 (정화 캡슐)
        if(gm.inventory.tools.purifier > 0) {
            const btn = document.createElement('button');
            btn.className = `tool-btn ${this.currentTool === 'tool_purifier' ? 'active':''}`;
            btn.style.border = "3px solid #02c39a";
            btn.innerHTML = `<span style="color:#02c39a;">🟢 맹독 살균 장치 (남은 캡슐:${gm.inventory.tools.purifier})</span>`;
            btn.dataset.tool = 'tool_purifier';
            
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
            c.appendChild(btn);
        }
    }

    bindEvents() {
        document.querySelector('[data-tool="harvest"]').addEventListener('click', (e) => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.currentTool = "harvest";
        });

        this.farmContainer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; 
            if(gm.isGameOver) return;
            this.isDragging = true;
            this.applyTool(e.target);
        });
        this.farmContainer.addEventListener('mouseover', (e) => {
            if(this.isDragging) this.applyTool(e.target);
        });
        window.addEventListener('mouseup', () => { 
            if(this.isDragging) {
                this.isDragging = false;
                if (gm && !gm.isGameOver) gm.saveDataLocally(); 
            }
        });
    }

    applyTool(target) {
        if(!target.classList.contains('farm-cell')) return;
        const idx = parseInt(target.dataset.index);
        const crop = this.crops[idx];

        if (this.currentTool === "harvest") {
            if (crop.isPlanted && crop.growthLevel >= 100) {
                gm.inventory.crops[crop.type]++;
                // 작물을 거둘 때 뿌리가 썩으면서 오염대폭발
                if (SEED_DATA[crop.type].isGMO) crop.pollution += 30; 
                crop.reset();
                gm.updateUI();
            }
        } 
        else if (this.currentTool.startsWith("seed_")) {
            const seedId = this.currentTool.split('_')[1];
            if (!crop.isPlanted && crop.pollution <= 80) {
                if (gm.inventory.seeds[seedId] > 0) {
                    gm.inventory.seeds[seedId]--;
                    crop.seed(seedId);
                    gm.updateUI();
                }
            }
        }
        else if (this.currentTool === "tool_purifier") {
            if (crop.pollution > 0) {
                if (gm.inventory.tools.purifier > 0) {
                    gm.inventory.tools.purifier--;
                    crop.pollution = 0; // 정화 완료!
                    crop.render();
                    gm.updateUI();
                }
            }
        }
    }
}


// 글로벌 부팅
let gm, dialogueManager, marketManager, interactionManager;
window.onload = () => {
    dialogueManager = new DialogueManager();
    marketManager = new MarketManager();
    interactionManager = new InteractionManager();
    gm = new GameManager();
    gm.init(); 
};
