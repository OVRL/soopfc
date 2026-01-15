import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../App';
import { FaFutbol, FaShoePrints, FaShieldAlt, FaRunning, FaStar, FaMedal, FaChartLine, FaTrophy, FaFire } from 'react-icons/fa';
import {
  OuterWrapper, Container, SearchForm, Input, Button, RankBannerContainer, RankMessage,
  PlayerData, PlayerCardHeader, PlayerRating, PlayerName, PlayerPosition, PositionBadge,
  StatsGrid, StatRow, StatHeader, StatLabel, StatValue, StatBarContainer, StatBar,
  AdvancedStatsSection, AdvancedStatsTitle, AdvancedStatsGrid, AdvancedStatCard,
  AdvancedStatValue, AdvancedStatLabel, LevelUpMessage, TitleContainer, Title,
  getRankColor, getRatingColor, ToggleHistoryButton, TopPlayersContainer, TopPlayersTitle,FixedBottomButton,
  TopPlayerItem, PlayerRank, PlayerNameText, TrendingBadge, LastUpdate, RankChangeIndicator, NewBadge
} from './TotalCss';

// 선수 Rating 계산 (FIFA 스타일)
const calculateRating = (playerInfo) => {
  if (!playerInfo) return 0;

  const goalWeight = 2.5;
  const assistWeight = 2;
  const cleanSheetWeight = 2;
  const winWeight = 1.5;
  const momScoreWeight = 0.02;

  const baseRating = 50;
  const calculatedRating = baseRating +
    ((playerInfo.goals || 0) * goalWeight) +
    ((playerInfo.assists || 0) * assistWeight) +
    ((playerInfo.cleanSheets || 0) * cleanSheetWeight) +
    ((playerInfo.win || 0) * winWeight) +
    ((playerInfo.momScore || 0) * momScoreWeight);

  return Math.min(99, Math.floor(calculatedRating));
};

// 선수 칭호 계산
const getPlayerTitles = (playerInfo) => {
  const titles = [];

  const goals = playerInfo.goals || 0;
  const assists = playerInfo.assists || 0;
  const cleanSheets = playerInfo.cleanSheets || 0;
  const matches = playerInfo.matches || 0;
  const personalPoints = playerInfo.personalPoints || 0;
  const momScore = playerInfo.momScore || 0;
  const winRate = playerInfo.winRate || 0;

  if (goals >= 15) {
    titles.push('SOOP FC 메시');
  } else if (goals >= 10) {
    titles.push('득점기계');
  } else if (goals >= 5) {
    titles.push('골잡이');
  }

  if (assists >= 10) {
    titles.push('SOOP FC 이니에스타');
  } else if (assists >= 5) {
    titles.push('키패서');
  }

  if (cleanSheets >= 15) {
    titles.push('클린 시트의 주역');
  } else if (cleanSheets >= 10) {
    titles.push('수비의 리더');
  } else if (cleanSheets >= 5) {
    titles.push('뒷공간 지킴이');
  }

  if (matches >= 20) {
    titles.push('SOOP FC 레전드');
  } else if (matches >= 10) {
    titles.push('SOOP FC 참석왕');
  } else if (matches >= 5) {
    titles.push('꾸준함의 아이콘');
  }

  if (personalPoints >= 20) {
    titles.push('승점의 화신');
  } else if (personalPoints >= 10) {
    titles.push('팀의 핵심');
  }

  if (momScore >= 900) {
    titles.push('MOM의 제왕');
  } else if (momScore >= 800) {
    titles.push('경기의 MVP');
  }

  if (winRate >= 70) {
    titles.push('승리 제조기');
  } else if (winRate >= 50) {
    titles.push('믿을 수 있는 승부사');
  }

  if (titles.length === 0) {
    titles.push('SOOP FC 유망주');
  }

  return titles;
};

// 공동 순위 계산 헬퍼 함수
const computeRankings = (docs, statKey, rankKeyName) => {
  const sortedDocs = [...docs].sort((a, b) => {
    const valueA = a.data()[statKey] || 0;
    const valueB = b.data()[statKey] || 0;
    return valueB - valueA;
  });

  let currentRank = 0;
  let prevValue = null;
  return sortedDocs.map((doc, index) => {
    const value = doc.data()[statKey] || 0;
    if (value !== prevValue) {
      currentRank = index + 1;
      prevValue = value;
    }
    return { id: doc.id, ...doc.data(), [rankKeyName]: currentRank };
  });
};

// 레벨업 메시지 헬퍼 함수
const getLevelUpMessage = (value, thresholds, titles, unit) => {
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]) {
      const diff = thresholds[i] - value;
      if (diff <= 3) {
        return `추가 ${diff}${unit}만 더하면 '${titles[i]}' 칭호를 얻을 수 있습니다!`;
      }
      break;
    }
  }
  return null;
};

// 포메이션 통일 함수 (CB1, CB2만 통일)
const unifyPosition = (position) => {
  const positionMap = {
    'CB1': 'CB',
    'CB2': 'CB',
    'CDM1': 'CDM',
    'CDM2': 'CDM',
    'CM1': 'CM',
    'CM2': 'CM',
  };
  return positionMap[position] || position;
};

// 가장 많이 사용한 포메이션 계산
const calculateMostFrequentFormation = async (playerName) => {
  const quartersQuery = query(collection(db, 'matches'));
  const quartersSnapshot = await getDocs(quartersQuery);
  const playerPositions = {};

  quartersSnapshot.forEach((matchDoc) => {
    const quarters = matchDoc.data().quarters || [];
    quarters.forEach((quarter) => {
      quarter.teams.forEach((team) => {
        team.players.forEach((player) => {
          if (player.name === playerName) {
            const unifiedPos = unifyPosition(player.position);
            playerPositions[unifiedPos] = (playerPositions[unifiedPos] || 0) + 1;
          }
        });
      });
    });
  });

  const positionCounts = Object.entries(playerPositions);
  if (positionCounts.length === 0) return 'N/A';

  const sortedPositions = positionCounts.sort((a, b) => b[1] - a[1]);
  const maxCount = sortedPositions[0][1];
  const mostFrequent = sortedPositions
    .filter(([_, count]) => count === maxCount)
    .map(([pos]) => pos);

  return mostFrequent.join(', ');
};

const Total = () => {
  const [playerName, setPlayerName] = useState('');
  const [playerInfo, setPlayerInfo] = useState(null); // 여기서 isFlipped 추가
  const [playerRankings, setPlayerRankings] = useState(null);
  const [error, setError] = useState('');
  const [mostFrequentFormation, setMostFrequentFormation] = useState('N/A');
  const [topSearchedPlayers, setTopSearchedPlayers] = useState([]);
  const [topPlayersLoading, setTopPlayersLoading] = useState(true);
  const [topPlayersError, setTopPlayersError] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Handle window resize for responsive TopPlayersContainer
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch top searched players with real-time listener (완전히 그대로)
  useEffect(() => {
    const fetchTopSearchedPlayers = async () => {
      setTopPlayersLoading(true);
      setTopPlayersError('');

      try {
        const searchQuery = query(
          collection(db, 'searchCounts'),
          orderBy('count', 'desc'),
          limit(3)
        );
        const unsubscribe = onSnapshot(searchQuery, async (searchSnapshot) => {
          console.log('searchCounts snapshot received:', searchSnapshot.docs.length, 'docs');
          
          if (searchSnapshot.empty) {
            console.warn('searchCounts is empty');
            setTopPlayersError('현재 인기 급상승 선수 데이터가 없습니다.');
            setTopSearchedPlayers([]);
            setTopPlayersLoading(false);
            return;
          }

          const newTopPlayers = searchSnapshot.docs.map((doc, index) => {
            const data = {
              name: doc.id,
              count: doc.data().count || 0,
              rank: index + 1,
            };
            console.log('New top player:', data);
            return data;
          });

          const historyQuery = query(
            collection(db, 'searchHistory'),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const historySnapshot = await getDocs(historyQuery);
          let prevPlayers = [];
          if (!historySnapshot.empty) {
            prevPlayers = historySnapshot.docs[0].data().players || [];
            console.log('Previous players from searchHistory:', prevPlayers);
          } else {
            console.warn('No searchHistory found');
          }

          const topPlayersWithChange = newTopPlayers.map((player) => {
            const prevPlayer = prevPlayers.find((p) => p.name === player.name);
            if (!prevPlayer) {
              return { ...player, change: 'NEW' };
            }
            const prevRank = prevPlayer.rank;
            const rankDiff = prevRank - player.rank;
            if (rankDiff > 0) {
              return { ...player, change: `UP_${rankDiff}` };
            } else if (rankDiff < 0) {
              return { ...player, change: `DOWN_${Math.abs(rankDiff)}` };
            }
            return { ...player, change: null };
          });
          console.log('Top players with change:', topPlayersWithChange);

          const now = new Date();
          const lastUpdate = historySnapshot.empty ? null : historySnapshot.docs[0].data().timestamp.toDate();
          const shouldUpdateHistory = !lastUpdate || (now - lastUpdate) / (1000 * 60) > 30;

          if (shouldUpdateHistory) {
            console.log('Updating searchHistory at:', now.toISOString());
            await setDoc(doc(db, 'searchHistory', now.toISOString()), {
              players: newTopPlayers,
              timestamp: now,
            });
          }

          setTopSearchedPlayers(topPlayersWithChange);
          setTopPlayersError('');
          setTopPlayersLoading(false);
        }, (err) => {
          console.error('Error in searchCounts snapshot:', err);
          setTopPlayersError('인기 급상승 선수 데이터를 가져오는 중 오류가 발생했습니다.');
          setTopSearchedPlayers([]);
          setTopPlayersLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        console.error('Error setting up top searched players listener:', err);
        setTopPlayersError('인기 급상승 선수 데이터를 가져오는 중 오류가 발생했습니다.');
        setTopSearchedPlayers([]);
        setTopPlayersLoading(false);
      }
    };

    fetchTopSearchedPlayers();
  }, []);

  // Fetch rankings (완전히 그대로)
  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const playersQuery = query(collection(db, 'players'));
        const playersSnapshot = await getDocs(playersQuery);
        let playersData = playersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        playersData = playersData.map((player) => {
          const matches = player.matches || 1;
          const normalizedGoals = (player.goals || 0) / matches;
          const normalizedAssists = (player.assists || 0) / matches;
          const normalizedCleanSheets = (player.cleanSheets || 0) / matches;
          const normalizedWinRate = (player.winRate || 0) / 100;
          const normalizedPoints = (player.personalPoints || 0) / matches;

          const xG =
            0.4 * normalizedGoals +
            0.3 * normalizedAssists +
            0.2 * normalizedCleanSheets +
            0.05 * normalizedWinRate +
            0.05 * normalizedPoints;

          return { ...player, xG };
        });

        const maxXG = Math.max(...playersData.map((p) => p.xG), 1);
        playersData = playersData.map((player) => ({
          ...player,
          xG: Math.min((player.xG / maxXG), 1.0),
        }));

        const rankedByGoals = computeRankings(playersSnapshot.docs, 'goals', 'goalsRank');
        const rankedByAssists = computeRankings(playersSnapshot.docs, 'assists', 'assistsRank');
        const rankedByCleanSheets = computeRankings(playersSnapshot.docs, 'cleanSheets', 'cleanSheetsRank');
        const rankedByMatches = computeRankings(playersSnapshot.docs, 'matches', 'matchesRank');
        const rankedByPoints = computeRankings(playersSnapshot.docs, 'personalPoints', 'pointsRank');
        const rankedByMom = computeRankings(playersSnapshot.docs, 'momScore', 'momRank');
        const rankedByWinRate = computeRankings(playersSnapshot.docs, 'winRate', 'winRateRank');

        setPlayerRankings({
          rankedByGoals,
          rankedByAssists,
          rankedByCleanSheets,
          rankedByMatches,
          rankedByPoints,
          rankedByMom,
          rankedByWinRate,
          playersData,
        });
      } catch (err) {
        console.error('Error fetching rankings:', err);
        setError('순위 데이터를 가져오는 중 오류가 발생했습니다.');
      }
    };

    fetchRankings();
  }, []);

  // Handle search and increment search count
  const handleSearch = async (e) => {
    e.preventDefault();

    if (!playerName) {
      setError('선수 이름을 입력해주세요.');
      return;
    }

    if (!playerRankings) {
      setError('순위를 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const searchRef = doc(db, 'searchCounts', playerName);
    try {
      const searchDoc = await getDoc(searchRef);
      if (searchDoc.exists()) {
        await updateDoc(searchRef, {
          count: searchDoc.data().count + 1,
        });
      } else {
        await setDoc(searchRef, {
          count: 1,
        });
      }

      const playerRef = doc(db, 'players', playerName);
      const playerDoc = await getDoc(playerRef);

      if (playerDoc.exists()) {
        const playerData = playerDoc.data();
        const matches = playerData.matches || 1;

        const playerInRankings = playerRankings.playersData.find(p => p.id === playerDoc.id);
        const xG = playerInRankings ? playerInRankings.xG.toFixed(3) : '0.000';
        const xA = isNaN((playerData.assists || 0) / matches)
          ? '0.000'
          : ((playerData.assists || 0) / matches).toFixed(3);
        const war = isNaN((playerData.goals || 0) / matches)
          ? '0.000'
          : ((playerData.goals || 0) / matches).toFixed(3);

        const playerInGoalsRank = playerRankings.rankedByGoals.find(p => p.id === playerDoc.id);
        const playerInAssistsRank = playerRankings.rankedByAssists.find(p => p.id === playerDoc.id);
        const playerInCleanSheetsRank = playerRankings.rankedByCleanSheets.find(p => p.id === playerDoc.id);
        const playerInMatchesRank = playerRankings.rankedByMatches.find(p => p.id === playerDoc.id);
        const playerInPointsRank = playerRankings.rankedByPoints.find(p => p.id === playerDoc.id);
        const playerInMomRank = playerRankings.rankedByMom.find(p => p.id === playerDoc.id);
        const playerInWinRateRank = playerRankings.rankedByWinRate.find(p => p.id === playerDoc.id);

        const trendingRank = topSearchedPlayers.find(p => p.name === playerName)?.rank || null;

        const formation = await calculateMostFrequentFormation(playerName);
        setMostFrequentFormation(formation);

        // isFlipped: false로 초기화해서 항상 앞면에서 시작
        setPlayerInfo({
          ...playerData,
          isFlipped: true,
          goalsRank: playerInGoalsRank ? playerInGoalsRank.goalsRank : '-',
          assistsRank: playerInAssistsRank ? playerInAssistsRank.assistsRank : '-',
          cleanSheetsRank: playerInCleanSheetsRank ? playerInCleanSheetsRank.cleanSheetsRank : '-',
          matchesRank: playerInMatchesRank ? playerInMatchesRank.matchesRank : '-',
          pointsRank: playerInPointsRank ? playerInPointsRank.pointsRank : '-',
          momRank: playerInMomRank ? playerInMomRank.momRank : '-',
          winRateRank: playerInWinRateRank ? playerInWinRateRank.winRateRank : '-',
          attackPoints: (playerData.goals || 0) + (playerData.assists || 0),
          xG,
          xA,
          war,
          trendingRank,
        });
        setError('');
      } else {
        setPlayerInfo(null);
        setError('선수를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('Error fetching player data or updating search count:', error);
      setError('선수 데이터 가져오기 중 오류가 발생했습니다.');
    }
  };

  const getStatPercentage = (value, max) => {
    return Math.min((value / max) * 100, 100);
  };

  const renderRankBanner = () => {
    if (!playerInfo || playerInfo.isFlipped) return null;
    const messages = [];

    if (playerInfo.goalsRank <= 3 && (playerInfo.goals || 0) > 0) {
      messages.push({
        icon: <FaFutbol color={getRankColor(playerInfo.goalsRank)} />,
        text: `현재 득점순위 ${playerInfo.goalsRank}위입니다! (${playerInfo.goals}골)`,
      });
    }
    if (playerInfo.assistsRank <= 3 && (playerInfo.assists || 0) > 0) {
      messages.push({
        icon: <FaShoePrints color={getRankColor(playerInfo.assistsRank)} />,
        text: `현재 어시스트순위 ${playerInfo.assistsRank}위입니다! (${playerInfo.assists}어시)`,
      });
    }
    if (playerInfo.cleanSheetsRank <= 3 && (playerInfo.cleanSheets || 0) > 0) {
      messages.push({
        icon: <FaShieldAlt color={getRankColor(playerInfo.cleanSheetsRank)} />,
        text: `현재 클린시트순위 ${playerInfo.cleanSheetsRank}위입니다! (${playerInfo.cleanSheets}클린)`,
      });
    }
    if (playerInfo.pointsRank <= 3 && (playerInfo.personalPoints || 0) > 0) {
      messages.push({
        icon: <FaTrophy color={getRankColor(playerInfo.pointsRank)} />,
        text: `현재 개인승점 순위 ${playerInfo.pointsRank}위입니다! (${playerInfo.personalPoints}점)`,
      });
    }
    if (playerInfo.momRank <= 3 && (playerInfo.momScore || 0) > 0) {
      messages.push({
        icon: <FaStar color={getRankColor(playerInfo.momRank)} />,
        text: `현재 MOM점수 순위 ${playerInfo.momRank}위입니다! (${playerInfo.momScore}점)`,
      });
    }
    if (playerInfo.matchesRank <= 3 && (playerInfo.matches || 0) > 0) {
      messages.push({
        icon: <FaStar color={getRankColor(playerInfo.matchesRank)} />,
        text: `현재 경기수 순위 ${playerInfo.matchesRank}위입니다! (${playerInfo.matches}경기)`,
      });
    }

    if (messages.length === 0) return null;
    return (
      <RankBannerContainer>
        {messages.map((msg, index) => (
          <RankMessage key={index}>
            <FaMedal color={getRankColor(3)} />
            {msg.icon}
            <span>{msg.text}</span>
          </RankMessage>
        ))}
      </RankBannerContainer>
    );
  };

  return (
    <OuterWrapper>
      <Container>
        <h2>내 스탯 보기</h2>
        <SearchForm onSubmit={handleSearch}>
          <Input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="선수 이름"
          />
          <Button type="submit">검색</Button>
        </SearchForm>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        {/* 인기 급상승 선수 TOP 3 */}
        {!playerInfo && (
          <TopPlayersContainer windowWidth={windowWidth}>
            <TopPlayersTitle>
              인기 급상승 선수 TOP 3
            </TopPlayersTitle>
            {topPlayersLoading && <p>인기 급상승 선수 데이터를 로딩 중입니다...</p>}
            {topPlayersError && <p style={{ color: 'red' }}>{topPlayersError}</p>}
            {!topPlayersLoading && !topPlayersError && topSearchedPlayers.length === 0 && (
              <p>현재 인기 급상승 선수 데이터가 없습니다.</p>
            )}
            {!topPlayersLoading && topSearchedPlayers.length > 0 && (
              <>
                {topSearchedPlayers.map((player) => (
                  <TopPlayerItem key={player.name}>
                    <PlayerRank>{player.rank ?? 'N/A'}</PlayerRank>
                    <PlayerNameText>
                      {player.name}
                      <span style={{ marginLeft: '10px', color: '#666' }}>(조회수: {player.count})</span>
                      {player.change === 'NEW' && <NewBadge>NEW</NewBadge>}
                      {player.change && player.change.startsWith('UP_') && (
                        <RankChangeIndicator direction="up">
                          {player.change.split('_')[1]}단계 UP
                        </RankChangeIndicator>
                      )}
                      {player.change && player.change.startsWith('DOWN_') && (
                        <RankChangeIndicator direction="down">
                          {player.change.split('_')[1]}단계 DOWN
                        </RankChangeIndicator>
                      )}
                    </PlayerNameText>
                  </TopPlayerItem>
                ))}
                <LastUpdate>최근 업데이트: {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</LastUpdate>
              </>
            )}
          </TopPlayersContainer>
        )}

        {playerInfo && renderRankBanner()}

        {/* 핵심: 뒤집히는 카드 */}
        {playerInfo && (
          <>
            {/* 1. 뒤집히는 카드 (버튼 제거) */}
            <div style={{ perspective: '1500px', margin: '40px auto', }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '720px',  // ← 높이 고정 → minHeight로 변경 (중요!)
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transform: playerInfo.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
                onClick={() => setPlayerInfo(prev => ({ ...prev, isFlipped: !prev.isFlipped }))}
                onMouseEnter={(e) => {
                  if (!playerInfo.isFlipped) {
                    e.currentTarget.style.transform = 'translateY(-15px) scale(1.02) rotateY(0deg)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!playerInfo.isFlipped) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  }
                }}
              >
                {/* 앞면: 스탯 카드 */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  // height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '20px',
                  overflow: 'hidden',
                }}>
                  <PlayerData>
                    <PlayerCardHeader>
                      <PlayerRating>{playerInfo.backNumber || '-'}</PlayerRating>
                      <PlayerName>
                        {playerInfo.name}
                        {playerInfo.trendingRank && (
                          <TrendingBadge rank={playerInfo.trendingRank}>
                            #인기 급상승 선수 {playerInfo.trendingRank}위
                          </TrendingBadge>
                        )}
                      </PlayerName>
                      <PlayerPosition>
                        {mostFrequentFormation.toUpperCase()}
                        {playerInfo.team && (
                          <div style={{ marginLeft: '10px' }}>
                            <PositionBadge>{playerInfo.team.toUpperCase()}</PositionBadge>
                          </div>
                        )}
                      </PlayerPosition>
                    </PlayerCardHeader>

                    <StatsGrid>
                      {/* 모든 스탯 그대로 유지 (생략 없음) */}
                       <StatRow>
                        <StatHeader>
                          <StatLabel>매치 수</StatLabel>
                          <StatValue color={getRankColor(playerInfo.matchesRank)}>
                            {playerInfo.matches || 0}경기 ({playerInfo.matchesRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.matches || 0, 38)} color={getRankColor(playerInfo.matchesRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>2026 득점</StatLabel>
                          <StatValue color={getRankColor(playerInfo.goalsRank)}>
                            {playerInfo.goals || 0} 골 ({playerInfo.goalsRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.goals || 0, 30)} color={getRankColor(playerInfo.goalsRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>2026 어시스트</StatLabel>
                          <StatValue color={getRankColor(playerInfo.assistsRank)}>
                            {playerInfo.assists || 0} 어시 ({playerInfo.assistsRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.assists || 0, 20)} color={getRankColor(playerInfo.assistsRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>2026 클린시트</StatLabel>
                          <StatValue color={getRankColor(playerInfo.cleanSheetsRank)}>
                            {playerInfo.cleanSheets || 0} ({playerInfo.cleanSheetsRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.cleanSheets || 0, 15)} color={getRankColor(playerInfo.cleanSheetsRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>승/무/패</StatLabel>
                          <StatValue>
                            <span style={{ color: '#f8c058' }}>{playerInfo.win || 0}</span> /
                            <span style={{ color: '#acb0b9' }}>{playerInfo.draw || 0}</span> /
                            <span style={{ color: '#f44336' }}>{playerInfo.lose || 0}</span>
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                            <StatBar percentage={playerInfo.matches > 0 ? ((playerInfo.win || 0) / playerInfo.matches) * 100 : 0} color="#FFD700" />
                            <div style={{ height: '100%', width: `${playerInfo.matches > 0 ? ((playerInfo.draw || 0) / playerInfo.matches) * 100 : 0}%`, backgroundColor: '#acb0b9' }}></div>
                            <div style={{ height: '100%', width: `${playerInfo.matches > 0 ? ((playerInfo.lose || 0) / playerInfo.matches) * 100 : 0}%`, backgroundColor: '#f44336' }}></div>
                          </div>
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>승률</StatLabel>
                          <StatValue color={getRankColor(playerInfo.winRateRank)}>
                            {(playerInfo.winRate || 0).toFixed(0)}% ({playerInfo.winRateRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.winRate || 0, 100)} color={getRankColor(playerInfo.winRateRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>개인승점</StatLabel>
                          <StatValue color={getRankColor(playerInfo.pointsRank)}>
                            {playerInfo.personalPoints || 0} ({playerInfo.pointsRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.personalPoints || 0, 30)} color={getRankColor(playerInfo.pointsRank)} />
                        </StatBarContainer>
                      </StatRow>
                      <StatRow>
                        <StatHeader>
                          <StatLabel>MOM점수</StatLabel>
                          <StatValue color={getRankColor(playerInfo.momRank)}>
                            {playerInfo.momScore || 0} ({playerInfo.momRank}위)
                          </StatValue>
                        </StatHeader>
                        <StatBarContainer>
                          <StatBar percentage={getStatPercentage(playerInfo.momScore || 0, 1000)} color={getRankColor(playerInfo.momRank)} />
                        </StatBarContainer>
                      </StatRow>
                     
                    </StatsGrid>

                    <AdvancedStatsSection>
                      <AdvancedStatsTitle>세부 스탯</AdvancedStatsTitle>
                      <AdvancedStatsGrid>
                        <AdvancedStatCard title="경기당 도움 기대값 (숫자가 높을수록 좋음)">
                          <AdvancedStatValue>{playerInfo.xA}</AdvancedStatValue>
                          <AdvancedStatLabel>xA</AdvancedStatLabel>
                        </AdvancedStatCard>
                        <AdvancedStatCard title="경기당 골 기대값 (숫자가 높을수록 좋음)">
                          <AdvancedStatValue>{playerInfo.war}</AdvancedStatValue>
                          <AdvancedStatLabel>xG</AdvancedStatLabel>
                        </AdvancedStatCard>
                        <AdvancedStatCard title="종합 기여도 (숫자가 높을수록 좋음)">
                          <AdvancedStatValue>{playerInfo.xG}</AdvancedStatValue>
                          <AdvancedStatLabel>WAR</AdvancedStatLabel>
                        </AdvancedStatCard>
                      </AdvancedStatsGrid>
                    </AdvancedStatsSection>

                    {/* 레벨업 메시지들 */}
                    {getLevelUpMessage(playerInfo.goals || 0, [5, 10, 15], ['골잡이', '득점기계', 'SOOP FC 메시'], '골') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.goals || 0, [5, 10, 15], ['골잡이', '득점기계', 'SOOP FC 메시'], '골')}</LevelUpMessage>
                    )}
                    {getLevelUpMessage(playerInfo.assists || 0, [5, 10], ['키패서', 'SOOP FC 이니에스타'], '개의 어시스트') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.assists || 0, [5, 10], ['키패서', 'SOOP FC 이니에스타'], '개의 어시스트')}</LevelUpMessage>
                    )}
                    {getLevelUpMessage(playerInfo.cleanSheets || 0, [5, 10, 15], ['뒷공간 지킴이', '수비의 리더', '클린 시트의 주역'], '클린시트') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.cleanSheets || 0, [5, 10, 15], ['뒷공간 지킴이', '수비의 리더', '클린 시트의 주역'], '클린시트')}</LevelUpMessage>
                    )}
                    {getLevelUpMessage(playerInfo.matches || 0, [5, 10, 20], ['꾸준함의 아이콘', 'SOOP FC 참석왕', 'SOOP FC 레전드'], '경기') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.matches || 0, [5, 10, 20], ['꾸준함의 아이콘', 'SOOP FC 참석왕', 'SOOP FC 레전드'], '경기')}</LevelUpMessage>
                    )}
                    {getLevelUpMessage(playerInfo.personalPoints || 0, [10, 20], ['팀의 핵심', '승점의 화신'], '승점') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.personalPoints || 0, [10, 20], ['팀의 핵심', '승점의 화신'], '승점')}</LevelUpMessage>
                    )}
                    {getLevelUpMessage(playerInfo.momScore || 0, [800, 900, 1000], ['경기의 MVP', 'MOM의 제왕', 'GOAT'], '점') && (
                      <LevelUpMessage>{getLevelUpMessage(playerInfo.momScore || 0, [800, 900, 1000], ['경기의 MVP', 'MOM의 제왕', 'GOAT'], '점')}</LevelUpMessage>
                    )}

                    <TitleContainer>
                      {getPlayerTitles(playerInfo).map((title, index) => (
                        <Title key={index}>{title}</Title>
                      ))}
{!playerInfo.isFlipped && (
    <div style={{ 
      marginTop: '30px', 
      textAlign: 'center',
      padding: '0 20px'
    }}>
      <ToggleHistoryButton
        as={Link}
        to={`/player-history/${playerInfo.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        선수 기록 더보기
      </ToggleHistoryButton>

      <div style={{
        marginTop: '12px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }}>
        다시 탭하면 카드로 돌아갑니다
      </div>
    </div>
  )}
                      
                    </TitleContainer>

                    {/* 안내 문구 */}
                   
                  </PlayerData>
                </div>

                {/* 뒷면: 사진 */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  boxSizing: 'border-box',
                }}>
                  <img
                    src={`${process.env.PUBLIC_URL}/card/${playerInfo.name.trim().replace(/\s+/g, '')}.png`}
                    alt={playerInfo.name}
                    onError={(e) => e.target.src = `${process.env.PUBLIC_URL}/card/nomal.png`}
                    style={{
                      width: '320px',
                      // height: '450px',
                      objectFit: 'cover',
                      borderRadius: '24px',
                      marginBottom: '30px',
                    }}
                  />
                  <h2 style={{
                    fontSize: '40px',
                    fontWeight: '900',
                    color: 'white',
                    margin: 0,
                    letterSpacing: '2px',
                  }}>
                    {playerInfo.name}
                  </h2>
                  <p style={{
                    margin: '10px 0 0',
                    fontSize: '20px',
                    color: '#ffffff',
                    fontWeight: '600',
                  }}>
                    SOOP FC
                  </p>
                </div>
           
              </div>
                {/* 스탯 카드일 때만 하단에 "선수 기록 더보기" 버튼 보이게 + 클릭하면 이동만! */}
             {/* 스탯 카드(뒷면)일 때만 버튼 + 안내 문구 보이게 */}
          

              {/* 사진 카드(앞면)일 때만 안내 문구만 */}
              {!playerInfo.isFlipped && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px 0',
                  color: '#e2e8f0',
                  fontSize: '17px',
                  marginTop: '10px',
                  fontWeight: '600'
                }}>
                  카드를 탭하면 스탯을 확인할 수 있습니다
                </div>
                
              )}
            </div>
 
            
          </>
        )}
   </Container>
    </OuterWrapper>
  );
};

export default Total;