/**
 * screens/LoginScreen/index.tsx
 *
 * TASK 36 — Email / password login screen.
 *
 * Design:
 *   • Wolis logo lock-up (same as DeviceConnectionScreen)
 *   • Email + password text inputs
 *   • "Войти" primary CTA → useAuth().signIn()
 *   • Loading state during request
 *   • Error banner with server message
 *   • Keyboard-avoiding scroll
 *
 * The screen is shown by WolisNavigator when status === "unauthenticated".
 * On success the AuthStore flips to "authenticated", WolisNavigator
 * moves to DeviceConnectionScreen automatically (no explicit navigate needed).
 */

import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";
import { useAuth } from "../../features/auth/useAuth";

// ─── Wolis logo mark (shared visual) ─────────────────────────────────────────
function WolisLogo() {
  return (
    <View style={styles.logoLockup}>
      <View style={styles.logoRow}>
        <Text style={styles.logoLetters}>W</Text>
        <View style={styles.logoO}>
          <View style={styles.logoOInner} />
        </View>
        <Text style={styles.logoLetters}>LIS</Text>
      </View>
      <Text style={styles.tagline}>WHERE BUILDINGS MEET THE FUTURE</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { signIn, status, error } = useAuth();
  const isLoading = status === "loading";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  function validate(): boolean {
    if (!email.trim() || !email.includes("@")) {
      setLocalError("Введите корректный email.");
      return false;
    }
    if (password.length < 6) {
      setLocalError("Пароль должен быть не менее 6 символов.");
      return false;
    }
    setLocalError(null);
    return true;
  }

  async function handleSignIn() {
    if (!validate()) return;
    await signIn(email.trim(), password);
  }

  const displayError = localError ?? (status === "error" ? error : null);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WolisLogo />

          {/* ── Form card ── */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Войти в аккаунт</Text>
            <Text style={styles.formSub}>Используйте email и пароль от Wolis.</Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setLocalError(null); }}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                testID="input-email"
                accessibilityLabel="Email"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>ПАРОЛЬ</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setLocalError(null); }}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                testID="input-password"
                accessibilityLabel="Пароль"
              />
            </View>

            {/* Error banner */}
            {displayError && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.8}
              accessibilityLabel="Войти"
              accessibilityRole="button"
              testID="btn-login"
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.btnText}>Войти</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.caption}>
            {"Регистрация выполняется через веб-портал Wolis."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.offwhite },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "android" ? 60 : 40,
    paddingBottom: 48,
  },

  // Logo
  logoLockup: { alignItems: "center", marginBottom: Spacing.xxl + 8 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: Spacing.xs },
  logoLetters: {
    fontFamily: "System",
    fontWeight: "900",
    fontSize: 36,
    color: Colors.ink,
    letterSpacing: -1,
    lineHeight: 40,
  },
  logoO: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.maroon,
    alignItems: "center", justifyContent: "center",
    ...Shadow.card,
  },
  logoOInner: { width: 8, height: 16, backgroundColor: Colors.white, borderRadius: 2 },
  tagline: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 2.5,
    color: Colors.blushDark,
    textAlign: "center",
  },

  // Form card
  formCard: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    ...Shadow.elevated,
  },
  formTitle: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 20,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  formSub: {
    fontFamily: "System",
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },

  // Fields
  fieldWrap: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontFamily: "System",
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.offwhite,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontFamily: "System",
    fontSize: 15,
    fontWeight: "500",
    color: Colors.ink,
  },

  // Error
  errorBanner: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.maroon,
  },
  errorText: { fontFamily: "System", fontSize: 13, color: Colors.maroon, lineHeight: 18 },

  // CTA
  btnPrimary: {
    width: "100%",
    backgroundColor: Colors.maroon,
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: "center",
    ...Shadow.card,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.2,
  },

  caption: {
    fontFamily: "System",
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },
});
