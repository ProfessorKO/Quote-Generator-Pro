import { useEffect, useRef, useState } from 'react';

import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';

export const SCENE_DURATIONS = {
  scene1: 5000,
  scene2: 13000,
  scene3: 14500,
  scene4: 5000,
  scene5: 8000,
  scene6: 5000,
  scene7: 7000,
  scene8: 8000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
  scene4: Scene4,
  scene5: Scene5,
  scene6: Scene6,
  scene7: Scene7,
  scene8: Scene8,
};

type CaptionLine = {
  speaker: string;
  text: string;
  atMs: number;
  durMs: number;
};

type SceneDialogue = {
  file: string;
  delayMs: number;
  captions: CaptionLine[];
  /** Where to render captions; scenes with busy lower thirds use 'top'. */
  captionPos?: 'top' | 'bottom';
};

const MUSIC_VOLUME = 0.45;
const MUSIC_VOLUME_DUCKED = 0.14;

const DIALOGUE: Record<string, SceneDialogue> = {
  scene1: {
    file: 's1.mp3',
    delayMs: 800,
    captions: [
      { speaker: 'PM', text: 'GET SPIDER MATE IN HERE! NOW!', atMs: 0, durMs: 2300 },
    ],
  },
  scene2: {
    file: 's2.mp3',
    delayMs: 800,
    captions: [
      { speaker: 'DEFENSE MINISTER', text: 'Evacuate everyone from inside and surrounding the Opera House.', atMs: 0, durMs: 3800 },
      { speaker: 'DEFENSE MINISTER', text: 'Bring the target back to me alive. And stop the bomb from going off.', atMs: 3800, durMs: 4100 },
      { speaker: 'SPIDER MATE', text: "On it. Quote'll be in your inbox in ten seconds.", atMs: 8350, durMs: 3300 },
    ],
  },
  scene3: {
    file: 's3.mp3',
    delayMs: 500,
    captionPos: 'top',
    captions: [
      { speaker: 'SPIDER MATE', text: 'Evacuate Opera House: $1,000,000.', atMs: 0, durMs: 2700 },
      { speaker: 'SPIDER MATE', text: 'Bring target back alive: $2,000,000.', atMs: 2700, durMs: 2700 },
      { speaker: 'SPIDER MATE', text: 'Stop the bomb: $500,000.', atMs: 5400, durMs: 2400 },
      { speaker: 'SPIDER MATE', text: 'Call-out fee: $50,000.', atMs: 7800, durMs: 2500 },
      { speaker: 'SPIDER MATE', text: 'Emergency surcharge: 30%.', atMs: 10300, durMs: 3100 },
    ],
  },
  scene4: {
    file: 's4.mp3',
    delayMs: 700,
    captions: [
      { speaker: 'SPIDER MATE', text: 'Quote sent. Gotta love Quote Mate.', atMs: 0, durMs: 2500 },
    ],
  },
  scene5: {
    file: 's5.mp3',
    delayMs: 600,
    captions: [
      { speaker: 'DEFENSE MINISTER', text: 'Prime Minister! The quote just came in.', atMs: 0, durMs: 3300 },
      { speaker: 'DEFENSE MINISTER', text: "It's going to be 3.5 MILLION DOLLARS!", atMs: 3300, durMs: 3700 },
    ],
  },
  scene6: {
    file: 's6.mp3',
    delayMs: 700,
    captions: [
      { speaker: 'PM', text: 'Fine. As long as he gets the job done.', atMs: 0, durMs: 2900 },
    ],
  },
  scene7: {
    file: 's7.mp3',
    delayMs: 800,
    captions: [
      { speaker: 'SPIDER MATE', text: 'Another day, another quote.', atMs: 0, durMs: 1800 },
    ],
  },
  scene8: {
    file: 's8.mp3',
    delayMs: 900,
    captionPos: 'top',
    captions: [
      { speaker: 'NARRATOR', text: 'Quote Mate. Try it free today. Link in bio.', atMs: 0, durMs: 3000 },
    ],
  },
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dialogueRef = useRef<HTMLAudioElement | null>(null);
  const [activeCaption, setActiveCaption] = useState<CaptionLine | null>(null);

  // Background music: seek to scene start, duck under dialogue.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DIALOGUE[baseSceneKey] ? MUSIC_VOLUME_DUCKED : MUSIC_VOLUME;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  // Dialogue playback + captions, scheduled per scene.
  useEffect(() => {
    const dialogue = DIALOGUE[baseSceneKey];
    setActiveCaption(null);
    const el = dialogueRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    if (!dialogue) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        const audio = dialogueRef.current;
        if (!audio) return;
        audio.src = `${import.meta.env.BASE_URL}audio/dialogue/${dialogue.file}`;
        audio.volume = 1;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, dialogue.delayMs)
    );

    for (const line of dialogue.captions) {
      timers.push(
        setTimeout(() => setActiveCaption(line), dialogue.delayMs + line.atMs)
      );
      timers.push(
        setTimeout(
          () => setActiveCaption((cur) => (cur === line ? null : cur)),
          dialogue.delayMs + line.atMs + line.durMs
        )
      );
    }

    // Restore music volume after dialogue ends.
    const lastLine = dialogue.captions[dialogue.captions.length - 1];
    timers.push(
      setTimeout(() => {
        const music = audioRef.current;
        if (music) music.volume = MUSIC_VOLUME;
      }, dialogue.delayMs + lastLine.atMs + lastLine.durMs + 300)
    );

    return () => timers.forEach(clearTimeout);
  }, [currentSceneKey, baseSceneKey]);

  return (
    <div className="w-full h-screen overflow-hidden bg-background relative font-body text-foreground">
      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      {/* Dialogue captions */}
      <div
        className={`absolute inset-x-0 z-40 flex justify-center pointer-events-none px-[6vw] ${
          DIALOGUE[baseSceneKey]?.captionPos === 'top' ? 'top-[6vh]' : 'bottom-[7vh]'
        }`}
      >
        <AnimatePresence mode="wait">
          {activeCaption && (
            <motion.div
              key={`${activeCaption.speaker}-${activeCaption.atMs}-${activeCaption.text}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="max-w-[88vw] text-center"
            >
              <span
                className="inline-block font-display text-[3vw] tracking-wider uppercase px-[1.6vw] py-[0.3vh] mb-[0.6vh]"
                style={{ backgroundColor: '#F2930D', color: '#1B2C4D' }}
              >
                {activeCaption.speaker}
              </span>
              <p
                className="font-body text-white text-[4.6vw] leading-tight font-extrabold"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.7)' }}
              >
                {activeCaption.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
      <audio ref={dialogueRef} preload="auto" muted={muted} />
    </div>
  );
}
