/**
 * WidgetKit extension — reads `listio_widget_data` JSON from App Group `group.com.cameroncons.listio`.
 */
import WidgetKit
import SwiftUI

private let appGroupId = "group.com.cameroncons.listio"
private let widgetDataKey = "listio_widget_data"

struct WidgetPayload: Codable {
  var listCount: Int?
  var runCount: Int?
  var streakWeeks: Int?
}

struct ListioWidgetEntry: TimelineEntry {
  let date: Date
  let listCount: Int
  let streakWeeks: Int
}

struct ListioWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListioWidgetEntry {
    ListioWidgetEntry(date: Date(), listCount: 8, streakWeeks: 2)
  }

  func getSnapshot(in context: Context, completion: @escaping (ListioWidgetEntry) -> Void) {
    completion(readEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ListioWidgetEntry>) -> Void) {
    let entry = readEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func readEntry() -> ListioWidgetEntry {
    let defaults = UserDefaults(suiteName: appGroupId)
    let json = defaults?.string(forKey: widgetDataKey) ?? ""
    var listCount = 0
    var streakWeeks = 0
    if let data = json.data(using: .utf8),
       let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data) {
      listCount = payload.listCount ?? 0
      streakWeeks = payload.streakWeeks ?? 0
    }
    return ListioWidgetEntry(date: Date(), listCount: listCount, streakWeeks: streakWeeks)
  }
}

struct ListioWidgetView: View {
  var entry: ListioWidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Listio")
        .font(.caption)
        .foregroundStyle(.secondary)
      Text("\(entry.listCount)")
        .font(.system(size: 34, weight: .semibold, design: .rounded))
      Text(entry.listCount == 1 ? "item left" : "items left")
        .font(.footnote)
        .foregroundStyle(.secondary)
      if entry.streakWeeks > 0 {
        Text("\(entry.streakWeeks) wk streak")
          .font(.caption2)
          .foregroundStyle(.green)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding()
  }
}

@main
struct ListioWidget: Widget {
  let kind: String = "ListioWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ListioWidgetProvider()) { entry in
      ListioWidgetView(entry: entry)
    }
    .configurationDisplayName("Grocery list")
    .description("See how many items are left on your Listio list.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
