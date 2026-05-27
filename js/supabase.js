// js/supabase.js

// 1. Supabase에서 발급받은 내 프로젝트 URL과 API 키를 여기에 붙여넣습니다.
const SUPABASE_URL = 'https://rtkrecjtttuqsfgmvbxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0a3JlY2p0dHR1cXNmZ212YnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjU2MDksImV4cCI6MjA5NTQwMTYwOX0.uedzrpU7d2zJF3otU7Yrp_6RO-Hla-bA3ARXxSUl4lU';
// 2. Supabase 클라이언트 초기화 
// (앞으로 자바스크립트에서 이 'supabase'라는 변수를 이용해 DB에 글을 쓰고 읽게 됩니다.)
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 디스코드 로그인 및 인증 상태 관리
// ==========================================

// 1. 디스코드 로그인 실행 함수
async function signInWithDiscord() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
    });
    if (error) console.error("로그인 에러:", error.message);
}

// 2. 로그아웃 실행 함수
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("로그아웃 에러:", error.message);
    } else {
        window.location.reload(); // 로그아웃 성공 시 화면 새로고침
    }
}

// 3. 화면이 로드될 때 로그인 상태를 확인하고 버튼 모양 바꾸기
document.addEventListener('DOMContentLoaded', async () => {
    // 헤더에 있는 로그인 버튼 요소 찾기
    const loginBtn = document.querySelector('.login-btn');
    if (!loginBtn) return;

    // Supabase에서 현재 유저의 세션(로그인 정보) 가져오기
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // [로그인 상태일 때]
        const user = session.user;
        // 디스코드 닉네임 추출
        const discordName = user.user_metadata.custom_claims?.global_name || user.user_metadata.full_name || '유저';
        
        // 버튼 텍스트를 닉네임으로 바꾸고 색상을 약간 변경
        loginBtn.innerHTML = `<i class="fa-brands fa-discord"></i> ${discordName} (로그아웃)`;
        loginBtn.style.color = "#deff9a"; 
        
        // 버튼을 누르면 로그아웃 함수가 실행되도록 연결
        loginBtn.onclick = signOut; 
    } else {
        // [로그아웃 상태일 때]
        loginBtn.innerHTML = `<i class="fa-brands fa-discord"></i> 로그인`;
        
        // 버튼을 누르면 로그인 함수가 실행되도록 연결
        loginBtn.onclick = signInWithDiscord;
    }
});
