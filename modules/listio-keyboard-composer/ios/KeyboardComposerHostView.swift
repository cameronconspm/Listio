import ExpoModulesCore
import UIKit

/// Passthrough host used only to sync UITabBar visibility with the keyboard.
///
/// Composer position is driven by `react-native-keyboard-controller` on the JS side
/// (native frame-tracked `keyboardWillChangeFrame` → Reanimated shared value on the UI thread).
/// This view does not move its children; it exists solely to hide/show the parent
/// `UITabBar` in sync with the keyboard using Apple's actual `UIKeyboardAnimationCurveUserInfoKey`
/// (the bezier-equivalent curve the library cannot reach through public RN APIs).
final class KeyboardComposerHostView: ExpoView {
  private var keyboardObservers: [NSObjectProtocol] = []

  var hidesTabBarOnKeyboard = true

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    isUserInteractionEnabled = true
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      installKeyboardObserversIfNeeded()
    } else {
      removeKeyboardObservers()
      setTabBarHidden(false)
    }
  }

  deinit {
    removeKeyboardObservers()
  }

  private func installKeyboardObserversIfNeeded() {
    guard keyboardObservers.isEmpty else { return }

    let center = NotificationCenter.default

    let willShow: NSObjectProtocol
    let didHide: NSObjectProtocol
    let willChange: NSObjectProtocol

    willShow = center.addObserver(
      forName: UIResponder.keyboardWillShowNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleKeyboardWillShow(notification)
    }

    // Show tab bar only after the keyboard is fully gone — showing on `willHide` races the
    // composer (still tracking keyboard height) and causes a visible timing gap after repeated
    // open/close cycles.
    didHide = center.addObserver(
      forName: UIResponder.keyboardDidHideNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.setTabBarHidden(false, animated: false)
    }

    willChange = center.addObserver(
      forName: UIResponder.keyboardWillChangeFrameNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleKeyboardFrameChangeForTabBar(notification)
    }

    keyboardObservers.append(contentsOf: [willShow, didHide, willChange])
  }

  private func removeKeyboardObservers() {
    let center = NotificationCenter.default
    for token in keyboardObservers {
      center.removeObserver(token)
    }
    keyboardObservers.removeAll()
  }

  private func handleKeyboardWillShow(_ notification: Notification) {
    guard hidesTabBarOnKeyboard, let userInfo = notification.userInfo else { return }

    let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0
    let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
    let options = UIView.AnimationOptions(rawValue: curveRaw << 16)

    setTabBarHidden(true, animated: duration > 0, duration: duration, options: options)
  }

  private func handleKeyboardFrameChangeForTabBar(_ notification: Notification) {
    guard hidesTabBarOnKeyboard,
          let userInfo = notification.userInfo,
          let endFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }

    let windowHeight = window?.bounds.height ?? UIScreen.main.bounds.height
    let keyboardVisible = endFrame.minY < windowHeight - 1
    if keyboardVisible {
      setTabBarHidden(true, animated: false)
    }
  }

  private func setTabBarHidden(
    _ hidden: Bool,
    animated: Bool = false,
    duration: Double = 0,
    options: UIView.AnimationOptions = []
  ) {
    guard let tabBar = tabBarController()?.tabBar else { return }
    guard tabBar.isHidden != hidden else { return }

    let apply = { tabBar.isHidden = hidden }

    if animated, duration > 0 {
      UIView.animate(withDuration: duration, delay: 0, options: options, animations: apply)
    } else {
      apply()
    }
  }

  private func tabBarController() -> UITabBarController? {
    var viewController: UIViewController?
    var responder: UIResponder? = self
    while let current = responder {
      if let vc = current as? UIViewController {
        viewController = vc
      }
      responder = current.next
    }
    return viewController?.tabBarController
  }
}
