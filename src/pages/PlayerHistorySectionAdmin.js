import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../App';
import * as XLSX from 'xlsx';
import eyeIcon from '../icons/eye_icon.png';
import eyeOffIcon from '../icons/eye_off_icon.png';
import * as PHS from './PlayerHistorySectionCss';

const PlayerHistorySectionAdmin = () => {
  // 상태 정의
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [years, setYears] = useState(['2022', '2023', '2024', '2025', '2026']);
  const [historyData, setHistoryData] = useState([]);
  const [playerData, setPlayerData] = useState({
    name: '', goals: '', assists: '', cleanSheets: '', matches: '',
    win: '', draw: '', lose: '', personalPoints: '', momScore: '', winRate: '',
    momTop3Count: '', momTop8Count: ''
  });
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({
    goals: '', assists: '', cleanSheets: '', matches: '',
    win: '', draw: '', lose: '', personalPoints: '', momScore: '', winRate: '',
    momTop3Count: '', momTop8Count: ''
  });

  // 로그 추가 헬퍼
  const addLog = (msg) => {
    const ts = new Date().toLocaleString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  // 연도 추가 핸들러
  const handleAddYear = () => {
    const latestYear = Math.max(...years.map(Number));
    const newYear = (latestYear + 1).toString();
    if (years.includes(newYear)) {
      alert('이미 존재하는 연도입니다.');
      return;
    }
    setYears((prev) => [...prev, newYear].sort((a, b) => a - b));
    setSelectedYear(newYear);
    addLog(`연도 추가: ${newYear}`);
  };

  // 비밀번호 입력/확인
  const handlePasswordChange = (e) => setPassword(e.target.value);
  const handlePasswordKeyEvent = (e) => setCapsLockOn(e.getModifierState('CapsLock'));
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === 'alves') {
      setIsAuthenticated(true);
      addLog('관리자 로그인 성공');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
      addLog('관리자 로그인 실패');
    }
  };
  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  // 데이터 조회
  const fetchHistory = async (year) => {
    try {
      const playersRef = collection(db, 'players');
      const playersSnapshot = await getDocs(playersRef);
      const data = [];

      for (const playerDoc of playersSnapshot.docs) {
        const playerId = playerDoc.id;
        const historyRef = doc(db, 'players', playerId, 'history', year);
        const historyDoc = await getDoc(historyRef);

        if (historyDoc.exists()) {
          data.push({
            id: playerId,
            name: playerId,
            ...historyDoc.data(),
            updatedAt: historyDoc.data().updatedAt
          });
        }
      }

      data.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setHistoryData(data);
      addLog(`연도 ${year} 데이터 조회 (${data.length}명)`);
    } catch (err) {
      console.error('Error fetching history:', err);
      setUploadMessage('데이터를 가져오는 중 오류가 발생했습니다.');
      addLog(`데이터 조회 오류: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory(selectedYear);
    }
  }, [isAuthenticated, selectedYear]);

  // 선수 데이터 입력 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPlayerData({ ...playerData, [name]: value });
  };

  // 선수 데이터 추가/업데이트
  const handleSubmitPlayerData = async (e) => {
    e.preventDefault();
    const { name, goals, assists, cleanSheets, matches, win, draw, lose, personalPoints, momScore, winRate, momTop3Count, momTop8Count } = playerData;

    if (!name || !selectedYear || isNaN(goals) || isNaN(assists) || isNaN(cleanSheets) || isNaN(matches) ||
      isNaN(win) || isNaN(draw) || isNaN(lose) || isNaN(personalPoints) || isNaN(momScore) || isNaN(winRate) ||
      isNaN(momTop3Count) || isNaN(momTop8Count)) {
      return alert('모든 필드를 올바르게 입력해주세요.');
    }

    const historyRef = doc(db, 'players', name, 'history', selectedYear);
    const historyDoc = await getDoc(historyRef);

    try {
      await setDoc(historyRef, {
        goals: Number(goals),
        assists: Number(assists),
        cleanSheets: Number(cleanSheets),
        matches: Number(matches),
        win: Number(win),
        draw: Number(draw),
        lose: Number(lose),
        personalPoints: Number(personalPoints),
        momScore: Number(momScore),
        winRate: Number(winRate),
        momTop3Count: Number(momTop3Count),
        momTop8Count: Number(momTop8Count),
        updatedAt: serverTimestamp()
      });
      alert(historyDoc.exists() ? '선수 기록이 업데이트되었습니다.' : '선수 기록이 추가되었습니다.');
      addLog(`선수 기록 ${historyDoc.exists() ? '업데이트' : '추가'}: ${name} (${selectedYear}년)`);
      setPlayerData({
        name: '', goals: '', assists: '', cleanSheets: '', matches: '',
        win: '', draw: '', lose: '', personalPoints: '', momScore: '', winRate: '',
        momTop3Count: '', momTop8Count: ''
      });
      fetchHistory(selectedYear);
    } catch (err) {
      console.error(err);
      alert('데이터 저장 중 오류 발생');
      addLog(`오류: ${err.message}`);
    }
  };

  // 엑셀 업로드 핸들러
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setShowExcelPreview(false);
  };

  const handleFileUpload = async () => {
    if (!file) return alert('파일을 선택해주세요.');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      setPreviewData(json);

      try {
        for (const row of json) {
          if (!row.name) continue;
          const historyRef = doc(db, 'players', row.name, 'history', selectedYear);
          await setDoc(historyRef, {
            goals: Number(row.goals) || 0,
            assists: Number(row.assists) || 0,
            cleanSheets: Number(row.cleanSheets) || 0,
            matches: Number(row.matches) || 0,
            win: Number(row.win) || 0,
            draw: Number(row.draw) || 0,
            lose: Number(row.lose) || 0,
            personalPoints: Number(row.personalPoints) || 0,
            momScore: Number(row.momScore) || 0,
            winRate: Number(row.winRate) || 0,
            momTop3Count: Number(row.top3) || 0,
            momTop8Count: Number(row.top8) || 0,
            updatedAt: serverTimestamp()
          });
          addLog(`엑셀 처리: ${row.name} (${selectedYear}년)`);
        }
        setUploadMessage('엑셀 파일 업로드 완료');
        fetchHistory(selectedYear);
      } catch (err) {
        console.error(err);
        setUploadMessage('엑셀 업로드 오류');
        addLog(`엑셀 오류: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePreviewExcel = () => {
    if (!file) return alert('파일을 선택해주세요.');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      setPreviewData(XLSX.utils.sheet_to_json(ws));
      setShowExcelPreview(true);
    };
    reader.readAsBinaryString(file);
  };

  // 엑셀 템플릿 다운로드
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        name: 'Player1', goals: 5, assists: 3, cleanSheets: 0, matches: 10,
        win: 6, draw: 2, lose: 2, personalPoints: 20, momScore: 800, winRate: 60,
        top3: 2, top8: 5
      },
      {
        name: 'Player2', goals: 2, assists: 1, cleanSheets: 5, matches: 8,
        win: 4, draw: 3, lose: 1, personalPoints: 15, momScore: 700, winRate: 50,
        top3: 1, top8: 3
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `history_template_${selectedYear}.xlsx`);
    addLog(`엑셀 양식 다운로드 (${selectedYear}년)`);
  };

  // 편집 모드 핸들러
  const handleEdit = (record) => {
    setEditingId(record.id);
    setEditingData({
      goals: record.goals,
      assists: record.assists,
      cleanSheets: record.cleanSheets,
      matches: record.matches,
      win: record.win,
      draw: record.draw,
      lose: record.lose,
      personalPoints: record.personalPoints,
      momScore: record.momScore,
      winRate: record.winRate,
      momTop3Count: record.momTop3Count,
      momTop8Count: record.momTop8Count
    });
    addLog(`편집 모드: ${record.name} (${selectedYear}년)`);
  };

  const handleEditingDataChange = (e) => {
    const { name, value } = e.target;
    setEditingData({ ...editingData, [name]: value });
  };

  const handleSaveEdit = async (id) => {
    try {
      const historyRef = doc(db, 'players', id, 'history', selectedYear);
      await setDoc(historyRef, {
        goals: Number(editingData.goals),
        assists: Number(editingData.assists),
        cleanSheets: Number(editingData.cleanSheets),
        matches: Number(editingData.matches),
        win: Number(editingData.win),
        draw: Number(editingData.draw),
        lose: Number(editingData.lose),
        personalPoints: Number(editingData.personalPoints),
        momScore: Number(editingData.momScore),
        winRate: Number(editingData.winRate),
        momTop3Count: Number(editingData.momTop3Count),
        momTop8Count: Number(editingData.momTop8Count),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
      setEditingData({
        goals: '', assists: '', cleanSheets: '', matches: '',
        win: '', draw: '', lose: '', personalPoints: '', momScore: '', winRate: '',
        momTop3Count: '', momTop8Count: ''
      });
      fetchHistory(selectedYear);
      addLog(`수정 저장: ${id} (${selectedYear}년)`);
    } catch (err) {
      console.error(err);
      alert('수정 오류');
      addLog(`수정 오류(${id}): ${err.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({
      goals: '', assists: '', cleanSheets: '', matches: '',
      win: '', draw: '', lose: '', personalPoints: '', momScore: '', winRate: '',
      momTop3Count: '', momTop8Count: ''
    });
    addLog('편집 취소');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'players', id, 'history', selectedYear));
      fetchHistory(selectedYear);
      addLog(`삭제: ${id} (${selectedYear}년)`);
    } catch (err) {
      console.error(err);
      alert('삭제 오류');
      addLog(`삭제 오류(${id}): ${err.message}`);
    }
  };

  return (
    <PHS.Container>
      {!isAuthenticated ? (
        <form onSubmit={handlePasswordSubmit}>
          <PHS.Header>관리자 페이지 접근</PHS.Header>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PHS.Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              onKeyDown={handlePasswordKeyEvent}
              onKeyUp={handlePasswordKeyEvent}
              placeholder="비밀번호 입력"
            />
            <PHS.TogglePasswordVisibility
              src={showPassword ? eyeIcon : eyeOffIcon}
              alt="Toggle Password Visibility"
              onClick={toggleShowPassword}
            />
          </div>
          {capsLockOn && <PHS.ErrorMessage>Caps Lock이 켜져 있습니다.</PHS.ErrorMessage>}
          <PHS.Button type="submit">확인</PHS.Button>
        </form>
      ) : (
        <PHS.AdminContent>
          <PHS.MainArea>
            <PHS.Header>연도별 선수 기록 관리</PHS.Header>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <PHS.Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </PHS.Select>
              <PHS.Button onClick={handleAddYear}>연도 추가</PHS.Button>
            </div>
            <div style={{ textAlign: 'right', fontSize: '14px', color: '#4e5968', marginBottom: '16px' }}>
              {historyData[0]?.updatedAt
                ? `최근 업데이트: ${new Date(historyData[0].updatedAt.seconds * 1000).toLocaleString('ko-KR')}`
                : '최근 업데이트 정보 없음'}
            </div>

            {/* 엑셀 업로드 */}
            <h3>엑셀 파일 업로드 ({selectedYear}년)</h3>
            <PHS.Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <PHS.Button onClick={handleFileUpload}>업로드</PHS.Button>
              <PHS.Button onClick={handlePreviewExcel}>미리보기</PHS.Button>
            </div>
            {uploadMessage && <PHS.UploadMessage success={uploadMessage.includes('완료')}>{uploadMessage}</PHS.UploadMessage>}
            {showExcelPreview && previewData.length > 0 && (
              <PHS.PreviewContainer>
                <p><strong>엑셀 미리보기 ({selectedYear}년)</strong></p>
                <PHS.Table>
                  <thead>
                    <tr>
                      <PHS.Th>선수 이름</PHS.Th>
                      <PHS.Th>득점</PHS.Th>
                      <PHS.Th>어시스트</PHS.Th>
                      <PHS.Th>클린시트</PHS.Th>
                      <PHS.Th>출장수</PHS.Th>
                      <PHS.Th>승</PHS.Th>
                      <PHS.Th>무</PHS.Th>
                      <PHS.Th>패</PHS.Th>
                      <PHS.Th>승률</PHS.Th>
                      <PHS.Th>개인승점</PHS.Th>
                      <PHS.Th>MOM점수</PHS.Th>
                      <PHS.Th>top3</PHS.Th>
                      <PHS.Th>top8</PHS.Th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((r, i) => (
                      <tr key={i}>
                        <PHS.Td>{r.name}</PHS.Td>
                        <PHS.Td>{r.goals}</PHS.Td>
                        <PHS.Td>{r.assists}</PHS.Td>
                        <PHS.Td>{r.cleanSheets}</PHS.Td>
                        <PHS.Td>{r.matches}</PHS.Td>
                        <PHS.Td>{r.win}</PHS.Td>
                        <PHS.Td>{r.draw}</PHS.Td>
                        <PHS.Td>{r.lose}</PHS.Td>
                        <PHS.Td>{r.winRate}</PHS.Td>
                        <PHS.Td>{r.personalPoints}</PHS.Td>
                        <PHS.Td>{r.momScore}</PHS.Td>
                        <PHS.Td>{r.top3}</PHS.Td>
                        <PHS.Td>{r.top8}</PHS.Td>
                      </tr>
                    ))}
                  </tbody>
                </PHS.Table>
              </PHS.PreviewContainer>
            )}

            <hr />

            {/* 개별 입력 폼 */}
            <PHS.Form onSubmit={handleSubmitPlayerData}>
              <h3>선수 기록 추가/수정 ({selectedYear}년)</h3>
              <PHS.Input type="text" name="name" value={playerData.name} onChange={handleInputChange} placeholder="선수 이름" />
              <PHS.Input type="number" name="goals" value={playerData.goals} onChange={handleInputChange} placeholder="득점" />
              <PHS.Input type="number" name="assists" value={playerData.assists} onChange={handleInputChange} placeholder="어시스트" />
              <PHS.Input type="number" name="cleanSheets" value={playerData.cleanSheets} onChange={handleInputChange} placeholder="클린시트" />
              <PHS.Input type="number" name="matches" value={playerData.matches} onChange={handleInputChange} placeholder="출장수" />
              <PHS.Input type="number" name="win" value={playerData.win} onChange={handleInputChange} placeholder="승" />
              <PHS.Input type="number" name="draw" value={playerData.draw} onChange={handleInputChange} placeholder="무" />
              <PHS.Input type="number" name="lose" value={playerData.lose} onChange={handleInputChange} placeholder="패" />
              <PHS.Input type="number" name="winRate" value={playerData.winRate} onChange={handleInputChange} placeholder="승률" />
              <PHS.Input type="number" name="personalPoints" value={playerData.personalPoints} onChange={handleInputChange} placeholder="개인승점" />
              <PHS.Input type="number" name="momScore" value={playerData.momScore} onChange={handleInputChange} placeholder="MOM점수" />
              <PHS.Input type="number" name="momTop3Count" value={playerData.momTop3Count} onChange={handleInputChange} placeholder="MOM TOP 3 횟수" />
              <PHS.Input type="number" name="momTop8Count" value={playerData.momTop8Count} onChange={handleInputChange} placeholder="MOM TOP 8 횟수" />
              <PHS.Button type="submit">저장</PHS.Button>
            </PHS.Form>

            <hr />

            <PHS.Button onClick={downloadTemplate}>엑셀 양식 다운로드</PHS.Button>

            <hr />

            {/* 선수 기록 목록 */}
            <PHS.Header>저장된 선수 기록 (총 {historyData.length}명, {selectedYear}년)</PHS.Header>
            <PHS.Table>
              <thead>
                <tr>
                  <PHS.Th>선수 이름</PHS.Th>
                  <PHS.Th>득점</PHS.Th>
                  <PHS.Th>어시스트</PHS.Th>
                  <PHS.Th>클린시트</PHS.Th>
                  <PHS.Th>출장수</PHS.Th>
                  <PHS.Th>승</PHS.Th>
                  <PHS.Th>무</PHS.Th>
                  <PHS.Th>패</PHS.Th>
                  <PHS.Th>승률</PHS.Th>
                  <PHS.Th>개인승점</PHS.Th>
                  <PHS.Th>MOM점수</PHS.Th>
                  <PHS.Th>MOM TOP 3 횟수</PHS.Th>
                  <PHS.Th>MOM TOP 8 횟수</PHS.Th>
                  <PHS.Th>액션</PHS.Th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((record) => (
                  <tr key={record.id}>
                    <PHS.Td>{record.name}</PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="goals"
                          value={editingData.goals}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.goals
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="assists"
                          value={editingData.assists}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.assists
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="cleanSheets"
                          value={editingData.cleanSheets}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.cleanSheets
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="matches"
                          value={editingData.matches}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.matches
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="win"
                          value={editingData.win}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.win
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="draw"
                          value={editingData.draw}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.draw
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="lose"
                          value={editingData.lose}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.lose
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="winRate"
                          value={editingData.winRate}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.winRate
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="personalPoints"
                          value={editingData.personalPoints}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.personalPoints
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="momScore"
                          value={editingData.momScore}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.momScore
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="momTop3Count"
                          value={editingData.momTop3Count}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.momTop3Count || 0
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      {editingId === record.id ? (
                        <PHS.SmallInput
                          type="number"
                          name="momTop8Count"
                          value={editingData.momTop8Count}
                          onChange={handleEditingDataChange}
                        />
                      ) : (
                        record.momTop8Count || 0
                      )}
                    </PHS.Td>
                    <PHS.Td>
                      <PHS.Button onClick={() => handleEdit(record)}>수정</PHS.Button>
                      {editingId === record.id && (
                        <>
                          <PHS.Button onClick={() => handleSaveEdit(record.id)}>저장</PHS.Button>
                          <PHS.Button onClick={handleCancelEdit}>취소</PHS.Button>
                        </>
                      )}
                      <PHS.Button onClick={() => handleDelete(record.id)}>삭제</PHS.Button>
                    </PHS.Td>
                  </tr>
                ))}
              </tbody>
            </PHS.Table>
          </PHS.MainArea>

          {/* 로그 */}
          <PHS.LogsContainer>
            <PHS.Header>로그</PHS.Header>
            {logs.map((log, i) => (
              <PHS.LogItem key={i}>{log}</PHS.LogItem>
            ))}
          </PHS.LogsContainer>
        </PHS.AdminContent>
      )}
    </PHS.Container>
  );
};

export default PlayerHistorySectionAdmin;