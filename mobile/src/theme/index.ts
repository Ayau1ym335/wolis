/**
 * src/theme/index.ts
 * Wolis brand design tokens.
 * Brand palette: #731919 (maroon), #bfa4b8 (blush/mauve), black, #f5f5f7 (offwhite)
 */

export const Colors = {
  // Brand primaries
  maroon: "#731919",
  maroonDark: "#4a1010",
  maroonLight: "#9e2222",

  // Neutrals
  ink: "#141616",
  white: "#ffffff",
  offwhite: "#f5f5f7",
  stone: "#f0ebe6",

  // Mauve / blush accent
  blush: "#bfa4b8",
  blushLight: "#e1cadb",
  blushDark: "#8c6d84",

  // Functional
  success: "#2d7d5a",
  successBg: "#d4ede4",
  warning: "#c4781a",
  warningBg: "#f9e9cf",
  error: "#731919",
  errorBg: "#fde8e8",

  // Surface / border
  surfaceAlt: "#f0ebe6",
  border: "#e4dcd8",
  borderLight: "#ede8e4",

  // Text hierarchy
  textPrimary: "#141616",
  textSecondary: "#8c7680",
  textTertiary: "#b0a4a8",
  textOnDark: "#f5f5f7",
  textOnMaroon: "#ffffff",
} as const;

export const Typography = {
  serif: "Fraunces_600SemiBold",
  serifMedium: "Fraunces_500Medium",
  sansRegular: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 100,
} as const;

export const Shadow = {
  card: {
    shadowColor: "#141616",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: "#141616",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;
