import React from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category, CATEGORY_LABEL, Place, Ride, STATUS_LABEL, formatGs } from '../domain/rides';

export const C = {
  ink: '#12242A', muted: '#6B7D80', teal: '#04AC83', darkTeal: '#047C66',
  bg: '#F5F8F9', white: '#FFFFFF', line: '#E6ECEE', mint: '#E6F8F0',
  pale: '#EAF2F4', amber: '#FFF2D6', amberInk: '#885700',
};

export function Page({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View style={s.page}>{children}</View>
    </ScrollView>
  </SafeAreaView>;
}
export function Top({ subtitle }: { subtitle?: string }) {
  return <View style={s.top}>
    <View style={s.logo}><Text style={s.logoText}>V</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={s.brand}>ViajeYa <Text style={s.byQore}>by QORE</Text></Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
    <View style={s.demoBadge}><Text style={s.demoText}>DEMO</Text></View>
  </View>;
}
export function Headline({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <View style={{ gap: 8, marginBottom: 16 }}>
    {!!eyebrow && <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>}
    <Text style={s.title}>{title}</Text>
    {!!description && <Text style={s.bodyMuted}>{description}</Text>}
  </View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({ text, onPress, secondary = false, disabled = false, danger = false }: {
  text: string; onPress: () => void; secondary?: boolean; disabled?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={text} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondaryButton, danger && s.dangerButton, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
    <Text style={[s.buttonText, secondary && { color: C.ink }, danger && { color: '#A12727' }]}>{text}</Text>
  </Pressable>;
}
export function Choice({ label, info, selected, onPress }: { label: string; info?: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={[s.choice, selected && s.choiceSelected]}>
    <View style={{ flex: 1, gap: 3 }}><Text style={s.choiceTitle}>{label}</Text>{info && <Text style={s.small}>{info}</Text>}</View>
    <View style={[s.radio, selected && s.radioSelected]} />
  </Pressable>;
}
export function CategoryChoices({ category, onChange }: { category: Category; onChange: (c: Category) => void }) {
  return <View style={s.categoryRow}>{(['economico', 'confort', 'xl'] as Category[]).map(c => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: c === category }} key={c} onPress={() => onChange(c)}
      style={[s.category, c === category && s.categoryActive]}>
      <Text style={s.categoryIcon}>{c === 'economico' ? '🚗' : c === 'confort' ? '🚙' : '🚐'}</Text>
      <Text style={[s.categoryLabel, c === category && { color: C.darkTeal }]}>{CATEGORY_LABEL[c]}</Text>
    </Pressable>
  ))}</View>;
}
export function MapSketch({ origin, destination }: { origin: Place; destination: Place }) {
  return <View accessible accessibilityLabel="Mapa ilustrativo; no usa GPS, rutas ni tráfico reales" style={s.map}>
    <View style={[s.road, { top: 22, transform: [{ rotate: '13deg' }] }]} />
    <View style={[s.road, { top: 108, transform: [{ rotate: '-16deg' }] }]} />
    <View style={[s.road, { top: 184, transform: [{ rotate: '11deg' }] }]} />
    <View style={[s.roadVertical, { left: '28%', transform: [{ rotate: '22deg' }] }]} />
    <View style={[s.roadVertical, { left: '73%', transform: [{ rotate: '-19deg' }] }]} />
    <View style={s.parkOne} /><View style={s.parkTwo} />
    <View style={[s.routeSegment, { transform: [{ rotate: '-30deg' }] }]} />
    <View style={[s.mapPin, { left: '15%', top: '59%', backgroundColor: C.darkTeal }]}>
      <Text style={s.pinText}>A</Text>
    </View>
    <View style={[s.mapPin, { right: '17%', top: '21%', backgroundColor: '#12242A' }]}>
      <Text style={s.pinText}>B</Text>
    </View>
    <View style={s.mapLabel}><Text style={s.mapLabelText}>ASUNCIÓN · ESQUEMA DEMO</Text></View>
    <View style={s.mapFooter}>
      <Text style={s.mapFooterText} numberOfLines={1}>A  {origin.label}</Text>
      <Text style={s.mapFooterText} numberOfLines={1}>B  {destination.label}</Text>
    </View>
  </View>;
}
export function Status({ ride }: { ride: Ride }) {
  return <Card style={{ gap: 13 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={s.cardTitle}>{STATUS_LABEL[ride.stage]}</Text>
      <Text style={s.demoChip}>SIMULADO</Text>
    </View>
    <View style={{ gap: 7 }}>
      <Text style={s.rideLine}>●  {ride.origin.label}</Text>
      <Text style={s.rideLine}>◆  {ride.destination.label}</Text>
    </View>
    <View style={s.divider} />
    <View style={s.twoCol}>
      <View><Text style={s.small}>Tarifa estimada</Text><Text style={s.number}>{formatGs(ride.quote.priceGs)}</Text></View>
      <View><Text style={s.small}>Distancia aproximada</Text><Text style={s.number}>{ride.quote.distanceKm} km</Text></View>
    </View>
    {ride.driver && <View style={s.driverRow}><Text style={{ fontSize: 25 }}>🚘</Text><View style={{ flex: 1 }}><Text style={s.choiceTitle}>{ride.driver.name}</Text><Text style={s.small}>{ride.driver.vehicle} · {ride.driver.plate} · ⭐ {ride.driver.rating}</Text></View></View>}
  </Card>;
}
export function Navigation() {
  return <View style={s.nav}>
    <Link href="/" asChild><Pressable style={s.navItem}><Text style={s.navIcon}>⌂</Text><Text style={s.navText}>Inicio</Text></Pressable></Link>
    <Link href="/demo" asChild><Pressable style={s.navItem}><Text style={s.navIcon}>🚗</Text><Text style={s.navText}>Viajes</Text></Pressable></Link>
    <Link href="/conductor" asChild><Pressable style={s.navItem}><Text style={s.navIcon}>◉</Text><Text style={s.navText}>Conductor</Text></Pressable></Link>
    <Link href="/admin" asChild><Pressable style={s.navItem}><Text style={s.navIcon}>▦</Text><Text style={s.navText}>Panel</Text></Pressable></Link>
  </View>;
}
export function Note({ children }: { children: React.ReactNode }) {
  return <View style={s.note}><Text style={s.noteText}>{children}</Text></View>;
}
const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  logo: { backgroundColor: C.teal, width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 25, fontWeight: '900' },
  brand: { fontSize: 21, fontWeight: '900', color: C.ink, letterSpacing: -0.8 },
  byQore: { fontSize: 11, fontWeight: '600', color: C.muted },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 1 },
  demoBadge: { backgroundColor: C.amber, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  demoText: { fontWeight: '800', fontSize: 10, color: C.amberInk, letterSpacing: 1 },
  eyebrow: { color: C.darkTeal, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: C.ink, fontSize: 33, lineHeight: 37, fontWeight: '900', letterSpacing: -1.4 },
  bodyMuted: { color: C.muted, fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: C.white, borderRadius: 22, padding: 19, borderWidth: 1, borderColor: C.line, gap: 11 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  button: { backgroundColor: C.teal, borderRadius: 17, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: C.pale },
  dangerButton: { backgroundColor: '#FCEBEB' },
  choice: { borderColor: C.line, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', gap: 8, alignItems: 'center' },
  choiceSelected: { borderColor: C.teal, backgroundColor: '#F1FBF7' },
  choiceTitle: { color: C.ink, fontWeight: '700', fontSize: 14 },
  small: { color: C.muted, fontSize: 12, lineHeight: 18 },
  radio: { borderWidth: 2, borderColor: '#B0BCC0', width: 17, height: 17, borderRadius: 10 },
  radioSelected: { borderColor: C.teal, backgroundColor: C.teal, borderWidth: 4 },
  categoryRow: { flexDirection: 'row', gap: 8 },
  category: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, gap: 6 },
  categoryActive: { borderColor: C.teal, backgroundColor: '#EEFBF5' },
  categoryIcon: { fontSize: 24 },
  categoryLabel: { fontSize: 12, fontWeight: '800', color: C.ink },
  map: { height: 248, borderRadius: 22, overflow: 'hidden', backgroundColor: '#DCEDE6', position: 'relative' },
  road: { position: 'absolute', width: '145%', left: '-15%', height: 14, backgroundColor: '#FFFFFF', opacity: 0.85 },
  roadVertical: { position: 'absolute', height: '140%', top: '-20%', width: 13, backgroundColor: '#FFFFFF', opacity: 0.85 },
  parkOne: { width: 70, height: 65, backgroundColor: '#BEE5C7', borderRadius: 19, top: 17, left: 8, position: 'absolute', transform: [{ rotate: '15deg' }] },
  parkTwo: { width: 100, height: 55, backgroundColor: '#BEE5C7', borderRadius: 19, bottom: 42, right: 12, position: 'absolute', transform: [{ rotate: '26deg' }] },
  routeSegment: { width: '72%', height: 6, borderRadius: 20, backgroundColor: C.teal, position: 'absolute', top: 119, left: '13%' },
  mapPin: { position: 'absolute', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderColor: '#fff', borderWidth: 3 },
  pinText: { fontWeight: '900', color: '#fff', fontSize: 14 },
  mapLabel: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,.95)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  mapLabelText: { color: C.darkTeal, fontWeight: '900', fontSize: 9, letterSpacing: 0.4 },
  mapFooter: { position: 'absolute', bottom: 9, left: 10, right: 10, padding: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.94)', gap: 3 },
  mapFooterText: { fontSize: 11, fontWeight: '700', color: C.ink },
  divider: { height: 1, backgroundColor: C.line },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rideLine: { color: C.ink, fontSize: 13 },
  number: { fontSize: 17, fontWeight: '900', color: C.ink, marginTop: 3 },
  demoChip: { fontSize: 10, fontWeight: '900', color: C.amberInk, backgroundColor: C.amber, padding: 6, borderRadius: 7 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, padding: 10, borderRadius: 14 },
  nav: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingVertical: 8, justifyContent: 'space-around', marginTop: 8 },
  navItem: { alignItems: 'center', paddingVertical: 5, minWidth: 55, gap: 3 },
  navIcon: { fontSize: 20, color: C.darkTeal },
  navText: { color: C.muted, fontWeight: '700', fontSize: 11 },
  note: { backgroundColor: C.amber, padding: 13, borderRadius: 14 },
  noteText: { fontSize: 12, color: C.amberInk, lineHeight: 18, fontWeight: '600' },
  link: { color: C.darkTeal, fontWeight: '700', fontSize: 14 },
});

export const textStyles = { body: s.bodyMuted, subtitle: s.small, heading: s.cardTitle, number: s.number, link: s.link, small: s.small };
export const containers = { row: s.twoCol, divider: s.divider };
