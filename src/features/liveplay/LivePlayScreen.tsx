import { Screen } from '@/components/ui/Screen';

import { EthicsGate } from './EthicsGate';
import { LiveWatchScreen } from './LiveWatchScreen';
import { useEthicsAcknowledgement } from './useEthicsAcknowledgement';

/**
 * Pillar A, Live Assist: the ethics gate first and always, then the camera.
 *
 * There is no setup step — the hero's cards are read off the table like
 * everything else, so opening the tab is enough to start watching.
 */
export function LivePlayScreen() {
  const { status, accept } = useEthicsAcknowledgement();

  if (status === 'loading') {
    return <Screen center>{null}</Screen>;
  }

  if (status === 'needed') {
    return <EthicsGate onAccept={accept} />;
  }

  return <LiveWatchScreen />;
}
