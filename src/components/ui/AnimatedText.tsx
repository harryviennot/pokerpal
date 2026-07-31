import Animated from 'react-native-reanimated';

import { Text } from './Text';

/** `Text` that accepts a reanimated style, for ink that changes colour on the fly. */
export const AnimatedText = Animated.createAnimatedComponent(Text);
