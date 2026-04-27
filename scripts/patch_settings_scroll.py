import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src/screens/settings"

FILES = [
    "MembersScreen.tsx",
    "HouseholdScreen.tsx",
    "DeleteAccountScreen.tsx",
    "OnboardingScreen.tsx",
    "PlanScreen.tsx",
    "HouseholdPendingInvitesScreen.tsx",
    "NotificationsScreen.tsx",
    "SharedActivityScreen.tsx",
    "PrivacyTermsScreen.tsx",
]

OLD_IMPORT = """import { headerContentTopInset } from '../../design/layout';
import { Screen } from '../../components/ui/Screen';"""

NEW_IMPORT = """import { useSettingsScrollHandler } from '../../navigation/NavigationChromeScrollContext';
import { Screen } from '../../components/ui/Screen';
import { useSettingsScrollInsets } from './settingsScrollLayout';"""

OLD_SCROLL = """    <Screen padded safeTop={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerContentTopInset }]}
        showsVerticalScrollIndicator={false}
      >"""

NEW_SCROLL = """    <Screen padded safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: scrollInsets.paddingTop,
            paddingBottom: scrollInsets.paddingBottom,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollInsets.scrollEventThrottle}
        contentInsetAdjustmentBehavior={scrollInsets.contentInsetBehavior}
        showsVerticalScrollIndicator={false}
      >"""

HOOK_LINES = """  const onScroll = useSettingsScrollHandler();
  const scrollInsets = useSettingsScrollInsets();
"""

OPEN_FN = re.compile(r"(export function \w+\([^)]*\) \{)\n")

for name in FILES:
    p = ROOT / name
    text = p.read_text()
    if OLD_IMPORT not in text:
        print(f"skip import: {name}")
        continue
    text = text.replace(OLD_IMPORT, NEW_IMPORT)
    if OLD_SCROLL not in text:
        print(f"skip scroll: {name}")
        continue
    text = text.replace(OLD_SCROLL, NEW_SCROLL)
    new_text, n = OPEN_FN.subn(r"\1\n" + HOOK_LINES, text, count=1)
    if n != 1:
        print(f"skip hooks: {name}")
        continue
    new_text = new_text.replace(
        "  content: { paddingBottom: spacing.xxl },\n", "  content: {},\n"
    )
    p.write_text(new_text)
    print(f"ok {name}")
