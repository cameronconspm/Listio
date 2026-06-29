import ExpoModulesCore

private let appGroupId = "group.com.cameroncons.listio"

public class ListioWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ListioWidgetBridge")

    Function("setWidgetData") { (appGroup: String, key: String, json: String) in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return }
      defaults.set(json, forKey: key)
    }
  }
}
