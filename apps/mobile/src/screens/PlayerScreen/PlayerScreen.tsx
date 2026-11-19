import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video, {
  OnLoadData,
  SelectedTrackType,
  SelectedVideoTrackType,
  VideoRef,
} from 'react-native-video';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Settings,
  X,
} from 'lucide-react-native';
import { PlaybackService } from '../../services/playbackService';
import { nextAd, PlaybackAd } from '../../services/adPlayback';
import { VastService } from '../../services/vastService';
import { PlaybackConfig } from '../../types';
import { SystemUiUtil } from '../../utils/systemUi';
import { AdMobService } from '../../services/adMobService';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';

const clock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(
    Math.floor(Math.max(0, seconds) % 60),
  ).padStart(2, '0')}`;
export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const contentId = route.params?.item?.id || route.params?.videoId;
  const title = route.params?.title || route.params?.item?.name || 'MaxxPixels';
  const video = useRef<VideoRef>(null);
  const position = useRef(0),
    total = useRef(0),
    lastSave = useRef(0),
    timelineWidth = useRef(1);
  const played = useRef(new Set<string>()),
    impressions = useRef(new Set<string>()),
    quartilesFired = useRef(new Set<string>());
  const active = useRef<PlaybackAd | undefined>(undefined),
    ended = useRef(false);
  const [config, setConfig] = useState<PlaybackConfig>();
  // Latest authorized session/config, read by the unmount cleanup.
  const sessionTokenRef = useRef<string | undefined>(undefined);
  const configRef = useRef<PlaybackConfig | undefined>(undefined);
  sessionTokenRef.current = config?.sessionToken;
  configRef.current = config;
  const [attempt, setAttempt] = useState(0),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true),
    [paused, setPaused] = useState(false),
    [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false),
    [settings, setSettings] = useState(false),
    [fill, setFill] = useState(false);
  const [foreground, setForeground] = useState(
      AppState.currentState === 'active',
    ),
    [error, setError] = useState('');
  const [ad, setAd] = useState<PlaybackAd>(),
    [adTime, setAdTime] = useState(0),
    [adDuration, setAdDuration] = useState(0);
  const [adLoading, setAdLoading] = useState(false),
    [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<number>(),
    [audio, setAudio] = useState<number>(),
    [subtitle, setSubtitle] = useState<number>();
  const [tracks, setTracks] = useState<
    Pick<OnLoadData, 'audioTracks' | 'textTracks' | 'videoTracks'>
  >({ audioTracks: [], textTracks: [], videoTracks: [] });
  const beginAd = useCallback((candidate?: PlaybackAd) => {
    active.current = candidate;
    quartilesFired.current.clear();
    setAd(candidate);
    setAdTime(0);
    setAdDuration(0);
    setAdLoading(Boolean(candidate));
  }, []);
  const finishAd = useCallback(() => {
    if (!active.current || active.current.key !== ad?.key) return;
    played.current.add(active.current.key);
    beginAd(
      nextAd(
        config?.ads || [],
        played.current,
        position.current,
        ended.current,
      ),
    );
  }, [ad, config, beginAd]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setConfig(undefined);
    played.current.clear();
    impressions.current.clear();
    beginAd();
    ended.current = false;
    setPaused(false);

    const isTrailer = Boolean(
      route.params?.isTrailer ||
      (route.params?.title && String(route.params.title).toLowerCase().includes('trailer'))
    );

    // Mandatory Login Guard: Streaming full video content requires active user session
    if (!isTrailer && !AuthService.isLoggedIn) {
      Toast.warning('Please sign in or create an account to start streaming.', 'Login Required');
      if (typeof navigation?.replace === 'function') {
        navigation.replace('Login');
        return;
      } else if (typeof navigation?.navigate === 'function') {
        navigation.navigate('Login');
        return;
      }
    }

    const directTrailerUrl =
      route.params?.videoUrl ||
      route.params?.streamUrl ||
      (isTrailer ? (route.params?.item?.trailerUrl || (route.params?.item as any)?.trailer_url) : undefined);

    if (isTrailer && directTrailerUrl && typeof directTrailerUrl === 'string' && directTrailerUrl.trim().length > 0) {
      const cleanUrl = directTrailerUrl.trim();
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        Linking.openURL(cleanUrl).catch(() => {});
        navigation.goBack();
        return;
      }
      const normalized = PlaybackService.normalizePlaybackUrl(cleanUrl);
      setConfig({
        streamUrl: normalized,
        ads: [],
        adMarkers: [],
        isHls: PlaybackService.isHlsStream(normalized),
      });
      setLoading(false);
      return;
    }

    const targetItem = route.params?.item || {
      id: contentId,
      slug: route.params?.slug,
      videoType: route.params?.videoType || 1,
      videoUrl: route.params?.videoUrl || route.params?.streamUrl,
      streamUrl: route.params?.streamUrl || route.params?.videoUrl,
    };

    PlaybackService.requestSecurePlayUrl(targetItem)
      .then(result => {
        if (!cancelled) {
          setConfig(result);
          beginAd(nextAd(result.ads, played.current, position.current));
        }
      })
      .catch(e => {
        if (!cancelled) {
          const directUrl =
            route.params?.videoUrl ||
            route.params?.streamUrl ||
            route.params?.item?.videoUrl ||
            route.params?.item?.streamUrl ||
            route.params?.item?.mediaUrl ||
            (route.params?.item as any)?.movie?.videoAssetId;

          if (directUrl && typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl)) {
            const normalized = PlaybackService.normalizePlaybackUrl(directUrl);
            setConfig({
              streamUrl: normalized,
              ads: [],
              adMarkers: [],
              isHls: PlaybackService.isHlsStream(normalized),
            });
            setLoading(false);
            return;
          }

          const rawMsg = e.message || '';
          const userFriendlyError = rawMsg.includes('prisma') || rawMsg.includes('constraint')
            ? 'Playback stream is currently synchronizing. Please try again in a moment.'
            : rawMsg || 'Unable to load this title.';

          setError(userFriendlyError);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, attempt, beginAd]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && foreground) {
      SystemUiUtil.setImmersive(true);
      SystemUiUtil.setSecureScreen(true);
    } else {
      SystemUiUtil.setImmersive(false);
      SystemUiUtil.setSecureScreen(false);
    }
    return () => {
      SystemUiUtil.setImmersive(false);
      SystemUiUtil.setSecureScreen(false);
    };
  }, [focused, foreground]);
  useEffect(() => {
    if (!controls || paused || settings || error || ad) return;
    const timer = setTimeout(() => setControls(false), 4000);
    return () => clearTimeout(timer);
  }, [controls, paused, settings, error, ad]);
  useEffect(() => {
    if (!ad || !foreground || !focused) return;
    const timer = setTimeout(finishAd, 15000);
    return () => clearTimeout(timer);
  }, [ad, adTime, foreground, focused, finishAd]);
  useEffect(
    () => () => {
      if (contentId && position.current > 0)
        void PlaybackService.recordProgress({
          contentId,
          positionSeconds: position.current,
          durationSeconds: total.current,
        });
      const token = sessionTokenRef.current;
      if (token)
        void PlaybackService.stopPlayback(token, {
          contentId: configRef.current?.contentId ?? contentId,
          episodeId: configRef.current?.episodeId,
          positionSeconds: position.current,
          durationSeconds: total.current,
        });
    },
    [contentId],
  );
  const seek = (target: number) => {
    if (active.current || locked || duration <= 0) return;
    const seconds = Math.max(0, Math.min(duration, target));
    position.current = seconds;
    setTime(seconds);
    video.current?.seek(seconds);
    beginAd(nextAd(config?.ads || [], played.current, seconds));
  };
  const handleExitPlayer = useCallback(() => {
    AdMobService.showInterstitial(() => navigation.goBack(), 'player_exit');
  }, [navigation]);
  const skipIn =
    ad?.skipAfter == null
      ? null
      : Math.max(0, Math.ceil(ad.skipAfter - adTime));
  const resolutions = [
    ...new Set(
      tracks.videoTracks
        .map(t => t.height)
        .filter((h): h is number => Boolean(h)),
    ),
  ].sort((a, b) => b - a);
  const option = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[styles.option, selected && styles.selected]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.text}>
        {selected ? '✓  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {config && (
        <Video
          key={`${contentId}-${attempt}`}
          ref={video}
          source={{
            uri: config.streamUrl,
            type: config.isHls ? 'm3u8' : undefined,
          }}
          style={StyleSheet.absoluteFill}
          resizeMode={fill ? 'cover' : 'contain'}
          paused={
            paused ||
            Boolean(ad) ||
            !foreground ||
            !focused ||
            settings ||
            Boolean(error)
          }
          rate={speed}
          playInBackground={false}
          playWhenInactive={false}
          selectedVideoTrack={
            quality === undefined
              ? { type: SelectedVideoTrackType.AUTO }
              : { type: SelectedVideoTrackType.RESOLUTION, value: quality }
          }
          selectedAudioTrack={
            audio === undefined
              ? { type: SelectedTrackType.SYSTEM }
              : { type: SelectedTrackType.INDEX, value: audio }
          }
          selectedTextTrack={
            subtitle === undefined
              ? { type: SelectedTrackType.DISABLED }
              : { type: SelectedTrackType.INDEX, value: subtitle }
          }
          onLoad={data => {
            setLoading(false);
            setDuration(data.duration);
            total.current = data.duration;
            setTracks({
              audioTracks: data.audioTracks || [],
              textTracks: data.textTracks || [],
              videoTracks: data.videoTracks || [],
            });
            if (position.current > 0) video.current?.seek(position.current);
          }}
          onBuffer={data => setLoading(data.isBuffering)}
          onProgress={data => {
            if (active.current) return;
            position.current = data.currentTime;
            setTime(data.currentTime);
            const candidate = nextAd(
              config.ads,
              played.current,
              data.currentTime,
            );
            if (candidate) beginAd(candidate);
            if (Date.now() - lastSave.current > 20000 && contentId) {
              lastSave.current = Date.now();
              void PlaybackService.recordProgress({
                contentId,
                positionSeconds: data.currentTime,
                durationSeconds: total.current,
              });
              if (config?.sessionToken) {
                void PlaybackService.sendHeartbeat(config.sessionToken, {
                  contentId: config.contentId ?? contentId,
                  episodeId: config.episodeId,
                  positionSeconds: data.currentTime,
                  durationSeconds: total.current,
                });
              }
            }
          }}
          onEnd={() => {
            ended.current = true;
            setPaused(true);
            setControls(true);
            beginAd(nextAd(config.ads, played.current, total.current, true));
          }}
          onError={() => {
            setError(
              'Unable to play this title. Check your connection and try again.',
            );
            setLoading(false);
          }}
        />
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setControls(value => !value)}
        accessibilityLabel="Show or hide playback controls"
      />
      {ad && (
        <View style={[StyleSheet.absoluteFill, styles.container]}>
          <Video
            key={ad.key}
            source={{ uri: ad.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            paused={!foreground || !focused}
            playInBackground={false}
            playWhenInactive={false}
            onLoad={data => {
              setAdDuration(data.duration);
              setAdLoading(false);
            }}
            onBuffer={data => setAdLoading(data.isBuffering)}
            onProgress={data => {
              setAdTime(data.currentTime);
              if (data.currentTime > 0 && !impressions.current.has(ad.key)) {
                impressions.current.add(ad.key);
                void PlaybackService.recordAdImpression(
                  ad.id,
                  contentId,
                  config?.sessionToken || config?.adSessionId,
                  { providerCode: ad.isVast ? 'INMOBI' : 'DIRECT' },
                );
                if (ad.impressionUrls) VastService.fireBeacons(ad.impressionUrls);
                if (ad.trackingEvents?.start) VastService.fireBeacons(ad.trackingEvents.start);
              }

              if (adDuration > 0) {
                const pct = (data.currentTime / adDuration) * 100;
                if (pct >= 25 && !quartilesFired.current.has(`${ad.key}_q1`)) {
                  quartilesFired.current.add(`${ad.key}_q1`);
                  if (ad.trackingEvents?.firstQuartile) VastService.fireBeacons(ad.trackingEvents.firstQuartile);
                }
                if (pct >= 50 && !quartilesFired.current.has(`${ad.key}_mid`)) {
                  quartilesFired.current.add(`${ad.key}_mid`);
                  if (ad.trackingEvents?.midpoint) VastService.fireBeacons(ad.trackingEvents.midpoint);
                }
                if (pct >= 75 && !quartilesFired.current.has(`${ad.key}_q3`)) {
                  quartilesFired.current.add(`${ad.key}_q3`);
                  if (ad.trackingEvents?.thirdQuartile) VastService.fireBeacons(ad.trackingEvents.thirdQuartile);
                }
              }
            }}
            onEnd={() => {
              if (ad.trackingEvents?.complete) VastService.fireBeacons(ad.trackingEvents.complete);
              finishAd();
            }}
            onError={finishAd}
          />
          <View style={[styles.adHeader, { top: insets.top + 12 }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Close player"
            >
              <ArrowLeft color="white" />
            </Pressable>
            <Text style={styles.adText}>
              {ad.title || 'Advertisement'}
              {adDuration > 0
                ? ` • ${clock(adDuration - adTime)} remaining`
                : ''}
            </Text>
          </View>
          {adLoading && (
            <ActivityIndicator style={styles.spinner} color="white" />
          )}
          {ad.clickThroughUrl && (
            <Pressable
              onPress={() => {
                if (ad.clickTrackingUrls) VastService.fireBeacons(ad.clickTrackingUrls);
                Linking.openURL(ad.clickThroughUrl!).catch(() => {});
              }}
              style={[styles.adCta, { bottom: insets.bottom + 24 }]}
            >
              <Text style={styles.adCtaText}>Visit Sponsor  ↗</Text>
            </Pressable>
          )}
          {skipIn !== null && (
            <Pressable
              disabled={skipIn > 0}
              onPress={() => {
                if (ad.trackingEvents?.skip) VastService.fireBeacons(ad.trackingEvents.skip);
                finishAd();
              }}
              style={[styles.skip, { bottom: insets.bottom + 24 }]}
            >
              <Text style={styles.text}>
                {skipIn > 0 ? `Skip in ${skipIn}s` : 'Skip ad  ›'}
              </Text>
            </Pressable>
          )}
          <View style={styles.adTimeline}>
            <View
              style={{
                height: 3,
                backgroundColor: '#FACC15',
                width: `${
                  adDuration > 0
                    ? Math.min(100, (adTime / adDuration) * 100)
                    : 0
                }%`,
              }}
            />
          </View>
        </View>
      )}
      {!ad && loading && !error && (
        <ActivityIndicator style={styles.spinner} size="large" color="white" />
      )}
      {!ad && controls && !locked && (
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 8,
              paddingLeft: insets.left + 20,
              paddingRight: insets.right + 20,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.row}>
            <Pressable
              onPress={handleExitPlayer}
              style={styles.button}
              accessibilityLabel="Back"
            >
              <ArrowLeft color="white" />
            </Pressable>
            <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={() => setSettings(true)}
              style={styles.button}
              accessibilityLabel="Playback settings"
            >
              <Settings color="white" />
            </Pressable>
          </View>
          {!error && (
            <View style={styles.center}>
              <Pressable
                onPress={() => seek(time - 10)}
                style={styles.button}
                accessibilityLabel="Rewind 10 seconds"
              >
                <RotateCcw size={30} color="white" />
                <Text style={styles.small}>10</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (ended.current) {
                    ended.current = false;
                    seek(0);
                  }
                  setPaused(!paused);
                }}
                style={styles.button}
                accessibilityLabel={paused ? 'Play' : 'Pause'}
              >
                {paused ? (
                  <Play size={42} color="white" fill="white" />
                ) : (
                  <Pause size={42} color="white" fill="white" />
                )}
              </Pressable>
              <Pressable
                onPress={() => seek(time + 10)}
                style={styles.button}
                accessibilityLabel="Forward 10 seconds"
              >
                <RotateCw size={30} color="white" />
                <Text style={styles.small}>10</Text>
              </Pressable>
            </View>
          )}
          <View>
            <View style={styles.row}>
              <Text style={styles.small}>{clock(time)}</Text>
              <View
                style={styles.scrub}
                onLayout={e => {
                  timelineWidth.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() => !locked && !ad}
                onResponderGrant={e =>
                  seek(
                    (e.nativeEvent.locationX / timelineWidth.current) *
                      duration,
                  )
                }
                onResponderMove={e =>
                  seek(
                    (e.nativeEvent.locationX / timelineWidth.current) *
                      duration,
                  )
                }
                accessibilityLabel="Playback position"
              >
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${
                          duration > 0
                            ? Math.min(100, (time / duration) * 100)
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.small}>{clock(duration)}</Text>
            </View>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Pressable onPress={() => setLocked(true)} style={styles.option}>
                <Text style={styles.small}>Lock</Text>
              </Pressable>
              <Pressable
                onPress={() => setSettings(true)}
                style={styles.option}
              >
                <Text style={styles.small}>
                  {quality ? `${quality}p` : 'Auto'} • {speed}x • Audio &
                  subtitles
                </Text>
              </Pressable>
              <Pressable onPress={() => setFill(!fill)} style={styles.option}>
                <Text style={styles.small}>{fill ? 'Fit' : 'Fill screen'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {locked && controls && !ad && (
        <Pressable onPress={() => setLocked(false)} style={styles.unlock}>
          <Text style={styles.text}>Unlock screen</Text>
        </Pressable>
      )}
      {error && !ad && (
        <View style={styles.error}>
          <Text style={styles.title}>Playback unavailable</Text>
          <Text style={[styles.text, { textAlign: 'center' }]}>{error}</Text>
          {/subscription|expire|premium|plan|purchase|buy|auth/i.test(error) ? (
            <Pressable
              onPress={() => navigation.replace('Subscription')}
              style={[styles.option, { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }]}
            >
              <Text style={[styles.text, { fontWeight: '800' }]}>Get Subscription</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setAttempt(n => n + 1)}
              style={styles.option}
            >
              <Text style={styles.text}>Retry</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={[styles.text, { color: '#94A3B8' }]}>Go back</Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={settings}
        transparent
        animationType="slide"
        onRequestClose={() => setSettings(false)}
      >
        <View style={styles.modal}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={styles.title}>Playback settings</Text>
              <Pressable
                onPress={() => setSettings(false)}
                accessibilityLabel="Close settings"
              >
                <X color="white" />
              </Pressable>
            </View>
            <ScrollView>
              <Text style={styles.heading}>Video quality</Text>
              {option('Auto', quality === undefined, () =>
                setQuality(undefined),
              )}
              {resolutions.map(h =>
                option(`${h}p`, quality === h, () => setQuality(h)),
              )}
              <Text style={styles.heading}>Audio language</Text>
              {option('Device default', audio === undefined, () =>
                setAudio(undefined),
              )}
              {tracks.audioTracks.map(t =>
                option(
                  `${t.title || t.language || 'Audio'} (${t.index + 1})`,
                  audio === t.index,
                  () => setAudio(t.index),
                ),
              )}
              <Text style={styles.heading}>Subtitles</Text>
              {option('Off', subtitle === undefined, () =>
                setSubtitle(undefined),
              )}
              {tracks.textTracks.map(t =>
                option(
                  `${t.title || t.language || 'Subtitles'} (${t.index + 1})`,
                  subtitle === t.index,
                  () => setSubtitle(t.index),
                ),
              )}
              <Text style={styles.heading}>Playback speed</Text>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate =>
                option(`${rate}x`, speed === rate, () => setSpeed(rate)),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  text: { color: '#FFF', fontSize: 15 },
  small: { color: '#DDD', fontSize: 12 },
  button: { padding: 12, alignItems: 'center', minWidth: 48 },
  center: {
    flexDirection: 'row',
    gap: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrub: { flex: 1, height: 36, justifyContent: 'center' },
  track: { height: 4, backgroundColor: '#555' },
  fill: { height: 4, backgroundColor: '#FFF' },
  spinner: { ...StyleSheet.absoluteFill },
  adHeader: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  adText: { color: '#FACC15', backgroundColor: '#171717', padding: 8 },
  skip: {
    position: 'absolute',
    right: 24,
    padding: 14,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#AAA',
  },
  adCta: {
    position: 'absolute',
    left: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E50914',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  adCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  adTimeline: { position: 'absolute', bottom: 0, width: '100%' },
  unlock: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    padding: 16,
    backgroundColor: '#222',
  },
  error: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    right: '15%',
    padding: 24,
    backgroundColor: '#151922',
    alignItems: 'center',
    gap: 16,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#141821',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  heading: { color: '#ABB5C7', marginTop: 16, marginBottom: 8, fontSize: 13 },
  option: { padding: 12, borderRadius: 6 },
  selected: { backgroundColor: '#303B50' },
});
