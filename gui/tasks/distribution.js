const path = require('path');
const fs = require('fs');
const builder = require('electron-builder');
const parseSemver = require('semver/functions/parse');
const { notarize } = require('electron-notarize');
const { version } = require('../package.json');

const compression = process.argv.indexOf('--no-compression') !== -1 ? 'store' : 'normal';
const noAppleNotarization = process.argv.indexOf('--no-apple-notarization') !== -1;

const config = {
  appId: 'net.mullvad.vpn',
  copyright: 'Mullvad VPN AB',
  productName: 'Mullvad VPN',
  asar: true,
  compression: compression,
  extraResources: [
    { from: distAssets('ca.crt'), to: '.' },
    { from: distAssets('relays.json'), to: '.' },
    { from: distAssets('api-ip-address.txt'), to: '.' },
    { from: root('CHANGELOG.md'), to: '.' },
  ],

  directories: {
    buildResources: root('dist-assets'),
    output: root('dist'),
  },

  extraMetadata: {
    name: 'mullvad-vpn',
  },

  files: [
    'package.json',
    'init.js',
    'build/',
    '!build/src/renderer',
    'build/src/renderer/index.html',
    'build/src/renderer/bundle.js',
    'build/src/renderer/preloadBundle.js',
    'build/src/renderer/components/CustomScrollbars.css',
    'node_modules/',
    '!**/*.tsbuildinfo',
  ],

  mac: {
    target: 'pkg',
    artifactName: 'MullvadVPN-${version}.${ext}',
    category: 'public.app-category.tools',
    extendInfo: {
      LSUIElement: true,
      NSUserNotificationAlertStyle: 'alert',
    },
    extraResources: [
      { from: distAssets('mullvad'), to: '.' },
      { from: distAssets('mullvad-problem-report'), to: '.' },
      { from: distAssets('mullvad-daemon'), to: '.' },
      { from: distAssets('mullvad-setup'), to: '.' },
      { from: distAssets('libtalpid_openvpn_plugin.dylib'), to: '.' },
      { from: distAssets('binaries/x86_64-apple-darwin/openvpn'), to: '.' },
      { from: distAssets('binaries/x86_64-apple-darwin/sslocal'), to: '.' },
      { from: distAssets('uninstall_macos.sh'), to: './uninstall.sh' },
      { from: distAssets('shell-completions/_mullvad'), to: '.' },
      { from: distAssets('shell-completions/mullvad.fish'), to: '.' },
    ],
  },

  pkg: {
    allowAnywhere: false,
    allowCurrentUserHome: false,
    isRelocatable: false,
  },

  nsis: {
    guid: '2A356FD4-03B7-4F45-99B4-737BE580DC82',
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: false,
    include: distAssets('windows/installer.nsh'),
    installerSidebar: distAssets('windows/installersidebar.bmp'),
  },

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: 'MullvadVPN-${version}.${ext}',
    publisherName: 'Mullvad VPN AB',
    signingHashAlgorithms: ['sha256'],
    signDlls: true,
    extraResources: [
      { from: distAssets('mullvad.exe'), to: '.' },
      { from: distAssets('mullvad-problem-report.exe'), to: '.' },
      { from: distAssets('mullvad-daemon.exe'), to: '.' },
      { from: distAssets('talpid_openvpn_plugin.dll'), to: '.' },
      { from: root('windows/winfw/bin/x64-Release/winfw.dll'), to: '.' },
      { from: root('windows/windns/bin/x64-Release/windns.dll'), to: '.' },
      { from: root('windows/winnet/bin/x64-Release/winnet.dll'), to: '.' },
      { from: distAssets('binaries/x86_64-pc-windows-msvc/openvpn.exe'), to: '.' },
      { from: distAssets('binaries/x86_64-pc-windows-msvc/sslocal.exe'), to: '.' },
      { from: root('build/lib/x86_64-pc-windows-msvc/libwg.dll'), to: '.' },
      { from: distAssets('binaries/x86_64-pc-windows-msvc/wintun.dll'), to: '.' },
    ],
  },

  linux: {
    target: ['deb', 'rpm'],
    artifactName: 'MullvadVPN-${version}_${arch}.${ext}',
    category: 'Network',
    extraFiles: [{ from: distAssets('linux/mullvad-gui-launcher.sh'), to: '.' }],
    extraResources: [
      { from: distAssets('mullvad-problem-report'), to: '.' },
      { from: distAssets('mullvad-daemon'), to: '.' },
      { from: distAssets('mullvad-setup'), to: '.' },
      { from: distAssets('libtalpid_openvpn_plugin.so'), to: '.' },
      { from: distAssets('binaries/x86_64-unknown-linux-gnu/openvpn'), to: '.' },
      { from: distAssets('binaries/x86_64-unknown-linux-gnu/sslocal'), to: '.' },
      { from: distAssets('linux/mullvad-daemon.conf'), to: '.' },
      { from: distAssets('linux/mullvad-daemon.service'), to: '.' },
    ],
  },

  deb: {
    fpm: [
      '--version',
      getDebVersion(),
      '--before-install',
      distAssets('linux/before-install.sh'),
      '--before-remove',
      distAssets('linux/before-remove.sh'),
      '--config-files',
      '/opt/Mullvad VPN/resources/mullvad-daemon.service',
      '--config-files',
      '/opt/Mullvad VPN/resources/mullvad-daemon.conf',
      distAssets('mullvad') + '=/usr/bin/',
      distAssets('mullvad-exclude') + '=/usr/bin/',
      distAssets('linux/problem-report-link') + '=/usr/bin/mullvad-problem-report',
      distAssets('shell-completions/mullvad.bash') +
        '=/usr/share/bash-completion/completions/mullvad',
      distAssets('shell-completions/_mullvad') + '=/usr/local/share/zsh/site-functions/_mullvad',
      distAssets('shell-completions/mullvad.fish') +
        '=/usr/share/fish/vendor_completions.d/mullvad.fish',
    ],
    afterInstall: distAssets('linux/after-install.sh'),
    afterRemove: distAssets('linux/after-remove.sh'),
    depends: ['iputils-ping'],
  },

  rpm: {
    fpm: [
      '--before-install',
      distAssets('linux/before-install.sh'),
      '--before-remove',
      distAssets('linux/before-remove.sh'),
      '--rpm-posttrans',
      distAssets('linux/post-transaction.sh'),
      '--config-files',
      '/opt/Mullvad VPN/resources/mullvad-daemon.service',
      '--config-files',
      '/opt/Mullvad VPN/resources/mullvad-daemon.conf',
      distAssets('mullvad') + '=/usr/bin/',
      distAssets('mullvad-exclude') + '=/usr/bin/',
      distAssets('linux/problem-report-link') + '=/usr/bin/mullvad-problem-report',
      distAssets('shell-completions/mullvad.bash') +
        '=/usr/share/bash-completion/completions/mullvad',
      distAssets('shell-completions/_mullvad') + '=/usr/share/zsh/site-functions/_mullvad',
      distAssets('shell-completions/mullvad.fish') +
        '=/usr/share/fish/vendor_completions.d/mullvad.fish',
    ],
    afterInstall: distAssets('linux/after-install.sh'),
    afterRemove: distAssets('linux/after-remove.sh'),
    depends: ['libXScrnSaver', 'libnotify', 'libnsl', 'dbus-libs'],
  },
};

function packWin() {
  return builder.build({
    targets: builder.Platform.WINDOWS.createTarget(),
    config: config,
  });
}

function packMac() {
  let appOutDir;

  return builder.build({
    targets: builder.Platform.MAC.createTarget(),
    config: {
      ...config,
      asarUnpack: ['**/*.node'],
      afterPack: (context) => {
        appOutDir = context.appOutDir;
        return Promise.resolve();
      },
      afterAllArtifactBuild: async (buildResult) => {
        if (!noAppleNotarization) {
          await notarizeMac(buildResult.artifactPaths[0]);
        }
        // remove the folder that contains the unpacked app
        return fs.promises.rmdir(appOutDir, { recursive: true });
      },
      afterSign: noAppleNotarization
        ? undefined
        : (context) => {
            const appOutDir = context.appOutDir;
            const appName = context.packager.appInfo.productFilename;
            return notarizeMac(path.join(appOutDir, `${appName}.app`));
          },
    },
  });
}

function notarizeMac(notarizePath) {
  console.log('Notarizing ' + notarizePath);
  return notarize({
    appBundleId: config.appId,
    appPath: notarizePath,
    appleId: process.env.NOTARIZE_APPLE_ID,
    appleIdPassword: process.env.NOTARIZE_APPLE_ID_PASSWORD,
  });
}

function packLinux() {
  return builder.build({
    targets: builder.Platform.LINUX.createTarget(),
    config: {
      ...config,
      afterPack: async (context) => {
        const sourceExecutable = path.join(context.appOutDir, 'mullvad-vpn');
        const targetExecutable = path.join(context.appOutDir, 'mullvad-gui');
        const launcherScript = path.join(context.appOutDir, 'mullvad-gui-launcher.sh');

        // rename mullvad-vpn to mullvad-gui
        await fs.promises.rename(sourceExecutable, targetExecutable);
        // rename launcher script to mullvad-vpn
        await fs.promises.rename(launcherScript, sourceExecutable);
      },
    },
  });
}

function distAssets(relativePath) {
  return path.join(path.resolve(__dirname, '../../dist-assets'), relativePath);
}

function root(relativePath) {
  return path.join(path.resolve(__dirname, '../../'), relativePath);
}

// Replace '-' between components with a tilde to make the version comparison understand that
// YYYY.NN > YYYY.NN-betaN > YYYY.NN-betaN-dev-HHHHHH.
function getDebVersion() {
  const { major, minor, prerelease } = parseSemver(version);
  const versionParts = [`${major}.${minor}`];
  if (prerelease[0]) {
    // Replace first '-' with a '~' since the first one is the one between 'betaN' and 'dev-hash'.
    versionParts.push(prerelease[0].replace('-', '~'));
  }
  return versionParts.join('~');
}

packWin.displayName = 'builder-win';
packMac.displayName = 'builder-mac';
packLinux.displayName = 'builder-linux';

exports.packWin = packWin;
exports.packMac = packMac;
exports.packLinux = packLinux;
