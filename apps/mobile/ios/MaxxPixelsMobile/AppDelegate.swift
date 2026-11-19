import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "MaxxPixelsMobile",
      in: window,
      launchOptions: launchOptions
    )

    setupScreenSecurityObservers()

    return true
  }

  private func setupScreenSecurityObservers() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(screenCaptureChanged),
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(userTookScreenshot),
      name: UIApplication.userDidTakeScreenshotNotification,
      object: nil
    )
  }

  @objc private func screenCaptureChanged() {
    if UIScreen.main.isCaptured {
      showSecurityOverlay(reason: "Screen recording and sharing are disabled.")
    } else {
      hideSecurityOverlay()
    }
  }

  @objc private func userTookScreenshot() {
    let alert = UIAlertController(
      title: "Security Notice",
      message: "Screenshots are prohibited on this application to protect content rights.",
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "OK", style: .default))
    window?.rootViewController?.present(alert, animated: true)
  }

  private var securityOverlayView: UIView?

  private func showSecurityOverlay(reason: String) {
    guard securityOverlayView == nil, let window = window else { return }
    let overlay = UIView(frame: window.bounds)
    overlay.backgroundColor = .black

    let label = UILabel()
    label.text = reason
    label.textColor = .white
    label.textAlignment = .center
    label.font = UIFont.boldSystemFont(ofSize: 16)
    label.numberOfLines = 0
    label.translatesAutoresizingMaskIntoConstraints = false

    overlay.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
      label.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 20),
      label.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -20)
    ])

    window.addSubview(overlay)
    securityOverlayView = overlay
  }

  private func hideSecurityOverlay() {
    securityOverlayView?.removeFromSuperview()
    securityOverlayView = nil
  }

  func applicationWillResignActive(_ application: UIApplication) {
    showSecurityOverlay(reason: "Protected Content")
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    if !UIScreen.main.isCaptured {
      hideSecurityOverlay()
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
