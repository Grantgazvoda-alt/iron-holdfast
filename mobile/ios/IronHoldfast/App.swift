import SwiftUI
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

struct GameWebView: UIViewRepresentable {
    final class Coordinator: NSObject, WKNavigationDelegate {
        let assets = LocalAssetSchemeHandler()

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if url.scheme == LocalAssetSchemeHandler.scheme {
                decisionHandler(.allow)
                return
            }

            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            context.coordinator.assets,
            forURLScheme: LocalAssetSchemeHandler.scheme
        )
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = []

        // App Review guideline 5.1.1 requires the privacy policy to be easily
        // accessible from inside the app. The packaged web client already ships
        // privacy.html; expose it in the existing command-mode tool belt without
        // changing the shared web source or relying on the production website.
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

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 26 / 255, green: 20 / 255, blue: 14 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false

        if let url = URL(string: "\(LocalAssetSchemeHandler.scheme)://app/index.html") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

final class LocalAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "ironholdfast"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              requestURL.scheme == Self.scheme,
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
        let rootPath = resourceRoot.standardizedFileURL.path
        guard fileURL.path.hasPrefix(rootPath) else {
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
