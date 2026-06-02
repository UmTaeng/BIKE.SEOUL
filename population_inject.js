(async function () {
  /* ═══════════════════════════════════════════
     서울시 주요 거점 유동인구 + 따릉이 수급 분석
     + 한강 자전거 명소
  ═══════════════════════════════════════════ */

  // 기존 레이어 정리
  if (window._popLayers) { window._popLayers.forEach(l => { try { l.remove(); } catch(e){} }); }
  window._popLayers = [];

  const POP_API_KEY = '7844717861786f6737375661737671'; // ← 여기에 유동인구 API 키 입력
  const BIKE_KEY    = '6745545472786f673339616c6e7864';

  // ── 서울시 주요 거점 121개 중 따릉이 관련 핵심 30곳 ──
  const SPOTS = [
    // 강남권
    {name:'강남역',      code:'POI009', lat:37.4979, lng:127.0276},
    {name:'홍대입구',    code:'POI011', lat:37.5572, lng:126.9246},
    {name:'신촌·이대',   code:'POI012', lat:37.5596, lng:126.9369},
    {name:'건대입구',    code:'POI010', lat:37.5403, lng:127.0698},
    {name:'왕십리',      code:'POI015', lat:37.5611, lng:127.0375},
    {name:'잠실',        code:'POI016', lat:37.5131, lng:127.1001},
    {name:'명동',        code:'POI001', lat:37.5636, lng:126.9869},
    {name:'종로·청계',   code:'POI002', lat:37.5700, lng:126.9830},
    {name:'이태원',      code:'POI005', lat:37.5343, lng:126.9944},
    {name:'서울역',      code:'POI006', lat:37.5547, lng:126.9706},
    {name:'용산',        code:'POI007', lat:37.5298, lng:126.9646},
    {name:'여의도',      code:'POI008', lat:37.5219, lng:126.9245},
    {name:'영등포',      code:'POI013', lat:37.5159, lng:126.9072},
    {name:'노원',        code:'POI017', lat:37.6547, lng:127.0564},
    {name:'신림',        code:'POI014', lat:37.4844, lng:126.9293},
  ];

  // ── 한강 자전거 명소 ──
  const HANGANG = [
    {name:'여의도 한강공원',   lat:37.5283, lng:126.9338, desc:'자전거 대여소 5개소 밀집, 한강 라이딩 최적'},
    {name:'뚝섬 한강공원',     lat:37.5311, lng:127.0668, desc:'자전거 전용도로 6km, 물놀이장 인접'},
    {name:'반포 한강공원',     lat:37.5071, lng:126.9989, desc:'달빛무지개분수, 세빛섬 인근'},
    {name:'잠실 한강공원',     lat:37.5130, lng:127.0869, desc:'롯데월드 인접, 자전거 하이킹 코스'},
    {name:'망원 한강공원',     lat:37.5555, lng:126.8973, desc:'메세나폴리스 인근, 노을 명소'},
    {name:'난지 한강공원',     lat:37.5691, lng:126.8947, desc:'캠핑장 인접, 한강 자전거길 연결'},
    {name:'광나루 한강공원',   lat:37.5477, lng:127.1073, desc:'광진교 인근, 한강 동쪽 출발점'},
    {name:'양화 한강공원',     lat:37.5438, lng:126.9033, desc:'선유도공원 연결, 한강 서쪽 핵심'},
    {name:'이촌 한강공원',     lat:37.5172, lng:126.9682, desc:'용산가족공원 인접, 한강철교 조망'},
    {name:'잠원 한강공원',     lat:37.5137, lng:127.0096, desc:'신사동 인근, 자전거 출발점'},
  ];

  function haversine(a,b,c,d){
    const R=6371000,dL=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;
    const x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dl/2)**2;
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  function cn(n){ return n.replace(/^\d+\.?\s*/,'').trim(); }

  /* ── 1. 한강 명소 마커 ── */
  HANGANG.forEach(h => {
    const icon = L.divIcon({
      className:'',
      html:`<div style="
        width:32px;height:32px;
        background:linear-gradient(135deg,#00c9ff,#4f8ef7);
        border:2px solid white;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;box-shadow:0 2px 8px rgba(0,180,255,0.6);
        cursor:pointer;">🚴</div>`,
      iconSize:[32,32], iconAnchor:[16,16]
    });
    const m = L.marker([h.lat, h.lng], {icon, zIndexOffset:500}).addTo(map);
    m.bindPopup(`
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#00c9ff">
        🚴 ${h.name}
      </div>
      <div style="font-size:12px;color:#c8ccd8;line-height:1.6">${h.desc}</div>
      <div style="font-size:11px;color:#8a8fa8;margin-top:6px;padding-top:6px;
                  border-top:1px solid rgba(255,255,255,0.1)">
        📍 한강 자전거 명소
      </div>`
    );
    m.bindTooltip(h.name, {direction:'top', offset:[0,-18]});
    window._popLayers.push(m);
  });

  /* ── 2. 유동인구 + 따릉이 수급 분석 ── */
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'position:absolute;top:80px;left:50%;transform:translateX(-50%);z-index:2000;background:rgba(15,17,23,0.92);color:#4f8ef7;font-family:Noto Sans KR,sans-serif;font-size:12px;padding:8px 16px;border-radius:20px;border:1px solid rgba(79,142,247,0.4);';
  statusDiv.textContent = '🔄 유동인구 데이터 불러오는 중...';
  document.getElementById('map').appendChild(statusDiv);
  window._popLayers.push({remove:()=>statusDiv.remove()});

  let loaded = 0;
  for (const spot of SPOTS) {
    try {
      const url = `https://openapi.seoul.go.kr:8088/${POP_API_KEY}/json/citydata_ppltn/1/5/${encodeURIComponent(spot.name)}`;
      const data = await fetch(url).then(r => r.json());
      const ppl  = data['SeoulRtd.citydata_ppltn']?.[0];
      if (!ppl) continue;

      const level     = ppl.AREA_CONGEST_LVL || '알수없음'; // 여유/보통/약간붐빔/붐빔
      const minPop    = parseInt(ppl.AREA_PPLTN_MIN || 0);
      const maxPop    = parseInt(ppl.AREA_PPLTN_MAX || 0);
      const avgPop    = Math.round((minPop + maxPop) / 2);

      // 반경 500m 내 따릉이 대여소
      const nearby    = STATIONS.filter(s => haversine(spot.lat, spot.lng, s.lat, s.lng) <= 500);
      const totalBike = nearby.reduce((a,s) => a+s.p, 0);
      const shortage  = nearby.filter(s => s.p < 5).length;

      // 수급 지수: 유동인구 1000명당 이용 가능 자전거 수
      const supplyIdx = avgPop > 0 ? (totalBike / avgPop * 1000).toFixed(1) : 'N/A';

      // 붐빔 수준에 따른 색상
      const congColor = level.includes('붐빔') ? '#e8394d' :
                        level.includes('약간')  ? '#f5a623' :
                        level.includes('보통')  ? '#4f8ef7' : '#00c471';

      // 버블 크기 (유동인구 기준)
      const bubbleR = Math.max(20, Math.min(50, avgPop / 1000));

      const icon = L.divIcon({
        className:'',
        html:`<div style="
          width:${bubbleR*2}px;height:${bubbleR*2}px;
          background:${congColor}22;
          border:2px solid ${congColor};
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:700;color:${congColor};
          box-shadow:0 0 12px ${congColor}44;
          cursor:pointer;
          font-family:'Noto Sans KR',sans-serif;">
          ${(avgPop/10000).toFixed(1)}만
        </div>`,
        iconSize:[bubbleR*2, bubbleR*2],
        iconAnchor:[bubbleR, bubbleR]
      });

      const marker = L.marker([spot.lat, spot.lng], {icon, zIndexOffset:1000}).addTo(map);

      const urgency = shortage > 2 ? `<div style="color:#e8394d;font-weight:700;margin-top:6px">⚠ 자전거 부족 긴급 재배치 필요</div>` :
                      shortage > 0 ? `<div style="color:#f5a623;margin-top:6px">⚡ 자전거 소폭 부족</div>` :
                                     `<div style="color:#00c471;margin-top:6px">✓ 공급 안정</div>`;

      marker.bindPopup(`
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">${spot.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:8px">
          <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px;text-align:center">
            <div style="color:#8a8fa8;font-size:10px;margin-bottom:2px">혼잡도</div>
            <div style="color:${congColor};font-weight:700">${level}</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px;text-align:center">
            <div style="color:#8a8fa8;font-size:10px;margin-bottom:2px">유동인구</div>
            <div style="color:#f0f0f0;font-weight:700">${avgPop.toLocaleString()}명</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px;text-align:center">
            <div style="color:#8a8fa8;font-size:10px;margin-bottom:2px">반경500m 대여소</div>
            <div style="color:#4f8ef7;font-weight:700">${nearby.length}개소</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px;text-align:center">
            <div style="color:#8a8fa8;font-size:10px;margin-bottom:2px">이용가능 자전거</div>
            <div style="color:#00c471;font-weight:700">${totalBike}대</div>
          </div>
        </div>
        <div style="font-size:11px;color:#8a8fa8;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px">
          수급지수(1000명당): <b style="color:#f0f0f0">${supplyIdx}대</b>
        </div>
        ${urgency}`
      );
      marker.bindTooltip(`${spot.name} (${level})`, {direction:'top', offset:[0,-bubbleR]});
      window._popLayers.push(marker);

      loaded++;
      statusDiv.textContent = `🔄 유동인구 로딩 중... (${loaded}/${SPOTS.length})`;
    } catch(e) { console.warn(spot.name, e); }
  }

  statusDiv.textContent = `✅ 주요 거점 ${loaded}곳 유동인구 + 한강 명소 ${HANGANG.length}곳 표시 완료`;
  setTimeout(() => { try { statusDiv.remove(); } catch(e){} }, 3000);

  // 범례
  const legend = document.createElement('div');
  legend.style.cssText = 'position:absolute;bottom:24px;left:16px;z-index:1000;background:rgba(15,17,23,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;color:#f0f0f0;font-family:Noto Sans KR,sans-serif;font-size:12px;min-width:180px;';
  legend.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;color:#4f8ef7">📊 거점 유동인구 버블</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;background:#e8394d;border-radius:50%"></div>
      <span style="color:#8a8fa8">붐빔 (즉시 재배치 필요)</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;background:#f5a623;border-radius:50%"></div>
      <span style="color:#8a8fa8">약간 붐빔</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <div style="width:10px;height:10px;background:#00c471;border-radius:50%"></div>
      <span style="color:#8a8fa8">여유 / 보통</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">
      <span style="font-size:16px">🚴</span>
      <span style="color:#8a8fa8">한강 자전거 명소</span>
    </div>
    <div style="font-size:11px;color:#8a8fa8">버블 클릭 → 수급 상세 정보</div>`;
  document.getElementById('map').appendChild(legend);
  window._popLayers.push({remove:()=>legend.remove()});

  console.log(`✅ 유동인구 ${loaded}개소 + 한강명소 ${HANGANG.length}개 완료`);
})();
