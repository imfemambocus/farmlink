const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidFixes(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidDir = path.join(projectRoot, 'android');
            const appDir = path.join(androidDir, 'app');

            const settingsGradlePath = path.join(androidDir, 'settings.gradle');
            const mainManifestPath = path.join(appDir, 'src/main/AndroidManifest.xml');
            const debugManifestPath = path.join(appDir, 'src/debug/AndroidManifest.xml');
            const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
            const appBuildGradlePath = path.join(appDir, 'build.gradle');

            const debugManifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <application
        android:name=".MainApplication"
        android:allowBackup="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        tools:replace="android:appComponentFactory,android:allowBackup"
        android:appComponentFactory="androidx.core.app.CoreComponentFactory"
        tools:targetApi="28"
        tools:ignore="GoogleAppIndexingWarning" />
</manifest>`;

            const log = (msg) => console.log(`🔧 [with-android-fixes] ${msg}`);

            const removeVoiceAutolink = () => {
                if (fs.existsSync(settingsGradlePath)) {
                    let content = fs.readFileSync(settingsGradlePath, 'utf8');
                    const original = content;
                    content = content.replace(/include\s+['"]:@react-native-voice\/voice['"].*?\n/g, '');
                    content = content.replace(/project\(['"]:@react-native-voice\/voice['"]\)\.projectDir\s*=.*?\n/g, '');
                    if (content !== original) {
                        fs.writeFileSync(settingsGradlePath, content);
                        log('Removed @react-native-voice/voice from settings.gradle');
                    } else {
                        log('No @react-native-voice/voice found in settings.gradle');
                    }
                }
            };

            const fixMainManifest = () => {
                if (fs.existsSync(mainManifestPath)) {
                    let content = fs.readFileSync(mainManifestPath, 'utf8');
                    if (!content.includes('tools:replace')) {
                        content = content.replace(
                            /<application([^>]*)>/,
                            (match, attributes) => {
                                const updatedAttributes = attributes.replace(
                                    /android:appComponentFactory="androidx\.core\.app\.CoreComponentFactory"/,
                                    'tools:replace="android:appComponentFactory,android:allowBackup"\n        android:appComponentFactory="androidx.core.app.CoreComponentFactory"'
                                );
                                return `<application${updatedAttributes}>`;
                            }
                        );
                        fs.writeFileSync(mainManifestPath, content);
                        log('Fixed main AndroidManifest.xml');
                    } else {
                        log('tools:replace already present in AndroidManifest.xml');
                    }
                }
            };

            const fixGradleProperties = () => {
                if (fs.existsSync(gradlePropertiesPath)) {
                    let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
                    if (!content.includes('android.enableJetifier=true')) {
                        content += '\n# Force AndroidX compatibility\nandroid.enableJetifier=true\n';
                        fs.writeFileSync(gradlePropertiesPath, content);
                        log('Added android.enableJetifier=true to gradle.properties');
                    } else {
                        log('Jetifier already enabled');
                    }
                }
            };

            const fixAppBuildGradle = () => {
                if (!fs.existsSync(appBuildGradlePath)) {
                    log('build.gradle not found');
                    return;
                }

                let content = fs.readFileSync(appBuildGradlePath, 'utf8');
                let modified = false;

                if (!content.includes('configurations.all')) {
                    const configurationsBlock = `
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        eachDependency { details ->
            if (details.requested.group == 'com.android.support') {
                details.useTarget group: 'androidx.legacy', name: 'legacy-support-v4', version: '1.0.0'
            }
        }
    }
}

`;
                    content = content.replace(/(\s*)(android\s*\{)/, `$1${configurationsBlock}$1$2`);
                    modified = true;
                    log('Inserted configurations.all block');
                }

                if (!content.includes("implementation 'androidx.core:core:1.13.1'")) {
                    const match = content.match(/(dependencies\s*\{\s*)/);
                    if (match) {
                        const insertPoint = match.index + match[0].length;
                        content = content.slice(0, insertPoint) + "    implementation 'androidx.core:core:1.13.1'\n" + content.slice(insertPoint);
                        modified = true;
                        log('Added androidx.core:core dependency');
                    }
                }

                if (modified) {
                    fs.writeFileSync(appBuildGradlePath, content);
                    log('Saved modified build.gradle');
                } else {
                    log('No changes needed in build.gradle');
                }
            };

            const createDebugManifest = () => {
                const debugDir = path.dirname(debugManifestPath);
                if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

                if (!fs.existsSync(debugManifestPath)) {
                    fs.writeFileSync(debugManifestPath, debugManifestContent);
                    log('Created debug AndroidManifest.xml');
                } else {
                    log('Debug AndroidManifest.xml already exists');
                }
            };

            // Run all fixers
            try {
                if (fs.existsSync(androidDir)) {
                    removeVoiceAutolink();
                    fixMainManifest();
                    fixGradleProperties();
                    fixAppBuildGradle();
                    createDebugManifest();
                } else {
                    log('Android directory not found, skipping');
                }
            } catch (err) {
                console.error('❌ Plugin error:', err);
                throw err;
            }

            return config;
        },
    ]);
};
