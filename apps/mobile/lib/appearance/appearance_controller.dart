import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum QoreThemePreference { dark, light, system }
enum QoreAccent { indigo, blue, green, cyan, amber, red }
enum QoreDensity { compact, normal, spacious }
enum QoreTextSize { small, normal, large }
enum QoreCardRadius { compact, soft, round }
enum QoreWidgetBackground { solid, glass, highContrast }
enum QoreWidgetInfoLevel { compact, normal, detailed }

class AppearanceController extends ChangeNotifier {
  AppearanceController._();

  static final AppearanceController instance = AppearanceController._();

  SharedPreferences? _prefs;

  QoreThemePreference themePreference = QoreThemePreference.dark;
  QoreAccent accent = QoreAccent.indigo;
  QoreDensity density = QoreDensity.normal;
  QoreTextSize textSize = QoreTextSize.normal;
  QoreCardRadius cardRadius = QoreCardRadius.soft;
  QoreWidgetBackground widgetBackground = QoreWidgetBackground.solid;
  QoreWidgetInfoLevel widgetInfoLevel = QoreWidgetInfoLevel.detailed;
  bool showTraderMarkets = true;
  bool showHeartbeatAge = true;
  bool showExactTime = false;

  Future<void> load() async {
    _prefs ??= await SharedPreferences.getInstance();
    final prefs = _prefs!;
    themePreference = _enumValue(
      QoreThemePreference.values,
      prefs.getString('appearance.theme'),
      themePreference,
    );
    accent = _enumValue(
      QoreAccent.values,
      prefs.getString('appearance.accent'),
      accent,
    );
    density = _enumValue(
      QoreDensity.values,
      prefs.getString('appearance.density'),
      density,
    );
    textSize = _enumValue(
      QoreTextSize.values,
      prefs.getString('appearance.text_size'),
      textSize,
    );
    cardRadius = _enumValue(
      QoreCardRadius.values,
      prefs.getString('appearance.card_radius'),
      cardRadius,
    );
    widgetBackground = _enumValue(
      QoreWidgetBackground.values,
      prefs.getString('appearance.widget_background'),
      widgetBackground,
    );
    widgetInfoLevel = _enumValue(
      QoreWidgetInfoLevel.values,
      prefs.getString('appearance.widget_info'),
      widgetInfoLevel,
    );
    showTraderMarkets =
        prefs.getBool('appearance.show_trader_markets') ?? showTraderMarkets;
    showHeartbeatAge =
        prefs.getBool('appearance.show_heartbeat_age') ?? showHeartbeatAge;
    showExactTime =
        prefs.getBool('appearance.show_exact_time') ?? showExactTime;
    notifyListeners();
  }

  T _enumValue<T extends Enum>(List<T> values, String? name, T fallback) {
    if (name == null) return fallback;
    for (final value in values) {
      if (value.name == name) return value;
    }
    return fallback;
  }

  ThemeMode get themeMode => switch (themePreference) {
        QoreThemePreference.dark => ThemeMode.dark,
        QoreThemePreference.light => ThemeMode.light,
        QoreThemePreference.system => ThemeMode.system,
      };

  Color get accentColor => switch (accent) {
        QoreAccent.indigo => const Color(0xFF4F46E5),
        QoreAccent.blue => const Color(0xFF2563EB),
        QoreAccent.green => const Color(0xFF16A34A),
        QoreAccent.cyan => const Color(0xFF0891B2),
        QoreAccent.amber => const Color(0xFFD97706),
        QoreAccent.red => const Color(0xFFDC2626),
      };

  double get textScale => switch (textSize) {
        QoreTextSize.small => 0.90,
        QoreTextSize.normal => 1.00,
        QoreTextSize.large => 1.15,
      };

  VisualDensity get visualDensity => switch (density) {
        QoreDensity.compact => const VisualDensity(horizontal: -1, vertical: -1),
        QoreDensity.normal => VisualDensity.standard,
        QoreDensity.spacious => const VisualDensity(horizontal: 1, vertical: 1),
      };

  double get radius => switch (cardRadius) {
        QoreCardRadius.compact => 8,
        QoreCardRadius.soft => 16,
        QoreCardRadius.round => 24,
      };

  Future<SharedPreferences> _store() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> setTheme(QoreThemePreference value) async {
    themePreference = value;
    notifyListeners();
    await (await _store()).setString('appearance.theme', value.name);
  }

  Future<void> setAccent(QoreAccent value) async {
    accent = value;
    notifyListeners();
    await (await _store()).setString('appearance.accent', value.name);
  }

  Future<void> setDensity(QoreDensity value) async {
    density = value;
    notifyListeners();
    await (await _store()).setString('appearance.density', value.name);
  }

  Future<void> setTextSize(QoreTextSize value) async {
    textSize = value;
    notifyListeners();
    await (await _store()).setString('appearance.text_size', value.name);
  }

  Future<void> setCardRadius(QoreCardRadius value) async {
    cardRadius = value;
    notifyListeners();
    await (await _store()).setString('appearance.card_radius', value.name);
  }

  Future<void> setWidgetBackground(QoreWidgetBackground value) async {
    widgetBackground = value;
    notifyListeners();
    await (await _store()).setString('appearance.widget_background', value.name);
  }

  Future<void> setWidgetInfoLevel(QoreWidgetInfoLevel value) async {
    widgetInfoLevel = value;
    notifyListeners();
    await (await _store()).setString('appearance.widget_info', value.name);
  }

  Future<void> setShowTraderMarkets(bool value) async {
    showTraderMarkets = value;
    notifyListeners();
    await (await _store()).setBool('appearance.show_trader_markets', value);
  }

  Future<void> setShowHeartbeatAge(bool value) async {
    showHeartbeatAge = value;
    notifyListeners();
    await (await _store()).setBool('appearance.show_heartbeat_age', value);
  }

  Future<void> setShowExactTime(bool value) async {
    showExactTime = value;
    notifyListeners();
    await (await _store()).setBool('appearance.show_exact_time', value);
  }

  Map<String, Object?> widgetPreferences() {
    return {
      'background': switch (widgetBackground) {
        QoreWidgetBackground.solid => 'solid',
        QoreWidgetBackground.glass => 'glass',
        QoreWidgetBackground.highContrast => 'high_contrast',
      },
      'accent_argb': accentColor.value,
      'text_scale': textScale,
      'info_level': widgetInfoLevel.name,
      'show_heartbeat_age': showHeartbeatAge,
      'show_exact_time': showExactTime,
    };
  }
}
