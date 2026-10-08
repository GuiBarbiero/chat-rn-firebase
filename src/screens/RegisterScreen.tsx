import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Avatar } from '../components/Avatar';
import { ErrorMessage } from '../components/ErrorMessage';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import type { ScreenProps } from '../navigation/types';
import { pickImage } from '../services/storageService';
import { colors, spacing } from '../theme';
import { getErrorMessage } from '../utils/errors';
import { birthDateToIso, maskBirthDate, maskPhone, validateSignUp } from '../utils/userValidation';

type RegisterForm = {
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
};

const EMPTY_FORM: RegisterForm = { name: '', email: '', phoneNumber: '', birthDate: '', password: '', confirmPassword: '' };

export function RegisterScreen(_props: ScreenProps<'Register'>) {
  const { signUp } = useAuth();
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback((field: keyof RegisterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handlePickPhoto = useCallback(async () => {
    setError(null);
    try {
      const picked = await pickImage();
      if (picked) setPhoto(picked);
    } catch (failure) {
      setError(getErrorMessage(failure, 'Não foi possível abrir a galeria.'));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const problem = validateSignUp(form);
    const birthDate = birthDateToIso(form.birthDate);
    if (problem || !birthDate) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({
        name: form.name,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber,
        birthDate,
        photo,
      });
      // Conta criada: a sessão já está ativa e o RootNavigator abre as conversas.
    } catch (failure) {
      setError(getErrorMessage(failure, 'Não foi possível criar a conta. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }, [form, photo, signUp]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Pressable accessibilityRole="button" onPress={handlePickPhoto} disabled={loading} style={styles.photo}>
        <Avatar uri={photo} size={96} />
        <Text style={styles.link}>{photo ? 'Trocar foto de perfil' : 'Escolher foto de perfil'}</Text>
      </Pressable>

      <TextField
        label="Nome"
        value={form.name}
        onChangeText={(value) => setField('name', value)}
        autoComplete="name"
        placeholder="Seu nome completo"
        maxLength={60}
      />
      <TextField
        label="E-mail"
        value={form.email}
        onChangeText={(value) => setField('email', value)}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
      />
      <TextField
        label="Celular"
        value={form.phoneNumber}
        onChangeText={(value) => setField('phoneNumber', maskPhone(value))}
        keyboardType="phone-pad"
        placeholder="(11) 91234-5678"
      />
      <TextField
        label="Data de nascimento"
        value={form.birthDate}
        onChangeText={(value) => setField('birthDate', maskBirthDate(value))}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
      />
      <TextField
        label="Senha"
        value={form.password}
        onChangeText={(value) => setField('password', value)}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Mínimo de 6 caracteres"
      />
      <TextField
        label="Confirmar senha"
        value={form.confirmPassword}
        onChangeText={(value) => setField('confirmPassword', value)}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Repita a senha"
      />

      <ErrorMessage message={error} />
      <PrimaryButton title="Criar conta" onPress={handleSubmit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  photo: { alignItems: 'center', gap: spacing.sm },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
