import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  getDocs,
  Timestamp,
  doc,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { db } from '../App';
import { format, isWithinInterval } from 'date-fns';
import moment from 'moment';
import styled, { keyframes } from 'styled-components';
import * as S from './Homecss';

// ========================
// 인트로 화면 스타일 (3.5초)
// ========================
const IntroOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  // background: #000 url('${process.env.PUBLIC_URL}/intro-bg.png') center center no-repeat;
  background-color: #000;
  background-size: 35% auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeOut 0.8s ease-in-out 3.2s forwards;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8));
  }

  @media (max-width: 768px) {
    background-size: 88% auto;
  }

  @media (max-width: 480px) {
    background-size: 92% auto;
  }

  @keyframes fadeOut {
    to {
      opacity: 0;
      visibility: hidden;
    }
  }
`;

const LogoContainer = styled.div`
  text-align: center;
  animation: floatUp 2s ease-in-out;

  img {
    width: 220px;
    height: auto;
    filter: drop-shadow(0 12px 40px rgba(0,0,0,0.7));
    animation: pulse 2s infinite;
  }

  @keyframes floatUp {
    0%   { transform: translateY(140px); opacity: 0; }
    60%  { transform: translateY(-20px); }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.12); }
  }
`;

// ========================
// MOM 플립 카드 전용 스타일 (Home.js 내부)
// ========================
const PlayerCardWrapper = styled.div`
  perspective: 1200px;
  width: 240px;
  height: 420px;
  cursor: pointer;
  flex-shrink: 0;
  scroll-snap-align: start;

  @media (max-width: 640px) {
    width: 85%;
    height: 460px;
  }
`;

const PlayerCardInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);

  &.flipped {
    transform: rotateY(180deg);
  }
`;

const CardFace = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 20px;
  overflow: hidden;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

const PlayerCardFront = styled(CardFace)`
  background: linear-gradient(135deg, #ffffff, #f8faff);
  border: 2px solid transparent;
  transition: border 0.3s;

  &:hover {
    border-color: rgba(49, 130, 246, 0.3);
  }
`;

const PlayerCardBack = styled(CardFace)`
  background: linear-gradient(135deg, #1e293b, #0f172a);
  transform: rotateY(180deg);
  color: white;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), transparent 60%);
    pointer-events: none;
  }
`;

const PlayerPhoto = styled.img`
  width: 200px;
  // height: 240px;
  object-fit: cover;
  border-radius: 16px;
  // border: 5px solid rgba(255, 255, 255, 0.25);
  // box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
  // margin-bottom: 16px;
  z-index: 1;
`;

const PlayerNameBack = styled.h3`
  font-size: 28px;
  font-weight: 800;
  margin: 12px 0 8px;
  text-shadow: 0 3px 10px rgba(0,0,0,0.6);
  z-index: 1;
`;

const PlayerQuote = styled.p`
  font-size: 15px;
  opacity: 0.9;
  font-style: italic;
  z-index: 1;
  margin: 0;
`;

// ========================
// 기존 버튼 스타일
// ========================
export const MatchButton = styled.a.attrs({
  as: Link,
})`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  color: white;
  background-color: #3182f6;
  border-radius: 12px;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(49, 130, 246, 0.2);
  transition: all 0.2s ease;
  margin: 0 8px 8px 0;
  animation: float 3s ease-in-out infinite;

  @keyframes float {
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-6px); }
    100% { transform: translateY(0px); }
  }

  svg { margin-right: 6px; font-size: 18px; }

  &:hover {
    background-color: #1c6fef;
    transform: translateY(2px);
    box-shadow: 0 8px 16px rgba(49, 130, 246, 0.3);
    animation-play-state: paused;
  }

  @media (max-width: 767px) {
    padding: 12px 24px;
    font-size: 16px;
  }
`;

// ========================
// localStorage 훅
// ========================
function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = value => {
    setStored(value);
    window.localStorage.setItem(key, JSON.stringify(value));
  };
  return [stored, setValue];
}

// ========================
// Home 컴포넌트 시작
// ========================
const Home = () => {
  const [showIntro, setShowIntro] = useState(true);

  // 여기 추가!
  const [flippedCards, setFlippedCards] = useState({});
  const toggleFlip = (index) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 5500);
    return () => clearTimeout(timer);
  }, []);

  const [players, setPlayers] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [momPlayers, setMomPlayers] = useState([]);
  const [showHint, setShowHint] = useState(true);
  const [showEnd, setShowEnd] = useState(false);
  const momRef = useRef(null);
  const [stats, setStats] = useState({
    members: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalCleanSheets: 0,
    totalGames: 0,
    attackpersonalPoints: 0,
    war: 0,
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeStartDate, setActiveStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [schedules, setSchedules] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [announces, setAnnounces] = useState([]);
  const [visibleIds, setVisibleIds] = useState([]);
  const [countdowns, setCountdowns] = useState({});
  const [voteExposures, setVoteExposures] = useState([]);
  const todayStr = format(new Date(), 'yyyyMMdd');
  const [hideToday, setHideToday] = useLocalStorage('hideAnnouncementsDate', null);
  const [holidays, setHolidays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [kingExposure, setKingExposure] = useState(false);

  // 26년 회장 추천 실시간 감지
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'kingVoteStatus', '2026'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (
          data.isHomeExposed &&
          data.exposeStartDateTime &&
          data.exposeEndDateTime
        ) {
          const start = data.exposeStartDateTime.toDate();
          const end = data.exposeEndDateTime.toDate();
          const now = new Date();

          if (isWithinInterval(now, { start, end })) {
            setKingExposure(true);
          } else {
            setKingExposure(false);
          }
        } else {
          setKingExposure(false);
        }
      } else {
        setKingExposure(false);
      }
    });

    return () => unsub && unsub();
  }, []);

  // 기존 투표 및 라인업 노출 데이터
  useEffect(() => {
    const fetchVoteExposures = async () => {
      const unsubscribe = onSnapshot(doc(db, 'voteStatus', todayStr), async (voteStatusDoc) => {
        const exposures = [];
        if (voteStatusDoc.exists()) {
          const { isEnabled, voteStartDateTime, voteEndDateTime, matchDate, exposedDates = [], isHomeExposed = false } = voteStatusDoc.data();
          const now = new Date();

          if (matchDate) {
            const match = new Date(matchDate);
            if (!isNaN(match.getTime())) {
              if (isHomeExposed) {
                const lineupDoc = await getDoc(doc(db, 'lineups', todayStr));
                if (lineupDoc.exists()) {
                  exposures.push({
                    date: todayStr,
                    dateStr: format(match, 'yyyy-MM-dd'),
                    matchId: `vote_${todayStr}`,
                    matchDate: match,
                    startDateTime: voteStartDateTime ? new Date(voteStartDateTime) : null,
                    endDateTime: voteEndDateTime ? new Date(voteEndDateTime) : null,
                    type: 'lineup',
                  });
                }
              }

              const momVoteDoc = await getDoc(doc(db, 'momVotes', todayStr));
              if (momVoteDoc.exists() && momVoteDoc.data().isActive && isEnabled && voteStartDateTime && voteEndDateTime) {
                const start = new Date(voteStartDateTime);
                const end = new Date(voteEndDateTime);
                if (isWithinInterval(now, { start, end }) && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  exposures.push({
                    date: todayStr,
                    dateStr: format(match, 'yyyy-MM-dd'),
                    matchId: `vote_${todayStr}`,
                    isVotingClosed: false,
                    matchDate: match,
                    startDateTime: start,
                    endDateTime: end,
                    type: 'vote',
                  });
                }
              }
            }
          }

          for (const date of exposedDates) {
            const voteDoc = await getDoc(doc(db, 'voteStatus', date));
            if (voteDoc.exists()) {
              const data = voteDoc.data();
              if (data.matchDate) {
                const match = new Date(data.matchDate);
                if (!isNaN(match.getTime())) {
                  if (data.isHomeExposed) {
                    const lineupDoc = await getDoc(doc(db, 'lineups', date));
                    if (lineupDoc.exists()) {
                      exposures.push({
                        date,
                        dateStr: format(match, 'yyyy-MM-dd'),
                        matchId: `vote_${date}`,
                        matchDate: match,
                        type: 'lineup',
                      });
                    }
                  }
                  const momVoteDoc = await getDoc(doc(db, 'momVotes', date));
                  if (momVoteDoc.exists() && momVoteDoc.data().isActive && data.isEnabled && data.voteStartDateTime && data.voteEndDateTime) {
                    const start = new Date(data.voteStartDateTime);
                    const end = new Date(data.voteEndDateTime);
                    if (isWithinInterval(now, { start, end })) {
                      exposures.push({
                        date,
                        dateStr: format(match, 'yyyy-MM-dd'),
                        matchId: `vote_${date}`,
                        isVotingClosed: false,
                        matchDate: match,
                        startDateTime: start,
                        endDateTime: end,
                        type: 'vote',
                      });
                    }
                  }
                }
              }
            }
          }
          setVoteExposures(exposures);
        } else {
          setVoteExposures([]);
        }
      });
      return () => unsubscribe && unsubscribe();
    };
    fetchVoteExposures();
  }, [todayStr]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const snap = await getDocs(collection(db, 'announcements'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllNotes(data);

        const now = Date.now();
        const published = data.filter(n => {
          if (!n.publishTimestamp || !n.publishDuration) return false;
          const t0 = new Date(n.publishTimestamp).getTime();
          const t1 = t0 + n.publishDuration * 1000;
          return now >= t0 && now <= t1;
        });

        setAnnounces(published);
        const ids = published.map(n => n.id);
        setVisibleIds(ids);
        const initialCd = {};
        published.forEach(n => {
          const t0 = new Date(n.publishTimestamp).getTime();
          const remainingSec = Math.max(0, Math.floor((t0 + n.publishDuration * 1000 - now) / 1000));
          initialCd[n.id] = remainingSec;
        });
        setCountdowns(initialCd);
      } catch (e) {
        console.error('공지사항 fetch 에러:', e);
      }
    };
    fetchNotes();
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdowns(prevCd => {
        const nextCd = { ...prevCd };
        Object.entries(prevCd).forEach(([id, sec]) => {
          if (sec > 0) {
            nextCd[id] = sec - 1;
            if (sec - 1 <= 0) {
              setVisibleIds(v => v.filter(vId => vId !== id));
            }
          }
        });
        return nextCd;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchAnniversaries = async () => {
      const year = activeStartDate.getFullYear();
      const month = String(activeStartDate.getMonth() + 1).padStart(2, '0');
      const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getAnniversaryInfo?solYear=${year}&solMonth=${month}&ServiceKey=CADGVCpJ6S3ugec34rtjEC4Fq1h0t0sbaD%2BchVRlpPGrKdOCDgyGmI0WnIpPQf4d7a4EPfo8FXmTmJqWxPrqrQ%3D%3D&_type=json`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        let items = json.response.body.items?.item || [];
        if (!Array.isArray(items)) items = items ? [items] : [];
        const evts = items.map(i => ({
          date: `${String(i.locdate).slice(0,4)}-${String(i.locdate).slice(4,6)}-${String(i.locdate).slice(6,8)}`,
          title: i.dateName,
        }));
        setAnniversaries(evts);
      } catch (e) {
        console.error('기념일 API 에러:', e);
      }
    };
    fetchAnniversaries();
  }, [activeStartDate]);

  useEffect(() => {
    const fetchHolidays = async () => {
      const year = activeStartDate.getFullYear();
      const month = String(activeStartDate.getMonth() + 1).padStart(2, '0');
      const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&solMonth=${month}&ServiceKey=CADGVCpJ6S3ugec34rtjEC4Fq1h0t0sbaD%2BchVRlpPGrKdOCDgyGmI0WnIpPQf4d7a4EPfo8FXmTmJqWxPrqrQ%3D%3D&_type=json`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        let items = json.response.body.items?.item || [];
        if (!Array.isArray(items)) items = items ? [items] : [];
        const days = items.map(i => {
          const d = String(i.locdate);
          return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
        });
        setHolidays(days);
      } catch (e) {
        console.error('공휴일 API 에러:', e);
      }
    };
    fetchHolidays();
  }, [activeStartDate]);

  useEffect(() => {
    const fetchPlayers = async () => {
      const snap = await getDocs(collection(db, 'players'));
      const ps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      ps.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setPlayers(ps);
    };
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (players.length) {
      const totalGoals = players.reduce((s, p) => s + (p.goals || 0), 0);
      const totalAssists = players.reduce((s, p) => s + (p.assists || 0), 0);
      const totalCleanSheets = players.reduce((s, p) => s + (p.cleanSheets || 0), 0);
      const totalGames = players.reduce((s, p) => s + (p.matches || 0), 0);
      setStats({
        members: players.length,
        totalGoals,
        totalAssists,
        totalCleanSheets,
        totalGames,
        attackpersonalPoints: totalGoals + totalAssists,
      });
      const lu = players[0].updatedAt;
      if (lu) setLastUpdated(new Date(lu.seconds * 1000));
    }
  }, [players]);

  useEffect(() => {
    const fetchMOM = async () => {
      const snap = await getDocs(collection(db, 'MOM'));
      if (snap.docs.length) {
        const data = snap.docs[0].data().players || [];
        setMomPlayers(data);
      }
    };
    fetchMOM();
  }, []);

  useEffect(() => {
    const el = momRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowHint(scrollLeft < 10);
      setShowEnd(scrollLeft + clientWidth >= scrollWidth - 10);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetchSchedules = async () => {
      const snap = await getDocs(collection(db, 'schedules'));
      const arr = snap.docs.map(d => {
        const dd = d.data().date;
        const date = dd instanceof Timestamp ? new Date(dd.seconds * 1000) : new Date(dd);
        return { id: d.id, text: d.data().text, date };
      });
      setSchedules(arr);
    };
    fetchSchedules();
  }, []);

  const onDateChange = date => setSelectedDate(date);
  const getSchedulesForSelectedDate = () =>
    schedules.filter(s => format(s.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));
  const upcomingSchedules = schedules
    .filter(s => s.date > new Date())
    .sort((a, b) => a.date - b.date)
    .slice(0, 2);

  const handleHideToday = () => {
    localStorage.setItem('hideAnnouncementsDate', todayStr);
    setHideToday(todayStr);
  };

  const getButtonState = (matchDate, isVotingClosed, matchId, startDateTime, endDateTime, type) => {
    if (!matchDate || isNaN(matchDate.getTime())) return { visible: false };
    if (type === 'vote') {
      if (!startDateTime || !endDateTime) return { visible: false };
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      if (isWithinInterval(new Date(), { start, end }) && !isVotingClosed) {
        return {
          visible: true,
          type: 'vote',
          to: `/announcements?matchId=${matchId}`,
          text: `${format(matchDate, 'M월 d일')} MOM 투표`,
        };
      }
    } else if (type === 'lineup') {
      return {
        visible: true,
        type: 'lineup',
        to: '/live',
        text: `${format(matchDate, 'M월 d일')} 경기 라인업 보기`,
      };
    }
    return { visible: false };
  };

  return (
    <>
      {showIntro && (
        <IntroOverlay>
          <LogoContainer>
            <img src={`${process.env.PUBLIC_URL}/SOOPLOGO.png`} alt="SOOP FC" />
          </LogoContainer>
        </IntroOverlay>
      )}

      <S.HomeContainer>
        <S.ContentWrapper>
          <S.HeroSection>
            <S.HeroContent>
              <S.HeroTitle>더 쉽게<br />더 즐겁게<br />축구하세요</S.HeroTitle>
              <S.HeroSubtitle>
                SOOP FC와 함께 축구 실력과 재미를 키워나가세요. 경기 기록, 출석체크, 팀원 통계까지 한눈에 확인하세요.
              </S.HeroSubtitle>
              <S.ButtonGroup>
                <S.PrimaryButton href="/total">내 스탯 보기</S.PrimaryButton>
                
                {voteExposures.map(exposure => {
                  const { visible, type, to, text } = getButtonState(
                    exposure.matchDate,
                    exposure.isVotingClosed,
                    exposure.matchId,
                    exposure.startDateTime,
                    exposure.endDateTime,
                    exposure.type
                  );
                  return visible && (
                    <MatchButton key={`${exposure.dateStr}-${type}`} to={to}>
                      {text}
                    </MatchButton>
                  );
                })}

                {kingExposure && (
                  <MatchButton
                    to="/king"
                    style={{
                      background: 'linear-gradient(135deg, #ff5e00, #e64a00)',
                      boxShadow: '0 8px 25px rgba(255, 94, 0, 0.5)',
                      fontWeight: '700',
                      fontSize: '19px',
                      animation: 'float 3s ease-in-out infinite',
                    }}
                  >
                    27년 회장 추천
                  </MatchButton>
                )}
              </S.ButtonGroup>
            </S.HeroContent>
            <S.HeroImageContainer>
              <S.HeroImage src={`${process.env.PUBLIC_URL}/Main.png`} alt="축구 동호회 이미지" />
            </S.HeroImageContainer>
          </S.HeroSection>

          <S.StatsContainer>
            <S.StatItem>
              <S.StatValue>{stats.totalGoals}</S.StatValue>
              <S.StatLabel>2026년 득점</S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.StatValue>{stats.totalAssists}</S.StatValue>
              <S.StatLabel>2026년 어시스트</S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.StatValue>{stats.totalCleanSheets}</S.StatValue>
              <S.StatLabel>26년 누적 클린시트</S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.StatValue>{stats.members}명</S.StatValue>
              <S.StatLabel>SOOP FC 누적 회원 수</S.StatLabel>
            </S.StatItem>
            <S.StatItem>
              <S.StatValue>{stats.attackpersonalPoints}</S.StatValue>
              <S.StatLabel>누적 공격 포인트</S.StatLabel>
            </S.StatItem>
          </S.StatsContainer>

          {lastUpdated && (
            <div style={{ textAlign: 'right', width: '100%', fontSize: 14, color: '#4e5968', margin: '-24px 0 40px' }}>
              마지막 업데이트: {lastUpdated.toLocaleDateString('ko-KR')} {lastUpdated.toLocaleTimeString('ko-KR')}
            </div>
          )}


<div style={{ marginBottom: '60px', width: '100%' }}>
  <S.MomSectionTitle>
    <img src={`${process.env.PUBLIC_URL}/mom.png`} alt="Mom Icon" /> M.O.M 플레이어
  </S.MomSectionTitle>
  {showHint && <S.SwipeHint>순위를 더 보려면 옆으로 넘겨주세요!</S.SwipeHint>}
  
  <S.MomPlayersContainer ref={momRef}>
    {momPlayers.length > 0 ? momPlayers.map((p, i) => {
      const isFlipped = flippedCards[i] !== false;
      const photoName = p.name.trim().replace(/\s+/g, '') + '.png';
      const photoPath = `${process.env.PUBLIC_URL}/card/${photoName}`;

      return (
     <PlayerCardWrapper 
  key={i} 
  onClick={() => toggleFlip(i)}
  style={{
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    transform: 'translateY(0)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-16px) scale(1.03)';
    e.currentTarget.style.boxShadow = '0 25px 50px rgba(251, 191, 36, 0.5)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0) scale(1)';
    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.12)';
  }}
>
          <PlayerCardInner className={isFlipped ? 'flipped' : ''}>
            
            {/* 앞면 - 통계 */}
            <PlayerCardFront>
              <S.PlayerHeader>
                <S.PlayerContainer>
                  <S.PlayerRankBadge>
                    <S.TrophyIcon src={`${process.env.PUBLIC_URL}/trophy.png`} alt="Trophy Icon" />
                    <S.PlayerRank>{p.rankText || '순위 미정'}</S.PlayerRank>
                  </S.PlayerRankBadge>
                  <S.PlayerScore title="누적 MOM점수">{p.momScore}</S.PlayerScore>
                </S.PlayerContainer>
                <S.PlayerName>{p.name}</S.PlayerName>
              </S.PlayerHeader>
              <S.PositionTags>
                {p.formations?.map((pos, idx) => <S.PositionTag key={idx} position={pos}>{pos}</S.PositionTag>)}
              </S.PositionTags>
              <S.WhiteDivider />
              <S.StatRow><S.StatLabel>골</S.StatLabel><S.StatLabel>{p.goals}</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>도움</S.StatLabel><S.StatLabel>{p.assists}</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>클린시트</S.StatLabel><S.StatLabel>{p.cleanSheets}</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>경기수</S.StatLabel><S.StatLabel>{p.matches}</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>승률</S.StatLabel><S.StatLabel>{p.winRate}%</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>승점</S.StatLabel><S.StatLabel>{p.personalPoints}</S.StatLabel></S.StatRow>
              <S.StatRow><S.StatLabel>WAR</S.StatLabel><S.StatLabel>{p.war}</S.StatLabel></S.StatRow>
            </PlayerCardFront>

            {/* 뒷면 - 사진 + 순위 */}
            <PlayerCardBack>
              <PlayerPhoto 
                src={photoPath}
                alt={p.name}
                onError={(e) => {
                  e.target.src = `${process.env.PUBLIC_URL}/card/nomal.png`;
                }}
              />

              <div style={{
                marginTop: '12px',
                borderRadius: '20px',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: '#fbbf24',
                  fontSize: '32px',
                  fontWeight: '900',
                }}>
                  <img src={`${process.env.PUBLIC_URL}/trophy.png`} alt="Trophy" style={{ width: '40px', height: '40px' }} />
                  {p.rankText || '순위 미정'}
                </div>
              </div>

              <PlayerNameBack style={{ marginTop: '16px', fontSize: '26px' }}>
                {p.name}
              </PlayerNameBack>
            </PlayerCardBack>

          </PlayerCardInner>
        </PlayerCardWrapper>
      );
    }) : <p style={{color: '#666', textAlign: 'center', width: '100%'}}>MOM 플레이어가 없습니다.</p>}
  </S.MomPlayersContainer>
  
  {showEnd && <S.EndMessage>MOM 순위는 여기까지입니다.</S.EndMessage>}
</div>
          <S.ScheduleSection>
            <S.ScheduleHeader>축구 일정 보기</S.ScheduleHeader>
            <S.StyledCalendar
              calendarType="gregory"
              locale="ko-KR"
              value={selectedDate}
              onActiveStartDateChange={({ activeStartDate }) => setActiveStartDate(activeStartDate)}
              onChange={onDateChange}
              tileContent={({ date, view }) => view === 'month' && schedules.some(s => format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) ? <span>⚽</span> : null}
              tileClassName={({ date, view }) => {
                if (view !== 'month') return;
                const dayStr = format(date, 'yyyy-MM-dd');
                if (date.getDay() === 6) return 'saturday';
                if (date.getDay() === 0 || holidays.includes(dayStr)) return 'sunday-or-holiday';
              }}
              formatDay={(locale, date) => moment(date).format('D')}
            />

            <div style={{ marginTop: 24 }}>
              <strong>{format(selectedDate, 'yyyy년 MM월 dd일')} 일정</strong>
              <S.ScheduleList>
                {getSchedulesForSelectedDate().length > 0 ?
                  getSchedulesForSelectedDate().map((it, idx) => <S.ScheduleItem key={idx}>{it.text}</S.ScheduleItem>)
                  : <S.ScheduleItem>일정 없음</S.ScheduleItem>}
              </S.ScheduleList>
            </div>

            <div style={{ marginTop: 24 }}>
              <strong>다가오는 일정</strong>
              <S.ScheduleList>
                {upcomingSchedules.length > 0 ?
                  upcomingSchedules.map((s, idx) =>
                    <S.ScheduleItem key={idx}>
                      {format(s.date, 'yyyy년 MM월 dd일 (E)')} - {s.text}
                    </S.ScheduleItem>
                  )
                  : <S.ScheduleItem>다가오는 일정이 없습니다.</S.ScheduleItem>}
              </S.ScheduleList>
            </div>
          </S.ScheduleSection>
        </S.ContentWrapper>
      </S.HomeContainer>
    </>
  );
};

export default Home;