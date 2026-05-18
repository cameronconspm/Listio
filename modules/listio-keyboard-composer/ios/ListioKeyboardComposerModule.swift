import ExpoModulesCore

public class ListioKeyboardComposerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ListioKeyboardComposer")

    View(KeyboardComposerHostView.self) {
      Prop("hidesTabBarOnKeyboard") { (view: KeyboardComposerHostView, hides: Bool) in
        view.hidesTabBarOnKeyboard = hides
      }
    }
  }
}
