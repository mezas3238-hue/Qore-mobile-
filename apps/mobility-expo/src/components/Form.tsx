import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { C } from './UI';
export function FormField({ label, value, onChangeText, placeholder, secure = false, keyboardType = 'default', autoCapitalize = 'sentences', maxLength = 120 }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; maxLength?: number;
}) {
  return <View style={{ gap: 5 }}>
    <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholder={placeholder || label} placeholderTextColor={C.muted}
      value={value} onChangeText={onChangeText} keyboardType={keyboardType}
      secureTextEntry={secure} autoCapitalize={autoCapitalize}
      maxLength={maxLength} autoCorrect={false}
      style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 13, minHeight: 48, color: C.ink, fontSize: 15 }}
    />
  </View>;
}
export function FormMessage({ text, error = false }: { text: string; error?: boolean }) {
  if (!text) return null;
  return <Text accessibilityRole="alert" style={{ color: error ? '#A12727' : C.darkTeal, fontSize: 13, lineHeight: 20 }}>{text}</Text>;
}
