const fs = require('fs');
const path = 'c:/Users/risay/masaki/010_TOEIC学習アプリ/Nextjs_ws/TOEICPRO/src/app/words/race/page.tsx';

let code = fs.readFileSync(path, 'utf8');

// 1. Replace HorseRaceAnimation implementation
const horseOldStart = code.indexOf(`const HorseRaceAnimation = ({`);
const horseOldEndToken = `// =============================\n// カウントダウンオーバーレイ`;
const horseOldEnd = code.indexOf(horseOldEndToken);

const horseNewCode = `const HorseRaceAnimation = ({
  participants,
  myUserId,
  userTotalXp,
  phase,
  startDistances,
  targetDistances,
  currentDayLabel,
}: {
  participants: RaceParticipant[];
  myUserId: string | null;
  userTotalXp: number;
  phase: RacePhase;
  startDistances: Record<string, number>;
  targetDistances: Record<string, number>;
  currentDayLabel?: string;
}) => {
  const sorted = [...participants].sort((a, b) => b.distance - a.distance);
  const maxDistance = sorted[0]?.distance || 1;
  const displayScale = maxDistance > 0 ? 90 / maxDistance : 1;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden relative">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-[var(--muted-foreground)]">START</span>
        <div className="flex-1 mx-3 border-b border-dashed border-[var(--border)] flex justify-center">
           {currentDayLabel && <span className="absolute -mt-2 bg-[var(--background)] px-2 text-[10px] font-bold text-[var(--accent)] rounded-full border border-[var(--border)]">{currentDayLabel}</span>}
        </div>
        <span className="text-[11px] font-bold text-[var(--muted-foreground)]">🏁</span>
      </div>

      <div className="px-2 pb-3 space-y-0.5">
        {sorted.map((p, index) => {
          const isMe = p.user_id === myUserId;
          const charType = (p.character_type || "cat") as CharacterType;
          const cpuXp = p.cpu_total_xp ?? 5000;
          const xpForChar = isMe ? userTotalXp : cpuXp;
          const rank = index + 1;

          const sDist = startDistances[p.id] || 0;
          const tDist = targetDistances[p.id] || p.distance;

          const finalPos = Math.max(tDist * displayScale, 2);
          const startPos = Math.max(sDist * displayScale, 2);

          const raceDelay = phase === "racing" ? 0.2 + (Math.random() * 0.4) : 0;
          const raceDuration = phase === "racing" ? 1.5 + (Math.random() * 1.0) : 0.4;

          return (
            <div key={p.id} className={\`relative flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-all \${isMe ? "bg-[var(--accent)]/8 border border-[var(--accent)]/20" : ""}\`}>
              <span className={\`text-[10px] font-bold w-4 text-center shrink-0 \${
                rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-600" : "text-[var(--muted-foreground)]"
              }\`}>
                {phase === "finished" ? rank : ""}
              </span>

              <div className="flex-1 relative h-9 bg-gradient-to-r from-emerald-900/10 via-emerald-800/5 to-emerald-900/10 rounded border border-[var(--border)]/30">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(34,197,94,0.15) 8px, rgba(34,197,94,0.15) 9px)" }} />
                
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 z-10"
                  initial={{ left: \`\${startPos}%\` }}
                  animate={{ left: phase === "racing" || phase === "finished" ? \`\${Math.min(finalPos, 92)}%\` : \`\${startPos}%\` }}
                  transition={{ duration: raceDuration, delay: raceDelay, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="relative -translate-x-1/2">
                    {phase === "racing" && (
                      <motion.div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[8px] text-[var(--muted-foreground)]/30" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0] }} transition={{ duration: 0.3, repeat: 5, delay: raceDelay }}>💨</motion.div>
                    )}
                    <PixelCharacterMini type={charType} totalXp={xpForChar} />
                  </div>
                </motion.div>
                <div className="absolute right-0 top-0 bottom-0 w-px bg-amber-500/30" />
              </div>

              <div className="w-20 shrink-0 text-right">
                <div className={\`text-[9px] font-semibold truncate \${isMe ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}\`}>
                  {isMe ? "あなた" : p.display_name.replace("CPU ", "")}
                </div>
                <motion.div className="text-[9px] text-[var(--muted-foreground)]" initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
                  {tDist.toLocaleString()}xp
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {phase === "countdown" && <CountdownOverlay />}
      </AnimatePresence>
    </div>
  );
};

`;

if (horseOldStart === -1 || horseOldEnd === -1) {
  console.log("Could not find HorseRaceAnimation boundaries");
} else {
  code = code.substring(0, horseOldStart) + horseNewCode + code.substring(horseOldEnd);
}

// 2. Replace the variables and useEffect in RacePage
const pageOldEffectStart = code.indexOf(`  // レースアニメーション自動開始`);
const pageOldEffectEndToken = `  const handleCharacterSelect`;
const pageOldEffectEnd = code.indexOf(pageOldEffectEndToken);

const pageNewEffectCode = `  const [startDistances, setStartDistances] = useState<Record<string, number>>({});
  const [targetDistances, setTargetDistances] = useState<Record<string, number>>({});
  const [currentDayLabel, setCurrentDayLabel] = useState<string>("");
  const [recapParticipants, setRecapParticipants] = useState<RaceParticipant[] | null>(null);

  // レースアニメーション自動開始
  useEffect(() => {
    if (!raceData || animationTriggered.current) return;
    animationTriggered.current = true;

    const todayStr = getJSTDateString();
    const lastRecapWatched = localStorage.getItem("race_recap_watched");
    const mostRecentHistory = history.length > 0 ? history[0].week_start : null;

    if (mostRecentHistory && lastRecapWatched !== mostRecentHistory) {
      // Recap mode
      (async () => {
        try {
          const pList = await getRaceParticipantsByWeek(mostRecentHistory);
          setRecapParticipants(pList);
          
          const days: string[] = [];
          for(let i=0; i<7; i++){
             const d = new Date(mostRecentHistory);
             d.setDate(d.getDate() + i);
             days.push(getJSTDateString(d));
          }

          const runRecap = async () => {
            let currStart: Record<string, number> = {};
            for (const p of pList) currStart[p.id] = 0;

            for (let i = 0; i < 7; i++) {
               const dayStr = days[i];
               setCurrentDayLabel(\`\${i+1}日目\`);
               
               let currTarget: Record<string, number> = {};
               for (const p of pList) {
                  const prog = p.daily_progress || {};
                  let maxDist = currStart[p.id];
                  for(const [k, v] of Object.entries(prog)) {
                     if (k <= dayStr && v > maxDist) maxDist = v; 
                  }
                  currTarget[p.id] = maxDist;
               }
               setStartDistances(currStart);
               setTargetDistances(currTarget);

               setRacePhase("ready");
               if (i === 0) {
                 await new Promise(r => setTimeout(r, 500));
                 setRacePhase("countdown");
                 await new Promise(r => setTimeout(r, 2300));
               } else {
                 await new Promise(r => setTimeout(r, 300));
               }

               setRacePhase("racing");
               await new Promise(r => setTimeout(r, 2000));
               
               currStart = { ...currTarget };
               setRacePhase("finished");
               await new Promise(r => setTimeout(r, 600));
            }
            
            localStorage.setItem("race_recap_watched", mostRecentHistory);
            setRecapParticipants(null);
            setCurrentDayLabel("");
            
            // Re-render components gracefully to Daily Mode
            startDailyAnimation();
          };

          runRecap();
        } catch (e) {
          console.error("Recap failed", e);
          startDailyAnimation();
        }
      })();
    } else {
      startDailyAnimation();
    }

    function startDailyAnimation() {
       const yesterdayD = new Date();
       yesterdayD.setDate(yesterdayD.getDate() - 1);
       const yesterdayStr = getJSTDateString(yesterdayD);

       const pList = raceData!.participants;
       const lastWatchedDate = localStorage.getItem("race_daily_watched_" + raceData!.weekStart);

       let sDist: Record<string, number> = {};
       let tDist: Record<string, number> = {};

       if (lastWatchedDate === todayStr) {
          for (const p of pList) {
            sDist[p.id] = p.distance;
            tDist[p.id] = p.distance;
          }
          setStartDistances(sDist);
          setTargetDistances(tDist);
          setRacePhase("finished");
       } else {
          for (const p of pList) {
             let startPoint = 0;
             let targetPoint = 0;
             const prog = p.daily_progress || {};

             if (lastWatchedDate) {
               for(const [k, v] of Object.entries(prog)) {
                 if (k <= lastWatchedDate && v > startPoint) startPoint = v;
               }
             }

             for(const [k, v] of Object.entries(prog)) {
                if (k <= yesterdayStr && v > targetPoint) targetPoint = v;
             }
             // Fallback
             if (targetPoint < startPoint) targetPoint = startPoint;

             sDist[p.id] = startPoint;
             tDist[p.id] = targetPoint;
          }
          setStartDistances(sDist);
          setTargetDistances(tDist);

          const seq = async () => {
            setRacePhase("ready");
            await new Promise(r => setTimeout(r, 500));
            setRacePhase("countdown");
            await new Promise(r => setTimeout(r, 2300));
            
            setRacePhase("racing");
            await new Promise(r => setTimeout(r, 2500));
            
            // 最後に現在位置(今日分含む)に到達させる
            let cDist: Record<string, number> = {};
            for (const p of pList) cDist[p.id] = p.distance;
            setTargetDistances(cDist);
            
            await new Promise(r => setTimeout(r, 800));
            setRacePhase("finished");
            localStorage.setItem("race_daily_watched_" + raceData!.weekStart, todayStr);
          };
          seq();
       }
    }
  }, [raceData, history]);

`;

if (pageOldEffectStart === -1 || pageOldEffectEnd === -1) {
  console.log("Could not find useEffect boundaries");
} else {
  code = code.substring(0, pageOldEffectStart) + pageNewEffectCode + code.substring(pageOldEffectEnd);
}

// 3. Passing props to HorseRaceAnimation
const oldRenderTrack = `<HorseRaceAnimation
              participants={raceData.participants}
              myUserId={userId}
              weeklyTarget={raceData.weeklyTarget}
              userTotalXp={raceData.userTotalXp}
              phase={racePhase}
            />`;

const newRenderTrack = `<HorseRaceAnimation
              participants={recapParticipants || raceData.participants}
              myUserId={userId}
              userTotalXp={raceData.userTotalXp}
              phase={racePhase}
              startDistances={startDistances}
              targetDistances={targetDistances}
              currentDayLabel={currentDayLabel}
            />`;

if (code.includes(oldRenderTrack)) {
  code = code.replace(oldRenderTrack, newRenderTrack);
} else {
  console.log("Could not find oldRenderTrack string.");
}

fs.writeFileSync(path, code);
console.log('Update finished.');
