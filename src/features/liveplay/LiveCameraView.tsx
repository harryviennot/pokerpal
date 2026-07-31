import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

import { DemoFeedPanel } from './DemoFeedPanel';
import { useCardFrameProcessor } from './useCardFrameProcessor';
import { useLivePlayStore } from './useLivePlayStore';

/**
 * The stage: the live camera feeding the detector, active only while this
 * screen is focused and the app is foregrounded so the sensor is never held
 * hostage. Falls back to the demo feed when there is no camera at all (a
 * simulator) or the detector has no model, and to a plain ask when the camera
 * permission is missing.
 */
export function LiveCameraView() {
  const { colors } = useTheme();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [denied, setDenied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => setFocused(false);
    }, []),
  );

  const { status, frameOutput } = useCardFrameProcessor((frame) => {
    useLivePlayStore.getState().ingestFrame(frame);
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });

    return () => subscription.remove();
  }, []);

  const ask = async (): Promise<void> => {
    const granted = await requestPermission();

    setDenied(!granted);
  };

  // Before the permission ask: with no camera to grant access to, asking is
  // noise — the demo feed is the whole experience on a simulator.
  if (device == null || status === 'unavailable') {
    return <DemoFeedPanel />;
  }

  if (!hasPermission) {
    return (
      <View style={[styles.stage, styles.centered, { backgroundColor: colors.felt }]}>
        <Text variant="subheadline" tone="secondaryLabel" style={styles.askText}>
          {denied
            ? 'Camera access is off. Enable it in Settings to watch a table.'
            : 'LivePlay reads the board through the camera.'}
        </Text>
        {denied ? null : <Button label="Allow camera" onPress={() => void ask()} />}
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={focused && appActive}
        outputs={[frameOutput]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    padding: spacing.base,
  },
  askText: {
    textAlign: 'center',
  },
});
