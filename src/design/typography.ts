import type { TextStyle } from 'react-native';
import { FONT_FAMILY } from './fonts';

/**
 * iOS-style typography scale. largeTitle/title2/headline/body/subhead/caption match spec.
 * Display titles use the Plus Jakarta Sans brand face (see fonts.ts); body and UI
 * styles stay on the system font. `fontFamily` carries the weight, so the matching
 * `fontWeight` is kept only as a graceful fallback before the font finishes loading.
 */
export const typography: Record<string, TextStyle> = {
  largeTitle: {
    fontFamily: FONT_FAMILY.displaySemiBold,
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 40,
  },
  title1: {
    fontFamily: FONT_FAMILY.displayBold,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  title2: {
    fontFamily: FONT_FAMILY.displaySemiBold,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  title3: {
    fontFamily: FONT_FAMILY.displaySemiBold,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  caption1: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 13,
  },
};
