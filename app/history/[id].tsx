import { useLocalSearchParams } from 'expo-router';

import { HandReplayScreen } from '@/features/tracker/HandReplayScreen';

export default function HandReplayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <HandReplayScreen handId={id} />;
}
