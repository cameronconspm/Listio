import {
  collapseDictationDuplicate,
  normalizeDictationTextInput,
} from '../src/utils/normalizeDictationTextInput';

describe('normalizeDictationTextInput', () => {
  it('collapses iOS dictation exact doubling', () => {
    expect(normalizeDictationTextInput('Bananas', 'BananasBananas')).toBe('Bananas');
    expect(normalizeDictationTextInput('Banana', 'BananaBanana')).toBe('Banana');
  });

  it('collapses autocorrected dictation in one event (Banana → BananasBananas)', () => {
    expect(normalizeDictationTextInput('Banana', 'BananasBananas')).toBe('Bananas');
    expect(normalizeDictationTextInput('banana', 'BananasBananas')).toBe('Bananas');
  });

  it('collapses odd-length mic-off duplicates (Banana → BananaBananas)', () => {
    expect(normalizeDictationTextInput('Banana', 'BananaBananas')).toBe('Bananas');
    expect(collapseDictationDuplicate('BananaBananas')).toBe('Bananas');
  });

  it('collapses doubling with a space separator', () => {
    expect(normalizeDictationTextInput('milk', 'milk milk')).toBe('milk');
  });

  it('leaves normal typing unchanged', () => {
    expect(normalizeDictationTextInput('ban', 'bananas')).toBe('bananas');
    expect(normalizeDictationTextInput('apple', 'apple pie')).toBe('apple pie');
  });

  it('does not collapse unrelated equal halves', () => {
    expect(normalizeDictationTextInput('milk', 'BananasBananas')).toBe('BananasBananas');
  });

  it('leaves empty previous value unchanged for short strings', () => {
    expect(normalizeDictationTextInput('', 'Bananas')).toBe('Bananas');
    expect(normalizeDictationTextInput('', 'bonbon')).toBe('bonbon');
  });

  it('collapses from empty when the duplicate is long enough', () => {
    expect(normalizeDictationTextInput('', 'BananasBananas')).toBe('Bananas');
    expect(collapseDictationDuplicate('BananaBananas')).toBe('Bananas');
  });
});

describe('collapseDictationDuplicate', () => {
  it('collapses on blur when dictation slipped through', () => {
    expect(collapseDictationDuplicate('BananasBananas')).toBe('Bananas');
    expect(collapseDictationDuplicate('  BaconBacon  ')).toBe('Bacon');
  });

  it('leaves short natural repeats alone', () => {
    expect(collapseDictationDuplicate('bonbon')).toBe('bonbon');
  });
});
