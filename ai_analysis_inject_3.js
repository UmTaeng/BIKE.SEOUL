(function () {
  /* ════════════════════════════════════════════
     1. 레이아웃 분리 – 사이드바를 위/아래 두 영역으로
        위  : 기존 따릉이 현황 (실시간 갱신 영역)
        아래 : AI 분석 패널 (갱신과 무관하게 유지)
  ════════════════════════════════════════════ */
  if (!document.getElementById('ai-panel')) {
    // station-list 높이 제한 (TOP 8만 보이도록)
    const sl = document.getElementById('station-list');
    sl.style.cssText = 'overflow-y:auto;padding:0 16px 8px;max-height:220px;flex-shrink:0;';

    // AI 패널 추가 (station-list 다음에 삽입)
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.style.cssText = [
      'flex:1',
      'overflow-y:auto',
      'border-top:1px solid rgba(255,255,255,0.08)',
      'padding:0 16px 16px',
      'display:flex',
      'flex-direction:column',
    ].join(';');
    panel.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--muted,#8a8fa8);
                  letter-spacing:0.5px;padding:12px 0 8px">
        <span style="color:#4f8ef7">🤖</span> AI 실시간 재배치 분석
      </div>
      <div id="ai-text"
           style="font-size:12px;line-height:1.85;color:#c8ccd8;
                  white-space:pre-wrap;word-break:keep-all;flex:1"></div>
      <span id="ai-cur"
            style="display:none;width:7px;height:13px;background:#4f8ef7;
                   vertical-align:middle;border-radius:1px;
                   animation:pulse 0.7s infinite"></span>
      <div id="ai-route-info"
           style="margin-top:8px;font-size:11px;color:#8a8fa8;display:none"></div>
      <button id="ai-rerun-btn"
              style="display:none;margin-top:10px;width:100%;
                     background:rgba(79,142,247,0.12);
                     border:1px solid rgba(79,142,247,0.35);
                     color:#4f8ef7;border-radius:8px;padding:7px;
                     cursor:pointer;font-size:12px;font-weight:600;
                     font-family:'Noto Sans KR',sans-serif">
        🔄 다시 분석
      </button>`;
    sl.parentNode.appendChild(panel);
  }

  /* ════════════════════════════════════════════
     2. 핵심 유틸
  ════════════════════════════════════════════ */
  function cn(n) { return n.replace(/^\d+\.?\s*/, '').trim(); }
  function hav(a, b, c, d) {
    const R = 6371000,
          dL = (c - a) * Math.PI / 180,
          dl = (d - b) * Math.PI / 180,
          x  = Math.sin(dL/2)**2
             + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dl/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ════════════════════════════════════════════
     3. 분석 메인 함수 (window._runAI 로 등록 → 버튼 재사용)
  ════════════════════════════════════════════ */
  window._runAI = async function () {
    const st = (typeof STATIONS !== 'undefined') ? STATIONS : [];
    if (!st.length) { alert('대여소 데이터 없음. 잠시 후 다시 시도해주세요.'); return; }

    // 기존 경로 레이어 제거
    if (window._rb) { window._rb.forEach(l => { try { l.remove(); } catch(e) {} }); }
    window._rb = [];

    // UI 초기화
    const aiText      = document.getElementById('ai-text');
    const aiCur       = document.getElementById('ai-cur');
    const aiRouteInfo = document.getElementById('ai-route-info');
    const aiRerunBtn  = document.getElementById('ai-rerun-btn');

    aiText.textContent      = '';
    aiCur.style.display     = 'inline-block';
    aiRouteInfo.style.display = 'none';
    aiRerunBtn.style.display  = 'none';

    /* ── 실 데이터 계산 ── */
    const total       = st.length;
    const deficitList = st.filter(s => s.p < 5).sort((a, b) => a.p - b.p);
    const surplusList = st.filter(s => s.p >= 20).sort((a, b) => b.p - a.p);
    const defCnt      = deficitList.length;
    const surCnt      = surplusList.length;
    const defPct      = ((defCnt / total) * 100).toFixed(1);

    const avgRate  = st.reduce((a, s) => a + (s.r > 0 ? s.p / s.r : 0), 0) / total;
    const variance = st.reduce((a, s) => a + (s.r > 0 ? Math.pow(s.p/s.r - avgRate, 2) : 0), 0) / total;
    const effScore    = Math.max(0, Math.round(100 - variance * 300));
    const effImproved = Math.min(100, effScore + Math.round(defCnt * 0.18));

    const totalMovable = surplusList.reduce((a, s) => a + Math.max(0, s.p - Math.ceil(s.r*0.4)), 0);
    const top3def = deficitList.slice(0, 3).map(s => `${cn(s.n)}(${s.p}대)`).join(', ');
    const top3sur = surplusList.slice(0, 3).map(s => `${cn(s.n)}(${s.p}대)`).join(', ');

    const h       = new Date().getHours();
    const timeCtx = h >= 7  && h <= 9  ? '출근 시간대 수요 급증 구간'  :
                    h >= 12 && h <= 14 ? '점심 이동 수요 집중 구간'    :
                    h >= 17 && h <= 20 ? '퇴근 시간대 혼잡 구간'       : '일반 운영 시간대';

    /* ── 분석 텍스트 ── */
    const text =
`[ 현황 진단 ]
현재 서울시 따릉이 ${total.toLocaleString()}개소 중 ${defCnt}개소(${defPct}%)에서 공급 위기 상태가 감지되었습니다. 전체 공급 효율 지수는 ${effScore}점으로, 최적 재배치 시 ${effImproved}점까지 개선 가능합니다.

[ 긴급 재배치 대상 ]
자전거 부족 심각 대여소: ${top3def}.
즉시 공급 가능 과잉 대여소: ${top3sur}.
현재 ${timeCtx}로, 수요-공급 불균형 심화 가능성이 높습니다.

[ 재배치 효과 예측 ]
AI 추천 루트 10개 실행 시 부족 대여소 최대 ${Math.min(defCnt, 10)}개소 즉시 해소, 총 ${Math.min(totalMovable, 80)}대 이동 가능. 시민 불편 지수 약 ${Math.round(defCnt / total * 100 * 0.6)}% 감소 효과가 예측됩니다.`;

    /* ── 타이핑 애니메이션 ── */
    let i = 0;
    while (i < text.length) {
      const step = text[i] === '\n' ? 1 : 3;
      aiText.textContent += text.slice(i, i + step);
      i += step;
      document.getElementById('ai-panel').scrollTop = 9999;
      await sleep(text[i] === '\n' ? 60 : 14);
    }
    aiCur.style.display = 'none';

    /* ── TOP 10 매칭 ── */
    const used  = new Set();
    const pairs = [];
    deficitList.forEach(d => {
      let best = null, bd = Infinity;
      surplusList.forEach(s => {
        if (used.has(s.n)) return;
        const dd = hav(d.lat, d.lng, s.lat, s.lng);
        if (dd < bd) { bd = dd; best = s; }
      });
      if (best && bd < 8000) {
        used.add(best.n);
        const bikes = Math.max(1, Math.min(
          best.p - Math.ceil(best.r * 0.4),
          Math.ceil(best.r * 0.4) - d.p
        ));
        pairs.push({ from: best, to: d, dist: Math.round(bd), bikes });
      }
    });
    const top10 = pairs.sort((a, b) => a.dist - b.dist).slice(0, 10);

    /* ── OSRM 도보 경로 ── */
    aiRouteInfo.style.display = 'block';
    aiRouteInfo.textContent   = '🗺 실제 도보 경로 계산 중...';

    let drawn = 0;
    for (const p of top10) {
      try {
        // foot = 도보 기준 (골목·보행로 포함)
        const url  = `https://router.project-osrm.org/route/v1/foot/${p.from.lng},${p.from.lat};${p.to.lng},${p.to.lat}?overview=full&geometries=geojson`;
        const data = await fetch(url).then(r => r.json());

        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          const dist   = Math.round(data.routes[0].distance);
          const dur    = Math.round(data.routes[0].duration / 60);

          const line = L.polyline(coords, { color: '#4f8ef7', weight: 4, opacity: 0.88 }).addTo(map);

          const fi = L.divIcon({ className:'',
            html:`<div style="width:13px;height:13px;background:#4f8ef7;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(79,142,247,.9)"></div>`,
            iconSize:[13,13], iconAnchor:[6,6] });
          const ti = L.divIcon({ className:'',
            html:`<div style="width:13px;height:13px;background:#e8394d;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(232,57,77,.9)"></div>`,
            iconSize:[13,13], iconAnchor:[6,6] });

          const mf = L.marker([p.from.lat, p.from.lng], { icon: fi }).addTo(map);
          const mt = L.marker([p.to.lat,   p.to.lng  ], { icon: ti }).addTo(map);

          const popup = `
            <div style="font-size:13px;font-weight:700;color:#4f8ef7;margin-bottom:8px">🤖 AI 추천 재배치 루트</div>
            <div style="font-size:12px;margin-bottom:3px">
              📤 <b style="color:#4f8ef7">${cn(p.from.n)}</b>
              <span style="color:#8a8fa8"> (현재 ${p.from.p}대)</span></div>
            <div style="font-size:12px;margin-bottom:8px">
              📥 <b style="color:#e8394d">${cn(p.to.n)}</b>
              <span style="color:#8a8fa8"> (현재 ${p.to.p}대)</span></div>
            <div style="display:flex;gap:14px;font-size:11px;color:#8a8fa8;
                        border-top:1px solid rgba(255,255,255,.1);padding-top:6px">
              <span>🚲 <b style="color:#00c471">${p.bikes}대</b></span>
              <span>📍 <b style="color:#f0f0f0">${dist}m</b></span>
              <span>⏱ <b style="color:#f0f0f0">${dur}분</b></span>
            </div>`;

          line.bindPopup(popup); mf.bindPopup(popup); mt.bindPopup(popup);
          window._rb.push(line, mf, mt);
          drawn++;
          aiRouteInfo.textContent = `🗺 도보 경로 계산 중... (${drawn}/${top10.length})`;
        }
      } catch (e) { console.warn('OSRM 오류:', e); }
    }

    aiRouteInfo.innerHTML =
      `✅ AI 추천 루트 <b style="color:#4f8ef7">${drawn}개</b> 표시 완료 · 경로 클릭 → 상세 정보`;

    /* ── 다시 분석 버튼 활성화 ── */
    aiRerunBtn.style.display = 'block';
    aiRerunBtn.onclick = () => window._runAI();

    console.log(`✅ AI 분석 완료 | 루트 ${drawn}개 | 부족 ${defCnt}개소 | 효율 ${effScore}→${effImproved}점`);
  };

  // 최초 실행
  window._runAI();
})();
