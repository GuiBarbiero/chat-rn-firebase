import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorMessage } from '../components/ErrorMessage';
import { FormScrollView } from '../components/FormScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { getErrorMessage } from '../utils/errors';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      // Com a sessão criada, o RootNavigator troca sozinho para as telas autenticadas.
    } catch (failure) {
      setError(getErrorMessage(failure, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Chat RN Firebase</Text>
        <Text style={styles.subtitle}>Entre com seu e-mail e senha</Text>

        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@exemplo.com"
        />
        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="Sua senha"
          onSubmitEditing={handleSubmit}
        />

        <ErrorMessage message={error} />
        <PrimaryButton title="Entrar" onPress={handleSubmit} loading={loading} />

        <Pressable accessibilityRole="button" disabled={loading} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Não tem conta? Criar conta</Text>
        </Pressable>
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center', marginBottom: spacing.md },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', padding: spacing.sm },
});
