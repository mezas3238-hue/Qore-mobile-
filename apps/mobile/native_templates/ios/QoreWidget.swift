import SwiftUI
import WidgetKit

private let appGroup = "group.com.qore.mobile.shared"
private let snapshotKey = "qore_widget_snapshot"

struct QoreWidgetSnapshot: Codable {
  let schemaVersion: String
  let generatedAt: Date
  let expiresAt: Date
  let equity: Double?
  let realizedPnlToday: Double?
  let floatingPnl: Double?
  let dailyDrawdownFraction: Double?
  let activePositions: Int
  let healthyRuntimes: Int
  let totalRuntimes: Int
  let freshness: String

  enum CodingKeys: String, CodingKey {
    case schemaVersion = "schema_version"
    case generatedAt = "generated_at"
    case expiresAt = "expires_at"
    case equity
    case realizedPnlToday = "realized_pnl_today"
    case floatingPnl = "floating_pnl"
    case dailyDrawdownFraction = "daily_drawdown_fraction"
    case activePositions = "active_positions"
    case healthyRuntimes = "healthy_runtimes"
    case totalRuntimes = "total_runtimes"
    case freshness
  }
}

struct QoreWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: QoreWidgetSnapshot?
  let expired: Bool
}

struct QoreWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> QoreWidgetEntry {
    QoreWidgetEntry(
      date: Date(),
      snapshot: nil,
      expired: false
    )
  }

  func getSnapshot(
    in context: Context,
    completion: @escaping (QoreWidgetEntry) -> Void
  ) {
    completion(loadEntry())
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<QoreWidgetEntry>) -> Void
  ) {
    let entry = loadEntry()
    let next = Date().addingTimeInterval(60)
    completion(
      Timeline(
        entries: [entry],
        policy: .after(next)
      )
    )
  }

  private func loadEntry() -> QoreWidgetEntry {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let raw = defaults.string(forKey: snapshotKey),
      let data = raw.data(using: .utf8)
    else {
      return QoreWidgetEntry(
        date: Date(),
        snapshot: nil,
        expired: true
      )
    }

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    guard let snapshot = try? decoder.decode(
      QoreWidgetSnapshot.self,
      from: data
    ) else {
      return QoreWidgetEntry(
        date: Date(),
        snapshot: nil,
        expired: true
      )
    }

    return QoreWidgetEntry(
      date: snapshot.generatedAt,
      snapshot: snapshot,
      expired: Date() > snapshot.expiresAt
    )
  }
}

struct QoreWidgetView: View {
  let entry: QoreWidgetEntry

  @Environment(\.widgetFamily) private var family

  private var status: String {
    if entry.expired {
      return "STALE"
    }
    return entry.snapshot?.freshness.uppercased() ?? "SIN DATOS"
  }

  private var drawdown: String {
    guard
      !entry.expired,
      let value = entry.snapshot?.dailyDrawdownFraction
    else {
      return "—"
    }
    return (value * 100).formatted(
      .number.precision(.fractionLength(2))
    ) + "%"
  }

  private var updated: String {
    entry.snapshot?.generatedAt.formatted(
      date: .omitted,
      time: .standard
    ) ?? "Sin datos"
  }

  private func number(_ value: Double?) -> String {
    guard !entry.expired, let value else { return "—" }
    return value.formatted(
      .number.precision(.fractionLength(2))
    )
  }

  var body: some View {
    Group {
      if family == .systemSmall {
        compact
      } else {
        expanded
      }
    }
    .padding()
    .widgetURL(URL(string: "qore://dashboard"))
    .containerBackground(.background, for: .widget)
  }

  private var compact: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("QORE")
          .font(.headline)
        Spacer()
        Text(status)
          .font(.caption2.bold())
      }

      metric("Equity", number(entry.snapshot?.equity))

      HStack {
        metric("P/L hoy", number(entry.snapshot?.realizedPnlToday))
        Spacer()
      }

      Spacer(minLength: 0)

      Text(updated)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
  }

  private var expanded: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("QORE")
          .font(.headline)
        Spacer()
        Text(status)
          .font(.caption.bold())
      }

      HStack {
        metric("Equity", number(entry.snapshot?.equity))
        Spacer()
        metric("P/L hoy", number(entry.snapshot?.realizedPnlToday))
      }

      HStack {
        metric("DD", drawdown)
        Spacer()
        metric(
          "Pos.",
          entry.expired
            ? "—"
            : String(entry.snapshot?.activePositions ?? 0)
        )
        Spacer()
        metric(
          "RT",
          entry.expired
            ? "—"
            : "\(entry.snapshot?.healthyRuntimes ?? 0)/\(entry.snapshot?.totalRuntimes ?? 0)"
        )
      }

      Text(updated)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
  }

  @ViewBuilder
  private func metric(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(value)
        .font(.subheadline.bold())
        .lineLimit(1)
    }
  }
}

struct QorePortfolioWidget: Widget {
  let kind = "QorePortfolioWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: kind,
      provider: QoreWidgetProvider()
    ) { entry in
      QoreWidgetView(entry: entry)
    }
    .configurationDisplayName("QORE Portfolio")
    .description("Equity, P/L, riesgo y estado de runtimes.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
