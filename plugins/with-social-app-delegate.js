const { withAppDelegate } = require('expo/config-plugins');

// SDK 58's scene delegate forwards URLs to ExpoAppDelegate. Kakao's plugin still expects
// the former template's URL override; supply it so Kakao and Expo subscribers both run.
module.exports = function withSocialAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const result = config.modResults;
    if (result.language !== 'swift' || result.contents.includes('open url: URL')) return config;
    const declaration = /class AppDelegate[^\{]*\{/;
    if (!declaration.test(result.contents)) throw new Error('Cannot locate the Expo AppDelegate class.');
    result.contents = result.contents.replace(declaration, `$&
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options)
  }
`);
    return config;
  });
};
