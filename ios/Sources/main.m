#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface EarnBDController : UIViewController <WKNavigationDelegate, WKUIDelegate>
@property(nonatomic,strong) WKWebView *web;
@end
@implementation EarnBDController
- (BOOL)trusted:(NSURL *)url { return [url.scheme isEqualToString:@"https"] && [url.host isEqualToString:@"earnbd.work"] && (!url.port || url.port.intValue == 443) && !url.user && !url.password; }
- (void)viewDidLoad {
 [super viewDidLoad];
 self.view.backgroundColor = [UIColor colorWithRed:.03 green:.05 blue:.13 alpha:1];
 self.title = @"EarnBD Shakil";
 self.navigationItem.leftBarButtonItem = [[UIBarButtonItem alloc] initWithTitle:@"Back" style:UIBarButtonItemStylePlain target:self action:@selector(goBack)];
 self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemRefresh target:self action:@selector(refresh)];
 WKWebViewConfiguration *config = [WKWebViewConfiguration new];
 config.allowsInlineMediaPlayback = YES;
 config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
 config.applicationNameForUserAgent = @"EarnBDiOS/1.3";
 self.web = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
 self.web.navigationDelegate = self; self.web.UIDelegate = self;
 self.web.translatesAutoresizingMaskIntoConstraints = NO;
 [self.view addSubview:self.web];
 [NSLayoutConstraint activateConstraints:@[
  [self.web.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
  [self.web.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor],
  [self.web.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
  [self.web.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor]]];
 [self.web loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"https://earnbd.work/"]]];
}
- (void)goBack { if(self.web.canGoBack) [self.web goBack]; }
- (void)refresh { [self.web reload]; }
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
 NSURL *url = action.request.URL;
 if ([self trusted:url]) { handler(WKNavigationActionPolicyAllow); return; }
 if (action.targetFrame && !action.targetFrame.mainFrame) { handler(WKNavigationActionPolicyAllow); return; }
 handler(WKNavigationActionPolicyCancel);
 if ([@[@"https", @"mailto", @"tel"] containsObject:url.scheme]) [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
}
- (void)webView:(WKWebView *)webView requestMediaCapturePermissionForOrigin:(WKSecurityOrigin *)origin initiatedByFrame:(WKFrameInfo *)frame type:(WKMediaCaptureType)type decisionHandler:(void (^)(WKPermissionDecision))handler {
 BOOL trustedOrigin = [origin.protocol isEqualToString:@"https"] && [origin.host isEqualToString:@"earnbd.work"] && (origin.port == 0 || origin.port == 443);
 handler(trustedOrigin && [self trusted:webView.URL] && type == WKMediaCaptureTypeMicrophone ? WKPermissionDecisionPrompt : WKPermissionDecisionDeny);
}
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
 if(error.code == NSURLErrorCancelled) return;
 UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Connection unavailable" message:@"Check your internet connection and try again." preferredStyle:UIAlertControllerStyleAlert];
 [alert addAction:[UIAlertAction actionWithTitle:@"Retry" style:UIAlertActionStyleDefault handler:^(UIAlertAction *action){[self refresh];}]];
 [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];
 if(!self.presentedViewController) [self presentViewController:alert animated:YES completion:nil];
}
@end
@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic,strong) UIWindow *window;
@end
@implementation AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)options {
 self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
 self.window.rootViewController = [[UINavigationController alloc] initWithRootViewController:[EarnBDController new]];
 [self.window makeKeyAndVisible]; return YES;
}
@end
int main(int argc, char *argv[]) { @autoreleasepool { return UIApplicationMain(argc, argv, nil, NSStringFromClass(AppDelegate.class)); } }
