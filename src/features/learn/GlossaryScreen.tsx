import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  GLOSSARY,
  GLOSSARY_SECTIONS,
  lookupTerm,
  type GlossaryTermId,
} from '@/components/coach/glossary';
import { LanguageToggle } from '@/components/coach/LanguageToggle';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

import { GlossaryEntryRow } from './GlossaryEntryRow';

/**
 * Every word the coach uses, and the switch that decides which set it uses.
 *
 * Pillar D's first slice, and the answer to the thing that made the coaching
 * unreadable: a verdict the player could not parse is one tap from the word that
 * confused them, already open.
 *
 * The control sits at the top rather than on a settings screen because this is
 * where a reader is when they realise they want the other register — they came
 * here because a word was unfamiliar.
 */
export function GlossaryScreen() {
  const { term } = useLocalSearchParams<{ term?: string }>();
  // A deep link is an untrusted string, so it is looked up rather than cast: a
  // stale or hand-typed link opens the glossary, it does not break it.
  const landed = lookupTerm(term);
  const [expanded, setExpanded] = useState<GlossaryTermId | null>(landed?.id ?? null);

  return (
    <Screen scroll>
      <Text variant="body" tone="secondaryLabel">
        Every word the coach uses, in both sets. Poker terms are what you will hear at a real table;
        plain English is the same thing said the way you would say it.
      </Text>

      <Section title="Which words the coach uses">
        <LanguageToggle />
      </Section>

      {GLOSSARY_SECTIONS.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.terms.map((id) => (
            <GlossaryEntryRow
              key={id}
              entry={GLOSSARY[id]}
              expanded={expanded === id}
              onToggle={() => setExpanded((current) => (current === id ? null : id))}
            />
          ))}
        </Section>
      ))}

      <Text variant="footnote" tone="secondaryLabel" style={styles.footer}>
        Tap any word to see more.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    textAlign: 'center',
    paddingBottom: spacing.lg,
  },
});
