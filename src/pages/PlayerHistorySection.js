import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../App';
import { FaArrowLeft, FaChartLine, FaTrophy, FaMedal, FaAward } from 'react-icons/fa';
import * as PHS from './PlayerHistorySectionCss';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PlayerHistorySection = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGraphs, setShowGraphs] = useState(false);
  const [selectedStat, setSelectedStat] = useState('goals');
  const [rankingData, setRankingData] = useState({});
  const [totalRankingData, setTotalRankingData] = useState({});
  const [rankingDataLoading, setRankingDataLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [bestPartners, setBestPartners] = useState({
    given: { name: '', count: 0 },
    received: { name: '', count: 0 },
    teamMate: { name: '', count: 0 },
    cleanSheet: { name: '', count: 0 }
  });
  const [totalStats, setTotalStats] = useState({
    goals: 0,
    assists: 0,
    matches: 0,
    cleanSheets: 0,
    attackPoints: 0,
    top3: 0,
    top8: 0
  });

  const getCurrentSeason = () => {
    const now = new Date();
    return now.getFullYear().toString(); // 현재 2026
  };

  const currentSeason = getCurrentSeason();
  const years = ['2022', '2023', '2024', '2025', currentSeason];

  const statOptions = [
    { value: 'goals', label: '득점', color: '#8884d8' },
    { value: 'assists', label: '어시스트', color: '#82ca9d' },
    { value: 'cleanSheets', label: '클린시트', color: '#ffc658' },
    { value: 'matches', label: '출장수', color: '#ff8042' },
    { value: 'personalPoints', label: '개인승점', color: '#0088fe' },
    { value: 'momScore', label: 'MOM점수', color: '#9c27b0' },
    { value: 'winRate', label: '승률(%)', color: '#00C49F' },
    { value: 'momTop3Count', label: 'MOM TOP 3', color: '#FF6B6B' },
    { value: 'momTop8Count', label: 'MOM TOP 8', color: '#4ECDC4' }
  ];

  const totalStatOptions = [
    { value: 'goals', label: '득점', color: '#8884d8' },
    { value: 'assists', label: '어시스트', color: '#82ca9d' },
    { value: 'matches', label: '출장수', color: '#ff8042' },
    { value: 'cleanSheets', label: '클린시트', color: '#ffc658' },
    { value: 'top3', label: 'MOM TOP 3', color: '#FF6B6B' },
    { value: 'top8', label: 'MOM TOP 8', color: '#4ECDC4' }
  ];

  const statRankingToCheck = ['goals', 'assists', 'cleanSheets', 'matches', 'momTop3Count', 'momTop8Count'];

  useEffect(() => {
    let interval;
    if (rankingDataLoading) {
      setLoadingPercent(0);
      interval = setInterval(() => {
        setLoadingPercent((prev) => (prev >= 100 ? 100 : prev + 1));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [rankingDataLoading]);

  useEffect(() => {
    if (historyData.length > 0) {
      const totals = historyData.reduce(
        (acc, record) => ({
          goals: acc.goals + (record.goals || 0),
          assists: acc.assists + (record.assists || 0),
          matches: acc.matches + (record.matches || 0),
          cleanSheets: acc.cleanSheets + (record.cleanSheets || 0),
          attackPoints: acc.attackPoints + ((record.goals || 0) + (record.assists || 0)),
          top3: acc.top3 + (record.momTop3Count || 0),
          top8: acc.top8 + (record.momTop8Count || 0)
        }),
        { goals: 0, assists: 0, matches: 0, cleanSheets: 0, attackPoints: 0, top3: 0, top8: 0 }
      );
      setTotalStats(totals);
    }
  }, [historyData]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const data = [];

      try {
        const playerRef = doc(db, 'players', playerId);
        const playerDoc = await getDoc(playerRef);
        const currentPlayerData = playerDoc.exists() ? playerDoc.data() : {};

        for (const year of years) {
          if (year === currentSeason) {
            // 2026년(현재 시즌) → players 컬렉션 실시간 데이터
            data.push({
              year,
              goals: currentPlayerData.goals || 0,
              assists: currentPlayerData.assists || 0,
              cleanSheets: currentPlayerData.cleanSheets || 0,
              matches: currentPlayerData.matches || 0,
              win: currentPlayerData.win || 0,
              draw: currentPlayerData.draw || 0,
              lose: currentPlayerData.lose || 0,
              winRate: Math.round(currentPlayerData.winRate || 0),
              personalPoints: currentPlayerData.personalPoints || 0,
              momScore: currentPlayerData.momScore || 0,
              momTop3Count: currentPlayerData.momTop3Count || 0,
              momTop8Count: currentPlayerData.momTop8Count || 0
            });
          } else {
            // 2025년 포함 모든 과거 연도 → history 서브컬렉션
            const historyRef = doc(db, 'players', playerId, 'history', year);
            const historyDoc = await getDoc(historyRef);

            if (historyDoc.exists()) {
              const hData = historyDoc.data();
              data.push({
                year,
                goals: hData.goals || 0,
                assists: hData.assists || 0,
                cleanSheets: hData.cleanSheets || 0,
                matches: hData.matches || 0,
                win: hData.win || 0,
                draw: hData.draw || 0,
                lose: hData.lose || 0,
                winRate: Math.round(hData.winRate || 0),
                personalPoints: hData.personalPoints || 0,
                momScore: hData.momScore || 0,
                momTop3Count: hData.momTop3Count || 0,
                momTop8Count: hData.momTop8Count || 0
              });
            } else {
              data.push({
                year,
                goals: 0,
                assists: 0,
                cleanSheets: 0,
                matches: 0,
                win: 0,
                draw: 0,
                lose: 0,
                winRate: 0,
                personalPoints: 0,
                momScore: 0,
                momTop3Count: 0,
                momTop8Count: 0
              });
            }
          }
        }

        const sorted = data.sort((a, b) => parseInt(a.year) - parseInt(b.year));
        setHistoryData(sorted);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError('기록을 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [playerId]);

  useEffect(() => {
    const fetchRankingData = async () => {
      setRankingDataLoading(true);
      const rankData = {};

      for (const year of years) {
        rankData[year] = {};

        try {
          if (year === currentSeason) {
            // 2026년(현재 시즌) → players 컬렉션 실시간 랭킹
            const playersRef = collection(db, 'players');
            const playersSnapshot = await getDocs(playersRef);

            statRankingToCheck.forEach(stat => {
              const playerStats = [];

              playersSnapshot.forEach(doc => {
                const playerData = doc.data();
                if ((playerData[stat] || 0) > 0) {
                  playerStats.push({
                    id: doc.id,
                    value: playerData[stat] || 0
                  });
                }
              });

              playerStats.sort((a, b) => b.value - a.value);

              const ranks = [];
              let currentRank = 1;
              let currentValue = null;
              let playersAtCurrentValue = 0;

              playerStats.forEach((player, index) => {
                if (player.value !== currentValue) {
                  currentRank += playersAtCurrentValue;
                  currentValue = player.value;
                  playersAtCurrentValue = 1;
                } else {
                  playersAtCurrentValue++;
                }
                ranks.push({
                  id: player.id,
                  value: player.value,
                  rank: currentRank
                });
              });

              const top3 = ranks.filter(item => item.rank <= 3);
              const playerRank = ranks.find(item => item.id === playerId)?.rank || null;

              rankData[year][stat] = { top3, playerRank };
            });
          } else {
            // 2025년 포함 과거 연도 → history 서브컬렉션
            const yearlyData = [];
            const playersRef = collection(db, 'players');
            const playersSnapshot = await getDocs(playersRef);

            for (const playerDoc of playersSnapshot.docs) {
              const historyRef = doc(db, 'players', playerDoc.id, 'history', year);
              const historyDoc = await getDoc(historyRef);

              if (historyDoc.exists()) {
                const historyData = historyDoc.data();
                if ((historyData.matches || 0) > 0) {
                  statRankingToCheck.forEach(stat => {
                    if (!yearlyData[stat]) yearlyData[stat] = [];
                    yearlyData[stat].push({
                      id: playerDoc.id,
                      value: historyData[stat] || 0
                    });
                  });
                }
              }
            }

            statRankingToCheck.forEach(stat => {
              if (yearlyData[stat]) {
                yearlyData[stat].sort((a, b) => b.value - a.value);

                const ranks = [];
                let currentRank = 1;
                let currentValue = null;
                let playersAtCurrentValue = 0;

                yearlyData[stat].forEach((player, index) => {
                  if (player.value !== currentValue) {
                    currentRank += playersAtCurrentValue;
                    currentValue = player.value;
                    playersAtCurrentValue = 1;
                  } else {
                    playersAtCurrentValue++;
                  }
                  ranks.push({
                    id: player.id,
                    value: player.value,
                    rank: currentRank
                  });
                });

                const top3 = ranks.filter(item => item.rank <= 3);
                const playerRank = ranks.find(item => item.id === playerId)?.rank || null;

                rankData[year][stat] = { top3, playerRank };
              } else {
                rankData[year][stat] = { top3: [], playerRank: null };
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching ranking data for ${year}:`, err);
          statRankingToCheck.forEach(stat => {
            rankData[year][stat] = { top3: [], playerRank: null };
          });
        }
      }

      setRankingData(rankData);
      setRankingDataLoading(false);
    };

    if (!loading && historyData.length > 0) {
      fetchRankingData();
    }
  }, [historyData, loading, playerId]);

  useEffect(() => {
    const fetchTotalRankingData = async () => {
      const totalRankData = {};
      const statsToCheck = ['goals', 'assists', 'matches', 'cleanSheets', 'attackPoints', 'top3', 'top8'];

      try {
        const playersRef = collection(db, 'players');
        const playersSnapshot = await getDocs(playersRef);
        const playerTotals = {};

        for (const playerDoc of playersSnapshot.docs) {
          const pid = playerDoc.id;
          playerTotals[pid] = {
            goals: 0, assists: 0, matches: 0, cleanSheets: 0,
            attackPoints: 0, top3: 0, top8: 0
          };

          const playerData = playerDoc.data();
          playerTotals[pid].goals += playerData.goals || 0;
          playerTotals[pid].assists += playerData.assists || 0;
          playerTotals[pid].matches += playerData.matches || 0;
          playerTotals[pid].cleanSheets += playerData.cleanSheets || 0;
          playerTotals[pid].attackPoints += (playerData.goals || 0) + (playerData.assists || 0);
          playerTotals[pid].top3 += playerData.momTop3Count || 0;
          playerTotals[pid].top8 += playerData.momTop8Count || 0;

          for (const year of years.filter(y => y !== currentSeason)) {
            const historyRef = doc(db, 'players', pid, 'history', year);
            const historyDoc = await getDoc(historyRef);
            if (historyDoc.exists()) {
              const data = historyDoc.data();
              playerTotals[pid].goals += data.goals || 0;
              playerTotals[pid].assists += data.assists || 0;
              playerTotals[pid].matches += data.matches || 0;
              playerTotals[pid].cleanSheets += data.cleanSheets || 0;
              playerTotals[pid].attackPoints += (data.goals || 0) + (data.assists || 0);
              playerTotals[pid].top3 += data.momTop3Count || 0;
              playerTotals[pid].top8 += data.momTop8Count || 0;
            }
          }
        }

        statsToCheck.forEach(stat => {
          const playerStats = Object.entries(playerTotals)
            .map(([id, totals]) => ({
              id,
              value: totals[stat]
            }))
            .filter(player => player.value > 0);

          playerStats.sort((a, b) => b.value - a.value);

          const ranks = [];
          let currentRank = 1;
          let currentValue = null;
          let playersAtCurrentValue = 0;

          playerStats.forEach((player, index) => {
            if (player.value !== currentValue) {
              currentRank += playersAtCurrentValue;
              currentValue = player.value;
              playersAtCurrentValue = 1;
            } else {
              playersAtCurrentValue++;
            }
            ranks.push({
              id: player.id,
              value: player.value,
              rank: currentRank
            });
          });

          const top3 = ranks.filter(item => item.rank <= 3);
          const playerRank = ranks.find(item => item.id === playerId)?.rank || null;

          totalRankData[stat] = { top3, playerRank };
        });

        setTotalRankingData(totalRankData);
      } catch (err) {
        console.error('Error fetching total ranking data:', err);
      }
    };

    if (!loading && historyData.length > 0) {
      fetchTotalRankingData();
    }
  }, [historyData, loading, playerId]);

  useEffect(() => {
    const fetchBestPartners = async () => {
      try {
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(matchesRef, orderBy('date', 'desc'));
        const matchesSnapshot = await getDocs(matchesQuery);

        const givenCounts = {};
        const receivedCounts = {};
        const teamMateCounts = {};
        const cleanSheetCounts = {};

        let isDefender = false;
        const defensivePositions = ['CB1', 'CB2', 'LB', 'RB', 'LWB', 'RWB'];

        matchesSnapshot.forEach(doc => {
          const match = doc.data();
          if (match.date && new Date(match.date).getFullYear() === 2025) {
            match.quarters.forEach(quarter => {
              quarter.teams.forEach(team => {
                const player = team.players.find(p => p.name.toLowerCase() === playerId.toLowerCase());
                if (player && defensivePositions.includes(player.position)) {
                  isDefender = true;
                }
              });
            });
          }
        });

        matchesSnapshot.forEach(doc => {
          const match = doc.data();
          if (match.date && new Date(match.date).getFullYear() === 2025) {
            match.quarters.forEach(quarter => {
              const playerTeam = quarter.teams.find(team =>
                team.players.some(p => p.name.toLowerCase() === playerId.toLowerCase())
              );
              if (playerTeam) {
                playerTeam.players.forEach(player => {
                  if (player.name.toLowerCase() !== playerId.toLowerCase()) {
                    teamMateCounts[player.name] = (teamMateCounts[player.name] || 0) + 1;
                  }
                });
              }

              if (isDefender && playerTeam) {
                const opponentTeams = quarter.teams.filter(t => t.name !== playerTeam.name);
                const opponentGoals = quarter.goalAssistPairs.filter(p =>
                  opponentTeams.some(t => (p.goal?.team || '').trim().toLowerCase() === (t.name || '').trim().toLowerCase())
                ).length;

                if (opponentGoals === 0) {
                  playerTeam.players.forEach(player => {
                    if (player.name.toLowerCase() !== playerId.toLowerCase()) {
                      cleanSheetCounts[player.name] = (cleanSheetCounts[player.name] || 0) + 1;
                    }
                  });
                }
              }

              (quarter.goalAssistPairs || []).forEach(pair => {
                if (pair.assist?.player?.toLowerCase() === playerId.toLowerCase() && pair.goal?.player) {
                  const goalPlayer = pair.goal.player;
                  givenCounts[goalPlayer] = (givenCounts[goalPlayer] || 0) + 1;
                }
                if (pair.goal?.player?.toLowerCase() === playerId.toLowerCase() && pair.assist?.player) {
                  const assistPlayer = pair.assist.player;
                  receivedCounts[assistPlayer] = (receivedCounts[assistPlayer] || 0) + 1;
                }
              });
            });
          }
        });

        const givenMax = Object.entries(givenCounts).reduce((max, [name, count]) =>
          count > max.count ? { name, count } : max, { name: '', count: 0 });

        const receivedMax = Object.entries(receivedCounts).reduce((max, [name, count]) =>
          count > max.count ? { name, count } : max, { name: '', count: 0 });

        const teamMateMax = Object.entries(teamMateCounts).reduce((max, [name, count]) =>
          count > max.count ? { name, count } : max, { name: '', count: 0 });

        const cleanSheetMax = Object.entries(cleanSheetCounts).reduce((max, [name, count]) =>
          count > max.count ? { name, count } : max, { name: '', count: 0 });

        setBestPartners({
          given: givenMax,
          received: receivedMax,
          teamMate: teamMateMax,
          cleanSheet: cleanSheetMax
        });
      } catch (err) {
        console.error('Error fetching best partners:', err);
      }
    };

    if (!loading && historyData.length > 0) {
      fetchBestPartners();
    }
  }, [loading, historyData, playerId]);

  const toggleGraphs = () => setShowGraphs(!showGraphs);

  const getMaxValue = (statKey) => {
    const max = Math.max(...historyData.map(item => item[statKey] || 0));
    return max === 0 ? 10 : Math.ceil(max * 1.2);
  };

  const normalizeTeamName = (name) => name ? name.trim().toLowerCase() : '';

  if (loading) {
    return (
      <PHS.OuterWrapper>
        <PHS.Container>
          <p>로딩 중...</p>
        </PHS.Container>
      </PHS.OuterWrapper>
    );
  }

  const hasData = historyData.some(record => record.matches > 0);

  return (
    <PHS.OuterWrapper>
      <PHS.Container>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <PHS.Button onClick={() => navigate('/total')} style={{ marginRight: '10px' }}>
            <FaArrowLeft />
          </PHS.Button>
          <h2>{playerId} 연도별 기록</h2>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <PHS.HistoryTable>
          <thead>
            <tr>
              <PHS.HistoryTableHeader>연도</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>득점</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>어시스트</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>클린시트</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>출장수</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>승/무/패</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>승률</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>개인승점</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>MOM점수</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>MOM TOP 3</PHS.HistoryTableHeader>
              <PHS.HistoryTableHeader>MOM TOP 8</PHS.HistoryTableHeader>
            </tr>
          </thead>
          <tbody>
            {[...historyData].reverse().map((record) => (
              <PHS.HistoryTableRow
                key={record.year}
                style={
                  record.year === currentSeason
                    ? { backgroundColor: 'rgba(66, 134, 244, 0.1)' }
                    : {}
                }
              >
                <PHS.HistoryTableCell>
                  {record.year === currentSeason
                    ? `${record.year} (현재)`
                    : record.year}
                </PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.goals}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.assists}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.cleanSheets}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.matches}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>
                  {record.win}/{record.draw}/{record.lose}
                </PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.winRate}%</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.personalPoints}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.momScore}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.momTop3Count}</PHS.HistoryTableCell>
                <PHS.HistoryTableCell>{record.momTop8Count}</PHS.HistoryTableCell>
              </PHS.HistoryTableRow>
            ))}
          </tbody>
        </PHS.HistoryTable>

        {!hasData ? (
          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            이 선수의 기록이 없습니다.
          </p>
        ) : (
          <>
            <PHS.RankingSummary>
              <PHS.SectionTitle>🏆 수상 기록 🏆</PHS.SectionTitle>
              {rankingDataLoading ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '300px',
                  gap: '20px'
                }}>
                  <img
                    src="/mom.png"
                    alt="Loading Logo"
                    style={{
                      width: '150px',
                      height: '150px',
                      animation: 'spin 2s linear infinite'
                    }}
                  />
                  <div style={{
                    width: '300px',
                    height: '20px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${loadingPercent}%`,
                      height: '100%',
                      backgroundColor: '#4286f4',
                      transition: 'width 0.1s linear'
                    }} />
                  </div>
                  <p>발롱도르에서 트로피 가져오는 중... {loadingPercent}%</p>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginLeft: '-35px'
                }}>
                  {years.some(year => {
                    if (!rankingData[year]) return false;
                    return statRankingToCheck.some(stat => {
                      const rankInfo = rankingData[year][stat];
                      if (rankInfo && rankInfo.top3) {
                        const playerItem = rankInfo.top3.find(item => item.id === playerId);
                        return playerItem && playerItem.rank <= 3 && playerItem.value > 0;
                      }
                      return false;
                    });
                  }) ? (
                    years
                      .filter(year => {
                        if (!rankingData[year]) return false;
                        return statRankingToCheck.some(stat => {
                          const rankInfo = rankingData[year][stat];
                          if (rankInfo && rankInfo.top3) {
                            const playerItem = rankInfo.top3.find(item => item.id === playerId);
                            return playerItem && playerItem.rank <= 3 && playerItem.value > 0;
                          }
                          return false;
                        });
                      })
                      .map(year => (
                        <div key={year} style={{
                          backgroundColor: '#1a1a1a',
                          borderRadius: '8px',
                          padding: '12px',
                          width: '200px',
                          flexShrink: 0
                        }}>
                          <h4 style={{
                            margin: '0 0 8px 0',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            paddingBottom: '4px',
                            fontSize: '16px',
                            color: '#ffffff'
                          }}>
                            {year}년 수상 기록
                          </h4>
                          <div>
                            {statRankingToCheck.map((stat, index) => {
                              if (!rankingData[year]?.[stat]) return null;
                              const playerItem = rankingData[year][stat].top3.find(item => item.id === playerId);
                              if (!playerItem || playerItem.rank > 3 || playerItem.value <= 0) return null;

                              const statLabels = {
                                goals: '득점',
                                assists: '어시스트',
                                cleanSheets: '클린시트',
                                matches: '출장',
                                momTop3Count: 'MOM TOP 3',
                                momTop8Count: 'MOM TOP 8'
                              };

                              let icon, color, text;
                              switch (playerItem.rank) {
                                case 1:
                                  icon = <FaTrophy style={{ color: 'gold' }} />;
                                  color = 'gold';
                                  text = `${statLabels[stat]} ${playerItem.rank}위 (${playerItem.value})`;
                                  break;
                                case 2:
                                  icon = <FaMedal style={{ color: 'silver' }} />;
                                  color = 'silver';
                                  text = `${statLabels[stat]} ${playerItem.rank}위 (${playerItem.value})`;
                                  break;
                                case 3:
                                  icon = <FaAward style={{ color: '#cd7f32' }} />;
                                  color = '#cd7f32';
                                  text = `${statLabels[stat]} ${playerItem.rank}위 (${playerItem.value})`;
                                  break;
                                default:
                                  return null;
                              }

                              return (
                                <div key={index} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginBottom: '6px',
                                  color,
                                  fontSize: '14px'
                                }}>
                                  <span style={{ marginRight: '6px' }}>{icon}</span>
                                  <span>{text}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p style={{ textAlign: 'center', color: '#000', width: '100%' }}>
                      수상 기록이 없습니다
                    </p>
                  )}
                </div>
              )}
            </PHS.RankingSummary>

            <PHS.GraphToggleButton onClick={toggleGraphs}>
              <FaChartLine style={{ marginRight: '8px' }} />
              {showGraphs ? '그래프 닫기' : '성장 추이 그래프 보기'}
            </PHS.GraphToggleButton>

            {showGraphs && (
              <PHS.GraphSection>
                <h3>연도별 성장 추이</h3>

                <PHS.StatSelector>
                  {statOptions.map(option => (
                    <PHS.StatButton
                      key={option.value}
                      onClick={() => setSelectedStat(option.value)}
                      active={selectedStat === option.value}
                      color={option.color}
                    >
                      {option.label}
                    </PHS.StatButton>
                  ))}
                </PHS.StatSelector>

                <PHS.GraphContainer>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={historyData}
                      margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis domain={[0, getMaxValue(selectedStat)]} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={selectedStat}
                        name={statOptions.find(opt => opt.value === selectedStat)?.label || selectedStat}
                        stroke={statOptions.find(opt => opt.value === selectedStat)?.color || '#8884d8'}
                        activeDot={{ r: 8 }}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </PHS.GraphContainer>

                <PHS.GraphContainer>
                  <h3>승/무/패 비율</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={historyData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="win" name="승" stroke="#FFD700" strokeWidth={2} />
                      <Line type="monotone" dataKey="draw" name="무" stroke="rgb(172, 176, 185)" strokeWidth={2} />
                      <Line type="monotone" dataKey="lose" name="패" stroke="rgb(244, 67, 54)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </PHS.GraphContainer>

                <PHS.GraphContainer>
                  <h3>종합 공격 기여도</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={historyData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="goals" name="득점" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="assists" name="어시스트" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </PHS.GraphContainer>

                <PHS.GraphContainer>
                  <h3>{playerId}의 SOOP FC 올타임 기록</h3>
                  <PHS.SummaryCardContainer>
                    {totalStats.matches > 0 ? (
                      totalStatOptions.map(stat => (
                        <PHS.SummaryCard key={stat.value}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '50px',
                            color: stat.color,
                            fontSize: '22px',
                            fontWeight: 'bold',
                          }}>
                            {totalStats[stat.value]}
                          </div>
                          <div style={{
                            marginTop: '4px',
                            fontSize: '13px',
                            color: '#aaa',
                            textAlign: 'center',
                          }}>
                            {stat.label}
                          </div>
                        </PHS.SummaryCard>
                      ))
                    ) : (
                      <p>기록이 없습니다.</p>
                    )}
                  </PHS.SummaryCardContainer>
                </PHS.GraphContainer>

                <PHS.GraphContainer>
                  <h3>{playerId} 최고의 파트너 (2025)</h3>
                  <PHS.PartnerContainer>
                    <PHS.PartnerCard>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#82ca9d' }}>
                        {bestPartners.given.name || '없음'} ({bestPartners.given.count}회)
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', color: '#aaa' }}>
                        가장 많이 어시스트한 파트너
                      </div>
                    </PHS.PartnerCard>
                    <PHS.PartnerCard>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8884d8' }}>
                        {bestPartners.received.name || '없음'} ({bestPartners.received.count}회)
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', color: '#aaa' }}>
                        가장 많이 어시스트 받은 파트너
                      </div>
                    </PHS.PartnerCard>
                    <PHS.PartnerCard>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00C49F' }}>
                        {bestPartners.teamMate.name || '없음'} ({bestPartners.teamMate.count}쿼터)
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', color: '#aaa' }}>
                        같은 팀 많이 한 파트너
                      </div>
                    </PHS.PartnerCard>
                    <PHS.PartnerCard>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffc658' }}>
                        {bestPartners.cleanSheet.name || '없음'} ({bestPartners.cleanSheet.count}회)
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', color: '#aaa' }}>
                        같이 클린 시트 많이 한 파트너
                      </div>
                    </PHS.PartnerCard>
                  </PHS.PartnerContainer>
                </PHS.GraphContainer>
              </PHS.GraphSection>
            )}
          </>
        )}
      </PHS.Container>
    </PHS.OuterWrapper>
  );
};

export default PlayerHistorySection;