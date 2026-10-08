import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type FormScrollViewProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Área rolável de formulário que mantém os campos visíveis com o teclado aberto. */
export function FormScrollView({ children, contentContainerStyle }: FormScrollViewProps) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0; // 0 nas telas sem cabeçalho

  return (
    // No Android (edge-to-edge) a janela não encolhe para o teclado, então o espaço é aberto aqui.
    // No iOS quem ajusta é o próprio ScrollView, com automaticallyAdjustKeyboardInsets.
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
