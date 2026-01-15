import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../App';
import * as Styles from './Top10Css';

// 메달 컴포넌트
const Medal = ({ rank }) => {
  const images = {
    1: '/prize_1st.png',
    2: '/prize_2ed.png',
    3: '/prize3rd.png',
  };
  const src = images[rank] || '';
  return <Styles.Medal src={src} rank={rank} alt={`Rank ${rank} Medal`} />;
};

// 포지션 통일 함수
const unifyPosition = (position) => {
  const positionMap = {
    'CB1': 'CB', 'CB2': 'CB',
    'CDM1': 'CDM', 'CDM2': 'CDM',
    'CM1': 'CM', 'CM2': 'CM',
  };
  return positionMap[position] || position;
};

const TOP = () => {
  const [players, setPlayers] = useState([]);
  const [searchNickname, setSearchNickname] = useState('');
  const [fullRankingSearch, setFullRankingSearch] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [playerStats, setPlayerStats] = useState(null);
  const [showMorePopup, setShowMorePopup] = useState(null);
  const [positions, setPositions] = useState({});
  const [sortKey, setSortKey] = useState('matches');
  const [currentYear, setCurrentYear] = useState(null); // 처음엔 null → 자동 설정
  const [hasData, setHasData] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const fullRankingRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // 현재 시즌 판단 (클라이언트 기준)
  const getCurrentSeason = () => {
    const now = new Date();
    return now.getFullYear().toString(); // 2026
  };

  // 지원 연도 목록 자동 생성 (2022 ~ 현재년도)
  const availableYears = useMemo(() => {
    const startYear = 2022;
    const current = parseInt(getCurrentSeason());
    const years = [];
    for (let y = startYear; y <= current; y++) {
      years.push(y.toString());
    }
    return years; // ['2022','2023','2024','2025','2026']
  }, []);

  // 최초 로드 시 가장 최근 연도 자동 선택
  useEffect(() => {
    if (availableYears.length > 0 && !currentYear) {
      setCurrentYear(availableYears[availableYears.length - 1]); // 2026
    }
  }, [availableYears, currentYear]);

  // 사진 자동 로딩 + fallback
  const PlayerAvatar = ({ name, style }) => {
    const imageUrl = `/players/${name}.png`;
    return (
      <img
        src={imageUrl}
        alt={name}
        style={style}
        onError={(e) => {
          e.target.src = '/logo194.png';
        }}
      />
    );
  };

  useEffect(() => {
    if (!currentYear) return;

    const fetchAllData = async () => {
      try {
        let playerData = [];
        let positionMap = {};

        const isCurrentSeason = currentYear === getCurrentSeason();

        if (isCurrentSeason) {
          // 2026년 → 실시간 집계
          const [playerSnap, matchesSnap] = await Promise.all([
            getDocs(collection(db, 'players')),
            getDocs(query(collection(db, 'matches'))),
          ]);

          playerData = playerSnap.docs.map((doc) => doc.data());

          const playerPositions = {};
          matchesSnap.forEach((matchDoc) => {
            const matchData = matchDoc.data();
            const matchYear = matchData.date
              ? new Date(matchData.date).getFullYear().toString()
              : null;

            if (matchYear !== currentYear) return;

            const quarters = matchData.quarters || [];
            quarters.forEach((quarter) => {
              quarter.teams.forEach((team) => {
                team.players.forEach((player) => {
                  if (!playerPositions[player.name]) {
                    playerPositions[player.name] = {};
                  }
                  const unifiedPos = unifyPosition(player.position);
                  playerPositions[player.name][unifiedPos] =
                    (playerPositions[player.name][unifiedPos] || 0) + 1;
                });
              });
            });
          });

          for (const name in playerPositions) {
            const counts = Object.entries(playerPositions[name]);
            if (counts.length > 0) {
              const sorted = counts.sort((a, b) => b[1] - a[1]);
              positionMap[name] = sorted[0][0];
            }
          }
        } else {
          // 2022~2025 → history 서브컬렉션
          const snap = await getDocs(collection(db, 'players'));
          const yearlyDataPromises = snap.docs.map(async (playerDoc) => {
            const historyRef = doc(db, 'players', playerDoc.id, 'history', currentYear);
            const historyDoc = await getDoc(historyRef);
            if (historyDoc.exists()) {
              const historyData = historyDoc.data();
              if ((historyData.matches || 0) > 0) {
                return {
                  ...historyData,
                  name: playerDoc.data().name || playerDoc.id,
                };
              }
            }
            return null;
          });

          const yearlyData = (await Promise.all(yearlyDataPromises)).filter(Boolean);
          playerData = yearlyData.map((data) => ({
            ...data,
            goals: data.goals || 0,
            assists: data.assists || 0,
            cleanSheets: data.cleanSheets || 0,
            matches: data.matches || 0,
            win: data.win || 0,
            draw: data.draw || 0,
            lose: data.lose || 0,
            winRate: data.winRate || 0,
            personalPoints: data.personalPoints || 0,
            momScore: data.momScore || 0,
            momTop3Count: data.momTop3Count || 0,
            momTop8Count: data.momTop8Count || 0,
          }));
        }

        setHasData(playerData.length > 0);
        setPlayers(playerData);
        setPositions(positionMap);

        // 마지막 업데이트 시간 (현재 시즌일 때만 의미 있음)
        if (isCurrentSeason) {
          const latestPlayer = playerData
            .filter(p => p.updatedAt)
            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0];

          if (latestPlayer?.updatedAt) {
            setLastUpdated(new Date(latestPlayer.updatedAt.seconds * 1000));
          }
        }
      } catch (err) {
        console.error(`Error fetching data for ${currentYear}:`, err);
        setHasData(false);
      }
    };

    fetchAllData();

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentYear]);

  const processedPlayers = useMemo(() => {
    return players.map((player) => ({
      ...player,
      attackPoints: (player.goals || 0) + (player.assists || 0),
      position: positions[player.name] || null,
    }));
  }, [players, positions]);

  // 나머지 부분은 기존과 동일 (statsCategories, sortedAndFilteredPlayers, handle 함수들 등)
  const statsCategories = useMemo(() => {
    if (!hasData) return [];

    const calculateRankings = (key, unit, title) => {
      const sortedPlayers = [...processedPlayers]
        .filter((p) => p[key] > 0)
        .sort((a, b) => {
          if (b[key] === a[key]) return (b.matches || 0) - (a.matches || 0);
          return b[key] - a[key];
        });

      let currentRank = 1;
      let currentValue = sortedPlayers[0]?.[key] || 0;
      const rankedPlayers = sortedPlayers.map((player, index) => {
        if (index > 0 && player[key] < currentValue) {
          currentRank = index + 1;
          currentValue = player[key];
        }
        return {
          rank: currentRank,
          name: player.name,
          position: player.position,
          value: player[key],
          matches: player.matches || 0,
        };
      });

      return {
        id: key,
        title,
        unit,
        players: rankedPlayers,
      };
    };

    return [
      calculateRankings('matches', '경기', '출장수'),
      calculateRankings('goals', '골', '득점'),
      calculateRankings('assists', '개', '도움'),
      calculateRankings('attackPoints', 'P', '공격포인트'),
      calculateRankings('cleanSheets', '회', '클린시트'),
      calculateRankings('momScore', '점', '파워랭킹'),
      calculateRankings('momTop3Count', '회', 'TOP 3'),
      calculateRankings('momTop8Count', '회', 'TOP 8'),
      calculateRankings('personalPoints', '점', '개인승점'),
    ];
  }, [processedPlayers, hasData]);

  const sortedAndFilteredPlayers = useMemo(() => {
    const sorted = [...processedPlayers].sort((a, b) => {
      const aValue = a[sortKey] || 0;
      const bValue = b[sortKey] || 0;
      if (bValue === aValue) return (b.matches || 0) - (a.matches || 0);
      return bValue - aValue;
    });

    let currentRank = 1;
    let currentValue = sorted[0]?.[sortKey] || 0;
    const rankedPlayers = sorted.map((player, index) => {
      if (index > 0 && player[sortKey] < currentValue) {
        currentRank = index + 1;
        currentValue = player[sortKey];
      }
      return { ...player, rank: currentRank };
    });

    if (fullRankingSearch.trim()) {
      const nicknameLower = fullRankingSearch.toLowerCase();
      return rankedPlayers.filter((player) =>
        player.name.toLowerCase().includes(nicknameLower)
      );
    }
    return rankedPlayers;
  }, [processedPlayers, sortKey, fullRankingSearch]);

  const handleNavClick = (direction) => {
    const currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    if (direction === 'left') {
      newIndex--;
      if (newIndex < 0) return;
    } else {
      newIndex++;
      if (newIndex >= availableYears.length) return;
    }
    setCurrentYear(availableYears[newIndex]);
  };

  const handleSearch = () => {
    if (!searchNickname.trim()) return;
    const nicknameLower = searchNickname.toLowerCase();

    const getRank = (key) => {
      const category = statsCategories.find((c) => c.id === key);
      if (!category) return { rank: '-', value: 0 };
      const player = category.players.find((p) => p.name.toLowerCase() === nicknameLower);
      return player ? { rank: player.rank, value: player.value } : { rank: '-', value: 0 };
    };

    const stats = {
      matches: getRank('matches'),
      goals: getRank('goals'),
      assists: getRank('assists'),
      attackPoints: getRank('attackPoints'),
      cleanSheets: getRank('cleanSheets'),
      momScore: getRank('momScore'),
      momTop3Count: getRank('momTop3Count'),
      momTop8Count: getRank('momTop8Count'),
      personalPoints: getRank('personalPoints'),
    };

    setPlayerStats({ name: searchNickname, ...stats });
    setShowPopup(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleMoreClick = (category) => {
    setShowMorePopup({
      selectedCategory: category,
      categories: statsCategories,
    });
  };

  const handleCategoryChange = (category) => {
    setShowMorePopup((prev) => ({
      ...prev,
      selectedCategory: category,
    }));
  };

  const handleSort = (key) => {
    setSortKey(key);
  };

  const handleFullRankingKeyDown = () => {};

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - fullRankingRef.current.offsetLeft;
    scrollLeft.current = fullRankingRef.current.scrollLeft;
    fullRankingRef.current.style.cursor = 'grabbing';
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    fullRankingRef.current.style.cursor = 'grab';
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    fullRankingRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - fullRankingRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    fullRankingRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleTouchStart = (e) => {
    isDragging.current = true;
    startX.current = e.touches[0].pageX - fullRankingRef.current.offsetLeft;
    scrollLeft.current = fullRankingRef.current.scrollLeft;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const x = e.touches[0].pageX - fullRankingRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    fullRankingRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPositionVisible = currentYear === getCurrentSeason();

  if (!currentYear) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}>시즌 정보를 불러오는 중...</div>;
  }

  return (
    <Styles.Container>
      {lastUpdated && (
        <div
          style={{
            textAlign: 'right',
            width: '100%',
            fontSize: '14px',
            color: '#4e5968',
            marginTop: '-24px',
            marginBottom: '40px',
          }}
        >
          마지막 업데이트: {lastUpdated.toLocaleDateString('ko-KR')}{' '}
          {lastUpdated.toLocaleTimeString('ko-KR')}
        </div>
      )}

      <Styles.Header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Styles.NavArrow
            disabled={currentYear === availableYears[0]}
            onClick={() => handleNavClick('left')}
          >
            ❮
          </Styles.NavArrow>
          <Styles.Title>{currentYear}시즌</Styles.Title>
          <Styles.NavArrow
            disabled={currentYear === availableYears[availableYears.length - 1]}
            onClick={() => handleNavClick('right')}
          >
            ❯
          </Styles.NavArrow>
        </div>
        <Styles.SearchContainer>
          <Styles.SearchInput
            value={searchNickname}
            onChange={(e) => setSearchNickname(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="닉네임 입력"
          />
          <Styles.SearchButton onClick={handleSearch}>검색</Styles.SearchButton>
        </Styles.SearchContainer>
      </Styles.Header>

      {hasData ? (
        <>
          <Styles.StatsContainer>
            <Styles.StatsScroll>
              {statsCategories.length > 0 ? (
                statsCategories.map((category) => (
                  <Styles.StatsCard key={category.id}>
                    <Styles.StatsTitle>{category.title}</Styles.StatsTitle>
                    <Styles.RankingList>
                      {category.players.slice(0, 4).map((player) => (
                        <Styles.RankingItem key={`${category.id}-${player.rank}-${player.name}`}>
                          <Styles.RankWrapper>
                            <Styles.Rank isNumber={player.rank > 3}>
                              {player.rank === 1 && <Medal rank={1} />}
                              {player.rank === 2 && <Medal rank={2} />}
                              {player.rank === 3 && <Medal rank={3} />}
                              {player.rank > 3 && player.rank}
                            </Styles.Rank>
                          </Styles.RankWrapper>
                          <Styles.PlayerInfo style={{ display: 'flex', alignItems: 'center' }}>
                            <PlayerAvatar
                              name={player.name}
                              style={{
                                width: '36px',
                                marginRight: '10px',
                                objectFit: 'cover',
                                border: '2px solid #fff',
                              }}
                            />
                            <div>
                              <Styles.PlayerName>{player.name}</Styles.PlayerName>
                              {isPositionVisible && player.position && (
                                <Styles.PlayerPosition>{player.position}</Styles.PlayerPosition>
                              )}
                            </div>
                          </Styles.PlayerInfo>
                          <Styles.PlayerStat>
                            {player.value}
                            {category.unit}
                          </Styles.PlayerStat>
                        </Styles.RankingItem>
                      ))}
                    </Styles.RankingList>
                    <Styles.SeeMore onClick={() => handleMoreClick(category)}>더보기</Styles.SeeMore>
                  </Styles.StatsCard>
                ))
              ) : (
                <Styles.NoDataMessage>해당 연도에는 기록이 없습니다.</Styles.NoDataMessage>
              )}
            </Styles.StatsScroll>
          </Styles.StatsContainer>

          <Styles.FullRankingSection>
            <Styles.FullRankingTitle>전체 순위</Styles.FullRankingTitle>
            <Styles.FullRankingSearchContainer>
              <Styles.SearchInput
                value={fullRankingSearch}
                onChange={(e) => setFullRankingSearch(e.target.value)}
                onKeyDown={handleFullRankingKeyDown}
                placeholder="닉네임 검색"
              />
            </Styles.FullRankingSearchContainer>

            {sortedAndFilteredPlayers.length > 0 ? (
              <Styles.FullRankingContainer
                ref={fullRankingRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
              >
                <Styles.FullRankingTable>
                  <thead>
                    <tr>
                      <Styles.TableHeader active={sortKey === 'rank'} onClick={() => handleSort('rank')}>
                        등수
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'name'} onClick={() => handleSort('name')}>
                        이름
                      </Styles.TableHeader>
                      {isPositionVisible && (
                        <Styles.TableHeader active={sortKey === 'position'} onClick={() => handleSort('position')}>
                          포지션
                        </Styles.TableHeader>
                      )}
                      <Styles.TableHeader active={sortKey === 'matches'} onClick={() => handleSort('matches')}>
                        출장수
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'goals'} onClick={() => handleSort('goals')}>
                        득점
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'assists'} onClick={() => handleSort('assists')}>
                        도움
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'attackPoints'} onClick={() => handleSort('attackPoints')}>
                        공격P
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'cleanSheets'} onClick={() => handleSort('cleanSheets')}>
                        클린시트
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'momScore'} onClick={() => handleSort('momScore')}>
                        파워랭킹
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'momTop3Count'} onClick={() => handleSort('momTop3Count')}>
                        TOP3
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'momTop8Count'} onClick={() => handleSort('momTop8Count')}>
                        TOP8
                      </Styles.TableHeader>
                      <Styles.TableHeader active={sortKey === 'personalPoints'} onClick={() => handleSort('personalPoints')}>
                        승점
                      </Styles.TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredPlayers.map((player, index) => (
                      <Styles.TableRow key={index}>
                        <Styles.FixedTableCell>{player.rank}</Styles.FixedTableCell>
                        <Styles.FixedTableCell style={{ display: 'flex', alignItems: 'center' }}>
                          <PlayerAvatar
                            name={player.name}
                            style={{
                              width: '38px',
                              marginRight: '8px',
                              objectFit: 'cover',
                            }}
                          />
                          {player.name}
                        </Styles.FixedTableCell>
                        {isPositionVisible && <Styles.FixedTableCell>{player.position || '-'}</Styles.FixedTableCell>}
                        <Styles.TableCellStat>{player.matches || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.goals || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.assists || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.attackPoints || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.cleanSheets || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.momScore || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.momTop3Count || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.momTop8Count || 0}</Styles.TableCellStat>
                        <Styles.TableCellStat>{player.personalPoints || 0}</Styles.TableCellStat>
                      </Styles.TableRow>
                    ))}
                  </tbody>
                </Styles.FullRankingTable>
              </Styles.FullRankingContainer>
            ) : (
              <Styles.NoDataMessage>
                {fullRankingSearch.trim() ? '해당 선수를 찾을 수 없습니다.' : '해당 연도에는 기록이 없습니다.'}
              </Styles.NoDataMessage>
            )}
          </Styles.FullRankingSection>
        </>
      ) : (
        <Styles.NoDataMessage>해당 연도에는 기록이 없습니다.</Styles.NoDataMessage>
      )}

      {/* 선수 검색 팝업 */}
      {showPopup && playerStats && (
        <Styles.PopupOverlay onClick={() => setShowPopup(false)}>
          <Styles.PopupContent onClick={(e) => e.stopPropagation()}>
            <Styles.PopupInner>
              <Styles.PopupHeader>
                <Styles.PopupTitle style={{ display: 'flex', alignItems: 'center' }}>
                  <PlayerAvatar
                    name={playerStats.name}
                    style={{
                      width: '64px',
                      marginRight: '16px',
                      objectFit: 'cover',
                      border: '4px solid #fff',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{playerStats.name}님</div>
                    <div style={{ fontSize: '18px', color: '#666' }}>{currentYear}시즌 순위</div>
                  </div>
                </Styles.PopupTitle>
                <Styles.CloseButton onClick={() => setShowPopup(false)}>×</Styles.CloseButton>
              </Styles.PopupHeader>
              <Styles.StatsContainerInner>
                <Styles.StatsColumn>
                  <Styles.StatItem>
                    <Styles.StatLabel>출장수</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.matches.value} 경기</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.matches.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>득점</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.goals.value} 골</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.goals.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>도움</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.assists.value} 개</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.assists.rank}</Styles.StatRank>
                  </Styles.StatItem>
                </Styles.StatsColumn>

                <Styles.StatsColumn>
                  <Styles.StatItem>
                    <Styles.StatLabel>공격포인트</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.attackPoints.value} P</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.attackPoints.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>클린시트</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.cleanSheets.value} 회</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.cleanSheets.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>파워랭킹</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.momScore.value} 점</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.momScore.rank}</Styles.StatRank>
                  </Styles.StatItem>
                </Styles.StatsColumn>

                <Styles.StatsColumn>
                  <Styles.StatItem>
                    <Styles.StatLabel>TOP 3</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.momTop3Count.value} 회</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.momTop3Count.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>TOP 8</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.momTop8Count.value} 회</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.momTop8Count.rank}</Styles.StatRank>
                  </Styles.StatItem>
                  <Styles.StatItem>
                    <Styles.StatLabel>개인승점</Styles.StatLabel>
                    <Styles.StatValueWrapper>
                      <Styles.StatValue>{playerStats.personalPoints.value} 점</Styles.StatValue>
                    </Styles.StatValueWrapper>
                    <Styles.StatRank>순위: {playerStats.personalPoints.rank}</Styles.StatRank>
                  </Styles.StatItem>
                </Styles.StatsColumn>
              </Styles.StatsContainerInner>
              <Styles.PopupFooter>
                <Styles.SecondaryButton onClick={() => setShowPopup(false)}>닫기</Styles.SecondaryButton>
              </Styles.PopupFooter>
            </Styles.PopupInner>
          </Styles.PopupContent>
        </Styles.PopupOverlay>
      )}

      {/* 더보기 팝업 */}
      {showMorePopup && (
        <Styles.PopupOverlay onClick={() => setShowMorePopup(null)}>
          <Styles.TossPopup onClick={(e) => e.stopPropagation()}>
            <Styles.TossHeader>
              <Styles.TossTitle>
                {showMorePopup.selectedCategory.title} {currentYear}시즌 상위 순위
              </Styles.TossTitle>
              <Styles.TossCloseButton onClick={() => setShowMorePopup(null)}>×</Styles.TossCloseButton>
            </Styles.TossHeader>
            <Styles.CategoryButtonContainer>
              <Styles.CategoryButtonScroll>
                {showMorePopup.categories.map((category) => (
                  <Styles.CategoryButton
                    key={category.id}
                    active={showMorePopup.selectedCategory.id === category.id}
                    onClick={() => handleCategoryChange(category)}
                  >
                    {category.title}
                  </Styles.CategoryButton>
                ))}
              </Styles.CategoryButtonScroll>
            </Styles.CategoryButtonContainer>
            <Styles.TossList>
              {showMorePopup.selectedCategory.players.map((player) => (
                <Styles.TossListItem
                  key={`${showMorePopup.selectedCategory.id}-${player.rank}-${player.name}`}
                >
                  <Styles.TossRankWrapper>
                    <Styles.TossRank isNumber={player.rank > 3}>
                      {player.rank === 1 && <Medal rank={1} />}
                      {player.rank === 2 && <Medal rank={2} />}
                      {player.rank === 3 && <Medal rank={3} />}
                      {player.rank > 3 && player.rank}
                    </Styles.TossRank>
                  </Styles.TossRankWrapper>
                  <Styles.TossPlayerInfo style={{ display: 'flex', alignItems: 'center' }}>
                    <PlayerAvatar
                      name={player.name}
                      style={{
                        width: '44px',
                        marginRight: '12px',
                        objectFit: 'cover',
                      }}
                    />
                    <div>
                      <Styles.TossPlayerName>{player.name}</Styles.TossPlayerName>
                      {isPositionVisible && player.position && (
                        <Styles.TossPlayerPosition>{player.position}</Styles.TossPlayerPosition>
                      )}
                    </div>
                  </Styles.TossPlayerInfo>
                  <Styles.TossPlayerStat>
                    {player.value}
                    {showMorePopup.selectedCategory.unit}
                  </Styles.TossPlayerStat>
                </Styles.TossListItem>
              ))}
            </Styles.TossList>
          </Styles.TossPopup>
        </Styles.PopupOverlay>
      )}

      {showScrollTop && (
        <Styles.ScrollTopButton onClick={scrollToTop}>⏫</Styles.ScrollTopButton>
      )}
    </Styles.Container>
  );
};

export default TOP;