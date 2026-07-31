import { Screen } from '@/components/ui/Screen';

import { EthicsGate } from './EthicsGate';
import { HandSetupPanel } from './HandSetupPanel';
import { LiveWatchScreen } from './LiveWatchScreen';
import { useEthicsAcknowledgement } from './useEthicsAcknowledgement';
import { useLivePlayStore } from './useLivePlayStore';

/**
 * Pillar A, Live Assist: the ethics gate first and always, then hand setup,
 * then the watching HUD. Composition only — every state lives in the store.
 */
export function LivePlayScreen() {
  const { status, accept } = useEthicsAcknowledgement();
  const phase = useLivePlayStore((state) => state.phase);

  if (status === 'loading') {
    return <Screen center>{null}</Screen>;
  }

  if (status === 'needed') {
    return <EthicsGate onAccept={accept} />;
  }

  if (phase === 'setup') {
    return (
      <Screen scroll>
        <HandSetupPanel />
      </Screen>
    );
  }

  return <LiveWatchScreen />;
}
