import SwiftUI
import UIKit
import WebKit

@main
struct IronHoldfastApp: App {
    var body: some Scene {
        WindowGroup {
            GameWebView()
                .ignoresSafeArea()
                .background(Color(red: 26 / 255, green: 20 / 255, blue: 14 / 255))
        }
    }
}

private enum RuntimeProbe {
    static let readyKey = "IronHoldfastWebReady"
    static let titleKey = "IronHoldfastWebTitle"
    static let errorKey = "IronHoldfastWebError"

    static func reset() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: readyKey)
        defaults.removeObject(forKey: titleKey)
        defaults.removeObject(forKey: errorKey)
        defaults.synchronize()
    }

    static func markReady(title: String) {
        let defaults = UserDefaults.standard
        defaults.set(true, forKey: readyKey)
        defaults.set(title, forKey: titleKey)
        defaults.removeObject(forKey: errorKey)
        defaults.synchronize()
    }

    static func markFailure(_ message: String) {
        let defaults = UserDefaults.standard
        defaults.set(false, forKey: readyKey)
        defaults.set(message, forKey: errorKey)
        defaults.synchronize()
    }
}

private enum LaunchOverlay {
    static let overlayTag = 9100
    static let messageTag = 9101
    static let spinnerTag = 9102
    static let retryTag = 9103

    static func install(in container: UIView, retryTarget: Any, retryAction: Selector) {
        let overlay = UIView()
        overlay.tag = overlayTag
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = UIColor(red: 26 / 255, green: 20 / 255, blue: 14 / 255, alpha: 1)

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "IRON HOLDFAST"
        title.textColor = UIColor(red: 217 / 255, green: 164 / 255, blue: 65 / 255, alpha: 1)
        title.font = .systemFont(ofSize: 24, weight: .bold)
        title.textAlignment = .center
        title.accessibilityIdentifier = "ironHoldfastLaunchTitle"

        let message = UILabel()
        message.tag = messageTag
        message.translatesAutoresizingMaskIntoConstraints = false
        message.text = "Preparing the siege…"
        message.textColor = UIColor(red: 232 / 255, green: 217 / 255, blue: 184 / 255, alpha: 1)
        message.font = .systemFont(ofSize: 14, weight: .medium)
        message.textAlignment = .center
        message.numberOfLines = 0

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.tag = spinnerTag
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = UIColor(red: 217 / 255, green: 164 / 255, blue: 65 / 255, alpha: 1)
        spinner.startAnimating()

        let retry = UIButton(type: .system)
        retry.tag = retryTag
        retry.translatesAutoresizingMaskIntoConstraints = false
        retry.setTitle("Retry", for: .normal)
        retry.setTitleColor(UIColor(red: 26 / 255, green: 20 / 255, blue: 14 / 255, alpha: 1), for: .normal)
        retry.backgroundColor = UIColor(red: 217 / 255, green: 164 / 255, blue: 65 / 255, alpha: 1)
        retry.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        retry.layer.cornerRadius = 8
        retry.contentEdgeInsets = UIEdgeInsets(top: 9, left: 22, bottom: 9, right: 22)
        retry.isHidden = true
        retry.addTarget(retryTarget, action: retryAction, for: .touchUpInside)

        container.addSubview(overlay)
        overlay.addSubview(title)
        overlay.addSubview(message)
        overlay.addSubview(spinner)
        overlay.addSubview(retry)

        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: container.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: container.bottomAnchor),

            title.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -40),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: overlay.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: overlay.trailingAnchor, constant: -24),

            message.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 14),
            message.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            message.leadingAnchor.constraint(greaterThanOrEqualTo: overlay.leadingAnchor, constant: 32),
            message.trailingAnchor.constraint(lessThanOrEqualTo: overlay.trailingAnchor, constant: -32),

            spinner.topAnchor.constraint(equalTo: message.bottomAnchor, constant: 16),
            spinner.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),

            retry.topAnchor.constraint(equalTo: message.bottomAnchor, constant: 18),
            retry.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        ])
    }

    static func showLoading(in container: UIView) {
        guard let overlay = container.viewWithTag(overlayTag) else { return }
        overlay.alpha = 1
        overlay.isHidden = false
        (overlay.viewWithTag(messageTag) as? UILabel)?.text = "Preparing the siege…"
        (overlay.viewWithTag(spinnerTag) as? UIActivityIndicatorView)?.startAnimating()
        overlay.viewWithTag(retryTag)?.isHidden = true
    }

    static func showFailure(in container: UIView, message: String) {
        guard let overlay = container.viewWithTag(overlayTag) else { return }
        overlay.alpha = 1
        overlay.isHidden = false
        (overlay.viewWithTag(messageTag) as? UILabel)?.text = message
        (overlay.viewWithTag(spinnerTag) as? UIActivityIndicatorView)?.stopAnimating()
        overlay.viewWithTag(retryTag)?.isHidden = false
    }

    static func hide(in container: UIView) {
        guard let overlay = container.viewWithTag(overlayTag) else { return }
        UIView.animate(withDuration: 0.2, animations: {
            overlay.alpha = 0
        }, completion: { _ in
            overlay.isHidden = true
        })
    }
}

struct GameWebView: UIViewRepresentable {
    final class Coordinator: NSObject, WKNavigationDelegate {
        let assets = LocalAssetSchemeHandler()
        weak var webView: WKWebView?
        weak var container: UIView?

        @objc func retryLoad() {
            guard let webView, let container else { return }
            loadStart(in: webView, container: container)
        }

        func loadStart(in webView: WKWebView, container: UIView) {
            RuntimeProbe.reset()
            LaunchOverlay.showLoading(in: container)
            guard let url = LocalAssetSchemeHandler.startURL else {
                failRuntime("The packaged game URL is invalid.")
                return
            }
            webView.load(URLRequest(url: url))
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if url.scheme == LocalAssetSchemeHandler.scheme && url.host == LocalAssetSchemeHandler.host {
                decisionHandler(.allow)
                return
            }

            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard webView.url?.scheme == LocalAssetSchemeHandler.scheme else { return }
            webView.evaluateJavaScript("Boolean(document.getElementById('app')) && document.body.children.length > 0") { [weak self, weak webView] result, error in
                guard let self, let webView else { return }
                guard error == nil, (result as? Bool) == true else {
                    self.failRuntime("The packaged game did not finish loading.")
                    return
                }

                webView.evaluateJavaScript("document.title || 'Iron Holdfast'") { [weak self] titleResult, _ in
                    let title = (titleResult as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Iron Holdfast"
                    RuntimeProbe.markReady(title: title)
                    if let container = self?.container {
                        LaunchOverlay.hide(in: container)
                    }
                }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            failRuntime("Unable to open the packaged game. Tap Retry.", diagnostic: error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            failRuntime("Unable to open the packaged game. Tap Retry.", diagnostic: error.localizedDescription)
        }

        private func failRuntime(_ message: String, diagnostic: String? = nil) {
            let detail = diagnostic.map { "\(message) \($0)" } ?? message
            RuntimeProbe.markFailure(detail)
            if let container {
                LaunchOverlay.showFailure(in: container, message: message)
            }
            print("[IronHoldfast] Web runtime failure: \(detail)")
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            context.coordinator.assets,
            forURLScheme: LocalAssetSchemeHandler.scheme
        )
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let privacyLinkScript = """
        (() => {
          const toolbar = document.getElementById('btnTutorial')?.parentElement;
          if (!toolbar || document.getElementById('iosPrivacyLink')) return;

          const link = document.createElement('a');
          link.id = 'iosPrivacyLink';
          link.href = 'ironholdfast://app/privacy.html';
          link.className = 'tool';
          link.textContent = 'Privacy';
          link.title = 'Privacy Policy';
          link.setAttribute('aria-label', 'Privacy Policy');
          link.style.margin = '0';
          link.style.minWidth = '64px';
          link.style.textDecoration = 'none';
          link.style.display = 'inline-flex';
          link.style.alignItems = 'center';
          link.style.justifyContent = 'center';
          toolbar.prepend(link);
        })();
        """
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: privacyLinkScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
        )

        let container = UIView()
        container.backgroundColor = UIColor(red: 26 / 255, green: 20 / 255, blue: 14 / 255, alpha: 1)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = container.backgroundColor
        webView.scrollView.backgroundColor = container.backgroundColor
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false

        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        context.coordinator.webView = webView
        context.coordinator.container = container
        LaunchOverlay.install(in: container, retryTarget: context.coordinator, retryAction: #selector(Coordinator.retryLoad))
        context.coordinator.loadStart(in: webView, container: container)

        return container
    }

    func updateUIView(_ container: UIView, context: Context) {}
}

final class LocalAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "ironholdfast"
    static let host = "app"
    static var startURL: URL? { URL(string: "\(scheme)://\(host)/index.html") }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              requestURL.scheme == Self.scheme,
              requestURL.host == Self.host,
              let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("www", isDirectory: true)
        else {
            fail(urlSchemeTask, code: 400, message: "Invalid local request")
            return
        }

        var path = requestURL.path
        if path.isEmpty || path == "/" {
            path = "/index.html"
        }
        let relative = String(path.drop(while: { $0 == "/" }))
        guard !relative.contains("..") else {
            fail(urlSchemeTask, code: 403, message: "Forbidden")
            return
        }

        let fileURL = resourceRoot.appendingPathComponent(relative).standardizedFileURL
        let normalizedRoot = resourceRoot.standardizedFileURL.path
        let allowedPrefix = normalizedRoot.hasSuffix("/") ? normalizedRoot : normalizedRoot + "/"
        guard fileURL.path.hasPrefix(allowedPrefix) else {
            fail(urlSchemeTask, code: 403, message: "Forbidden")
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let mime = mimeType(for: fileURL.pathExtension)
            let response = URLResponse(
                url: requestURL,
                mimeType: mime,
                expectedContentLength: data.count,
                textEncodingName: isText(mime) ? "utf-8" : nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            fail(urlSchemeTask, code: 404, message: "Not Found")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func fail(_ task: WKURLSchemeTask, code: Int, message: String) {
        let error = NSError(
            domain: "IronHoldfastLocalAssets",
            code: code,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
        task.didFailWithError(error)
    }

    private func isText(_ mime: String) -> Bool {
        mime.hasPrefix("text/")
            || mime == "application/javascript"
            || mime == "application/json"
            || mime == "image/svg+xml"
    }

    private func mimeType(for extensionName: String) -> String {
        switch extensionName.lowercased() {
        case "html": return "text/html"
        case "js": return "application/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "webp": return "image/webp"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}
